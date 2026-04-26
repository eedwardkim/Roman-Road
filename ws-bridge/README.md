# Bi-grammar WebSocket Bridge

Tiny Node WS broadcaster that connects the system-wide keystroke producer
(`scripts/keymaxx_capture.py`) to the Bi-grammar browser UI.

```
[Python pynput] --ws--> [this bridge :8765] --ws--> [Browser (Next.js)]
```

Run it:

```bash
npm run ws-bridge
```

Env: `PORT` (default `8765`), `HOST` (default `127.0.0.1`).

The bridge is intentionally dumb — no auth, no persistence, localhost only.
Producers send JSON messages; the bridge forwards them to all subscribers.
