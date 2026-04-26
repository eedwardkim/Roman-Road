"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { KeystrokeEvent, BigramStats } from "@/types/typing";
import {
  computeBigramLatencies,
  aggregateBigramStats,
  getSlowestBigrams,
} from "@/lib/bigram";
import SessionSummaryModal from "@/components/SessionSummaryModal";
import DrillCompletionModal from "@/components/DrillCompletionModal";
import DrillContextPanel from "@/components/DrillContextPanel";
import { ImprovedBigram, WeakestBigram, WeakestWord } from "@/lib/db/sessions";
import { getLocalUserId } from "@/lib/db/local-storage";
import TypingModeSelector from "@/components/TypingModeSelector";
import TypingDisplay from "@/components/TypingDisplay";
import { type TypingConfig, type TypingMode, generateText, generateAdditionalText } from "@/lib/wordSources";
import { getSessionContext, IN_APP_PROMPTED_CONTEXT } from "@/lib/session-context";
import { extractLetterStats, extractWordStats, normalizeLatencyScore } from "@/lib/stats";

interface TypingTestProps {
  onSessionComplete?: (
    keystrokes: KeystrokeEvent[],
    stats: Record<string, BigramStats>
  ) => void;
  onSessionUpdate?: (stats: {
    wpm: number;
    accuracy: number;
    keystrokes: number;
    progress: number;
    total: number;
    timeElapsed: number;
    isActive: boolean;
    keystrokeLatencies: number[];
  }) => void;
  initialMode?: TypingMode;
  fixedMode?: TypingMode;
  showModeSelector?: boolean;
  /** System-wide captured text (from background typing) */
  systemWideText?: string;
  /** Whether system-wide recording is active */
  isSystemWideRecording?: boolean;
  /** System-wide session start time */
  systemWideSessionStart?: number | null;
  isSystemWideCaptureReady?: boolean;
  systemWideCaptureStatus?: "disconnected" | "starting" | "ready" | "recording" | "error";
  systemWideCaptureError?: string | null;
  /** Function to manually stop system-wide recording */
  stopSystemWideRecording?: () => void;
  onModeChange?: (mode: TypingMode) => void;
}

const defaultConfig: TypingConfig = {
  mode: "normal",
  wordCount: 100,
  includeNumbers: false,
  includePunctuation: false,
};

function createConfig(mode: TypingMode): TypingConfig {
  return {
    ...defaultConfig,
    mode,
  };
}

export default function TypingTest({ 
  onSessionComplete, 
  onSessionUpdate,
  initialMode = "normal",
  fixedMode,
  showModeSelector = true,
  systemWideText = "",
  isSystemWideRecording = false,
  isSystemWideCaptureReady = false,
  systemWideCaptureStatus = "disconnected",
  systemWideCaptureError = null,
  stopSystemWideRecording,
  onModeChange,
 }: TypingTestProps) {
  const [keystrokes, setKeystrokes] = useState<KeystrokeEvent[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [bigramStats, setBigramStats] = useState<Record<string, BigramStats>>(
    {}
  );
  const [slowestBigrams, setSlowestBigrams] = useState<BigramStats[]>([]);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showDrillModal, setShowDrillModal] = useState(false);
  const [summaryData, setSummaryData] = useState<{
    wpm: number;
    accuracy: number;
    improvedBigrams: ImprovedBigram[];
    weakestBigrams: WeakestBigram[];
    slowestBigrams?: BigramStats[];
  } | null>(null);
  const [practicedBigrams, setPracticedBigrams] = useState<WeakestBigram[]>([]);
  const [practicedWords, setPracticedWords] = useState<WeakestWord[]>([]);
  const [dbError, setDbError] = useState<string | null>(null);
  const [config, setConfig] = useState<TypingConfig>(() => createConfig(fixedMode ?? initialMode));
  const [targetText, setTargetText] = useState("");
  const [isLoadingDrill, setIsLoadingDrill] = useState(false);
  const [showDevDiscardButton, setShowDevDiscardButton] = useState(false);
  const isSystemWideCaptureStarting = systemWideCaptureStatus === "starting";

  useEffect(() => {
    if (!fixedMode || config.mode === fixedMode) {
      return;
    }

    setConfig((prev) => ({
      ...prev,
      mode: fixedMode,
    }));
  }, [config.mode, fixedMode]);

  useEffect(() => {
    onModeChange?.(config.mode);
  }, [config.mode, onModeChange]);

  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const isAppendingRef = useRef(false);
  const hasCompletedRef = useRef(false);

  const resetSession = useCallback(() => {
    hasCompletedRef.current = false;
    setKeystrokes([]);
    setInputValue("");
    setIsActive(false);
    setBigramStats({});
    setSlowestBigrams([]);
    setSessionStartTime(null);
    setDbError(null);
    inputRef.current?.focus();
  }, []);

  // Keyboard listener for v + 4 to show dev discard button
  useEffect(() => {
    const pressedKeys = new Set<string>();

    const handleKeyDown = (e: KeyboardEvent) => {
      pressedKeys.add(e.key.toLowerCase());

      // Check if both v and 4 are pressed simultaneously
      if (pressedKeys.has('v') && pressedKeys.has('4')) {
        setShowDevDiscardButton(true);
        setTimeout(() => setShowDevDiscardButton(false), 3000);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      pressedKeys.delete(e.key.toLowerCase());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const loadDrillText = useCallback(async () => {
    setIsLoadingDrill(true);
    try {
      const userId = getLocalUserId();
      const { getWeakestBigrams, getWeakestWords } = await import("@/lib/db/sessions");
      
      const [weakestBigrams, weakestWords] = await Promise.all([
        getWeakestBigrams(userId, 20, IN_APP_PROMPTED_CONTEXT),
        getWeakestWords(userId, 50, IN_APP_PROMPTED_CONTEXT),
      ]);
      
      // Store the practiced bigrams for the drill completion modal
      setPracticedBigrams(weakestBigrams);
      setPracticedWords(weakestWords);
      
      const { generateDrillText } = await import("@/lib/db/drills");
      const drillText = generateDrillText(weakestBigrams, weakestWords, 100);
      setTargetText(drillText);
    } catch (error) {
      console.error("Failed to load drill text:", error);
      setPracticedBigrams([]);
      setPracticedWords([]);
      setTargetText("the quick brown fox jumps over the lazy dog");
    } finally {
      setIsLoadingDrill(false);
    }
  }, []); // Empty deps is fine - this only depends on external functions

  // Generate initial text client-side only to avoid hydration mismatch
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const startingMode = fixedMode ?? initialMode;

      if (startingMode === "drill") {
        void loadDrillText();
        return;
      }

      if (startingMode === "free") {
        setTargetText("");
        return;
      }

      setTargetText(generateText(createConfig(startingMode)));
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [fixedMode, initialMode, loadDrillText]);

  // Regenerate text when config changes
  const handleConfigChange = useCallback((newConfig: TypingConfig) => {
    if (fixedMode && newConfig.mode !== fixedMode) {
      return;
    }

    setConfig(newConfig);
    if (newConfig.mode === "drill") {
      loadDrillText();
    } else if (newConfig.mode === "free") {
      setPracticedBigrams([]);
      setPracticedWords([]);
      setTargetText(""); // Free mode has no target text
    } else {
      setPracticedBigrams([]);
      setPracticedWords([]);
      setTargetText(generateText(newConfig));
    }
    setInputValue("");
    setKeystrokes([]);
    setIsActive(false);
    setSessionStartTime(null);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [fixedMode, loadDrillText]);

  // Timer effect (not used in new modes but kept for potential future use)
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

// Real-time stats update effect
useEffect(() => {
  if (!onSessionUpdate) return;

  const keydownEvents = keystrokes.filter((e) => e.type === "keydown" && e.key.length === 1);
  const characterCount = keydownEvents.length;
  
  let wpm = 0;
  let timeElapsed = 0;
  
  if (sessionStartTime && isActive) {
    const currentTime = Date.now();
    timeElapsed = (currentTime - sessionStartTime) / 1000; // in seconds
    const durationMinutes = timeElapsed / 60;
    wpm = durationMinutes > 0 ? Math.round((characterCount / 5) / durationMinutes) : 0;
  }

  const backspaceCount = keystrokes.filter((e) => e.key === "Backspace").length;
  const accuracy = characterCount > 0 ? Math.max(0, Math.round(((characterCount - backspaceCount) / characterCount) * 100)) : 100;

  // Calculate keystroke latencies for visualization
  const latencies: number[] = [];
  for (let i = 1; i < keydownEvents.length; i++) {
    latencies.push(keydownEvents[i].timestamp - keydownEvents[i - 1].timestamp);
  }

  onSessionUpdate({
    wpm,
    accuracy,
    keystrokes: keystrokes.length,
    progress: inputValue.length,
    total: targetText.length,
    timeElapsed,
    isActive,
    keystrokeLatencies: latencies,
  });
}, [keystrokes, inputValue, targetText, sessionStartTime, isActive, onSessionUpdate]);

  // Stat extractors and score normalization live in @/lib/stats so the
  // system-wide capture hook can reuse the exact same pipeline.

  const analyzeSession = useCallback(async () => {
    if (hasCompletedRef.current || keystrokes.length < 2) return;
    hasCompletedRef.current = true;

    const latencies = computeBigramLatencies(keystrokes);
    const stats = aggregateBigramStats(latencies);
    const slowest = getSlowestBigrams(stats, 10, 1);

    setBigramStats(stats);
    setSlowestBigrams(slowest);

    // Calculate session metrics
    const endTime = Date.now();
    const durationMinutes = (endTime - (sessionStartTime || endTime)) / 60000;
    const keydownEvents = keystrokes.filter((e) => e.type === "keydown" && e.key.length === 1);
    const characterCount = keydownEvents.length;
    const wpm = durationMinutes > 0 ? Math.round((characterCount / 5) / durationMinutes) : 0;

    // Calculate accuracy (simplified: assume backspace indicates errors)
    const backspaceCount = keystrokes.filter((e) => e.key === "Backspace").length;
    const accuracy = characterCount > 0 ? Math.max(0, Math.round(((characterCount - backspaceCount) / characterCount) * 100)) : 100;
    const rawErrorCount = backspaceCount;

    // Extract letter statistics
    const letterStats = extractLetterStats(keystrokes);

    // Extract word statistics
    const wordStats = extractWordStats(keystrokes, inputValue);

    // Initialize summary data for modal (will be updated with DB data if logged in)
    const improvedBigrams: ImprovedBigram[] = [];
    const weakestBigrams: WeakestBigram[] = [];

    // Calculate slowest bigrams for this session
    const slowestBigrams = getSlowestBigrams(stats, 10);

    // Set summary data and show modal immediately
    setSummaryData({
      wpm,
      accuracy,
      improvedBigrams,
      weakestBigrams,
      slowestBigrams,
    });
    
    // Show drill completion modal if in drill mode, otherwise show regular summary
    if (config.mode === "drill") {
      setShowDrillModal(true);
    } else {
      setShowSummaryModal(true);
    }

    if (onSessionComplete) {
      onSessionComplete(keystrokes, stats);
    }

    const sessionContext = getSessionContext(config.mode);

    // Save to database in background after modal is shown
    (async () => {
      try {
        const userId = getLocalUserId();
        const { insertSession, upsertBigramScores, upsertLetterScores, upsertWordScores, getMostImprovedBigrams, getWeakestBigrams } = await import("@/lib/db/sessions");

        // Insert session
        const sessionId = await insertSession({
          userId,
          startedAt: new Date(sessionStartTime || endTime),
          endedAt: new Date(endTime),
          mode: config.mode,
          captureSource: sessionContext.captureSource,
          textOrigin: sessionContext.textOrigin,
          contextKey: sessionContext.contextKey,
          wpm,
          accuracy,
          rawErrorCount,
        });

        if (sessionId) {
          console.log("Session saved to database:", sessionId);

          // Upsert bigram scores
          const bigramScores = Object.entries(stats).map(([bigram, stat]: [string, BigramStats]) => ({
            sessionId,
            userId,
            item: bigram,
            captureSource: sessionContext.captureSource,
            textOrigin: sessionContext.textOrigin,
            contextKey: sessionContext.contextKey,
            avgLatencyMs: stat.avgLatency,
            errorRate: 0, // TODO: Calculate from backspace patterns
            normalizedScore: normalizeLatencyScore(stat.avgLatency),
            sampleCount: stat.count,
          }));
          await upsertBigramScores(bigramScores, sessionId);

          // Upsert letter scores
          const letterScores = Object.entries(letterStats).map(([letter, stat]: [string, { count: number; avgLatency: number }]) => ({
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
          }));
          await upsertLetterScores(letterScores);

          // Upsert word scores
          const wordScores = Object.entries(wordStats).map(([word, stat]: [string, { count: number; avgLatency: number; errorRate: number }]) => ({
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

          // Get improved bigrams and update summary data
          const newImprovedBigrams = await getMostImprovedBigrams(userId, sessionId, Object.fromEntries(
            Object.entries(stats).map(([bigram, stat]) => [bigram, normalizeLatencyScore(stat.avgLatency)])
          ));

          // Get weakest bigrams and update summary data
          const newWeakestBigrams = await getWeakestBigrams(userId, 10, sessionContext.contextKey);

          // Update summary data with fetched values
          setSummaryData(prev => prev ? {
            ...prev,
            improvedBigrams: newImprovedBigrams,
            weakestBigrams: newWeakestBigrams,
          } : null);
        }
      } catch (error) {
        console.error("Failed to save session data:", error);
        setDbError("Failed to save session data");
      }
    })();
  }, [keystrokes, sessionStartTime, inputValue, onSessionComplete, config.mode]);

  const restartCurrentSession = useCallback(() => {
    if (config.mode === "drill") {
      void loadDrillText();
    } else if (config.mode !== "free") {
      setTargetText(generateText(config));
    }

    resetSession();
  }, [config, loadDrillText, resetSession]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Handle Cmd/Ctrl + R to restart
      if ((e.metaKey || e.ctrlKey) && e.key === "r") {
        e.preventDefault();
        restartCurrentSession();
        return;
      }

      // Handle Escape to finish session (for infinite mode or free mode)
      if (e.key === "Escape" && (config.wordCount === "infinite" || config.mode === "free") && isActive) {
        e.preventDefault();
        analyzeSession();
        return;
      }

      // Start timer on first keypress
      if (!isActive) {
        setIsActive(true);
        setSessionStartTime(Date.now());
      }

      const event: KeystrokeEvent = {
        key: e.key,
        timestamp: performance.now(),
        type: "keydown",
      };

      setKeystrokes((prev) => [...prev, event]);
    },
    [isActive, config.wordCount, config.mode, restartCurrentSession, analyzeSession]
  );

  const handleKeyUp = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const event: KeystrokeEvent = {
      key: e.key,
      timestamp: performance.now(),
      type: "keyup",
    };

    setKeystrokes((prev) => [...prev, event]);
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    // Auto-complete when text is fully typed (for finite modes, not free mode)
    if (config.mode !== "free" && config.wordCount !== "infinite" && newValue.length >= targetText.length) {
      analyzeSession();
    }
  }, [config.mode, config.wordCount, targetText, analyzeSession]);

  // For infinite mode, add more words when approaching the end
  useEffect(() => {
    if (!targetText) return;

    const words = targetText.split(" ");
    const typedWords = inputValue.split(" ").filter(w => w.length > 0).length;
    const wordsRemaining = words.length - typedWords;

    // For infinite mode, add more words when user is within 10 words of the end
    if (config.wordCount === "infinite" && wordsRemaining <= 10 && wordsRemaining > 0 && !isAppendingRef.current) {
      isAppendingRef.current = true;
      const currentWordCount = words.length;
      const additionalText = generateAdditionalText(config, currentWordCount);
      setTargetText(prev => prev + " " + additionalText);
      // Reset the ref after a brief delay to allow the state update to complete
      setTimeout(() => {
        isAppendingRef.current = false;
      }, 0);
    }
  }, [inputValue, targetText, config]);

  const handleStartDrill = useCallback(async () => {
    if (summaryData?.weakestBigrams && summaryData.weakestBigrams.length > 0) {
      try {
        const userId = getLocalUserId();
        const { getWeakestWords } = await import("@/lib/db/sessions");
        
        const weakestWords = await getWeakestWords(userId, 50, IN_APP_PROMPTED_CONTEXT);
        const { generateDrillText } = await import("@/lib/db/drills");
        
        const drillText = generateDrillText(summaryData.weakestBigrams, weakestWords, 100);
        setPracticedBigrams(summaryData.weakestBigrams);
        setPracticedWords(weakestWords);
        setTargetText(drillText);
        setInputValue("");
        resetSession();
        setShowSummaryModal(false);
        setConfig({ ...config, mode: "drill" });
      } catch (error) {
        console.error("Failed to start drill:", error);
      }
    }
  }, [summaryData, resetSession, config]);

  const handleTryAgain = useCallback(() => {
    setShowSummaryModal(false);
    setDbError(null);
    resetSession();
  }, [resetSession]);

  const handleNextTest = useCallback(() => {
    if (config.mode === "drill") {
      void loadDrillText();
    } else if (config.mode === "free") {
      setTargetText("");
    } else {
      setTargetText(generateText(config));
    }

    setShowSummaryModal(false);
    setDbError(null);
    resetSession();
  }, [config, loadDrillText, resetSession]);

  const handleContinueDrill = useCallback(async () => {
    setShowDrillModal(false);
    await loadDrillText();
    resetSession();
  }, [loadDrillText, resetSession]);

  const handleReturnToNormal = useCallback(() => {
    setShowDrillModal(false);
    setPracticedBigrams([]);
    setPracticedWords([]);
    setConfig({ ...config, mode: "normal" });
    setTargetText(generateText({ ...config, mode: "normal" }));
    resetSession();
  }, [config, resetSession]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="w-full space-y-4">
      {/* Database Error Display */}
      {dbError && (
        <div className="p-4 border" style={{ borderColor: "#ef4444", backgroundColor: "rgba(239, 68, 68, 0.1)" }}>
          <div className="text-xs font-medium mb-1" style={{ color: "#ef4444" }}>Database Error</div>
          <div className="text-xs" style={{ color: "var(--color-text-secondary)" }}>{dbError}</div>
        </div>
      )}

      {showModeSelector && (
        <div className="border p-3">
          <TypingModeSelector config={config} onConfigChange={handleConfigChange} />
        </div>
      )}

      {/* Typing Display - click to focus */}
      <div className={config.mode === "drill" ? "grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_18rem] gap-4" : undefined}>
        <div
          ref={containerRef}
          onClick={() => inputRef.current?.focus()}
          className="cursor-text p-6 h-[500px] overflow-y-auto relative border"
          style={{
            backgroundColor: "var(--background)",
            borderColor: isInputFocused ? "var(--color-accent)" : "var(--color-border)",
            transition: "border-color 150ms ease",
          }}
        >
          {isLoadingDrill ? (
            <div className="flex items-center justify-center h-full" style={{ color: "var(--color-text-muted)" }}>
              Loading personalized drill...
            </div>
          ) : config.mode === "free" ? (
            <div className="h-full">
              {isSystemWideRecording ? (
                <div className="h-full">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b" style={{ borderColor: "var(--color-border)" }}>
                    <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: "#22c55e" }} />
                    <span className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                      Capturing system-wide typing...
                    </span>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        stopSystemWideRecording?.();
                      }}
                      className="ml-auto px-2 py-1 text-xs font-medium transition-colors hover:opacity-70"
                      style={{
                        backgroundColor: "rgba(239, 68, 68, 0.1)",
                        color: "#ef4444",
                        border: "1px solid #ef4444",
                      }}
                    >
                      Stop
                    </button>
                  </div>
                  <div className="text-lg leading-relaxed whitespace-pre-wrap" style={{ color: "var(--color-text-primary)" }}>
                    {systemWideText}
                    {isInputFocused && (
                      <span
                        ref={cursorRef}
                        className="cursor-blink inline-block w-0.5 h-6 ml-0.5 align-[-0.125em]"
                        style={{ backgroundColor: "var(--color-accent)" }}
                      />
                    )}
                  </div>
                </div>
              ) : !isActive && inputValue.length === 0 ? (
                <div className="text-lg leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                  {systemWideCaptureError ? (
                    <div className="text-sm mb-3" style={{ color: "#ef4444" }}>
                      {systemWideCaptureError}
                    </div>
                  ) : systemWideCaptureStatus === "ready" || isSystemWideCaptureReady ? (
                    <div className="text-sm mb-3" style={{ color: "var(--color-text-muted)" }}>
                      System capture is ready and will start after 5 words are typed anywhere on your Mac.
                    </div>
                  ) : isSystemWideCaptureStarting ? (
                    <div className="text-sm mb-3" style={{ color: "var(--color-text-muted)" }}>
                      Starting local system capture...
                    </div>
                  ) : null}
                  Free Flow capture starts automatically after 5 words are typed anywhere on your system, including other windows and desktops, and keeps running in the background.
                  <br />
                  <span className="text-sm">Press <kbd className="px-1.5 py-0.5 border" style={{ borderColor: "var(--color-border)" }}>esc</kbd> when done to see your results.</span>
                  <br />
                  <span className="text-sm mt-2 block" style={{ color: "var(--color-text-muted)" }}>
                    Type anywhere on your system from Free Flow only. Normal, Random, and Drill tests do not record desktop keystrokes.
                  </span>
                </div>
              ) : (
                <div className="text-lg leading-relaxed whitespace-pre-wrap" style={{ color: "var(--color-text-primary)" }}>
                  {inputValue}
                  {isInputFocused && (
                    <span
                      ref={cursorRef}
                      className="cursor-blink inline-block w-0.5 h-6 ml-0.5 align-[-0.125em]"
                      style={{ backgroundColor: "var(--color-accent)" }}
                    />
                  )}
                </div>
              )}
            </div>
          ) : (
            <TypingDisplay
              targetText={targetText}
              typedText={inputValue}
              cursorPosition={inputValue.length}
              cursorRef={cursorRef}
              showCursor={isInputFocused}
            />
          )}

          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            className="absolute opacity-0 pointer-events-none"
            style={{ position: 'fixed', top: '-9999px', left: '-9999px' }}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        {config.mode === "drill" && (
          <DrillContextPanel
            isLoadingDrill={isLoadingDrill}
            weakestBigrams={practicedBigrams}
            weakestWords={practicedWords}
            targetText={targetText}
          />
        )}
      </div>

      {/* Controls */}
      <div className="flex justify-center gap-6 text-xs" style={{ color: "var(--color-text-muted)" }}>
        <button
          onClick={restartCurrentSession}
          className="flex items-center gap-2 transition-colors hover:opacity-70"
        >
          <span className="px-1.5 py-0.5 border" style={{ borderColor: "var(--color-border)" }}>⌘</span>
          /
          <span className="px-1.5 py-0.5 border" style={{ borderColor: "var(--color-border)" }}>ctrl</span>
          +
          <span className="px-1.5 py-0.5 border" style={{ borderColor: "var(--color-border)" }}>r</span>
          - restart
        </button>
        {(config.wordCount === "infinite" || config.mode === "free") && (
          <button
            onClick={() => isActive && analyzeSession()}
            disabled={!isActive}
            className="flex items-center gap-2 transition-colors hover:opacity-70 disabled:opacity-50"
          >
            <span className="px-1.5 py-0.5 border" style={{ borderColor: "var(--color-border)" }}>esc</span>
            - finish
          </button>
        )}
        {showDevDiscardButton && (
          <button
            onClick={resetSession}
            className="flex items-center gap-2 px-3 py-1 border transition-colors hover:opacity-70"
            style={{ borderColor: "#ef4444", color: "#ef4444", backgroundColor: "rgba(239, 68, 68, 0.1)" }}
          >
            Discard Session (v + 4)
          </button>
        )}
      </div>

      {slowestBigrams.length > 0 && (
        <details className="border p-4" open>
          <summary className="cursor-pointer transition-colors" style={{ color: "var(--color-text-muted)" }}>
            <h3 className="text-xs font-medium" style={{ color: "var(--color-text-primary)" }}>
              Slowest Bi-grammars
            </h3>
          </summary>
          <div className="space-y-2 mt-3">
            {slowestBigrams.map((stat, index) => (
              <div
                key={stat.bigram}
                className="flex items-center justify-between py-2 border-b last:border-0"
                style={{ borderColor: "var(--color-border)" }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs w-4" style={{ color: "var(--color-text-muted)" }}>
                    {index + 1}.
                  </span>
                  <code className="text-sm font-mono" style={{ color: "var(--color-text-primary)" }}>
                    {stat.bigram}
                  </code>
                </div>
                <div className="text-right">
                  <div className="text-xs font-medium" style={{ color: "var(--color-text-primary)" }}>
                    {stat.avgLatency.toFixed(0)}ms
                  </div>
                  <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {stat.count}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {Object.keys(bigramStats).length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer transition-colors" style={{ color: "var(--color-text-muted)" }}>
            Raw keystroke data ({keystrokes.length} events)
          </summary>
          <pre className="mt-2 p-3 border overflow-auto max-h-40" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--background)", color: "var(--color-text-secondary)" }}>
            {JSON.stringify(keystrokes.slice(-20), null, 2)}
          </pre>
        </details>
      )}

      <SessionSummaryModal
        isOpen={showSummaryModal}
        onClose={() => setShowSummaryModal(false)}
        onStartDrill={handleStartDrill}
        onTryAgain={handleTryAgain}
        onNextTest={handleNextTest}
        wpm={summaryData?.wpm || 0}
        accuracy={summaryData?.accuracy || 0}
        improvedBigrams={summaryData?.improvedBigrams || []}
        weakestBigrams={summaryData?.weakestBigrams || []}
        slowestBigrams={slowestBigrams}
      />

      <DrillCompletionModal
        isOpen={showDrillModal}
        onClose={() => setShowDrillModal(false)}
        onContinueDrill={handleContinueDrill}
        onReturnToNormal={handleReturnToNormal}
        wpm={summaryData?.wpm || 0}
        accuracy={summaryData?.accuracy || 0}
        improvedBigrams={summaryData?.improvedBigrams || []}
        slowestBigrams={slowestBigrams}
        practicedBigrams={practicedBigrams}
      />
    </div>
  );
}
