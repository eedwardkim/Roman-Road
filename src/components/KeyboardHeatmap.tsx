"use client";

import { useState } from "react";
import { LetterScore } from "@/lib/db/sessions";

interface KeyboardHeatmapProps {
  letterScores: LetterScore[];
}

const KEYBOARD_ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Z", "X", "C", "V", "B", "N", "M"],
];

export default function KeyboardHeatmap({ letterScores }: KeyboardHeatmapProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  // Create a map of letter to score for quick lookup
  const scoreMap = new Map(
    letterScores.map((score) => [score.letter.toLowerCase(), score])
  );

  // Calculate min and max latency for dynamic normalization
  const latencies = letterScores.map(s => s.avg_latency_ms);
  const minLatency = latencies.length > 0 ? Math.min(...latencies) : 0;
  const maxLatency = latencies.length > 0 ? Math.max(...latencies) : 0;
  const latencyRange = maxLatency - minLatency || 1; // Avoid division by zero

  // Get color based on latency (lower = greener)
  const getKeyColor = (letter: string): string => {
    const score = scoreMap.get(letter.toLowerCase());
    if (!score) return "#27272a"; // Gray for no data

    // Normalize latency: 0 = fastest (min), 1 = slowest (max)
    const normalized = (score.avg_latency_ms - minLatency) / latencyRange;
    
    // Enhanced gradient: Green (fast) -> Yellow -> Red (slow)
    // Green: rgb(34, 197, 94), Yellow: rgb(234, 179, 8), Red: rgb(239, 68, 68)
    let red, green, blue;
    
    if (normalized < 0.5) {
      // Green to Yellow
      const t = normalized * 2; // 0 to 1
      red = Math.round(34 + (234 - 34) * t);
      green = Math.round(197 + (179 - 197) * t);
      blue = Math.round(94 + (8 - 94) * t);
    } else {
      // Yellow to Red
      const t = (normalized - 0.5) * 2; // 0 to 1
      red = Math.round(234 + (239 - 234) * t);
      green = Math.round(179 + (68 - 179) * t);
      blue = Math.round(8 + (68 - 8) * t);
    }
    
    return `rgb(${red}, ${green}, ${blue})`;
  };

  const handleMouseEnter = (letter: string) => {
    setHoveredKey(letter);
  };

  const handleMouseLeave = () => {
    setHoveredKey(null);
  };

  const sortedScores = [...letterScores].sort((a, b) => a.avg_latency_ms - b.avg_latency_ms);
  const fastestScore = sortedScores[0];
  const slowestScore = sortedScores[sortedScores.length - 1];
  const totalSamples = letterScores.reduce((sum, score) => sum + score.sample_count, 0);

  const getKeyTextColor = (letter: string): string => {
    const score = scoreMap.get(letter.toLowerCase());
    if (!score) return "var(--color-text-secondary)";

    const normalized = (score.avg_latency_ms - minLatency) / latencyRange;
    if (normalized > 0.72) return "#ffffff";

    return "#06110c";
  };

  const getTooltipPositionClasses = (rowIndex: number): string => {
    if (rowIndex === 0) {
      return "top-full mt-3";
    }

    return "bottom-full mb-3";
  };

  return (
    <div
      className="rounded-[2rem] border shadow-2xl"
      style={{
        borderColor: "var(--color-border)",
        background:
          "linear-gradient(145deg, rgba(24, 24, 27, 0.94), rgba(9, 9, 11, 0.94))",
        boxShadow: "0 24px 80px rgba(0, 0, 0, 0.42)",
      }}
    >
      <div
        className="border-b px-5 py-5 sm:px-8"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2
              className="text-lg font-semibold tracking-[-0.02em]"
              style={{ color: "var(--color-text-primary)" }}
            >
              Letter latency
            </h2>
            <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
              Hover any key to inspect its average latency, score, and sample depth.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 text-left sm:grid-cols-3 sm:text-right">
            <div
              className="rounded-2xl border px-3 py-2"
              style={{
                borderColor: "var(--color-border)",
                backgroundColor: "rgba(0, 0, 0, 0.22)",
              }}
            >
              <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--color-text-muted)" }}>
                Fastest
              </div>
              <div className="mt-1 text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                {fastestScore ? fastestScore.letter.toUpperCase() : "—"}
              </div>
            </div>
            <div
              className="rounded-2xl border px-3 py-2"
              style={{
                borderColor: "var(--color-border)",
                backgroundColor: "rgba(0, 0, 0, 0.22)",
              }}
            >
              <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--color-text-muted)" }}>
                Slowest
              </div>
              <div className="mt-1 text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                {slowestScore ? slowestScore.letter.toUpperCase() : "—"}
              </div>
            </div>
            <div
              className="rounded-2xl border px-3 py-2"
              style={{
                borderColor: "var(--color-border)",
                backgroundColor: "rgba(0, 0, 0, 0.22)",
              }}
            >
              <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--color-text-muted)" }}>
                Samples
              </div>
              <div className="mt-1 text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                {totalSamples}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-3 py-8 sm:px-8 sm:py-10">
        <div
          className="mx-auto max-w-3xl rounded-[1.5rem] border px-3 py-10 sm:px-8"
          style={{
            borderColor: "rgba(255, 255, 255, 0.08)",
            background:
              "radial-gradient(circle at center, rgba(16, 185, 129, 0.08), transparent 22rem), rgba(0, 0, 0, 0.28)",
          }}
        >
          <div className="overflow-x-auto pb-1">
            <div className="mx-auto flex w-max min-w-full flex-col gap-3">
              {KEYBOARD_ROWS.map((row, rowIndex) => (
                <div key={rowIndex} className="flex justify-center gap-3">
                  {row.map((letter) => {
                    const score = scoreMap.get(letter.toLowerCase());
                    const color = getKeyColor(letter);
                    const isHovered = hoveredKey === letter;

                    return (
                      <div
                        key={letter}
                        className={isHovered ? "relative z-40" : "relative z-0"}
                        onMouseEnter={() => handleMouseEnter(letter)}
                        onMouseLeave={handleMouseLeave}
                      >
                        <button
                          type="button"
                          className="relative flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-black shadow-lg transition-all duration-200 hover:-translate-y-1 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-emerald-300/70 sm:h-14 sm:w-14"
                          style={{
                            backgroundColor: color,
                            border: "1px solid rgba(255, 255, 255, 0.16)",
                            boxShadow:
                              "0 16px 30px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.22)",
                            color: getKeyTextColor(letter),
                          }}
                          aria-label={
                            score
                              ? `${letter}, ${score.avg_latency_ms.toFixed(1)} milliseconds average latency`
                              : `${letter}, no data`
                          }
                        >
                          {letter}
                        </button>

                        {hoveredKey === letter && score && (
                          <div
                            className={`absolute left-1/2 z-[120] w-44 -translate-x-1/2 rounded-2xl border px-3 py-3 text-xs shadow-2xl ${getTooltipPositionClasses(rowIndex)}`}
                            style={{
                              borderColor: "var(--color-border)",
                              backgroundColor: "rgba(9, 9, 11, 0.96)",
                              color: "var(--color-text-secondary)",
                            }}
                          >
                            <div className="mb-2 text-sm font-bold" style={{ color: "var(--color-text-primary)" }}>
                              {letter}
                            </div>
                            <div className="flex justify-between gap-3">
                              <span>Latency</span>
                              <span style={{ color: "var(--color-text-primary)" }}>{score.avg_latency_ms.toFixed(1)}ms</span>
                            </div>
                            <div className="mt-1 flex justify-between gap-3">
                              <span>Score</span>
                              <span style={{ color: "var(--color-text-primary)" }}>{score.normalized_score.toFixed(2)}</span>
                            </div>
                            <div className="mt-1 flex justify-between gap-3">
                              <span>Samples</span>
                              <span style={{ color: "var(--color-text-primary)" }}>{score.sample_count}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs" style={{ color: "var(--color-text-muted)" }}>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: "rgb(34, 197, 94)" }} />
              <span>Fast</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: "rgb(234, 179, 8)" }} />
              <span>Medium</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: "rgb(239, 68, 68)" }} />
              <span>Slow</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full border"
                style={{
                  backgroundColor: "#27272a",
                  borderColor: "rgba(255, 255, 255, 0.14)",
                }}
              />
              <span>No data</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
