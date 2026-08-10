import {
  optionsWebSocket,
  type OptionStreamUpdate,
  type OptionTradeUpdate,
} from "@/libs/options/optionsWebSocket";

import {
  institutionalTradeClassifier,
  type ClassifiedOptionTrade,
} from "@/libs/options/institutionalTradeClassifier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type SmartMoneyTrade = ClassifiedOptionTrade & {
  id: string;
  contractSymbol: string;
  underlying: string;
  direction: "CALLS" | "PUTS";
  strike: number | null;
  expiration: string | null;
};

const MINIMUM_PREMIUM = 10_000;
const MAX_QUOTE_SUBSCRIPTIONS = 250;

/*
 * Vercel Hobby functions have a 300-second maximum duration.
 * We intentionally close the stream at 4m30s so the browser
 * can start a fresh connection before Vercel kills the function.
 */
const STREAM_ROLLOVER_MS = 270_000;

const trackedContracts = new Set<string>();
const trackedContractOrder: string[] = [];

function createEvent(name: string, data: unknown): string {
  return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
}

function parseOptionContract(contract: string): {
  underlying: string;
  direction: "CALLS" | "PUTS" | null;
  strike: number | null;
  expiration: string | null;
} {
  const normalized = contract.trim().toUpperCase().replace(/^O:/, "");

  const match = normalized.match(
    /^([A-Z.]+)(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/,
  );

  if (!match) {
    return {
      underlying: normalized,
      direction: null,
      strike: null,
      expiration: null,
    };
  }

  const [, underlying, year, month, day, optionType, strikeRaw] = match;

  return {
    underlying,
    direction: optionType === "C" ? "CALLS" : "PUTS",
    strike: Number(strikeRaw) / 1000,
    expiration: `20${year}-${month}-${day}`,
  };
}

function trackContract(contract: string): void {
  if (trackedContracts.has(contract)) {
    return;
  }

  trackedContracts.add(contract);
  trackedContractOrder.push(contract);

  optionsWebSocket.subscribe(contract);

  while (trackedContractOrder.length > MAX_QUOTE_SUBSCRIPTIONS) {
    const oldest = trackedContractOrder.shift();

    if (!oldest) {
      break;
    }

    trackedContracts.delete(oldest);
    optionsWebSocket.unsubscribe(oldest);
  }
}

function normalizeTrade(update: OptionTradeUpdate): SmartMoneyTrade | null {
  const parsed = parseOptionContract(update.ticker);

  if (
    !parsed.direction ||
    !Number.isFinite(update.price) ||
    !Number.isFinite(update.size) ||
    update.price <= 0 ||
    update.size <= 0
  ) {
    return null;
  }

  /*
   * Track the contract so we can receive quote information
   * used by the institutional trade classifier.
   */
  trackContract(update.ticker);

  const classified = institutionalTradeClassifier.classify(update);

  if (classified.premium < MINIMUM_PREMIUM) {
    return null;
  }

  return {
    ...classified,

    id: [update.ticker, update.timestamp, update.price, update.size].join(":"),

    contractSymbol: update.ticker,

    underlying: parsed.underlying,

    direction: parsed.direction,

    strike: parsed.strike,

    expiration: parsed.expiration,
  };
}

export async function GET(request: Request) {
  const encoder = new TextEncoder();

  let closed = false;

  let removeUpdateListener: (() => void) | null = null;

  let removeStatusListener: (() => void) | null = null;

  let heartbeat: NodeJS.Timeout | null = null;

  let rolloverTimer: NodeJS.Timeout | null = null;

  function cleanup(): void {
    if (closed) {
      return;
    }

    closed = true;

    if (heartbeat) {
      clearInterval(heartbeat);
      heartbeat = null;
    }

    if (rolloverTimer) {
      clearTimeout(rolloverTimer);
      rolloverTimer = null;
    }

    removeUpdateListener?.();
    removeStatusListener?.();

    removeUpdateListener = null;
    removeStatusListener = null;

    /*
     * Important for Massive:
     * release the old WebSocket before the browser
     * creates the next Vercel stream.
     */
    optionsWebSocket.disconnect();
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      function send(name: string, data: unknown): void {
        if (closed) {
          return;
        }

        try {
          controller.enqueue(encoder.encode(createEvent(name, data)));
        } catch {
          cleanup();
        }
      }

      /*
       * Tell the page that the SSE route itself
       * has started.
       */
      send("ready", {
        status: "connecting",
        timestamp: Date.now(),
      });

      removeUpdateListener = optionsWebSocket.onUpdate(
        (update: OptionStreamUpdate) => {
          if (update.event === "quote") {
            institutionalTradeClassifier.recordQuote(update);

            return;
          }

          if (update.event !== "trade") {
            return;
          }

          const trade = normalizeTrade(update);

          if (trade) {
            send("trade", trade);
          }
        },
      );

      removeStatusListener = optionsWebSocket.onStatus((status) => {
        send("status", status);

        if (status.status === "auth_success") {
          send("ready", {
            status: "connected",
            timestamp: Date.now(),
          });
        }

        if (status.status === "auth_failed") {
          send("stream-error", {
            message:
              status.message ||
              "Massive options WebSocket authentication failed.",
          });
        }
      });

      /*
       * Start Massive's market-wide
       * option trade stream.
       */
      optionsWebSocket.subscribeToAllTrades();

      /*
       * Keep the SSE response active
       * through proxies and Vercel.
       */
      heartbeat = setInterval(() => {
        send("heartbeat", {
          timestamp: Date.now(),
        });
      }, 20_000);

      /*
       * Gracefully roll the function over
       * BEFORE Vercel reaches the 300s limit.
       */
      rolloverTimer = setTimeout(() => {
        if (closed) {
          return;
        }

        /*
         * Tell the browser to create a fresh
         * EventSource connection.
         */
        send("reconnect", {
          reason: "scheduled-rollover",
          timestamp: Date.now(),
        });

        /*
         * Release the Massive WebSocket
         * and listeners first.
         */
        cleanup();

        /*
         * Then finish this SSE response normally
         * instead of letting Vercel kill it.
         */
        try {
          controller.close();
        } catch {
          // Browser may have already closed.
        }
      }, STREAM_ROLLOVER_MS);
    },

    cancel() {
      cleanup();
    },
  });

  request.signal.addEventListener("abort", cleanup, {
    once: true,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",

      "Cache-Control": "no-cache, no-transform",

      Connection: "keep-alive",

      "X-Accel-Buffering": "no",
    },
  });
}
