"use client";

import { TypingMode, TypingConfig } from "@/lib/wordSources";

interface TypingModeSelectorProps {
  config: TypingConfig;
  onConfigChange: (config: TypingConfig) => void;
}

export default function TypingModeSelector({ config, onConfigChange }: TypingModeSelectorProps) {
  const modes: { value: TypingMode; label: string }[] = [
    { value: "random", label: "Random" },
    { value: "normal", label: "Normal" },
    { value: "drill", label: "Drill" },
  ];

  const activeStyle = {
    color: "var(--color-accent)",
    borderBottom: "1px solid var(--color-accent)",
  };

  const inactiveStyle = {
    color: "var(--color-text-secondary)",
    borderBottom: "1px solid transparent",
  };

  return (
    <div className="flex items-center gap-6">
      {modes.map((mode) => (
        <button
          key={mode.value}
          onClick={() => onConfigChange({ ...config, mode: mode.value })}
          className={`text-xs pb-1 transition-colors hover:opacity-70 ${mode.value === "drill" ? "ml-auto" : ""}`}
          style={config.mode === mode.value ? activeStyle : inactiveStyle}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
