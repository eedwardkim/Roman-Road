#!/usr/bin/env python3
"""Bi-grammar system-wide keystroke capture (macOS).

Captures keystrokes globally with `pynput`, gates by typing activity, and
streams events to the Bi-grammar WebSocket bridge.

Activation:  recording starts after >= 5s of typing with no inter-key gap > 3s.
End-of-session: 5s of inactivity flushes a `session_end` and resets state.

Privacy: only printable single characters, Space, and Backspace are forwarded.
Modifiers, function keys, arrows, and navigation keys are dropped.

Setup:
    pip3 install -r scripts/requirements.txt
    # Grant Accessibility permission to your terminal in:
    # System Settings -> Privacy & Security -> Accessibility

Run:
    python3 scripts/keymaxx_capture.py [--host 127.0.0.1] [--port 8765]
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
from collections import deque
from dataclasses import dataclass

try:
    import websockets
except ImportError:
    print(
        "[bi-grammar] missing dependency: websockets\n"
        "         pip3 install -r scripts/requirements.txt",
        file=sys.stderr,
    )
    sys.exit(1)

try:
    from pynput import keyboard
except ImportError:
    print(
        "[bi-grammar] missing dependency: pynput\n"
        "         pip3 install -r scripts/requirements.txt",
        file=sys.stderr,
    )
    sys.exit(1)


WARMUP_SECONDS = 5.0       # require this much continuous typing before activating
WARMUP_GAP_SECONDS = 3.0   # any inter-key gap above this resets warmup
INACTIVITY_END_SECONDS = 5.0  # 5s of silence ends an active session
TICK_INTERVAL_SECONDS = 0.25
MIN_SESSION_KEYDOWNS = 20
MIN_SESSION_WORDS = 5


def log(msg: str) -> None:
    print(f"[bi-grammar] {msg}", file=sys.stderr, flush=True)


@dataclass
class KeyEvent:
    key: str           # normalized: single char, " ", or "Backspace"
    event: str         # "keydown" | "keyup"
    ts: float          # epoch ms


def normalize_key(key) -> str | None:
    """Return the normalized key name, or None if it should be dropped.

    Forwarded:
      - single printable chars (key.char)
      - Key.space  -> " "
      - Key.backspace -> "Backspace"
    Everything else (modifiers, fn keys, arrows, etc.) is dropped.
    """
    # pynput sends KeyCode for normal characters
    if isinstance(key, keyboard.KeyCode):
        ch = key.char
        if ch is None:
            return None
        # Only single printable chars
        if len(ch) == 1 and ch.isprintable():
            return ch
        return None
    # Special keys
    if key == keyboard.Key.space:
        return " "
    if key == keyboard.Key.backspace:
        return "Backspace"
    return None


class CaptureState:
    """State machine: IDLE (warming up) <-> ACTIVE (recording)."""

    def __init__(self, send_queue: asyncio.Queue, loop: asyncio.AbstractEventLoop):
        self.queue = send_queue
        self.loop = loop
        self.active = False
        # warmup buffer of (KeyEvent) so we can flush once activated
        self.warmup_buffer: deque[KeyEvent] = deque()
        self.warmup_first_ts: float | None = None
        self.last_keydown_ts: float | None = None
        self.manual_override = False  # When True, bypass warmup and inactivity detection
        self.session_start_ts: float | None = None
        self.session_buffer: deque[KeyEvent] = deque()
        self.session_keydown_count = 0
        self.session_emitted = False

    def _buffered_word_count(self, events: deque[KeyEvent]) -> int:
        chars: list[str] = []

        for ev in events:
            if ev.event != "keydown":
                continue

            if ev.key == "Backspace":
                if chars:
                    chars.pop()
                continue

            chars.append(ev.key)

        return len("".join(chars).split())

    # Called from the pynput thread.
    def on_event(self, ev: KeyEvent) -> None:
        # Schedule onto the asyncio loop; all state mutations happen there.
        asyncio.run_coroutine_threadsafe(self._handle(ev), self.loop)

    async def _handle(self, ev: KeyEvent) -> None:
        now = ev.ts
        if not self.manual_override and not self.active:
            return

        if ev.event == "keydown":
            self.last_keydown_ts = now

        if self.active:
            await self._record_active_event(ev)
            return

        # IDLE: only keydown drives the warmup state machine; keyups are dropped
        # while warming up to keep the warmup buffer small.
        if ev.event != "keydown":
            return

        if self.warmup_first_ts is None:
            self.warmup_first_ts = now
            self.warmup_buffer.clear()

        # If the gap from the previous keydown is too large, restart warmup
        # (the previous keydown is the last one buffered).
        if self.warmup_buffer:
            prev = self.warmup_buffer[-1]
            if (now - prev.ts) > (WARMUP_GAP_SECONDS * 1000):
                self.warmup_first_ts = now
                self.warmup_buffer.clear()

        self.warmup_buffer.append(ev)

        # Activate?
        if self._buffered_word_count(self.warmup_buffer) >= MIN_SESSION_WORDS:
            await self._activate()

    async def _activate(self) -> None:
        self.active = True
        self.session_start_ts = self.warmup_first_ts or self.warmup_buffer[0].ts
        self.session_buffer.clear()
        self.session_keydown_count = 0
        self.session_emitted = False
        for ev in self.warmup_buffer:
            await self._record_active_event(ev)
        self.warmup_buffer.clear()
        self.warmup_first_ts = None

    async def _record_active_event(self, ev: KeyEvent) -> None:
        if ev.event == "keydown":
            self.session_keydown_count += 1

        if self.session_emitted:
            await self.queue.put(ev)
            return

        self.session_buffer.append(ev)
        if self._buffered_word_count(self.session_buffer) >= MIN_SESSION_WORDS:
            await self._emit_session_start()

    async def _emit_session_start(self) -> None:
        if self.session_emitted or self.session_start_ts is None:
            return
        self.session_emitted = True
        log(f"session_start (flushing {len(self.session_buffer)} buffered keystrokes)")
        await self.queue.put({"type": "session_start", "ts": self.session_start_ts})
        for ev in self.session_buffer:
            await self.queue.put(ev)
        self.session_buffer.clear()

    async def _finish_session(self, end_ts: float, reason: str) -> None:
        if self.session_emitted:
            log(f"session_end ({reason})")
            await self.queue.put({"type": "session_end", "ts": end_ts})

        if self.manual_override:
            self.active = False
            self.warmup_buffer.clear()
            self.warmup_first_ts = None
            self.session_start_ts = None
            self.session_buffer.clear()
            self.session_keydown_count = 0
            self.session_emitted = False
            return

        self._reset_session()

    def _reset_session(self) -> None:
        self.active = False
        self.manual_override = False
        self.warmup_buffer.clear()
        self.warmup_first_ts = None
        self.session_start_ts = None
        self.session_buffer.clear()
        self.session_keydown_count = 0
        self.session_emitted = False

    async def manual_start(self) -> None:
        """Manually start recording immediately, bypassing warmup."""
        if self.active or self.manual_override:
            return
        self.manual_override = True
        self.active = False
        self.session_start_ts = None
        self.session_buffer.clear()
        self.session_keydown_count = 0
        self.session_emitted = False
        self.warmup_buffer.clear()
        self.warmup_first_ts = None

    async def manual_stop(self) -> None:
        """Manually stop recording."""
        if not self.active and not self.manual_override:
            return
        if self.active:
            end_ts = time.time() * 1000
            self.manual_override = False
            await self._finish_session(end_ts, "manual stop")
            return

        self._reset_session()

    async def tick(self) -> None:
        """Periodic timer: detect inactivity and emit session_end."""
        if not self.active:
            return
        if self.last_keydown_ts is None:
            return
        now_ms = time.time() * 1000
        if (now_ms - self.last_keydown_ts) >= (INACTIVITY_END_SECONDS * 1000):
            await self._finish_session(now_ms, "5s inactivity")
            # Keep last_keydown_ts so the next keypress restarts warmup naturally.


def make_listener(state: CaptureState) -> keyboard.Listener:
    def on_press(key):
        name = normalize_key(key)
        if name is None:
            return
        state.on_event(KeyEvent(key=name, event="keydown", ts=time.time() * 1000))

    def on_release(key):
        name = normalize_key(key)
        if name is None:
            return
        state.on_event(KeyEvent(key=name, event="keyup", ts=time.time() * 1000))

    return keyboard.Listener(on_press=on_press, on_release=on_release)


def serialize(item) -> str:
    if isinstance(item, KeyEvent):
        return json.dumps({
            "type": "keystroke",
            "key": item.key,
            "event": item.event,
            "ts": item.ts,
        })
    return json.dumps(item)


async def run(host: str, port: int) -> None:
    url = f"ws://{host}:{port}"
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue = asyncio.Queue()
    state = CaptureState(queue, loop)
    listener = make_listener(state)
    listener.start()
    log(f"pynput listener started; connecting to {url}")

    backoff = 0.5
    while True:
        try:
            async with websockets.connect(url, ping_interval=20) as ws:
                log("connected")
                backoff = 0.5
                await ws.send(json.dumps({"type": "hello", "role": "producer"}))

                async def ticker():
                    while True:
                        await asyncio.sleep(TICK_INTERVAL_SECONDS)
                        await state.tick()

                ticker_task = asyncio.create_task(ticker())
                get_task = asyncio.create_task(queue.get())
                recv_task = asyncio.create_task(ws.recv())
                try:
                    while True:
                        done, _pending = await asyncio.wait(
                            [get_task, recv_task],
                            return_when=asyncio.FIRST_COMPLETED,
                        )

                        if get_task in done:
                            item = get_task.result()
                            await ws.send(serialize(item))
                            get_task = asyncio.create_task(queue.get())

                        if recv_task in done:
                            raw = recv_task.result()
                            try:
                                msg = json.loads(raw)
                            except (json.JSONDecodeError, TypeError):
                                msg = None
                            if isinstance(msg, dict):
                                if msg.get("type") == "start_recording":
                                    await state.manual_start()
                                elif msg.get("type") == "stop_recording":
                                    await state.manual_stop()
                            recv_task = asyncio.create_task(ws.recv())
                finally:
                    ticker_task.cancel()
                    get_task.cancel()
                    recv_task.cancel()
        except (OSError, websockets.WebSocketException) as e:
            log(f"disconnected: {e}; retrying in {backoff:.1f}s")
            # Drop in-flight buffered events so we don't ship stale data.
            state._reset_session()
            try:
                while True:
                    queue.get_nowait()
            except asyncio.QueueEmpty:
                pass
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 5.0)


def main() -> None:
    parser = argparse.ArgumentParser(description="Bi-grammar system-wide capture")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()

    try:
        asyncio.run(run(args.host, args.port))
    except KeyboardInterrupt:
        log("exiting")


if __name__ == "__main__":
    main()
