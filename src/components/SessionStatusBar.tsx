"use client";

interface SessionStatusBarProps {
  wpm?: number;
  accuracy?: number;
  timeElapsed?: number;
  isActive?: boolean;
}

export default function SessionStatusBar({
  wpm = 0,
  accuracy = 100,
  timeElapsed = 0,
  isActive = false,
}: SessionStatusBarProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 border-t px-4 py-2 flex justify-between items-center text-xs"
      style={{
        borderColor: "var(--color-border)",
        backgroundColor: "var(--background)",
        color: "var(--color-text-secondary)",
      }}
    >
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span style={{ color: "var(--color-text-muted)" }}>WPM</span>
          <span className="font-medium" style={{ color: "var(--color-text-primary)" }}>
            {wpm}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span style={{ color: "var(--color-text-muted)" }}>ACC</span>
          <span className="font-medium" style={{ color: "var(--color-text-primary)" }}>
            {accuracy}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span style={{ color: "var(--color-text-muted)" }}>TIME</span>
          <span className="font-medium" style={{ color: "var(--color-text-primary)" }}>
            {formatTime(timeElapsed)}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full" style={{ 
          backgroundColor: isActive ? "var(--color-accent)" : "var(--color-text-muted)",
          opacity: isActive ? 1 : 0.5 
        }} />
        <span style={{ color: "var(--color-text-muted)" }}>
          {isActive ? "Recording" : "Ready"}
        </span>
      </div>
    </div>
  );
}
