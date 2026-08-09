import WebSocket from "ws";

const apiKey = process.env.MASSIVE_API_KEY;

if (!apiKey) {
  console.error("Missing MASSIVE_API_KEY.");
  console.error("Run: source .env.local");
  process.exit(1);
}

const socket = new WebSocket("wss://socket.massive.com/stocks");

socket.on("open", () => {
  console.log("Connected to Massive stocks WebSocket.");
});

socket.on("message", (buffer) => {
  const message = JSON.parse(buffer.toString());

  console.log(JSON.stringify(message, null, 2));

  for (const event of message) {
    if (event.ev === "status" && event.status === "connected") {
      socket.send(
        JSON.stringify({
          action: "auth",
          params: apiKey,
        }),
      );
    }

    if (event.ev === "status" && event.status === "auth_success") {
      console.log("Authenticated. Subscribing to AAPL...");

      socket.send(
        JSON.stringify({
          action: "subscribe",
          params: "AM.AAPL,Q.AAPL,T.AAPL",
        }),
      );
    }
  }
});

socket.on("error", (error) => {
  console.error("WebSocket error:", error.message);
});

socket.on("close", (code, reason) => {
  console.log(
    `WebSocket closed: ${code} ${reason.toString()}`,
  );
});

process.on("SIGINT", () => {
  console.log("\nClosing connection...");
  socket.close();
  process.exit(0);
});
