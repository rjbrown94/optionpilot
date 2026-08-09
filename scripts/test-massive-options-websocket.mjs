import WebSocket from "ws";

const apiKey = process.env.MASSIVE_API_KEY;

if (!apiKey) {
  console.error("Missing MASSIVE_API_KEY.");
  process.exit(1);
}

const socket = new WebSocket("wss://socket.massive.com/options");

socket.on("open", () => {
  console.log("Connected to Massive options WebSocket.");
});

socket.on("message", (buffer) => {
  let events;

  try {
    events = JSON.parse(buffer.toString());
  } catch {
    console.log(buffer.toString());
    return;
  }

  console.log(JSON.stringify(events, null, 2));

  for (const event of events) {
    if (event.ev === "status" && event.status === "connected") {
      socket.send(
        JSON.stringify({
          action: "auth",
          params: apiKey,
        }),
      );
    }

    if (event.ev === "status" && event.status === "auth_success") {
      console.log("Authenticated. Subscribing to option trades...");

      socket.send(
        JSON.stringify({
          action: "subscribe",
          params: "T.*",
        }),
      );
    }

    if (event.ev === "status" && event.status === "auth_failed") {
      console.error("Authentication failed:", event.message);
    }
  }
});

socket.on("error", (error) => {
  console.error("WebSocket error:", error.message);
});

socket.on("close", (code, reason) => {
  console.log(`WebSocket closed: ${code} ${reason.toString()}`);
});

process.on("SIGINT", () => {
  console.log("\nClosing connection...");
  socket.close();
  process.exit(0);
});
