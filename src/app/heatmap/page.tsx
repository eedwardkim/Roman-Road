"use client";

import { useEffect, useState } from "react";
import KeyboardHeatmap from "@/components/KeyboardHeatmap";
import { getLetterScores, LetterScore } from "@/lib/db/sessions";
import Navigation from "@/components/Navigation";
import KeyboardShortcuts from "@/components/KeyboardShortcuts";
import { getLocalUserId } from "@/lib/db/local-storage";

export default function HeatmapPage() {
  const [letterScores, setLetterScores] = useState<LetterScore[]>([]);

  useEffect(() => {
    const loadData = async () => {
      const userId = getLocalUserId();
      const scores = await getLetterScores(userId);
      console.log("Fetched letter scores for user:", userId, "Count:", scores.length);
      setLetterScores(scores);
    };
    loadData();
  }, []);

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          "radial-gradient(circle at top, rgba(16, 185, 129, 0.12), transparent 34rem), var(--background)",
      }}
    >
      <Navigation />
      <main className="container mx-auto px-4 py-10 sm:py-14">
        <section className="mx-auto max-w-5xl">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p
                className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em]"
                style={{ color: "var(--color-accent)" }}
              >
                Performance map
              </p>
              <h1
                className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl"
                style={{ color: "var(--color-text-primary)" }}
              >
                Keyboard Heatmap
              </h1>
              <p
                className="mt-3 max-w-2xl text-sm leading-6"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Visualize which letters feel automatic, which ones slow you down, and where your next practice reps should go.
              </p>
            </div>
            <div
              className="w-fit rounded-full border px-3 py-1.5 text-xs font-medium"
              style={{
                borderColor: "var(--color-border)",
                backgroundColor: "rgba(24, 24, 27, 0.72)",
                color: "var(--color-text-secondary)",
              }}
            >
              {letterScores.length > 0 ? `${letterScores.length} letters tracked` : "No letters tracked"}
            </div>
          </div>

          <KeyboardHeatmap letterScores={letterScores} />

          {letterScores.length === 0 && (
            <div
              className="mt-6 rounded-2xl border p-5 text-center"
              style={{
                borderColor: "var(--color-border)",
                backgroundColor: "rgba(24, 24, 27, 0.52)",
              }}
            >
              <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                No typing data yet. Complete some typing tests to see your heatmap.
              </p>
            </div>
          )}
        </section>
      </main>
      <KeyboardShortcuts />
    </div>
  );
}
