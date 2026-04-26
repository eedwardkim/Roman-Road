"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { KeystrokeEvent } from "@/types/typing";
import {
  computeBigramLatencies,
  aggregateBigramStats,
} from "@/lib/bigram";
import {
  extractLetterStats,
  extractWordStats,
  reconstructTypedText,
  normalizeLatencyScore,
} from "@/lib/stats";
import { getSessionContext } from "@/lib/session-context";
import { getLocalUserId } from "@/lib/db/local-storage";

const DEFAULT_URL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_KEYMAXX_WS_URL) ||
  "ws://127.0.0.1:8765";
const MIN_SYSTEM_WIDE_SESSION_KEYDOWNS = 20;

interface KeystrokeMessage {
  type: "keystroke";
  key: string;
  event: "keydown" | "keyup";
  ts: number;
}

interface SessionStartMessage {
  type: "session_start";
  ts: number;
}

interface SessionEndMessage {
  type: "session_end";
  ts: number;
}

interface ProducerStatusMessage {
  type: "producer_status";
  connected: boolean;
}

interface ControlAckMessage {
  type: "control_ack";
  command: "start_recording" | "stop_recording";
  ok: boolean;
  error?: string;
}

type CaptureStatus = "disconnected" | "starting" | "ready" | "recording" | "error";

type BridgeMessage =
  | KeystrokeMessage
  | SessionStartMessage
  | SessionEndMessage
  | ProducerStatusMessage
  | ControlAckMessage;

export interface SystemWideCaptureState {
  isRecording: boolean;
  keystrokeCount: number;
  isConnected: boolean;
  isCaptureReady: boolean;
  captureStatus: CaptureStatus;
  captureError: string | null;
  /** Live reconstructed text from system-wide keystrokes */
  typedText: string;
  /** Raw keystrokes from the current session (session-relative timestamps) */
  keystrokes: KeystrokeEvent[];
  /** Session start timestamp (wall clock ms) or null if not recording */
  sessionStartTime: number | null;
  /** Manually start recording */
  startRecording: () => void;
  /** Manually stop recording */
  stopRecording: () => void;
}

interface SystemWideCaptureOptions {
  url?: string;
  enabled?: boolean;
  autoStart?: boolean;
}

/**
 * Subscribes to the Bi-grammar WS bridge and pipes system-wide keystrokes
 * into the existing analysis + persistence pipeline. The on-page TypingTest
 * is unaffected.
 *
 * Lifecycle:
 *   - `session_start` -> reset buffer, set isRecording = true.
 *   - `keystroke`     -> append (with timestamps re-based to session start).
 *   - `session_end`   -> run analysis, persist via existing helpers, set
 *                        isRecording = false.
 */
// Shared mutable state for the external store pattern.
// This allows us to expose keystrokes without re-rendering on every keystroke.
let sharedKeystrokes: KeystrokeEvent[] = [];
let sharedTypedText = "";
let sharedSessionStartTs: number | null = null;
const sharedListeners: Set<() => void> = new Set();
// Cached snapshot for memoization
let cachedSnapshot: { keystrokes: KeystrokeEvent[]; typedText: string; sessionStartTime: number | null } | null = null;

function notifyListeners() {
  for (const listener of sharedListeners) {
    listener();
  }
}

function subscribeToKeystrokes(listener: () => void) {
  sharedListeners.add(listener);
  return () => sharedListeners.delete(listener);
}

function getKeystrokesSnapshot(): { keystrokes: KeystrokeEvent[]; typedText: string; sessionStartTime: number | null } {
  // Return cached snapshot if data hasn't changed
  if (
    cachedSnapshot &&
    cachedSnapshot.keystrokes === sharedKeystrokes &&
    cachedSnapshot.typedText === sharedTypedText &&
    cachedSnapshot.sessionStartTime === sharedSessionStartTs
  ) {
    return cachedSnapshot;
  }
  // Create new snapshot and cache it
  cachedSnapshot = {
    keystrokes: sharedKeystrokes,
    typedText: sharedTypedText,
    sessionStartTime: sharedSessionStartTs,
  };
  return cachedSnapshot;
}

export function useSystemWideCapture({
  url = DEFAULT_URL,
  enabled = true,
  autoStart = false,
}: SystemWideCaptureOptions = {}): SystemWideCaptureState {
  const [isRecording, setIsRecording] = useState(false);
  const [keystrokeCount, setKeystrokeCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [isCaptureReady, setIsCaptureReady] = useState(false);
  const [captureStatus, setCaptureStatus] = useState<CaptureStatus>("disconnected");
  const [captureError, setCaptureError] = useState<string | null>(null);

  // Subscribe to the external store for keystrokes/typedText
  const { keystrokes, typedText, sessionStartTime } = useSyncExternalStore(
    subscribeToKeystrokes,
    getKeystrokesSnapshot,
    getKeystrokesSnapshot
  );

  // Mutable buffers — kept in refs to avoid re-rendering per keystroke.
  const keystrokesRef = useRef<KeystrokeEvent[]>([]);
  const sessionStartTsRef = useRef<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const isRecordingRef = useRef(false);
  const producerConnectedRef = useRef(false);
  const pendingStartRef = useRef(false);
  const enabledRef = useRef(enabled);
  const sessionStartedWhileEnabledRef = useRef(false);

  const sendStartCommand = useCallback(() => {
    if (
      wsRef.current?.readyState === WebSocket.OPEN &&
      producerConnectedRef.current
    ) {
      wsRef.current.send(JSON.stringify({ type: "start_recording" }));
      return true;
    }

    return false;
  }, []);

  const startRecording = useCallback(() => {
    if (!enabledRef.current) {
      pendingStartRef.current = false;
      setCaptureStatus("disconnected");
      return;
    }

    setCaptureError(null);

    if (sendStartCommand()) {
      setCaptureStatus("starting");
      return;
    }

    pendingStartRef.current = true;
    setCaptureStatus("starting");

    fetch("/api/system-capture/start", { method: "POST" })
      .then(async (response) => {
        if (response.ok) return;

        let errorMessage = "Failed to start system capture.";
        try {
          const body = (await response.json()) as { error?: string };
          if (typeof body.error === "string") errorMessage = body.error;
        } catch {
          /* ignore */
        }
        throw new Error(errorMessage);
      })
      .catch((err) => {
        pendingStartRef.current = false;
        setCaptureStatus("error");
        setCaptureError(err instanceof Error ? err.message : "Failed to start system capture.");
      });
  }, [sendStartCommand]);

  const stopRecording = useCallback(() => {
    pendingStartRef.current = false;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "stop_recording" }));
    }
  }, []);

  useEffect(() => {
    enabledRef.current = enabled;

    if (!enabled) {
      pendingStartRef.current = false;
      stopRecording();
      queueMicrotask(() => {
        setIsCaptureReady(false);
        setCaptureStatus("disconnected");
      });
      return;
    }

    queueMicrotask(() => {
      setIsCaptureReady(producerConnectedRef.current);
      if (!isRecordingRef.current) {
        setCaptureStatus(producerConnectedRef.current ? "ready" : "disconnected");
      }
    });

    if (autoStart && !isRecordingRef.current && !pendingStartRef.current) {
      startRecording();
    }
  }, [autoStart, enabled, startRecording, stopRecording]);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let backoffMs = 500;

    const persistSession = async (endedAtMs: number) => {
      const keystrokes = keystrokesRef.current;
      const startTs = sessionStartTsRef.current;
      if (!startTs || keystrokes.length < 2 || !sessionStartedWhileEnabledRef.current) return;

      try {
        const forwardedKeydownCount = keystrokes.filter(
          (e) =>
            e.type === "keydown" &&
            (e.key.length === 1 || e.key === "Backspace")
        ).length;
        if (forwardedKeydownCount < MIN_SYSTEM_WIDE_SESSION_KEYDOWNS) return;

        const latencies = computeBigramLatencies(keystrokes);
        const bigramStats = aggregateBigramStats(latencies);

        const typedText = reconstructTypedText(keystrokes);
        const letterStats = extractLetterStats(keystrokes);
        const wordStats = extractWordStats(keystrokes, typedText);

        const keydownPrintable = keystrokes.filter(
          (e) => e.type === "keydown" && e.key.length === 1
        );
        const characterCount = keydownPrintable.length;
        const durationMinutes = (endedAtMs - startTs) / 60000;
        const wpm =
          durationMinutes > 0
            ? Math.round(characterCount / 5 / durationMinutes)
            : 0;

        const backspaceCount = keystrokes.filter(
          (e) => e.key === "Backspace"
        ).length;
        const accuracy =
          characterCount > 0
            ? Math.max(
                0,
                Math.round(
                  ((characterCount - backspaceCount) / characterCount) * 100
                )
              )
            : 100;

        const userId = getLocalUserId();
        const sessionContext = getSessionContext("system_wide");
        const {
          insertSession,
          upsertBigramScores,
          upsertLetterScores,
          upsertWordScores,
        } = await import("@/lib/db/sessions");

        const sessionId = await insertSession({
          userId,
          startedAt: new Date(startTs),
          endedAt: new Date(endedAtMs),
          mode: "system_wide",
          captureSource: sessionContext.captureSource,
          textOrigin: sessionContext.textOrigin,
          contextKey: sessionContext.contextKey,
          wpm,
          accuracy,
          rawErrorCount: backspaceCount,
        });

        if (!sessionId) return;

        const bigramScores = Object.entries(bigramStats).map(
          ([bigram, stat]) => ({
            sessionId,
            userId,
            item: bigram,
            captureSource: sessionContext.captureSource,
            textOrigin: sessionContext.textOrigin,
            contextKey: sessionContext.contextKey,
            avgLatencyMs: stat.avgLatency,
            errorRate: 0,
            normalizedScore: normalizeLatencyScore(stat.avgLatency),
            sampleCount: stat.count,
          })
        );
        await upsertBigramScores(bigramScores, sessionId);

        const letterScores = Object.entries(letterStats).map(
          ([letter, stat]) => ({
            sessionId,
            userId,
            item: letter,
            captureSource: sessionContext.captureSource,
            textOrigin: sessionContext.textOrigin,
            contextKey: sessionContext.contextKey,
            avgLatencyMs: stat.avgLatency,
            errorRate: 0,
            normalizedScore: normalizeLatencyScore(stat.avgLatency),
            sampleCount: stat.count,
          })
        );
        await upsertLetterScores(letterScores);

        const wordScores = Object.entries(wordStats).map(([word, stat]) => ({
          sessionId,
          userId,
          item: word,
          captureSource: sessionContext.captureSource,
          textOrigin: sessionContext.textOrigin,
          contextKey: sessionContext.contextKey,
          avgLatencyMs: stat.avgLatency,
          errorRate: stat.errorRate,
          normalizedScore: normalizeLatencyScore(stat.avgLatency),
          sampleCount: stat.count,
        }));
        await upsertWordScores(wordScores);

        console.log(
          `[bi-grammar] system_wide session saved: ${sessionId} (${characterCount} chars, ${wpm} wpm)`
        );
      } catch (err) {
        console.error("[bi-grammar] failed to persist system_wide session", err);
      }
    };

    const handleMessage = (raw: string) => {
      let msg: BridgeMessage | null = null;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }
      if (!msg) return;

      if (msg.type === "producer_status") {
        producerConnectedRef.current = msg.connected;
        setIsCaptureReady(enabledRef.current && msg.connected);
        if (!enabledRef.current) {
          pendingStartRef.current = false;
          setCaptureStatus("disconnected");
          if (msg.connected) {
            stopRecording();
          }
          return;
        }
        if (pendingStartRef.current) {
          if (msg.connected) sendStartCommand();
          else setCaptureStatus("starting");
        } else if (!isRecordingRef.current) {
          setCaptureStatus(msg.connected ? "ready" : "disconnected");
        }
        return;
      }

      if (msg.type === "control_ack") {
        if (!enabledRef.current && msg.command === "start_recording") {
          stopRecording();
          return;
        }

        if (!msg.ok) {
          pendingStartRef.current = false;
          setCaptureStatus("error");
          setCaptureError(msg.error ?? "System capture command failed.");
          return;
        }

        if (msg.command === "start_recording") {
          pendingStartRef.current = false;
          if (!isRecordingRef.current) {
            setCaptureStatus(producerConnectedRef.current ? "ready" : "disconnected");
          }
        }
        return;
      }

      if (msg.type === "session_start") {
        if (!enabledRef.current) {
          keystrokesRef.current = [];
          sessionStartTsRef.current = null;
          sessionStartedWhileEnabledRef.current = false;
          return;
        }

        keystrokesRef.current = [];
        sessionStartTsRef.current = msg.ts;
        sessionStartedWhileEnabledRef.current = true;
        // Update shared state
        sharedKeystrokes = [];
        sharedTypedText = "";
        sharedSessionStartTs = msg.ts;
        notifyListeners();
        setKeystrokeCount(0);
        isRecordingRef.current = true;
        setIsRecording(true);
        pendingStartRef.current = false;
        setCaptureStatus("recording");
        return;
      }

      if (msg.type === "keystroke") {
        if (!enabledRef.current) return;

        const startTs = sessionStartTsRef.current;
        if (startTs == null) return; // ignore until session_start
        const newEvent: KeystrokeEvent = {
          key: msg.key,
          // Rebase to a session-relative timeline so existing latency math
          // (based on keystrokes[i].timestamp deltas) works unchanged.
          timestamp: msg.ts - startTs,
          type: msg.event,
        };
        keystrokesRef.current.push(newEvent);
        // Update shared state (create new array reference for React)
        sharedKeystrokes = [...keystrokesRef.current];
        sharedTypedText = reconstructTypedText(sharedKeystrokes);
        notifyListeners();
        setKeystrokeCount(keystrokesRef.current.length);
        return;
      }

      if (msg.type === "session_end") {
        const startTs = sessionStartTsRef.current;
        const endedAtMs = startTs != null ? startTs + (msg.ts - startTs) : msg.ts;
        // We rebased keystroke timestamps to be session-relative; convert
        // endedAt to the same wall-clock used in the warmup start.
        const wallEnd = msg.ts;
        isRecordingRef.current = false;
        setIsRecording(false);
        setCaptureStatus(enabledRef.current && producerConnectedRef.current ? "ready" : "disconnected");
        // Fire-and-forget; never block UI.
        void persistSession(wallEnd);
        keystrokesRef.current = [];
        sessionStartTsRef.current = null;
        sessionStartedWhileEnabledRef.current = false;
        // Clear shared state
        sharedKeystrokes = [];
        sharedTypedText = "";
        sharedSessionStartTs = null;
        notifyListeners();
        // Suppress unused-var linting for endedAtMs.
        void endedAtMs;
        return;
      }
    };

    const connect = () => {
      if (cancelled) return;
      try {
        ws = new WebSocket(url);
        wsRef.current = ws;
      } catch {
        scheduleReconnect();
        return;
      }

      ws.onopen = () => {
        if (cancelled) return;
        setIsConnected(true);
        setCaptureError(null);
        backoffMs = 500;
        ws?.send(JSON.stringify({ type: "hello", role: "subscriber" }));
      };

      ws.onmessage = (ev) => {
        if (typeof ev.data === "string") handleMessage(ev.data);
      };

      ws.onerror = () => {
        // onclose will follow.
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsCaptureReady(false);
        producerConnectedRef.current = false;
        // If we were mid-session, drop it silently to avoid persisting partial data.
        if (sessionStartTsRef.current != null) {
          keystrokesRef.current = [];
          sessionStartTsRef.current = null;
          sessionStartedWhileEnabledRef.current = false;
          // Clear shared state
          sharedKeystrokes = [];
          sharedTypedText = "";
          sharedSessionStartTs = null;
          notifyListeners();
          isRecordingRef.current = false;
          setIsRecording(false);
          setKeystrokeCount(0);
        }
        setCaptureStatus(pendingStartRef.current ? "starting" : "disconnected");
        scheduleReconnect();
      };
    };

    const scheduleReconnect = () => {
      if (cancelled) return;
      reconnectTimer = setTimeout(() => {
        backoffMs = Math.min(backoffMs * 2, 5000);
        connect();
      }, backoffMs);
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
    };
  }, [sendStartCommand, stopRecording, url]);

  return {
    isRecording,
    keystrokeCount,
    isConnected,
    isCaptureReady,
    captureStatus,
    captureError,
    typedText,
    keystrokes,
    sessionStartTime,
    startRecording,
    stopRecording,
  };
}
