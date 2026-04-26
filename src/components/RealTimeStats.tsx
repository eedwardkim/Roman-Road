"use client";

interface RealTimeStatsProps {
  wpm?: number;
  accuracy?: number;
  keystrokes?: number;
  progress?: number;
  total?: number;
}

export default function RealTimeStats({
  wpm = 0,
  accuracy = 100,
  keystrokes = 0,
  progress = 0,
  total = 0,
}: RealTimeStatsProps) {
  return (
    <div
      className="border p-4 space-y-4"
      style={{
        borderColor: "var(--color-border)",
        backgroundColor: "var(--background)",
      }}
    >
      <div className="border-b pb-2" style={{ borderColor: "var(--color-border)" }}>
        <h3 className="text-xs font-medium" style={{ color: "var(--color-text-primary)" }}>
          Session Stats
        </h3>
      </div>
      
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            WPM
          </span>
          <span className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
            {wpm}
          </span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            Accuracy
          </span>
          <span className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
            {accuracy}%
          </span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            Keystrokes
          </span>
          <span className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
            {keystrokes}
          </span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            Progress
          </span>
          <span className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
            {progress}/{total}
          </span>
        </div>
      </div>

      <div className="pt-2 border-t" style={{ borderColor: "var(--color-border)" }}>
        <div className="w-full h-1 rounded-full" style={{ backgroundColor: "var(--color-surface)" }}>
          <div
            className="h-full rounded-full transition-all duration-200"
            style={{
              width: total > 0 ? `${(progress / total) * 100}%` : "0%",
              backgroundColor: "var(--color-accent)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
