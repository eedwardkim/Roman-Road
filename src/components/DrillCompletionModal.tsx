"use client";

import { ImprovedBigram, WeakestBigram } from "@/lib/db/sessions";
import { BigramStats } from "@/types/typing";
import AISummary from "./AISummary";

function formatImprovementPoints(improvement: number) {
  return `${improvement > 0 ? "+" : ""}${improvement.toFixed(1)} pts`;
}

interface DrillCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinueDrill: () => void;
  onReturnToNormal: () => void;
  wpm: number;
  accuracy: number;
  improvedBigrams: ImprovedBigram[];
  slowestBigrams: BigramStats[];
  practicedBigrams: WeakestBigram[];
}

export default function DrillCompletionModal({
  isOpen,
  onClose,
  onContinueDrill,
  onReturnToNormal,
  wpm,
  accuracy,
  improvedBigrams,
  slowestBigrams,
  practicedBigrams,
}: DrillCompletionModalProps) {
  if (!isOpen) return null;

  // Calculate improvement metrics
  const totalImproved = improvedBigrams.filter(b => b.improvement > 0).length;
  const avgImprovement = improvedBigrams.length > 0
    ? improvedBigrams.reduce((sum, b) => sum + Math.max(0, b.improvement), 0) / improvedBigrams.length
    : 0;

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
          <h2 className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>Drill Complete!</h2>
          <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
            Great work on your targeted practice
          </p>
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
            ...practicedBigrams.map(b => ({ bigram: b.bigram, score: b.normalized_score })),
            ...slowestBigrams.map(b => ({ bigram: b.bigram, avgLatency: b.avgLatency, count: b.count })),
          ]}
        />

        {/* Improvement Summary */}
        <div className="mb-6 border p-3">
          <div className="border-b pb-2 mb-2" style={{ borderColor: "var(--color-border)" }}>
            <h3 className="text-xs font-medium" style={{ color: "var(--color-text-primary)" }}>
              Improvement Summary
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs mb-1" style={{ color: "var(--color-text-muted)" }}>Bi-grammars Improved</div>
              <div className="text-xl font-medium" style={{ color: "var(--color-accent)" }}>{totalImproved}</div>
            </div>
            <div>
              <div className="text-xs mb-1" style={{ color: "var(--color-text-muted)" }}>Avg. Improvement</div>
              <div className="text-[11px] mb-1" style={{ color: "var(--color-text-muted)" }}>
                Normalized score points; higher is faster.
              </div>
              <div className="text-xl font-medium" style={{ color: "var(--color-accent)" }}>
                {formatImprovementPoints(avgImprovement)}
              </div>
            </div>
          </div>
        </div>

        {/* Most Improved Bigrams */}
        {improvedBigrams.length > 0 && (
          <div className="mb-4 border p-3">
            <div className="border-b pb-2 mb-2" style={{ borderColor: "var(--color-border)" }}>
              <h3 className="text-xs font-medium" style={{ color: "var(--color-text-primary)" }}>
                Most Improved Bi-grammars
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
                {improvedBigrams.slice(0, 5).map((item, idx) => (
                  <tr
                    key={item.bigram}
                    style={{ borderBottom: idx < Math.min(5, improvedBigrams.length) - 1 ? "1px solid var(--color-border)" : "none" }}
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
                      {formatImprovementPoints(item.improvement)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Practiced Bigrams */}
        {practicedBigrams.length > 0 && (
          <div className="mb-6 border p-3">
            <div className="border-b pb-2 mb-2" style={{ borderColor: "var(--color-border)" }}>
              <h3 className="text-xs font-medium" style={{ color: "var(--color-text-primary)" }}>
                Bi-grammars You Practiced
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {practicedBigrams.slice(0, 10).map((item) => (
                <code
                  key={item.bigram}
                  className="px-2 py-1 text-xs font-mono border"
                  style={{ 
                    backgroundColor: "var(--color-surface)", 
                    borderColor: "var(--color-border)",
                    color: "var(--color-text-secondary)" 
                  }}
                >
                  {item.bigram}
                </code>
              ))}
            </div>
          </div>
        )}

        {/* Still Challenging */}
        {slowestBigrams.length > 0 && (
          <div className="mb-6 border p-3">
            <div className="border-b pb-2 mb-2" style={{ borderColor: "var(--color-border)" }}>
              <h3 className="text-xs font-medium" style={{ color: "var(--color-text-primary)" }}>
                Still Challenging (Slowest in Drill)
              </h3>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left" style={{ borderBottom: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}>
                  <th className="pb-2">Bi-grammar</th>
                  <th className="pb-2 text-right">Avg Latency</th>
                </tr>
              </thead>
              <tbody>
                {slowestBigrams.slice(0, 5).map((item, index) => (
                  <tr
                    key={item.bigram}
                    style={{ borderBottom: index < Math.min(5, slowestBigrams.length) - 1 ? "1px solid var(--color-border)" : "none" }}
                  >
                    <td className="py-2">
                      <code className="font-mono" style={{ color: "var(--color-text-secondary)" }}>
                        {item.bigram}
                      </code>
                    </td>
                    <td className="py-2 text-right" style={{ color: "var(--color-text-secondary)" }}>
                      {item.avgLatency.toFixed(0)}ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onContinueDrill}
            className="flex-1 px-4 py-2 text-xs font-medium border transition-colors hover:opacity-70"
            style={{ 
              borderColor: "var(--color-accent)",
              color: "var(--color-accent)"
            }}
          >
            Continue Drill
          </button>
          <button
            onClick={onReturnToNormal}
            className="flex-1 px-4 py-2 text-xs font-medium border transition-colors hover:opacity-70"
            style={{ 
              borderColor: "var(--color-border)",
              color: "var(--color-text-primary)"
            }}
          >
            Return to Normal
          </button>
        </div>
      </div>
    </div>
  );
}
