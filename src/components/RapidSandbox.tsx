"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

interface RapidSandboxProps {
  archetype?: string;
}

interface SandboxEntry {
  id: number;
  value: string;
  timestamp: number;
  quality: number;
}

interface ScoreBadgeState {
  id: number;
  value: number;
  isFading: boolean;
}

const IDLE_CLEAR_MS = 2000;
const SCORE_FLASH_MS = 1000;
const SCORE_FADE_DELAY_MS = 600;
const SCORE_FADE_MS = 400;
const FIRST_CHAR_QUALITY = 0.42;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getLatencies(entries: SandboxEntry[]) {
  const latencies: number[] = [];

  for (let index = 1; index < entries.length; index += 1) {
    latencies.push(entries[index].timestamp - entries[index - 1].timestamp);
  }

  return latencies;
}

function getSpeedQuality(latency: number) {
  const boundedLatency = clamp(latency, 90, 1000);
  return 1 - (boundedLatency - 90) / 910;
}

function getConsistencyQuality(latencies: number[]) {
  if (latencies.length < 2) {
    return 0.55;
  }

  const recentLatencies = latencies.slice(-6);
  const meanLatency = recentLatencies.reduce((sum, value) => sum + value, 0) / recentLatencies.length;

  if (meanLatency <= 0) {
    return 0;
  }

  const variance = recentLatencies.reduce((sum, value) => sum + (value - meanLatency) ** 2, 0) / recentLatencies.length;
  const coefficientOfVariation = Math.sqrt(variance) / meanLatency;

  return clamp(1 - coefficientOfVariation / 0.55, 0, 1);
}

function getBigramQuality(latencies: number[]) {
  if (latencies.length === 0) {
    return FIRST_CHAR_QUALITY;
  }

  const latestLatency = latencies[latencies.length - 1];
  const speedQuality = getSpeedQuality(latestLatency);
  const consistencyQuality = getConsistencyQuality(latencies);

  return clamp(speedQuality * 0.78 + consistencyQuality * 0.22, 0, 1);
}

function getRapidScore(latencies: number[]) {
  if (latencies.length === 0) {
    return null;
  }

  const recentLatencies = latencies.slice(-8);
  const meanLatency = recentLatencies.reduce((sum, value) => sum + value, 0) / recentLatencies.length;
  const speedQuality = getSpeedQuality(meanLatency);
  const consistencyQuality = getConsistencyQuality(recentLatencies);
  const blendedQuality = speedQuality * 0.78 + consistencyQuality * 0.22;
  const calibratedQuality = Math.pow(clamp(blendedQuality, 0, 1), 1.35);
  const nearPerfectBonus = speedQuality > 0.993 && consistencyQuality > 0.975 ? 0.3 : 0;

  return clamp(Math.round(1 + calibratedQuality * 7.9 + nearPerfectBonus), 1, 10);
}

function getQualityColor(quality: number) {
  const hue = Math.round(clamp(quality, 0, 1) * 120);
  return `hsl(${hue} 85% 55%)`;
}

export default function RapidSandbox({ archetype }: RapidSandboxProps) {
  const [entries, setEntries] = useState<SandboxEntry[]>([]);
  const [scoreBadge, setScoreBadge] = useState<ScoreBadgeState | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const entryIdRef = useRef(0);
  const entriesRef = useRef<SandboxEntry[]>([]);
  const idleTimerRef = useRef<number | null>(null);
  const scoreFadeTimerRef = useRef<number | null>(null);
  const scoreHideTimerRef = useRef<number | null>(null);
  const scoreBadgeIdRef = useRef(0);

  const clearSandbox = useCallback(() => {
    entriesRef.current = [];
    setEntries([]);
    setScoreBadge(null);
  }, []);

  const scheduleIdleClear = useCallback(() => {
    if (idleTimerRef.current !== null) {
      window.clearTimeout(idleTimerRef.current);
    }

    idleTimerRef.current = window.setTimeout(() => {
      clearSandbox();
    }, IDLE_CLEAR_MS);
  }, [clearSandbox]);

  const flashScore = useCallback((score: number | null) => {
    if (scoreFadeTimerRef.current !== null) {
      window.clearTimeout(scoreFadeTimerRef.current);
    }

    if (scoreHideTimerRef.current !== null) {
      window.clearTimeout(scoreHideTimerRef.current);
    }

    if (score === null) {
      setScoreBadge(null);
      return;
    }

    scoreBadgeIdRef.current += 1;
    const nextBadgeId = scoreBadgeIdRef.current;

    setScoreBadge({
      id: nextBadgeId,
      value: score,
      isFading: false,
    });

    scoreFadeTimerRef.current = window.setTimeout(() => {
      setScoreBadge((currentBadge: ScoreBadgeState | null) => currentBadge && currentBadge.id === nextBadgeId
        ? { ...currentBadge, isFading: true }
        : currentBadge);
    }, SCORE_FADE_DELAY_MS);

    scoreHideTimerRef.current = window.setTimeout(() => {
      setScoreBadge((currentBadge: ScoreBadgeState | null) => currentBadge?.id === nextBadgeId ? null : currentBadge);
    }, SCORE_FLASH_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current);
      }

      if (scoreFadeTimerRef.current !== null) {
        window.clearTimeout(scoreFadeTimerRef.current);
      }

      if (scoreHideTimerRef.current !== null) {
        window.clearTimeout(scoreHideTimerRef.current);
      }
    };
  }, []);

  const plainText = useMemo(() => entries.map((entry) => entry.value).join(""), [entries]);

  const handleAppendCharacter = useCallback((character: string) => {
    const now = performance.now();
    const currentEntries = entriesRef.current;
    const nextEntries = [...currentEntries];
    const latenciesBeforeAppend = getLatencies(currentEntries);
    const nextLatency = currentEntries.length > 0 ? now - currentEntries[currentEntries.length - 1].timestamp : null;
    const nextLatencies = nextLatency === null ? latenciesBeforeAppend : [...latenciesBeforeAppend, nextLatency];
    const nextEntry: SandboxEntry = {
      id: entryIdRef.current,
      value: character,
      timestamp: now,
      quality: getBigramQuality(nextLatencies),
    };

    entryIdRef.current += 1;
    nextEntries.push(nextEntry);
    entriesRef.current = nextEntries;
    setEntries(nextEntries);
    flashScore(getRapidScore(nextLatencies));
    scheduleIdleClear();
  }, [flashScore, scheduleIdleClear]);

  const handleBackspace = useCallback(() => {
    if (entriesRef.current.length === 0) {
      return;
    }

    const nextEntries = entriesRef.current.slice(0, -1);
    entriesRef.current = nextEntries;
    setEntries(nextEntries);
    flashScore(getRapidScore(getLatencies(nextEntries)));
    scheduleIdleClear();
  }, [flashScore, scheduleIdleClear]);

  const handleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    if (event.key === "Backspace") {
      event.preventDefault();
      handleBackspace();
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      handleAppendCharacter(" ");
      handleAppendCharacter(" ");
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      handleAppendCharacter(" ");
      return;
    }

    if (event.key.length !== 1) {
      return;
    }

    event.preventDefault();
    handleAppendCharacter(event.key);
  }, [handleAppendCharacter, handleBackspace]);

  return (
    <div
      className="border p-4 min-h-[220px] flex flex-col"
      style={{
        borderColor: "var(--color-border)",
        backgroundColor: "var(--background)",
      }}
    >
      <div className="border-b pb-2 mb-3 flex items-center justify-between gap-3" style={{ borderColor: "var(--color-border)" }}>
        <div>
          <h3 className="text-xs font-medium" style={{ color: "var(--color-text-primary)" }}>
            Rapid Sandbox
          </h3>
          <p className="text-[11px] mt-1" style={{ color: "var(--color-text-muted)" }}>
            Type here. It clears after 2s of idle time.
          </p>
        </div>
        {archetype ? (
          <span className="text-[10px] uppercase tracking-wide" style={{ color: "var(--color-accent)" }}>
            {archetype}
          </span>
        ) : null}
      </div>

      <div
        className="relative flex-1 border p-3 cursor-text overflow-hidden"
        style={{
          borderColor: isFocused ? "var(--color-accent)" : "var(--color-border)",
          backgroundColor: "var(--color-surface)",
          transition: "border-color 150ms ease",
        }}
        onClick={() => textareaRef.current?.focus()}
      >
        <textarea
          ref={textareaRef}
          value=""
          onChange={() => undefined}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          aria-label="Rapid sandbox"
          className="absolute inset-0 h-full w-full opacity-0 resize-none"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />

        {scoreBadge !== null ? (
          <div
            key={scoreBadge.id}
            className="absolute right-3 top-3 px-2 py-1 border text-sm font-semibold animate-fade-in"
            style={{
              borderColor: getQualityColor((scoreBadge.value - 1) / 9),
              color: getQualityColor((scoreBadge.value - 1) / 9),
              backgroundColor: "rgba(0, 0, 0, 0.8)",
              opacity: scoreBadge.isFading ? 0 : 1,
              transform: scoreBadge.isFading ? "translateY(-6px) scale(0.96)" : "translateY(0) scale(1)",
              transition: `opacity ${SCORE_FADE_MS}ms ease, transform ${SCORE_FADE_MS}ms ease`,
            }}
          >
            {scoreBadge.value}/10
          </div>
        ) : null}

        {entries.length === 0 ? (
          <div className="text-sm leading-relaxed pr-14" style={{ color: "var(--color-text-muted)" }}>
            {isFocused && (
              <span
                className="cursor-blink inline-block w-0.5 h-5 ml-0.5 align-[-0.125em]"
                style={{ backgroundColor: "var(--color-accent)" }}
              />
            )}
          </div>
        ) : (
          <div className="text-lg leading-relaxed whitespace-pre-wrap break-words pr-14" style={{ color: "var(--color-text-primary)" }}>
            {entries.map((entry) => (
              <span key={entry.id} style={{ color: getQualityColor(entry.quality), transition: "color 120ms ease" }}>
                {entry.value === " " ? "\u00A0" : entry.value}
              </span>
            ))}
            {isFocused && (
              <span
                className="cursor-blink inline-block w-0.5 h-6 ml-0.5 align-[-0.125em]"
                style={{ backgroundColor: "var(--color-accent)" }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
