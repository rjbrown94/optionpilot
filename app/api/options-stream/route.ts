import { optionsWebSocket } from "@/libs/options/optionsWebSocket";
import type { OptionStreamUpdate } from "@/libs/options/optionsWebSocket";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeContract(value: string | null): string {
  return (value || "").trim().toUpperCase();
}

function createEvent(name: string, data: unknown): string {
  return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const contract = normalizeContract(searchParams.get("contract"));

  if (!contract) {
    return Response.json(
      {
        error: "Missing option contract ticker.",
      },
      {
        status: 400,
      },
    );
  }

  const encoder = new TextEncoder();

  let removeUpdateListener: (() => void) | null = null;
  let removeStatusListener: (() => void) | null = null;
  let heartbeat: NodeJS.Timeout | null = null;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      function send(name: string, data: unknown) {
        if (closed) {
          return;
        }

        try {
          controller.enqueue(
            encoder.encode(createEvent(name, data)),
          );
        } catch {
          closed = true;
        }
      }

      send("ready", {
        contract,
        status: "connecting",
      });

      removeUpdateListener = optionsWebSocket.onUpdate(
        (update: OptionStreamUpdate) => {
          if (
            update.ticker.trim().toUpperCase() !== contract
          ) {
            return;
          }

          send("update", update);
        },
      );

      removeStatusListener = optionsWebSocket.onStatus(
        (status) => {
          send("status", status);

          if (status.status === "auth_success") {
            send("ready", {
              contract,
              status: "connected",
            });
          }

          if (status.status === "auth_failed") {
            send("stream-error", {
              message:
                status.message ||
                "Options WebSocket authentication failed.",
            });
          }
        },
      );

      optionsWebSocket.subscribe(contract);

      heartbeat = setInterval(() => {
        send("heartbeat", {
          contract,
          timestamp: Date.now(),
        });
      }, 20_000);
    },

    cancel() {
      closed = true;

      if (heartbeat) {
        clearInterval(heartbeat);
      }

      removeUpdateListener?.();
      removeStatusListener?.();

      optionsWebSocket.unsubscribe(contract);
    },
  });

  request.signal.addEventListener("abort", () => {
    closed = true;

    if (heartbeat) {
      clearInterval(heartbeat);
    }

    removeUpdateListener?.();
    removeStatusListener?.();

    optionsWebSocket.unsubscribe(contract);
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
