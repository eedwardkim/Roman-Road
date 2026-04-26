"use client";

import { useCallback, useEffect, useState } from "react";
import Navigation from "@/components/Navigation";
import TypingTest from "@/components/TypingTest";
import KeyboardShortcuts from "@/components/KeyboardShortcuts";
import RealTimeStats from "@/components/RealTimeStats";
import SessionStatusBar from "@/components/SessionStatusBar";
import KeystrokeVisualization from "@/components/KeystrokeVisualization";
import RecordingToast from "@/components/RecordingToast";
import RapidSandbox from "@/components/RapidSandbox";
import { getProfile } from "@/lib/db/profiles";
import { getLocalUserId } from "@/lib/db/local-storage";
import { useSystemWideCapture } from "@/hooks/useSystemWideCapture";

export default function FreeFlowPage() {
  const [typingArchetype, setTypingArchetype] = useState("balanced");
  const {
    isRecording: isSystemWideRecording,
    typedText: systemWideText,
    sessionStartTime: systemWideSessionStart,
    isCaptureReady,
    captureStatus,
    captureError,
    stopRecording,
  } = useSystemWideCapture({
    enabled: true,
    autoStart: true,
  });
  const [sessionStats, setSessionStats] = useState({
    wpm: 0,
    accuracy: 100,
    keystrokes: 0,
    progress: 0,
    total: 0,
    timeElapsed: 0,
    isActive: false,
    keystrokeLatencies: [] as number[],
  });

  useEffect(() => {
    const loadProfile = async () => {
      const userId = getLocalUserId();
      const profile = await getProfile(userId);
      setTypingArchetype(profile?.typing_archetype || "balanced");
    };
    loadProfile();
  }, []);

  const handleSessionUpdate = useCallback((stats: {
    wpm: number;
    accuracy: number;
    keystrokes: number;
    progress: number;
    total: number;
    timeElapsed: number;
    isActive: boolean;
    keystrokeLatencies: number[];
  }) => {
    setSessionStats(stats);
  }, []);

  return (
    <div className="min-h-screen pb-12" style={{ backgroundColor: "var(--background)" }}>
      <Navigation />
      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <div className="mb-6">
              <h1 className="text-lg font-medium mb-1" style={{ color: "var(--color-text-primary)" }}>
                Free Flow
              </h1>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                Capture your natural typing anywhere on your system and review your freeform session stats.
              </p>
            </div>

            <TypingTest
              initialMode="free"
              fixedMode="free"
              showModeSelector={false}
              onSessionUpdate={handleSessionUpdate}
              systemWideText={systemWideText}
              isSystemWideRecording={isSystemWideRecording}
              systemWideSessionStart={systemWideSessionStart}
              isSystemWideCaptureReady={isCaptureReady}
              systemWideCaptureStatus={captureStatus}
              systemWideCaptureError={captureError}
              stopSystemWideRecording={stopRecording}
            />
          </div>

          <div className="lg:col-span-1 space-y-4">
            <RealTimeStats
              wpm={sessionStats.wpm}
              accuracy={sessionStats.accuracy}
              keystrokes={sessionStats.keystrokes}
              progress={sessionStats.progress}
              total={sessionStats.total}
            />

            <KeystrokeVisualization
              keystrokes={sessionStats.keystrokeLatencies}
              isActive={sessionStats.isActive}
            />

            <RapidSandbox archetype={typingArchetype} />
          </div>
        </div>
      </main>

      <SessionStatusBar
        wpm={sessionStats.wpm}
        accuracy={sessionStats.accuracy}
        timeElapsed={sessionStats.timeElapsed}
        isActive={sessionStats.isActive}
      />

      <KeyboardShortcuts />

      <RecordingToast isVisible={isSystemWideRecording} />
    </div>
  );
}
