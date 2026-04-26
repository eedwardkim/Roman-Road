"use client";

interface RecordingToastProps {
  isVisible: boolean;
}

export default function RecordingToast({ isVisible }: RecordingToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-hidden={!isVisible}
      className={`fixed bottom-4 right-4 z-50 pointer-events-none transition-opacity duration-300 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className="flex items-center gap-2 px-3 py-1.5 border text-xs font-medium shadow-sm"
        style={{
          backgroundColor: "var(--background)",
          borderColor: "var(--color-border)",
          color: "var(--color-text-primary)",
        }}
      >
        <span
          className="inline-block w-2 h-2 rounded-full animate-pulse"
          style={{ backgroundColor: "#ef4444" }}
        />
        Recording
      </div>
    </div>
  );
}
