import {
  insertSession as localInsertSession,
  upsertBigramScores as localUpsertBigramScores,
  upsertLetterScores as localUpsertLetterScores,
  upsertWordScores as localUpsertWordScores,
  getLetterScores as localGetLetterScores,
  insertBigramScoreHistory as localInsertBigramScoreHistory,
  getPreviousBigramScores as localGetPreviousBigramScores,
  getWeakestBigrams as localGetWeakestBigrams,
  getWeakestBigramsForTable as localGetWeakestBigramsForTable,
  getStrongestBigramsForTable as localGetStrongestBigramsForTable,
  getRecentSessions as localGetRecentSessions,
  getWeakestWords as localGetWeakestWords,
  getWeakestWordsForTable as localGetWeakestWordsForTable,
  deleteSession as localDeleteSession,
  updateSessionWpm as localUpdateSessionWpm,
  auditDuplicateFreeformSessions as localAuditDuplicateFreeformSessions,
  deleteDuplicateFreeformSessions as localDeleteDuplicateFreeformSessions,
  bootstrapDerivedSessionsToTriple as localBootstrapDerivedSessionsToTriple,
} from "./local-storage";
import type {
  DuplicateFreeformSessionAudit,
  DerivedSessionBootstrapSummary,
} from "./local-storage";
import type {
  SessionCaptureSource,
  SessionContextKey,
  SessionTextOrigin,
} from "@/lib/session-context";

interface SessionData {
  userId: string;
  startedAt: Date;
  endedAt: Date;
  mode: string;
  captureSource: SessionCaptureSource;
  textOrigin: SessionTextOrigin;
  contextKey: SessionContextKey;
  wpm: number;
  accuracy: number;
  rawErrorCount: number;
}

interface ScoreData {
  sessionId: string;
  userId: string;
  item: string; // bigram, letter, or word
  captureSource: SessionCaptureSource;
  textOrigin: SessionTextOrigin;
  contextKey: SessionContextKey;
  avgLatencyMs: number;
  errorRate: number;
  normalizedScore: number;
  sampleCount: number;
}

/**
 * Inserts a new session into the database.
 */
export async function insertSession(data: SessionData): Promise<string | null> {
  return localInsertSession(data);
}

/**
 * Upserts bigram scores for a session.
 */
export async function upsertBigramScores(
  scores: ScoreData[],
  sessionId: string | null = null
): Promise<void> {
  await localUpsertBigramScores(
    scores.map((score) => ({
      userId: score.userId,
      item: score.item,
      captureSource: score.captureSource,
      textOrigin: score.textOrigin,
      contextKey: score.contextKey,
      avgLatencyMs: score.avgLatencyMs,
      errorRate: score.errorRate,
      normalizedScore: score.normalizedScore,
      sampleCount: score.sampleCount,
    }))
  );
  console.log(`Upserted ${scores.length} bigram scores`);

  // Insert history records for tracking improvements
  for (const score of scores) {
    await insertBigramScoreHistory(
      score.userId,
      score.item,
      score.normalizedScore,
      sessionId
    );
  }
}

/**
 * Upserts letter scores for a session.
 */
export async function upsertLetterScores(scores: ScoreData[]): Promise<void> {
  await localUpsertLetterScores(
    scores.map((score) => ({
      userId: score.userId,
      item: score.item,
      captureSource: score.captureSource,
      textOrigin: score.textOrigin,
      contextKey: score.contextKey,
      avgLatencyMs: score.avgLatencyMs,
      errorRate: score.errorRate,
      normalizedScore: score.normalizedScore,
      sampleCount: score.sampleCount,
    }))
  );
  console.log(`Upserted ${scores.length} letter scores`);
}

/**
 * Upserts word scores for a session.
 */
export async function upsertWordScores(scores: ScoreData[]): Promise<void> {
  await localUpsertWordScores(
    scores.map((score) => ({
      userId: score.userId,
      item: score.item,
      captureSource: score.captureSource,
      textOrigin: score.textOrigin,
      contextKey: score.contextKey,
      avgLatencyMs: score.avgLatencyMs,
      errorRate: score.errorRate,
      normalizedScore: score.normalizedScore,
      sampleCount: score.sampleCount,
    }))
  );
  console.log(`Upserted ${scores.length} word scores`);
}

export interface LetterScore {
  letter: string;
  avg_latency_ms: number;
  error_rate: number;
  normalized_score: number;
  sample_count: number;
  last_updated: string;
}

/**
 * Fetches letter scores for a user.
 */
export async function getLetterScores(userId: string): Promise<LetterScore[]> {
  return localGetLetterScores(userId);
}

export interface BigramScoreHistory {
  id: string;
  user_id: string;
  bigram: string;
  normalized_score: number;
  session_id: string | null;
  created_at: string;
}

/**
 * Inserts a bigram score history record.
 */
export async function insertBigramScoreHistory(
  userId: string,
  bigram: string,
  normalizedScore: number,
  sessionId: string | null
): Promise<void> {
  await localInsertBigramScoreHistory(userId, bigram, normalizedScore, sessionId);
}

/**
 * Fetches bigram scores from the user's most recent session (before current one).
 */
export async function getPreviousBigramScores(
  userId: string,
  currentSessionId: string | null
): Promise<Record<string, number>> {
  return localGetPreviousBigramScores(userId, currentSessionId);
}

export interface ImprovedBigram {
  bigram: string;
  previousScore: number;
  currentScore: number;
  improvement: number;
}

/**
 * Computes the most improved bigrams by comparing current scores to previous session.
 */
export async function getMostImprovedBigrams(
  userId: string,
  currentSessionId: string | null,
  currentScores: Record<string, number>
): Promise<ImprovedBigram[]> {
  const previousScores = await getPreviousBigramScores(userId, currentSessionId);

  const improvements: ImprovedBigram[] = [];

  for (const [bigram, currentScore] of Object.entries(currentScores)) {
    const previousScore = previousScores[bigram];
    if (previousScore !== undefined) {
      const improvement = currentScore - previousScore;
      improvements.push({
        bigram,
        previousScore,
        currentScore,
        improvement,
      });
    }
  }

  // Sort by improvement (descending) and return top 3
  return improvements
    .sort((a, b) => b.improvement - a.improvement)
    .slice(0, 3);
}

export interface BigramTableData {
  bigram: string;
  avg_latency_ms: number;
  normalized_score: number;
  sample_count: number;
}

export interface WeakestBigram {
  bigram: string;
  normalized_score: number;
}

/**
 * Fetches the weakest bigrams (lowest normalized_score) for a user.
 */
export async function getWeakestBigrams(
  userId: string,
  limit: number = 3,
  contextKey?: SessionContextKey
): Promise<WeakestBigram[]> {
  return localGetWeakestBigrams(userId, limit, contextKey);
}

/**
 * Fetches the weakest bigrams with full details for the progress table.
 */
export async function getWeakestBigramsForTable(
  userId: string,
  limit: number = 10,
  contextKey?: SessionContextKey
): Promise<BigramTableData[]> {
  return localGetWeakestBigramsForTable(userId, limit, contextKey);
}

/**
 * Fetches the strongest bigrams (highest normalized_score) for a user.
 */
export async function getStrongestBigramsForTable(
  userId: string,
  limit: number = 10,
  contextKey?: SessionContextKey
): Promise<BigramTableData[]> {
  return localGetStrongestBigramsForTable(userId, limit, contextKey);
}

export interface SessionWPMData {
  id: string;
  started_at: string;
  wpm: number;
  mode: string;
  capture_source: SessionCaptureSource;
  text_origin: SessionTextOrigin;
  context_key: SessionContextKey;
}

/**
 * Fetches the most recent sessions with WPM data for the progress chart.
 */
export async function getRecentSessions(
  userId: string,
  limit: number = 20,
  includeSampleFallback: boolean = true
): Promise<SessionWPMData[]> {
  return localGetRecentSessions(userId, limit, includeSampleFallback);
}

export interface WeakestWord {
  word: string;
  normalized_score: number;
}

/**
 * Fetches the weakest words (lowest normalized_score) for a user.
 */
export async function getWeakestWords(
  userId: string,
  limit: number = 3,
  contextKey?: SessionContextKey
): Promise<WeakestWord[]> {
  return localGetWeakestWords(userId, limit, contextKey);
}

export interface WordTableData {
  word: string;
  avg_latency_ms: number;
  error_rate: number;
  normalized_score: number;
  sample_count: number;
}

/**
 * Fetches the weakest words with full details for the progress table.
 */
export async function getWeakestWordsForTable(
  userId: string,
  limit: number = 10,
  contextKey?: SessionContextKey
): Promise<WordTableData[]> {
  return localGetWeakestWordsForTable(userId, limit, contextKey);
}

/**
 * Deletes a session by ID.
 */
export async function deleteSession(sessionId: string): Promise<void> {
  return localDeleteSession(sessionId);
}

/**
 * Updates a session's WPM.
 */
export async function updateSessionWpm(sessionId: string, wpm: number): Promise<void> {
  return localUpdateSessionWpm(sessionId, wpm);
}

/**
 * Bootstraps derived sessions to triple.
 */
export async function bootstrapDerivedSessionsToTriple(data: {
  userId: string;
  force?: boolean;
}): Promise<DerivedSessionBootstrapSummary> {
  return localBootstrapDerivedSessionsToTriple(data);
}

export type { DuplicateFreeformSessionAudit };
export type { DerivedSessionBootstrapSummary };

export async function auditDuplicateFreeformSessions(
  userId: string,
  toleranceMs?: number
): Promise<DuplicateFreeformSessionAudit> {
  return localAuditDuplicateFreeformSessions(userId, toleranceMs);
}

export async function deleteDuplicateFreeformSessions(
  userId: string,
  toleranceMs?: number
): Promise<{
  deletedCount: number;
  auditBeforeDelete: DuplicateFreeformSessionAudit;
  auditAfterDelete: DuplicateFreeformSessionAudit;
}> {
  return localDeleteDuplicateFreeformSessions(userId, toleranceMs);
}
