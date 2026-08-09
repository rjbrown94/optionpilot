import WebSocket from "ws";
import { EventEmitter } from "events";

export type OptionTradeUpdate = {
  event: "trade";
  ticker: string;
  price: number;
  size: number;
  exchange: number | null;
  timestamp: number;
};

export type OptionQuoteUpdate = {
  event: "quote";
  ticker: string;
  bidPrice: number;
  bidSize: number;
  askPrice: number;
  askSize: number;
  timestamp: number;
};

export type OptionMinuteUpdate = {
  event: "minute";
  ticker: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
};

export type OptionStreamUpdate =
  | OptionTradeUpdate
  | OptionQuoteUpdate
  | OptionMinuteUpdate;

type MassiveStatusEvent = {
  ev: "status";
  status: string;
  message?: string;
};

type MassiveTradeEvent = {
  ev: "T";
  sym?: string;
  p?: number;
  s?: number;
  x?: number;
  t?: number;
};

type MassiveQuoteEvent = {
  ev: "Q";
  sym?: string;
  bp?: number;
  bs?: number;
  ap?: number;
  as?: number;
  t?: number;
};

type MassiveMinuteEvent = {
  ev: "AM";
  sym?: string;
  o?: number;
  h?: number;
  l?: number;
  c?: number;
  v?: number;
  e?: number;
};

type MassiveEvent =
  | MassiveStatusEvent
  | MassiveTradeEvent
  | MassiveQuoteEvent
  | MassiveMinuteEvent;

const OPTIONS_SOCKET_URL = "wss://socket.massive.com/options";
const RECONNECT_DELAY_MS = 3_000;

function normalizeContract(contract: string): string {
  return contract.trim().toUpperCase();
}

class OptionsWebSocketService {
  private socket: WebSocket | null = null;

  private emitter = new EventEmitter();

  private subscriptions = new Set<string>();

  private reconnectTimer: NodeJS.Timeout | null = null;

  private authenticated = false;

  private shouldReconnect = true;

  /*
   * Diagnostics only.
   * These counters let us verify that trades are actually
   * arriving without flooding the terminal with thousands
   * of messages.
   */
  private tradeEventCount = 0;

  private quoteEventCount = 0;

  private minuteEventCount = 0;

  connect(): void {
    if (
      this.socket?.readyState === WebSocket.OPEN ||
      this.socket?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    const apiKey = process.env.MASSIVE_API_KEY;

    if (!apiKey) {
      throw new Error(
        "MASSIVE_API_KEY is missing from .env.local.",
      );
    }

    this.shouldReconnect = true;
    this.authenticated = false;

    console.log(
      `[Options WS] Connecting to ${OPTIONS_SOCKET_URL}`,
    );

    this.socket = new WebSocket(OPTIONS_SOCKET_URL);

    this.socket.on("open", () => {
      console.log("[Options WS] Connected");
    });

    this.socket.on("message", (buffer) => {
      this.handleMessage(buffer.toString(), apiKey);
    });

    this.socket.on("error", (error) => {
      console.error(
        "[Options WS] Error:",
        error.message,
      );

      this.emitter.emit("error", error);
    });

    this.socket.on("close", (code, reason) => {
      console.log(
        `[Options WS] Closed: ${code} ${reason.toString()}`,
      );

      this.authenticated = false;
      this.socket = null;

      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    });
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.authenticated = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.socket?.close();
    this.socket = null;
  }

  subscribe(contract: string): void {
    const cleanContract =
      normalizeContract(contract);

    if (!cleanContract) {
      return;
    }

    this.subscriptions.add(cleanContract);

    this.connect();

    if (this.authenticated) {
      this.sendSubscription(
        "subscribe",
        cleanContract,
      );
    }
  }

  unsubscribe(contract: string): void {
    const cleanContract =
      normalizeContract(contract);

    if (!cleanContract) {
      return;
    }

    this.subscriptions.delete(cleanContract);

    if (this.authenticated) {
      this.sendSubscription(
        "unsubscribe",
        cleanContract,
      );
    }
  }

  subscribeToAllTrades(): void {
    this.subscriptions.add("*");

    console.log(
      "[Options WS] Requested all option trades: T.*",
    );

    this.connect();

    if (this.authenticated) {
      this.send({
        action: "subscribe",
        params: "T.*",
      });
    }
  }

  onUpdate(
    listener: (update: OptionStreamUpdate) => void,
  ): () => void {
    this.emitter.on("update", listener);

    return () => {
      this.emitter.off("update", listener);
    };
  }

  onStatus(
    listener: (status: MassiveStatusEvent) => void,
  ): () => void {
    this.emitter.on("status", listener);

    return () => {
      this.emitter.off("status", listener);
    };
  }

  private handleMessage(
    rawMessage: string,
    apiKey: string,
  ): void {
    let events: MassiveEvent[];

    try {
      const parsed = JSON.parse(rawMessage);

      events = Array.isArray(parsed)
        ? parsed
        : [parsed];
    } catch {
      console.error(
        "[Options WS] Invalid JSON:",
        rawMessage,
      );

      return;
    }

    for (const event of events) {
      if (event.ev === "status") {
        console.log(
          "[Options WS] STATUS:",
          event.status,
          event.message || "",
        );

        this.handleStatus(event, apiKey);

        continue;
      }

      const update = this.normalizeUpdate(event);

      if (update) {
        this.emitter.emit("update", update);
      } else {
        /*
         * If Massive sends an event type we do not recognize,
         * print it so we can immediately see a provider format
         * change.
         */
        console.log(
          "[Options WS] Unrecognized event:",
          event,
        );
      }
    }
  }

  private handleStatus(
    event: MassiveStatusEvent,
    apiKey: string,
  ): void {
    this.emitter.emit("status", event);

    if (event.status === "connected") {
      console.log(
        "[Options WS] Sending authentication request",
      );

      this.send({
        action: "auth",
        params: apiKey,
      });

      return;
    }

    if (event.status === "auth_success") {
      this.authenticated = true;

      console.log(
        "[Options WS] Authenticated",
      );

      console.log(
        `[Options WS] Restoring ${this.subscriptions.size} subscription(s)`,
      );

      this.restoreSubscriptions();

      return;
    }

    if (event.status === "auth_failed") {
      this.authenticated = false;
      this.shouldReconnect = false;

      console.error(
        "[Options WS] Authentication failed:",
        event.message,
      );
    }
  }

  private restoreSubscriptions(): void {
    for (const contract of this.subscriptions) {
      if (contract === "*") {
        console.log(
          "[Options WS] Restoring all trades subscription: T.*",
        );

        this.send({
          action: "subscribe",
          params: "T.*",
        });

        continue;
      }

      this.sendSubscription(
        "subscribe",
        contract,
      );
    }
  }

  private sendSubscription(
    action: "subscribe" | "unsubscribe",
    contract: string,
  ): void {
    const params = [
      `T.${contract}`,
      `Q.${contract}`,
      `AM.${contract}`,
    ].join(",");

    this.send({
      action,
      params,
    });
  }

  private send(payload: {
    action: string;
    params: string;
  }): void {
    if (
      this.socket?.readyState !== WebSocket.OPEN
    ) {
      console.log(
        `[Options WS] SEND skipped because socket is not open: ${payload.action}`,
      );

      return;
    }

    /*
     * Never print the API key.
     */
    if (payload.action === "auth") {
      console.log(
        "[Options WS] SEND auth [API KEY REDACTED]",
      );
    } else {
      console.log(
        `[Options WS] SEND ${payload.action} ${payload.params}`,
      );
    }

    this.socket.send(
      JSON.stringify(payload),
    );
  }

  private normalizeUpdate(
    event:
      | MassiveTradeEvent
      | MassiveQuoteEvent
      | MassiveMinuteEvent,
  ): OptionStreamUpdate | null {
    if (event.ev === "T" && event.sym) {
      this.tradeEventCount += 1;

      /*
       * Print the first 10 trades, then every 100th.
       * This proves the feed is working without flooding
       * your terminal.
       */
      if (
        this.tradeEventCount <= 10 ||
        this.tradeEventCount % 100 === 0
      ) {
        console.log(
          `[Options WS] TRADE #${this.tradeEventCount}`,
          event.sym,
          `price=${Number(event.p ?? 0)}`,
          `size=${Number(event.s ?? 0)}`,
        );
      }

      return {
        event: "trade",
        ticker: event.sym,
        price: Number(event.p ?? 0),
        size: Number(event.s ?? 0),
        exchange:
          typeof event.x === "number"
            ? event.x
            : null,
        timestamp: Number(
          event.t ?? Date.now(),
        ),
      };
    }

    if (event.ev === "Q" && event.sym) {
      this.quoteEventCount += 1;

      if (
        this.quoteEventCount === 1 ||
        this.quoteEventCount % 1000 === 0
      ) {
        console.log(
          `[Options WS] QUOTE count=${this.quoteEventCount}`,
        );
      }

      return {
        event: "quote",
        ticker: event.sym,
        bidPrice: Number(event.bp ?? 0),
        bidSize: Number(event.bs ?? 0),
        askPrice: Number(event.ap ?? 0),
        askSize: Number(event.as ?? 0),
        timestamp: Number(
          event.t ?? Date.now(),
        ),
      };
    }

    if (event.ev === "AM" && event.sym) {
      this.minuteEventCount += 1;

      if (
        this.minuteEventCount === 1 ||
        this.minuteEventCount % 100 === 0
      ) {
        console.log(
          `[Options WS] MINUTE count=${this.minuteEventCount}`,
        );
      }

      return {
        event: "minute",
        ticker: event.sym,
        open: Number(event.o ?? 0),
        high: Number(event.h ?? 0),
        low: Number(event.l ?? 0),
        close: Number(event.c ?? 0),
        volume: Number(event.v ?? 0),
        timestamp: Number(
          event.e ?? Date.now(),
        ),
      };
    }

    return null;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    console.log(
      `[Options WS] Reconnecting in ${RECONNECT_DELAY_MS}ms`,
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, RECONNECT_DELAY_MS);
  }
}

declare global {
  var optionPilotOptionsWebSocket:
    | OptionsWebSocketService
    | undefined;
}

export const optionsWebSocket =
  global.optionPilotOptionsWebSocket ??
  new OptionsWebSocketService();

if (process.env.NODE_ENV !== "production") {
  global.optionPilotOptionsWebSocket =
    optionsWebSocket;
}
