/**
 * KeyMaxx WebSocket Bridge
 *
 * Standalone Node WebSocket broadcaster. Two roles:
 *   - producer:  sends keystroke / session lifecycle messages (e.g. Python script)
 *   - subscriber: receives broadcast messages (e.g. browser)
 *
 * Localhost only, no auth. Run via `npm run ws-bridge`.
 */
const { WebSocketServer } = require("ws");

const PORT = Number(process.env.KEYMAXX_WS_PORT || 8765);
const HOST = process.env.KEYMAXX_WS_HOST || "127.0.0.1";

const wss = new WebSocketServer({ port: PORT, host: HOST });

const producers = new Set();
const subscribers = new Set();

function log(...args) {
  // eslint-disable-next-line no-console
  console.log("[ws-bridge]", ...args);
}

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) {
    try { ws.send(JSON.stringify(msg)); } catch { /* ignore */ }
  }
}

function broadcastProducerStatus() {
  const payload = { type: "producer_status", connected: producers.size > 0 };
  for (const sub of subscribers) send(sub, payload);
}

wss.on("listening", () => {
  log(`listening on ws://${HOST}:${PORT}`);
});

wss.on("connection", (ws, req) => {
  let role = null;
  log("connection from", req.socket.remoteAddress);

  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    if (msg && msg.type === "hello" && (msg.role === "producer" || msg.role === "subscriber")) {
      role = msg.role;
      if (role === "producer") {
        for (const producer of producers) {
          try { producer.close(1000, "Replaced by a newer producer"); } catch { /* ignore */ }
        }
        producers.clear();
        producers.add(ws);
      } else subscribers.add(ws);
      log(`hello -> ${role} (producers=${producers.size}, subscribers=${subscribers.size})`);
      if (role === "subscriber") send(ws, { type: "producer_status", connected: producers.size > 0 });
      else broadcastProducerStatus();
      return;
    }

    // Only producers may broadcast keystroke/session data.
    if (role !== "producer") {
      // Subscribers can send control commands to producers
      if (role === "subscriber" && msg && (msg.type === "start_recording" || msg.type === "stop_recording")) {
        if (producers.size === 0) {
          send(ws, {
            type: "control_ack",
            command: msg.type,
            ok: false,
            error: "No system capture process is connected.",
          });
          return;
        }
        const payload = data.toString();
        for (const prod of producers) {
          if (prod.readyState === prod.OPEN) {
            try { prod.send(payload); } catch { /* ignore */ }
          }
        }
        send(ws, { type: "control_ack", command: msg.type, ok: true });
      }
      return;
    }

    const payload = data.toString();
    for (const sub of subscribers) {
      if (sub.readyState === sub.OPEN) {
        try { sub.send(payload); } catch { /* ignore */ }
      }
    }
  });

  ws.on("close", () => {
    if (role === "producer") {
      producers.delete(ws);
      broadcastProducerStatus();
    } else if (role === "subscriber") subscribers.delete(ws);
    log(`close ${role || "unknown"} (producers=${producers.size}, subscribers=${subscribers.size})`);
  });

  ws.on("error", (err) => {
    log("socket error:", err.message);
  });
});

process.on("SIGINT", () => {
  log("shutting down");
  wss.close(() => process.exit(0));
});
