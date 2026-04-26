"use client";

import { useEffect, useState, useCallback } from "react";
import WPMChart from "./WPMChart";
import BigramTable from "./BigramTable";
import WordTable from "./WordTable";
import AISummary from "./AISummary";
import {
  getRecentSessions,
  getWeakestBigramsForTable,
  getWeakestWordsForTable,
  deleteSession,
  updateSessionWpm,
  bootstrapDerivedSessionsToTriple,
  auditDuplicateFreeformSessions,
  deleteDuplicateFreeformSessions,
  type SessionWPMData,
  type BigramTableData,
  type WordTableData,
  type DuplicateFreeformSessionAudit,
  type DerivedSessionBootstrapSummary,
} from "@/lib/db/sessions";
import { computeTypingArchetype, upsertProfile } from "@/lib/db/profiles";
import { IN_APP_PROMPTED_CONTEXT, IN_APP_FREEFORM_CONTEXT } from "@/lib/session-context";
import { clearInvalidSessions, clearAllData } from "@/lib/db/local-storage";

interface ProgressSectionProps {
  userId: string;
}

export default function ProgressSection({ userId }: ProgressSectionProps) {
  const [sessions, setSessions] = useState<SessionWPMData[]>([]);
  const [weakestBigramsFreeform, setWeakestBigramsFreeform] = useState<BigramTableData[]>([]);
  const [weakestBigramsPrompted, setWeakestBigramsPrompted] = useState<BigramTableData[]>([]);
  const [weakestWords, setWeakestWords] = useState<WordTableData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBigramAnalysisExpanded, setIsBigramAnalysisExpanded] = useState(false);
  const [isWordAnalysisExpanded, setIsWordAnalysisExpanded] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const [isDeletingSession, setIsDeletingSession] = useState(false);
  const [isUpdatingSessionWpm, setIsUpdatingSessionWpm] = useState(false);
  const [isAuditingDuplicates, setIsAuditingDuplicates] = useState(false);
  const [isDeletingDuplicates, setIsDeletingDuplicates] = useState(false);
  const [isBootstrappingSessions, setIsBootstrappingSessions] = useState(false);
  const [duplicateAudit, setDuplicateAudit] = useState<DuplicateFreeformSessionAudit | null>(null);
  const [bootstrapSummary, setBootstrapSummary] = useState<DerivedSessionBootstrapSummary | null>(null);
  const [showDevTools, setShowDevTools] = useState(false);
  const [allowSampleFallback, setAllowSampleFallback] = useState(true);

  const refreshProfileMetadata = useCallback(async () => {
    const [realSessions, typingArchetype] = await Promise.all([
      getRecentSessions(userId, Number.MAX_SAFE_INTEGER, false),
      computeTypingArchetype(userId),
    ]);

    await upsertProfile({
      userId,
      totalSessions: realSessions.length,
      typingArchetype,
    });
  }, [userId]);

  const fetchData = useCallback(async (includeSampleFallback: boolean = allowSampleFallback) => {
    setLoading(true);
    try {
      const [sessionsData, weakestFreeformData, weakestPromptedData, wordsData] = await Promise.all([
        getRecentSessions(userId, Number.MAX_SAFE_INTEGER, includeSampleFallback),
        getWeakestBigramsForTable(userId, 10, IN_APP_FREEFORM_CONTEXT),
        getWeakestBigramsForTable(userId, 10, IN_APP_PROMPTED_CONTEXT),
        getWeakestWordsForTable(userId, 10, IN_APP_PROMPTED_CONTEXT),
      ]);

      console.log("Profile data fetched:", { sessions: sessionsData.length, weakestFreeform: weakestFreeformData.length, weakestPrompted: weakestPromptedData.length, words: wordsData.length });

      setSessions(sessionsData);
      setWeakestBigramsFreeform(weakestFreeformData);
      setWeakestBigramsPrompted(weakestPromptedData);
      setWeakestWords(wordsData);
    } catch (error) {
      console.error("Failed to fetch progress data:", error);
    } finally {
      setLoading(false);
    }
  }, [userId, allowSampleFallback]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchData();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [fetchData]);

  const handleClearInvalidData = useCallback(async () => {
    setIsClearing(true);
    try {
      const deletedCount = await clearInvalidSessions(userId);
      if (deletedCount > 0) {
        setAllowSampleFallback(false);
        console.log(`Cleared ${deletedCount} invalid sessions, refreshing data...`);
        await refreshProfileMetadata();
        await fetchData(false);
      }
    } catch (error) {
      console.error("Failed to clear invalid data:", error);
    } finally {
      setIsClearing(false);
    }
  }, [userId, fetchData, refreshProfileMetadata]);

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    setIsDeletingSession(true);
    try {
      setAllowSampleFallback(false);
      await deleteSession(sessionId);
      console.log(`Deleted session ${sessionId}, refreshing data...`);
      await refreshProfileMetadata();
      await fetchData(false);
    } catch (error) {
      console.error("Failed to delete session:", error);
    } finally {
      setIsDeletingSession(false);
    }
  }, [fetchData, refreshProfileMetadata]);

  const handleUpdateSessionWpm = useCallback(async (sessionId: string, wpm: number) => {
    setIsUpdatingSessionWpm(true);
    try {
      await updateSessionWpm(sessionId, wpm);
      setAllowSampleFallback(false);
      console.log(`Updated session ${sessionId} to ${wpm} WPM, refreshing data...`);
      await fetchData(false);
    } catch (error) {
      console.error("Failed to update session WPM:", error);
      throw error;
    } finally {
      setIsUpdatingSessionWpm(false);
    }
  }, [fetchData]);

  const handleAuditDuplicateFreeformSessions = useCallback(async () => {
    setIsAuditingDuplicates(true);
    try {
      const audit = await auditDuplicateFreeformSessions(userId);
      setDuplicateAudit(audit);
      setAllowSampleFallback(false);
    } catch (error) {
      console.error("Failed to audit duplicate freeform sessions:", error);
    } finally {
      setIsAuditingDuplicates(false);
    }
  }, [userId]);

  const handleDeleteDuplicateFreeformSessions = useCallback(async () => {
    if (!duplicateAudit || duplicateAudit.duplicateSessions.length === 0) {
      return;
    }

    if (!confirm(`Delete ${duplicateAudit.duplicateSessions.length} overlapping freeform/system-wide duplicate sessions? Structured sessions will be kept.`)) {
      return;
    }

    setIsDeletingDuplicates(true);
    try {
      const result = await deleteDuplicateFreeformSessions(userId);
      setAllowSampleFallback(false);
      setDuplicateAudit(result.auditAfterDelete);
      await refreshProfileMetadata();
      await fetchData(false);
    } catch (error) {
      console.error("Failed to delete duplicate freeform sessions:", error);
    } finally {
      setIsDeletingDuplicates(false);
    }
  }, [duplicateAudit, fetchData, refreshProfileMetadata, userId]);

  const handleBootstrapDerivedSessions = useCallback(async () => {
    if (!confirm("This will create roughly 2N derived sessions for the current local user. Are you sure?")) {
      return;
    }
    setIsBootstrappingSessions(true);
    try {
      const summary = await bootstrapDerivedSessionsToTriple({ userId });
      setBootstrapSummary(summary);
      setAllowSampleFallback(false);
      console.log(`Bootstrapped ${summary.createdCount} derived sessions, refreshing data...`);
      await refreshProfileMetadata();
      await fetchData(false);
    } catch (error) {
      console.error("Failed to bootstrap derived sessions:", error);
    } finally {
      setIsBootstrappingSessions(false);
    }
  }, [userId, fetchData, refreshProfileMetadata]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchData]);

  useEffect(() => {
    const keysPressed = new Set<string>();
    
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.add(e.key.toLowerCase());
      if (keysPressed.has('v') && keysPressed.has('4')) {
        setShowDevTools(prev => !prev);
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.delete(e.key.toLowerCase());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleWipeAllData = useCallback(async () => {
    if (!confirm("This will permanently delete ALL your typing data. Are you sure?")) {
      return;
    }
    setIsWiping(true);
    try {
      await clearAllData();
      window.location.reload();
    } catch (error) {
      console.error("Failed to wipe data:", error);
      setIsWiping(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="p-6 rounded-lg" style={{ backgroundColor: "var(--color-surface)" }}>
          <p style={{ color: "var(--color-text-secondary)" }}>Loading progress data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-10">
      <div className="flex min-w-0 items-center justify-end">
        {showDevTools && (
          <div className="flex min-w-0 flex-wrap gap-2">
            <button
              onClick={handleWipeAllData}
              disabled={isWiping || loading}
              className="px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-50"
              style={{ 
                backgroundColor: "#dc2626", 
                color: "white" 
              }}
              title="Wipe ALL data and start fresh"
            >
              {isWiping ? "Wiping..." : "Wipe All"}
            </button>
            <button
              onClick={handleClearInvalidData}
              disabled={isClearing || loading}
              className="px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-50"
              style={{ 
                backgroundColor: "var(--color-error, #ef4444)", 
                color: "white" 
              }}
              title="Clear sessions with invalid dates"
            >
              {isClearing ? "Clearing..." : "Fix Data"}
            </button>
            <button
              onClick={() => {
                void fetchData();
              }}
              disabled={loading}
              className="px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-50"
              style={{ 
                backgroundColor: "var(--color-surface-hover)", 
                color: "var(--color-text-primary)" 
              }}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
            <button
              onClick={() => {
                void handleAuditDuplicateFreeformSessions();
              }}
              disabled={isAuditingDuplicates || loading}
              className="px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-50"
              style={{ 
                backgroundColor: "var(--color-surface-hover)", 
                color: "var(--color-text-primary)" 
              }}
            >
              {isAuditingDuplicates ? "Auditing..." : "Audit Free Flow"}
            </button>
            <button
              onClick={() => {
                void handleDeleteDuplicateFreeformSessions();
              }}
              disabled={
                isDeletingDuplicates ||
                loading ||
                !duplicateAudit ||
                duplicateAudit.duplicateSessions.length === 0
              }
              className="px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-50"
              style={{ 
                backgroundColor: "#dc2626", 
                color: "white" 
              }}
            >
              {isDeletingDuplicates ? "Deleting..." : "Delete Duplicates"}
            </button>
            <button
              onClick={() => {
                void handleBootstrapDerivedSessions();
              }}
              disabled={isBootstrappingSessions || loading}
              className="px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-50"
              style={{
                backgroundColor: "#2563eb",
                color: "white"
              }}
              title="Bootstrap roughly 2N derived sessions for the current local user"
            >
              {isBootstrappingSessions ? "Bootstrapping..." : "Triple Sessions"}
            </button>
          </div>
        )}
      </div>

      {showDevTools && duplicateAudit && (
        <section className="border p-4 text-xs space-y-3" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-surface)" }}>
          <div className="flex flex-wrap gap-4" style={{ color: "var(--color-text-secondary)" }}>
            <span>Total sessions: {duplicateAudit.totalSessions}</span>
            <span>Structured: {duplicateAudit.structuredSessions}</span>
            <span>Freeform/system-wide: {duplicateAudit.freeformSessions}</span>
            <span>Duplicates: {duplicateAudit.duplicateSessions.length}</span>
            <span>After cleanup: {duplicateAudit.remainingSessionsAfterCleanup}</span>
          </div>
          {duplicateAudit.duplicateSessions.length > 0 ? (
            <div className="space-y-2">
              {duplicateAudit.duplicateSessions.slice(0, 5).map((session) => (
                <div key={session.id} className="border-t pt-2" style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}>
                  <div style={{ color: "var(--color-text-primary)" }}>
                    {session.mode} / {session.context_key} / {session.wpm} WPM
                  </div>
                  <div>
                    {new Date(session.started_at).toLocaleString()} overlaps {session.overlapping_session_mode} from {new Date(session.overlapping_started_at).toLocaleString()}
                  </div>
                </div>
              ))}
              {duplicateAudit.duplicateSessions.length > 5 && (
                <div style={{ color: "var(--color-text-muted)" }}>
                  +{duplicateAudit.duplicateSessions.length - 5} more duplicate sessions
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: "var(--color-text-secondary)" }}>
              No overlapping freeform/system-wide duplicate sessions found.
            </div>
          )}
        </section>
      )}

      {showDevTools && bootstrapSummary && (
        <section className="border p-4 text-xs space-y-2" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-surface)" }}>
          <div style={{ color: "var(--color-text-primary)" }}>
            Derived session bootstrap: {bootstrapSummary.status}
          </div>
          <div className="flex flex-wrap gap-4" style={{ color: "var(--color-text-secondary)" }}>
            <span>Source: {bootstrapSummary.sourceCount}</span>
            <span>Created: {bootstrapSummary.createdCount}</span>
            <span>Final: {bootstrapSummary.finalCount}</span>
            <span>Target: {bootstrapSummary.targetFinalCount}</span>
            <span>Skipped: {bootstrapSummary.skippedSourceCount}</span>
          </div>
        </section>
      )}

      <section>
        <WPMChart
          data={sessions}
          onDeleteSession={handleDeleteSession}
          onUpdateSessionWpm={handleUpdateSessionWpm}
          showDevTools={showDevTools}
          isDeletingSession={isDeletingSession}
          isUpdatingSessionWpm={isUpdatingSessionWpm}
        />
      </section>

      {/* AI Summary for Bigrams */}
      <section>
        <AISummary
          bigramData={[
            ...weakestBigramsFreeform.map(b => ({ bigram: b.bigram, avg_latency_ms: b.avg_latency_ms, score: b.normalized_score, count: b.sample_count })),
            ...weakestBigramsPrompted.map(b => ({ bigram: b.bigram, avg_latency_ms: b.avg_latency_ms, score: b.normalized_score, count: b.sample_count })),
          ]}
          wordData={weakestWords.map(w => ({ word: w.word, avg_latency_ms: w.avg_latency_ms, error_rate: w.error_rate, normalized_score: w.normalized_score, sample_count: w.sample_count }))}
        />
      </section>

      <section>
        <button
          onClick={() => setIsWordAnalysisExpanded(!isWordAnalysisExpanded)}
          className="w-full flex items-center gap-2 mb-4 cursor-pointer"
          style={{ WebkitAppearance: "none", appearance: "none", font: "inherit" }}
        >
          <div className="h-px min-w-0 flex-1" style={{ backgroundColor: "var(--color-border)" }}></div>
          <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>
            Top 10 Poorest Performing Words
          </span>
          <span className="text-xs transition-transform" style={{ color: "var(--color-text-muted)" }}>
            {isWordAnalysisExpanded ? "▼" : "▶"}
          </span>
          <div className="h-px min-w-0 flex-1" style={{ backgroundColor: "var(--color-border)" }}></div>
        </button>
        <div className="text-xs mb-4" style={{ color: "var(--color-text-muted)" }}>
          Diagnostic word analysis reflects prompted in-app sessions so free-form capture stays separate.
        </div>
        {isWordAnalysisExpanded && (
          <WordTable title="Top 10 Poorest Performing Words" data={weakestWords} />
        )}
      </section>

      <section>
        <button
          onClick={() => setIsBigramAnalysisExpanded(!isBigramAnalysisExpanded)}
          className="w-full flex items-center gap-2 mb-4 cursor-pointer"
          style={{ WebkitAppearance: "none", appearance: "none", font: "inherit" }}
        >
          <div className="h-px min-w-0 flex-1" style={{ backgroundColor: "var(--color-border)" }}></div>
          <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>
            Bi-grammar Analysis
          </span>
          <span className="text-xs transition-transform" style={{ color: "var(--color-text-muted)" }}>
            {isBigramAnalysisExpanded ? "▼" : "▶"}
          </span>
          <div className="h-px min-w-0 flex-1" style={{ backgroundColor: "var(--color-border)" }}></div>
        </button>
        <div className="text-xs mb-4" style={{ color: "var(--color-text-muted)" }}>
          Comparing weakest Bi-grammar patterns from free-form writing vs prompted diagnostics within the website (in-app context).
        </div>
        {isBigramAnalysisExpanded && (
          <div className="grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-2">
            <BigramTable title="Weakest Bi-grammar Patterns (Free-form)" data={weakestBigramsFreeform} />
            <BigramTable title="Weakest Bi-grammar Patterns (Diagnostics)" data={weakestBigramsPrompted} />
          </div>
        )}
      </section>
    </div>
  );
}
