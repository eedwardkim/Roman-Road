"use client";

import { useState } from "react";
import { ImprovedBigram, WeakestBigram } from "@/lib/db/sessions";
import { BigramStats } from "@/types/typing";
import AISummary from "./AISummary";

interface SessionSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartDrill: () => void;
  onTryAgain: () => void;
  onNextTest: () => void;
  wpm: number;
  accuracy: number;
  improvedBigrams: ImprovedBigram[];
  weakestBigrams: WeakestBigram[];
  slowestBigrams: BigramStats[];
}

export default function SessionSummaryModal({
  isOpen,
  onClose,
  onStartDrill,
  onTryAgain,
  onNextTest,
  wpm,
  accuracy,
  improvedBigrams,
  weakestBigrams,
  slowestBigrams,
}: SessionSummaryModalProps) {
  const [isSlowestBigramsOpen, setIsSlowestBigramsOpen] = useState(false);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto border"
        style={{ backgroundColor: "var(--background)", borderColor: "var(--color-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b pb-3 mb-4" style={{ borderColor: "var(--color-border)" }}>
          <h2 className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>Session Summary</h2>
        </div>

        {/* Session Metrics */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="border p-3">
            <div className="text-xs mb-1" style={{ color: "var(--color-text-muted)" }}>WPM</div>
            <div className="text-2xl font-medium" style={{ color: "var(--color-accent)" }}>{wpm}</div>
          </div>
          <div className="border p-3">
            <div className="text-xs mb-1" style={{ color: "var(--color-text-muted)" }}>Accuracy</div>
            <div className="text-2xl font-medium" style={{ color: "var(--color-accent)" }}>{accuracy}%</div>
          </div>
        </div>

        {/* AI Summary */}
        <AISummary
          bigramData={[
            ...improvedBigrams.map(b => ({ bigram: b.bigram, score: b.currentScore, improvement: b.improvement })),
            ...weakestBigrams.map(b => ({ bigram: b.bigram, score: b.normalized_score })),
            ...slowestBigrams.map(b => ({ bigram: b.bigram, avgLatency: b.avgLatency, count: b.count })),
          ]}
        />

        {/* Most Improved Bigrams */}
        {improvedBigrams.length > 0 && (
          <div className="mb-4 border p-3">
            <div className="border-b pb-2 mb-2" style={{ borderColor: "var(--color-border)" }}>
              <h3 className="text-xs font-medium" style={{ color: "var(--color-text-primary)" }}>
                Improved Bi-grammars
              </h3>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left" style={{ borderBottom: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}>
                  <th className="pb-2">Bi-grammar</th>
                  <th className="pb-2 text-right">Improvement</th>
                </tr>
              </thead>
              <tbody>
                {improvedBigrams.map((item, idx) => (
                  <tr
                    key={item.bigram}
                    style={{ borderBottom: idx < improvedBigrams.length - 1 ? "1px solid var(--color-border)" : "none" }}
                  >
                    <td className="py-2">
                      <code className="font-mono" style={{ color: "var(--color-accent)" }}>
                        {item.bigram}
                      </code>
                    </td>
                    <td className="py-2 text-right" style={{ 
                      color: item.improvement > 0 
                        ? "var(--color-accent)" 
                        : item.improvement < 0 
                        ? "#ef4444" 
                        : "var(--color-text-muted)" 
                    }}>
                      {item.improvement > 0 ? "+" : ""}{item.improvement.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Slowest Bigrams (This Session) */}
        <div className="mb-6">
          <button
            onClick={() => setIsSlowestBigramsOpen(!isSlowestBigramsOpen)}
            className="w-full flex items-center justify-between text-left"
            style={{ color: "var(--color-text-primary)" }}
          >
            <h3 className="text-lg font-semibold">
              Slowest Bi-grammars (This Session)
            </h3>
            <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              {isSlowestBigramsOpen ? "▼" : "▶"}
            </span>
          </button>
          {isSlowestBigramsOpen && (
            <div className="mt-3">
              {slowestBigrams.length === 0 ? (
                <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>No data available</div>
              ) : (
                <div className="rounded-lg overflow-hidden" style={{ backgroundColor: "var(--color-surface-hover)" }}>
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-xs" style={{ borderBottom: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}>
                        <th className="px-4 py-2">Bi-grammar</th>
                        <th className="px-4 py-2">Avg Latency</th>
                        <th className="px-4 py-2">Occurrences</th>
                      </tr>
                    </thead>
                    <tbody>
                      {slowestBigrams.map((item, index) => (
                        <tr
                          key={item.bigram}
                          style={{ borderBottom: index < slowestBigrams.length - 1 ? "1px solid var(--color-border)" : "none" }}
                        >
                          <td className="px-4 py-2">
                            <span className="mr-2" style={{ color: "var(--color-text-muted)" }}>{index + 1}.</span>
                            <code className="px-2 py-1 rounded font-mono" style={{ backgroundColor: "var(--color-surface)", color: "var(--color-accent)" }}>
                              {item.bigram}
                            </code>
                          </td>
                          <td className="px-4 py-2" style={{ color: "var(--color-text-secondary)" }}>
                            {item.avgLatency.toFixed(0)}ms
                          </td>
                          <td className="px-4 py-2" style={{ color: "var(--color-text-muted)" }}>
                            {item.count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onTryAgain}
            className="flex-1 px-4 py-2 text-xs font-medium border transition-colors hover:opacity-70"
            style={{
              borderColor: "var(--color-border)",
              color: "var(--color-text-primary)"
            }}
          >
            Try Again
          </button>
          <button
            onClick={onNextTest}
            className="flex-1 px-4 py-2 text-xs font-medium border transition-colors hover:opacity-70"
            style={{
              borderColor: "var(--color-border)",
              color: "var(--color-text-primary)"
            }}
          >
            Next Test
          </button>
        </div>
      </div>
    </div>
  );
}
