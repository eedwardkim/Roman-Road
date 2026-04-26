"use client";

import { useEffect, useState } from "react";
import ProgressSection from "@/components/ProgressSection";
import Navigation from "@/components/Navigation";
import KeyboardShortcuts from "@/components/KeyboardShortcuts";
import { getLocalUserId } from "@/lib/db/local-storage";

export default function ProfilePage() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setUserId(getLocalUserId());
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  if (!userId) return null;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--background)" }}>
      <Navigation />
      <main className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-lg font-medium mb-1" style={{ color: "var(--color-text-primary)" }}>
            Progress
          </h1>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            Track your typing improvement with detailed analytics
          </p>
        </div>

        <ProgressSection userId={userId} />
      </main>
      <KeyboardShortcuts />
    </div>
  );
}
