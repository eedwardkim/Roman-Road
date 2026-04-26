"use client";

import { useEffect, useMemo, useState } from "react";
import { createFallbackDrillBrief, deriveDrillContextData, formatDrillBigram } from "@/lib/db/drills";

interface DrillContextPanelProps {
  isLoadingDrill: boolean;
  weakestBigrams: Array<{ bigram: string; normalized_score: number }>;
  weakestWords: Array<{ word: string; normalized_score: number }>;
  targetText: string;
}

export default function DrillContextPanel({
  isLoadingDrill,
  weakestBigrams,
  weakestWords,
  targetText,
}: DrillContextPanelProps) {
  const drillContext = useMemo(
    () => deriveDrillContextData(weakestBigrams, weakestWords, targetText),
    [weakestBigrams, weakestWords, targetText]
  );
  const fallbackBrief = useMemo(
    () => createFallbackDrillBrief(drillContext),
    [drillContext]
  );
  const requestBody = useMemo(
    () =>
      JSON.stringify({
        weakestBigrams,
        weakestWords,
        targetText,
      }),
    [weakestBigrams, weakestWords, targetText]
  );
  const requestKey = useMemo(() => `${requestBody}:${fallbackBrief}`, [requestBody, fallbackBrief]);
  const hasContext = drillContext.focusBigrams.length > 0 || drillContext.highlightedWords.length > 0;
  const [resolvedBrief, setResolvedBrief] = useState<{
    requestKey: string;
    brief: string;
    source: "local" | "ai";
  } | null>(null);

  const brief = !hasContext || isLoadingDrill
    ? ""
    : resolvedBrief?.requestKey === requestKey
      ? resolvedBrief.brief
      : fallbackBrief;
  const source = resolvedBrief?.requestKey === requestKey ? resolvedBrief.source : "local";
  const isRefining = hasContext && !isLoadingDrill && resolvedBrief?.requestKey !== requestKey;

  useEffect(() => {
    if (isLoadingDrill || !hasContext) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 10000);

    fetch("/api/drill-context", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: requestBody,
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load drill context");
        }

        return response.json();
      })
      .then((data: { brief?: string; source?: "local" | "ai" }) => {
        setResolvedBrief({
          requestKey,
          brief: typeof data.brief === "string" && data.brief.trim() ? data.brief.trim() : fallbackBrief,
          source: data.source === "ai" ? "ai" : "local",
        });
      })
      .catch((error) => {
        console.error("Failed to load drill context:", error);
        setResolvedBrief({
          requestKey,
          brief: fallbackBrief,
          source: "local",
        });
      });

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [fallbackBrief, hasContext, isLoadingDrill, requestBody, requestKey]);

  return (
    <div
      className="border p-4 h-[500px] overflow-y-auto"
      style={{
        borderColor: "var(--color-border)",
        backgroundColor: "var(--background)",
      }}
    >
      <div className="flex items-start justify-between gap-3 border-b pb-2 mb-3" style={{ borderColor: "var(--color-border)" }}>
        <div>
          <h3 className="text-xs font-medium" style={{ color: "var(--color-text-primary)" }}>
            Drill Briefing
          </h3>
          <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
            Derived from your current training batches.
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-wide" style={{ color: "var(--color-accent)" }}>
          {isRefining ? "Refining" : source === "ai" ? "Claude" : "Local"}
        </span>
      </div>

      {isLoadingDrill ? (
        <div className="flex items-center justify-center h-full text-sm" style={{ color: "var(--color-text-muted)" }}>
          Building your drill briefing...
        </div>
      ) : !brief ? (
        <div className="text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
          Start a drill to see which key pairs and words this batch is targeting.
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
            {brief}
          </p>

          <div>
            <div className="text-[11px] uppercase tracking-wide mb-2" style={{ color: "var(--color-text-muted)" }}>
              Key pairs
            </div>
            <div className="space-y-2">
              {drillContext.exampleWordsByBigram.map(({ bigram, words }) => (
                <div
                  key={bigram}
                  className="border px-3 py-2"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <code className="text-sm" style={{ color: "var(--color-accent)" }}>
                      {formatDrillBigram(bigram)}
                    </code>
                    <span className="text-xs text-right" style={{ color: "var(--color-text-muted)" }}>
                      {words.length ? words.join(", ") : "Watch the transition itself"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-wide mb-2" style={{ color: "var(--color-text-muted)" }}>
              Words to watch
            </div>
            <div className="flex flex-wrap gap-2">
              {drillContext.highlightedWords.map((word) => (
                <span
                  key={word}
                  className="px-2 py-1 text-xs border"
                  style={{
                    borderColor: "var(--color-border)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  {word}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
