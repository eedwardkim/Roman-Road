"use client";

import { useEffect, useState } from "react";

interface BigramData {
  bigram: string;
  avg_latency_ms?: number;
  avgLatency?: number;
  normalized_score?: number;
  score?: number;
  sample_count?: number;
  count?: number;
  occurrences?: number;
  improvement?: number;
}

interface WordData {
  word: string;
  avg_latency_ms: number;
  error_rate: number;
  normalized_score: number;
  sample_count: number;
}

interface AISummaryProps {
  bigramData?: BigramData[];
  wordData?: WordData[];
}

export default function AISummary({ bigramData, wordData }: AISummaryProps) {
  const [summary, setSummary] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function generateSummary() {
      // Only generate if we have data
      if ((!bigramData || bigramData.length === 0) && (!wordData || wordData.length === 0)) {
        setIsLoading(false);
        return;
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch("/api/ai-summary", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            bigramData: bigramData || [],
            wordData: wordData || [],
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error("Failed to generate summary");
        }

        const data = await response.json();
        // Remove all markdown formatting
        const formattedSummary = data.summary
          .replace(/\*\*([^*]+)\*\*/g, '$1')
          .replace(/\*([^*]+)\*/g, '$1');
        setSummary(formattedSummary);
      } catch (err) {
        console.error("Failed to generate AI summary:", err);
        setError("Unable to load AI summary");
      } finally {
        setIsLoading(false);
      }
    }

    generateSummary();
  }, []);

  // Don't render anything if no data
  if ((!bigramData || bigramData.length === 0) && (!wordData || wordData.length === 0)) {
    return null;
  }

  return (
    <div className="mb-6 p-5 rounded-lg border-l-4" style={{ 
      borderColor: "var(--color-border)", 
      borderLeftColor: "var(--color-accent)",
      backgroundColor: "var(--color-surface)" 
    }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--color-accent)" }}>
          AI Insights
        </span>
      </div>
      {isLoading ? (
        <div className="flex items-center gap-3 p-4">
          <div className="animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full" style={{ color: "var(--color-accent)" }}></div>
          <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>Analyzing your typing patterns...</span>
        </div>
      ) : error ? (
        <div className="text-sm p-2" style={{ color: "var(--color-text-muted)" }}>{error}</div>
      ) : (
        <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
          {summary}
        </p>
      )}
    </div>
  );
}
