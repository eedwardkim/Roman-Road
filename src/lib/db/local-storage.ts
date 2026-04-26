import { getSessionContext, isContextAwareRecord } from "@/lib/session-context";
import type {
  SessionCaptureSource,
  SessionContextKey,
  SessionTextOrigin,
} from "@/lib/session-context";

// Local IndexedDB storage for typing data

const DB_NAME = "KeyMaxxDB";
const DB_VERSION = 2;
const LOCAL_DEV_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);
const DERIVED_SESSION_BOOTSTRAP_MULTIPLIER = 3;
const DERIVED_SESSION_BOOTSTRAP_MARKER_PREFIX = "keymaxx_derived_session_bootstrap";

interface Session {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string;
  mode: string;
  capture_source?: SessionCaptureSource;
  text_origin?: SessionTextOrigin;
  context_key?: SessionContextKey;
  wpm: number;
  accuracy: number;
  raw_error_count: number;
  created_at: string;
}

interface BigramScore {
  id?: string;
  user_id: string;
  capture_source?: SessionCaptureSource;
  text_origin?: SessionTextOrigin;
  context_key?: SessionContextKey;
  bigram: string;
  avg_latency_ms: number;
  error_rate: number;
  normalized_score: number;
  sample_count: number;
  last_updated: string;
}

interface LetterScore {
  id?: string;
  user_id: string;
  capture_source?: SessionCaptureSource;
  text_origin?: SessionTextOrigin;
  context_key?: SessionContextKey;
  letter: string;
  avg_latency_ms: number;
  error_rate: number;
  normalized_score: number;
  sample_count: number;
  last_updated: string;
}

interface WordScore {
  id?: string;
  user_id: string;
  capture_source?: SessionCaptureSource;
  text_origin?: SessionTextOrigin;
  context_key?: SessionContextKey;
  word: string;
  avg_latency_ms: number;
  error_rate: number;
  normalized_score: number;
  sample_count: number;
  last_updated: string;
}

interface BigramScoreHistory {
  id: string;
  user_id: string;
  bigram: string;
  normalized_score: number;
  session_id: string | null;
  created_at: string;
}

interface Profile {
  id: string;
  user_id: string;
  total_sessions: number;
  last_active: string;
  typing_archetype: string;
  created_at: string;
  updated_at: string;
}

export interface DuplicateFreeformSessionCandidate {
  id: string;
  started_at: string;
  ended_at: string;
  mode: string;
  wpm: number;
  capture_source: SessionCaptureSource;
  text_origin: SessionTextOrigin;
  context_key: SessionContextKey;
  overlapping_session_id: string;
  overlapping_session_mode: string;
  overlapping_started_at: string;
  overlapping_ended_at: string;
}

export interface DuplicateFreeformSessionAudit {
  totalSessions: number;
  structuredSessions: number;
  freeformSessions: number;
  duplicateSessions: DuplicateFreeformSessionCandidate[];
  remainingSessionsAfterCleanup: number;
}

export interface DerivedSessionBootstrapSummary {
  status: "created" | "already_bootstrapped" | "noop";
  userId: string;
  sourceCount: number;
  createdCount: number;
  finalCount: number;
  targetFinalCount: number;
  skippedSourceCount: number;
  markerKey: string;
}

let db: IDBDatabase | null = null;

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      const transaction = request.transaction;

      if (!database.objectStoreNames.contains("sessions")) {
        const sessionsStore = database.createObjectStore("sessions", { keyPath: "id" });
        sessionsStore.createIndex("user_id", "user_id", { unique: false });
        sessionsStore.createIndex("created_at", "created_at", { unique: false });
      }

      if (transaction) {
        const bigramStore = database.objectStoreNames.contains("bigram_scores")
          ? transaction.objectStore("bigram_scores")
          : database.createObjectStore("bigram_scores", { keyPath: "id", autoIncrement: true });
        if (!bigramStore.indexNames.contains("user_id")) {
          bigramStore.createIndex("user_id", "user_id", { unique: false });
        }
        if (bigramStore.indexNames.contains("user_id_bigram")) {
          bigramStore.deleteIndex("user_id_bigram");
        }
        if (!bigramStore.indexNames.contains("user_id_context_bigram")) {
          bigramStore.createIndex("user_id_context_bigram", ["user_id", "context_key", "bigram"], { unique: true });
        }
      }

      if (transaction) {
        const letterStore = database.objectStoreNames.contains("letter_scores")
          ? transaction.objectStore("letter_scores")
          : database.createObjectStore("letter_scores", { keyPath: "id", autoIncrement: true });
        if (!letterStore.indexNames.contains("user_id")) {
          letterStore.createIndex("user_id", "user_id", { unique: false });
        }
        if (letterStore.indexNames.contains("user_id_letter")) {
          letterStore.deleteIndex("user_id_letter");
        }
        if (!letterStore.indexNames.contains("user_id_context_letter")) {
          letterStore.createIndex("user_id_context_letter", ["user_id", "context_key", "letter"], { unique: true });
        }
      }

      if (transaction) {
        const wordStore = database.objectStoreNames.contains("word_scores")
          ? transaction.objectStore("word_scores")
          : database.createObjectStore("word_scores", { keyPath: "id", autoIncrement: true });
        if (!wordStore.indexNames.contains("user_id")) {
          wordStore.createIndex("user_id", "user_id", { unique: false });
        }
        if (wordStore.indexNames.contains("user_id_word")) {
          wordStore.deleteIndex("user_id_word");
        }
        if (!wordStore.indexNames.contains("user_id_context_word")) {
          wordStore.createIndex("user_id_context_word", ["user_id", "context_key", "word"], { unique: true });
        }
      }

      if (!database.objectStoreNames.contains("bigram_score_history")) {
        const historyStore = database.createObjectStore("bigram_score_history", { keyPath: "id", autoIncrement: true });
        historyStore.createIndex("user_id", "user_id", { unique: false });
        historyStore.createIndex("session_id", "session_id", { unique: false });
      }

      if (!database.objectStoreNames.contains("profiles")) {
        const profilesStore = database.createObjectStore("profiles", { keyPath: "id" });
        profilesStore.createIndex("user_id", "user_id", { unique: true });
      }
    };
  });
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function randomInteger(min: number, max: number) {
  return Math.round(randomBetween(min, max));
}

function buildDerivedSessionBootstrapMarkerKey(userId: string) {
  return `${DERIVED_SESSION_BOOTSTRAP_MARKER_PREFIX}:${userId}:x${DERIVED_SESSION_BOOTSTRAP_MULTIPLIER}`;
}

function resolveScoreRecordContext(record: {
  capture_source?: SessionCaptureSource;
  text_origin?: SessionTextOrigin;
  context_key?: SessionContextKey;
}) {
  if (record.context_key) {
    const captureSource =
      record.capture_source ??
      (record.context_key.startsWith("system_wide") ? "system_wide" : "in_app");
    const textOrigin =
      record.text_origin ??
      (record.context_key.endsWith("freeform") ? "freeform" : "prompted");

    return {
      captureSource,
      textOrigin,
      contextKey: record.context_key,
    };
  }

  const fallbackMode = record.capture_source === "system_wide"
    ? "system_wide"
    : record.text_origin === "freeform"
      ? "free"
      : "wpm_test";

  return getSessionContext(fallbackMode, {
    captureSource: record.capture_source,
    textOrigin: record.text_origin,
  });
}

function resolveSessionRecordContext(session: Pick<Session, "mode"> & Partial<Pick<Session, "capture_source" | "text_origin">>) {
  return getSessionContext(session.mode, {
    captureSource: session.capture_source,
    textOrigin: session.text_origin,
  });
}

function filterScoreRecordsByContext<T extends { context_key?: string }>(
  records: T[],
  contextKey?: SessionContextKey
): T[] {
  const contextAwareRecords = records.filter(isContextAwareRecord);

  if (contextAwareRecords.length > 0) {
    return contextKey
      ? contextAwareRecords.filter((record) => record.context_key === contextKey)
      : contextAwareRecords;
  }

  return contextKey ? [] : records;
}

function getSessionStartMs(session: Session) {
  return new Date(session.started_at).getTime();
}

function getSessionEndMs(session: Session) {
  const endedAt = new Date(session.ended_at).getTime();
  if (Number.isFinite(endedAt)) {
    return endedAt;
  }

  return getSessionStartMs(session);
}

function isValidSessionTimestamp(session: Session) {
  const minValidTimestamp = new Date("2020-01-01").getTime();
  const startedAt = getSessionStartMs(session);
  const endedAt = getSessionEndMs(session);

  return (
    Number.isFinite(startedAt) &&
    Number.isFinite(endedAt) &&
    startedAt > minValidTimestamp
  );
}

function isFreeformSessionRecord(session: Session) {
  const context = resolveSessionRecordContext(session);

  return (
    session.mode === "free" ||
    session.mode === "system_wide" ||
    context.captureSource === "system_wide" ||
    context.textOrigin === "freeform"
  );
}

function isStructuredSessionRecord(session: Session) {
  const context = resolveSessionRecordContext(session);

  return (
    !isFreeformSessionRecord(session) &&
    context.captureSource === "in_app" &&
    context.textOrigin === "prompted"
  );
}

function sessionsOverlap(
  candidate: Session,
  structured: Session,
  toleranceMs: number
) {
  const candidateStart = getSessionStartMs(candidate);
  const candidateEnd = getSessionEndMs(candidate);
  const structuredStart = getSessionStartMs(structured);
  const structuredEnd = getSessionEndMs(structured);

  return (
    candidateStart <= structuredEnd + toleranceMs &&
    candidateEnd >= structuredStart - toleranceMs
  );
}

function buildDuplicateFreeformAudit(
  sessions: Session[],
  toleranceMs: number
): DuplicateFreeformSessionAudit {
  const validSessions = sessions.filter(isValidSessionTimestamp);
  const structuredSessions = validSessions.filter(isStructuredSessionRecord);
  const freeformSessions = validSessions.filter(isFreeformSessionRecord);
  const duplicateSessions: DuplicateFreeformSessionCandidate[] = [];
  const seenDuplicateIds = new Set<string>();

  for (const candidate of freeformSessions) {
    const overlappingStructuredSession = structuredSessions.find((structured) =>
      sessionsOverlap(candidate, structured, toleranceMs)
    );

    if (!overlappingStructuredSession || seenDuplicateIds.has(candidate.id)) {
      continue;
    }

    const context = resolveSessionRecordContext(candidate);
    duplicateSessions.push({
      id: candidate.id,
      started_at: candidate.started_at,
      ended_at: candidate.ended_at,
      mode: candidate.mode,
      wpm: Number(candidate.wpm) || 0,
      capture_source: context.captureSource,
      text_origin: context.textOrigin,
      context_key: context.contextKey,
      overlapping_session_id: overlappingStructuredSession.id,
      overlapping_session_mode: overlappingStructuredSession.mode,
      overlapping_started_at: overlappingStructuredSession.started_at,
      overlapping_ended_at: overlappingStructuredSession.ended_at,
    });
    seenDuplicateIds.add(candidate.id);
  }

  return {
    totalSessions: validSessions.length,
    structuredSessions: structuredSessions.length,
    freeformSessions: freeformSessions.length,
    duplicateSessions,
    remainingSessionsAfterCleanup: validSessions.length - duplicateSessions.length,
  };
}

async function getAllUserSessions(database: IDBDatabase, userId: string): Promise<Session[]> {
  return new Promise((resolve, reject) => {
    const index = database.transaction("sessions", "readonly")
      .objectStore("sessions")
      .index("user_id");
    const request = index.getAll(IDBKeyRange.only(userId));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllUserBigramScoreHistory(database: IDBDatabase, userId: string): Promise<BigramScoreHistory[]> {
  return new Promise((resolve, reject) => {
    const index = database.transaction("bigram_score_history", "readonly")
      .objectStore("bigram_score_history")
      .index("user_id");
    const request = index.getAll(IDBKeyRange.only(userId));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllUserBigramScores(database: IDBDatabase, userId: string): Promise<BigramScore[]> {
  return new Promise((resolve, reject) => {
    const index = database.transaction("bigram_scores", "readonly")
      .objectStore("bigram_scores")
      .index("user_id");
    const request = index.getAll(IDBKeyRange.only(userId));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllUserLetterScores(database: IDBDatabase, userId: string): Promise<LetterScore[]> {
  return new Promise((resolve, reject) => {
    const index = database.transaction("letter_scores", "readonly")
      .objectStore("letter_scores")
      .index("user_id");
    const request = index.getAll(IDBKeyRange.only(userId));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllUserWordScores(database: IDBDatabase, userId: string): Promise<WordScore[]> {
  return new Promise((resolve, reject) => {
    const index = database.transaction("word_scores", "readonly")
      .objectStore("word_scores")
      .index("user_id");
    const request = index.getAll(IDBKeyRange.only(userId));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Session operations
export async function insertSession(data: {
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
}): Promise<string | null> {
  try {
    const minValidTimestamp = new Date("2020-01-01").getTime();
    const startedAtTimestamp = data.startedAt.getTime();
    const endedAtTimestamp = data.endedAt.getTime();

    if (isNaN(startedAtTimestamp) || startedAtTimestamp < minValidTimestamp) {
      console.error("Invalid startedAt date:", data.startedAt);
      data.startedAt = new Date();
    }
    if (isNaN(endedAtTimestamp) || endedAtTimestamp < minValidTimestamp) {
      console.error("Invalid endedAt date:", data.endedAt);
      data.endedAt = new Date();
    }

    const database = await getDB();
    const session: Session = {
      id: generateId(),
      user_id: data.userId,
      started_at: data.startedAt.toISOString(),
      ended_at: data.endedAt.toISOString(),
      mode: data.mode,
      capture_source: data.captureSource,
      text_origin: data.textOrigin,
      context_key: data.contextKey,
      wpm: data.wpm,
      accuracy: data.accuracy,
      raw_error_count: data.rawErrorCount,
      created_at: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      const request = database.transaction("sessions", "readwrite")
        .objectStore("sessions")
        .add(session);

      request.onsuccess = () => resolve(session.id);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to insert session:", error);
    return null;
  }
}

export async function getRecentSessions(userId: string, limit: number = 20, includeSampleFallback: boolean = true): Promise<Array<{
  id: string;
  started_at: string;
  wpm: number;
  mode: string;
  capture_source: SessionCaptureSource;
  text_origin: SessionTextOrigin;
  context_key: SessionContextKey;
}>> {
  try {
    const database = await getDB();
    return new Promise((resolve, reject) => {
      const index = database.transaction("sessions", "readonly")
        .objectStore("sessions")
        .index("user_id");

      const request = index.getAll(IDBKeyRange.only(userId));

      request.onsuccess = () => {
        const minValidTimestamp = new Date("2020-01-01").getTime();

        console.log("Raw IndexedDB sessions:", request.result.map((s) => ({
          id: s.id,
          started_at: s.started_at,
          wpm: s.wpm,
          wpm_type: typeof s.wpm,
        })));

        const sessions = request.result
          .filter((s) => {
            const timestamp = new Date(s.started_at).getTime();
            return !isNaN(timestamp) && timestamp > minValidTimestamp;
          })
          .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime())
          .slice(0, limit)
          .map((s) => {
            const context = resolveSessionRecordContext(s);

            return {
              id: s.id,
              started_at: s.started_at,
              wpm: Number(s.wpm) || 0,
              mode: s.mode,
              capture_source: context.captureSource,
              text_origin: context.textOrigin,
              context_key: context.contextKey,
            };
          });

        console.log("Filtered sessions:", sessions);

        if (includeSampleFallback && sessions.length === 0) {
          console.log("No valid sessions in IndexedDB, loading sample data");
          fetch("/sample-sessions.json")
            .then((res) => res.json())
            .then((sampleData) => {
              console.log("Sample data loaded:", sampleData);
              const sampleSessions = sampleData
                .slice(0, limit)
                .map((s: {
                  id: string;
                  started_at: string;
                  wpm: number;
                  mode?: string;
                  capture_source?: SessionCaptureSource;
                  text_origin?: SessionTextOrigin;
                  context_key?: SessionContextKey;
                }) => {
                  const context = getSessionContext(s.mode ?? "wpm_test", {
                    captureSource: s.capture_source,
                    textOrigin: s.text_origin,
                  });

                  return {
                    id: s.id,
                    started_at: s.started_at,
                    wpm: Number(s.wpm) || 0,
                    mode: s.mode ?? "wpm_test",
                    capture_source: context.captureSource,
                    text_origin: context.textOrigin,
                    context_key: s.context_key ?? context.contextKey,
                  };
                });
              resolve(sampleSessions);
            })
            .catch((err) => {
              console.error("Failed to load sample data:", err);
              resolve(sessions);
            });
        } else {
          resolve(sessions);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to fetch recent sessions:", error);
    return [];
  }
}

export async function updateSessionWpm(sessionId: string, wpm: number): Promise<void> {
  try {
    const normalizedWpm = Number.isFinite(wpm) ? Math.max(0, Math.round(wpm)) : 0;
    const database = await getDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("sessions", "readwrite");
      const store = transaction.objectStore("sessions");
      const request = store.get(sessionId);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error(`Session ${sessionId} was not updated`));

      request.onsuccess = () => {
        const session = request.result as Session | undefined;
        if (!session) {
          reject(new Error(`Session ${sessionId} not found`));
          transaction.abort();
          return;
        }

        const putRequest = store.put({
          ...session,
          wpm: normalizedWpm,
        });
        putRequest.onerror = () => reject(putRequest.error);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to update session WPM:", error);
    throw error;
  }
}

// Bigram score operations
export async function upsertBigramScores(scores: Array<{
  userId: string;
  item: string;
  captureSource: SessionCaptureSource;
  textOrigin: SessionTextOrigin;
  contextKey: SessionContextKey;
  avgLatencyMs: number;
  errorRate: number;
  normalizedScore: number;
  sampleCount: number;
}>): Promise<void> {
  try {
    const database = await getDB();
    const store = database.transaction("bigram_scores", "readwrite").objectStore("bigram_scores");
    const index = store.index("user_id_context_bigram");

    for (const score of scores) {
      const existing = await new Promise<BigramScore | undefined>((resolve, reject) => {
        const request = index.get([score.userId, score.contextKey, score.item]);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const data: BigramScore = {
        user_id: score.userId,
        capture_source: score.captureSource,
        text_origin: score.textOrigin,
        context_key: score.contextKey,
        bigram: score.item,
        avg_latency_ms: score.avgLatencyMs,
        error_rate: score.errorRate,
        normalized_score: score.normalizedScore,
        sample_count: score.sampleCount,
        last_updated: new Date().toISOString(),
      };

      if (existing?.id) {
        data.id = existing.id;
      }

      await new Promise<void>((resolve, reject) => {
        const request = store.put(data);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  } catch (error) {
    console.error("Failed to upsert bigram scores:", error);
  }
}

export async function getWeakestBigrams(userId: string, limit: number = 3, contextKey?: SessionContextKey): Promise<Array<{ bigram: string; normalized_score: number }>> {
  try {
    const database = await getDB();
    return new Promise((resolve, reject) => {
      const index = database.transaction("bigram_scores", "readonly")
        .objectStore("bigram_scores")
        .index("user_id");

      const request = index.getAll(IDBKeyRange.only(userId));

      request.onsuccess = () => {
        const scores = filterScoreRecordsByContext(request.result, contextKey)
          .sort((a, b) => a.normalized_score - b.normalized_score)
          .slice(0, limit)
          .map((s) => ({ bigram: s.bigram, normalized_score: s.normalized_score }));
        resolve(scores);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to fetch weakest bigrams:", error);
    return [];
  }
}

export async function getWeakestBigramsForTable(userId: string, limit: number = 10, contextKey?: SessionContextKey): Promise<Array<{
  bigram: string;
  avg_latency_ms: number;
  normalized_score: number;
  sample_count: number;
}>> {
  try {
    const database = await getDB();
    return new Promise((resolve, reject) => {
      const index = database.transaction("bigram_scores", "readonly")
        .objectStore("bigram_scores")
        .index("user_id");

      const request = index.getAll(IDBKeyRange.only(userId));

      request.onsuccess = () => {
        const scores = filterScoreRecordsByContext(request.result, contextKey)
          .sort((a, b) => a.normalized_score - b.normalized_score)
          .slice(0, limit)
          .map((s) => ({
            bigram: s.bigram,
            avg_latency_ms: s.avg_latency_ms,
            normalized_score: s.normalized_score,
            sample_count: s.sample_count,
          }));
        resolve(scores);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to fetch weakest bigrams for table:", error);
    return [];
  }
}

export async function getStrongestBigramsForTable(userId: string, limit: number = 10, contextKey?: SessionContextKey): Promise<Array<{
  bigram: string;
  avg_latency_ms: number;
  normalized_score: number;
  sample_count: number;
}>> {
  try {
    const database = await getDB();
    return new Promise((resolve, reject) => {
      const index = database.transaction("bigram_scores", "readonly")
        .objectStore("bigram_scores")
        .index("user_id");

      const request = index.getAll(IDBKeyRange.only(userId));

      request.onsuccess = () => {
        const scores = filterScoreRecordsByContext(request.result, contextKey)
          .sort((a, b) => b.normalized_score - a.normalized_score)
          .slice(0, limit)
          .map((s) => ({
            bigram: s.bigram,
            avg_latency_ms: s.avg_latency_ms,
            normalized_score: s.normalized_score,
            sample_count: s.sample_count,
          }));
        resolve(scores);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to fetch strongest bigrams for table:", error);
    return [];
  }
}

// Letter score operations
export async function upsertLetterScores(scores: Array<{
  userId: string;
  item: string;
  captureSource: SessionCaptureSource;
  textOrigin: SessionTextOrigin;
  contextKey: SessionContextKey;
  avgLatencyMs: number;
  errorRate: number;
  normalizedScore: number;
  sampleCount: number;
}>): Promise<void> {
  try {
    const database = await getDB();
    const store = database.transaction("letter_scores", "readwrite").objectStore("letter_scores");
    const index = store.index("user_id_context_letter");

    for (const score of scores) {
      const existing = await new Promise<LetterScore | undefined>((resolve, reject) => {
        const request = index.get([score.userId, score.contextKey, score.item]);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const data: LetterScore = {
        user_id: score.userId,
        capture_source: score.captureSource,
        text_origin: score.textOrigin,
        context_key: score.contextKey,
        letter: score.item,
        avg_latency_ms: score.avgLatencyMs,
        error_rate: score.errorRate,
        normalized_score: score.normalizedScore,
        sample_count: score.sampleCount,
        last_updated: new Date().toISOString(),
      };

      if (existing?.id) {
        data.id = existing.id;
      }

      await new Promise<void>((resolve, reject) => {
        const request = store.put(data);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  } catch (error) {
    console.error("Failed to upsert letter scores:", error);
  }
}

export async function getLetterScores(userId: string): Promise<Array<{
  letter: string;
  avg_latency_ms: number;
  error_rate: number;
  normalized_score: number;
  sample_count: number;
  last_updated: string;
}>> {
  try {
    const database = await getDB();
    return new Promise((resolve, reject) => {
      const index = database.transaction("letter_scores", "readonly")
        .objectStore("letter_scores")
        .index("user_id");

      const request = index.getAll(IDBKeyRange.only(userId));

      request.onsuccess = () => {
        const scores = filterScoreRecordsByContext(request.result).map((s) => ({
          letter: s.letter,
          avg_latency_ms: s.avg_latency_ms,
          error_rate: s.error_rate,
          normalized_score: s.normalized_score,
          sample_count: s.sample_count,
          last_updated: s.last_updated,
        }));
        resolve(scores);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to fetch letter scores:", error);
    return [];
  }
}

// Word score operations
export async function upsertWordScores(scores: Array<{
  userId: string;
  item: string;
  captureSource: SessionCaptureSource;
  textOrigin: SessionTextOrigin;
  contextKey: SessionContextKey;
  avgLatencyMs: number;
  errorRate: number;
  normalizedScore: number;
  sampleCount: number;
}>): Promise<void> {
  try {
    const database = await getDB();
    const store = database.transaction("word_scores", "readwrite").objectStore("word_scores");
    const index = store.index("user_id_context_word");

    for (const score of scores) {
      const existing = await new Promise<WordScore | undefined>((resolve, reject) => {
        const request = index.get([score.userId, score.contextKey, score.item]);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const data: WordScore = {
        user_id: score.userId,
        capture_source: score.captureSource,
        text_origin: score.textOrigin,
        context_key: score.contextKey,
        word: score.item,
        avg_latency_ms: score.avgLatencyMs,
        error_rate: score.errorRate,
        normalized_score: score.normalizedScore,
        sample_count: score.sampleCount,
        last_updated: new Date().toISOString(),
      };

      if (existing?.id) {
        data.id = existing.id;
      }

      await new Promise<void>((resolve, reject) => {
        const request = store.put(data);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  } catch (error) {
    console.error("Failed to upsert word scores:", error);
  }
}

export async function getWeakestWords(userId: string, limit: number = 3, contextKey?: SessionContextKey): Promise<Array<{ word: string; normalized_score: number }>> {
  try {
    const database = await getDB();
    return new Promise((resolve, reject) => {
      const index = database.transaction("word_scores", "readonly")
        .objectStore("word_scores")
        .index("user_id");

      const request = index.getAll(IDBKeyRange.only(userId));

      request.onsuccess = () => {
        const scores = filterScoreRecordsByContext(request.result, contextKey)
          .sort((a, b) => a.normalized_score - b.normalized_score)
          .slice(0, limit)
          .map((s) => ({ word: s.word, normalized_score: s.normalized_score }));
        resolve(scores);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to fetch weakest words:", error);
    return [];
  }
}

export async function getWeakestWordsForTable(userId: string, limit: number = 10, contextKey?: SessionContextKey): Promise<Array<{
  word: string;
  avg_latency_ms: number;
  error_rate: number;
  normalized_score: number;
  sample_count: number;
}>> {
  try {
    const database = await getDB();
    return new Promise((resolve, reject) => {
      const index = database.transaction("word_scores", "readonly")
        .objectStore("word_scores")
        .index("user_id");

      const request = index.getAll(IDBKeyRange.only(userId));

      request.onsuccess = () => {
        const scores = filterScoreRecordsByContext(request.result, contextKey)
          .sort((a, b) => a.normalized_score - b.normalized_score)
          .slice(0, limit)
          .map((s) => ({
            word: s.word,
            avg_latency_ms: s.avg_latency_ms,
            error_rate: s.error_rate,
            normalized_score: s.normalized_score,
            sample_count: s.sample_count,
          }));
        resolve(scores);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to fetch weakest words for table:", error);
    return [];
  }
}

// Bigram score history operations
export async function insertBigramScoreHistory(
  userId: string,
  bigram: string,
  normalizedScore: number,
  sessionId: string | null
): Promise<void> {
  try {
    const database = await getDB();
    const history: BigramScoreHistory = {
      id: generateId(),
      user_id: userId,
      bigram,
      normalized_score: normalizedScore,
      session_id: sessionId,
      created_at: new Date().toISOString(),
    };

    await new Promise<void>((resolve, reject) => {
      const request = database.transaction("bigram_score_history", "readwrite")
        .objectStore("bigram_score_history")
        .add(history);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to insert bigram score history:", error);
  }
}

export async function getPreviousBigramScores(
  userId: string,
  currentSessionId: string | null
): Promise<Record<string, number>> {
  try {
    const database = await getDB();

    const sessions = await new Promise<Session[]>((resolve, reject) => {
      const index = database.transaction("sessions", "readonly")
        .objectStore("sessions")
        .index("user_id");
      const request = index.getAll(IDBKeyRange.only(userId));
      request.onsuccess = () => {
        const sorted = request.result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        resolve(sorted);
      };
      request.onerror = () => reject(request.error);
    });

    const currentSession = sessions.find((session) => session.id === currentSessionId);
    const currentContextKey = currentSession
      ? resolveSessionRecordContext(currentSession).contextKey
      : null;

    const comparableSessions = sessions.filter((session) => {
      if (session.id === currentSessionId) {
        return false;
      }

      if (!currentContextKey) {
        return true;
      }

      return resolveSessionRecordContext(session).contextKey === currentContextKey;
    });

    if (comparableSessions.length === 0) {
      return {};
    }

    const previousSessionId = comparableSessions[0].id;
    const history = await new Promise<BigramScoreHistory[]>((resolve, reject) => {
      const index = database.transaction("bigram_score_history", "readonly")
        .objectStore("bigram_score_history")
        .index("session_id");
      const request = index.getAll(IDBKeyRange.only(previousSessionId));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const scores: Record<string, number> = {};
    for (const record of history) {
      scores[record.bigram] = record.normalized_score;
    }

    return scores;
  } catch (error) {
    console.error("Failed to fetch previous bigram scores:", error);
    return {};
  }
}

// Profile operations
export async function getProfile(userId: string): Promise<Profile | null> {
  try {
    const database = await getDB();
    return new Promise((resolve, reject) => {
      const index = database.transaction("profiles", "readonly")
        .objectStore("profiles")
        .index("user_id");
      const request = index.get(userId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to fetch profile:", error);
    return null;
  }
}

export async function upsertProfile(data: {
  userId: string;
  totalSessions: number;
  typingArchetype: string;
}): Promise<void> {
  try {
    const database = await getDB();
    const store = database.transaction("profiles", "readwrite").objectStore("profiles");
    const index = store.index("user_id");

    const existing = await new Promise<Profile | undefined>((resolve, reject) => {
      const request = index.get(data.userId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const profile: Profile = {
      id: existing?.id || generateId(),
      user_id: data.userId,
      total_sessions: data.totalSessions,
      last_active: new Date().toISOString(),
      typing_archetype: data.typingArchetype,
      created_at: existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.put(profile);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to upsert profile:", error);
  }
}

export async function computeTypingArchetype(userId: string): Promise<string> {
  try {
    const database = await getDB();
    const bigramScores = await new Promise<BigramScore[]>((resolve, reject) => {
      const index = database.transaction("bigram_scores", "readonly")
        .objectStore("bigram_scores")
        .index("user_id");
      const request = index.getAll(IDBKeyRange.only(userId));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (!bigramScores || bigramScores.length === 0) {
      return "balanced";
    }

    const avgSpeedScore = bigramScores.reduce((sum, score) => sum + (score.normalized_score || 0), 0) / bigramScores.length;
    const avgAccuracyScore = bigramScores.reduce((sum, score) => sum + (1 - (score.error_rate || 0)), 0) / bigramScores.length;
    const diff = Math.abs(avgSpeedScore - avgAccuracyScore);
    const threshold = Math.max(avgSpeedScore, avgAccuracyScore) * 0.1;

    if (diff <= threshold) {
      return "balanced";
    }
    if (avgSpeedScore > avgAccuracyScore) {
      return "speed-focused";
    }
    return "accuracy-focused";
  } catch (error) {
    console.error("Failed to compute typing archetype:", error);
    return "balanced";
  }
}

// Helper to get a local user ID
export function getLocalUserId(): string {
  let userId = localStorage.getItem("keymaxx_user_id");
  if (!userId) {
    userId = generateId();
    localStorage.setItem("keymaxx_user_id", userId);
  }
  return userId;
}

export async function bootstrapDerivedSessionsToTriple(data: {
  userId: string;
  force?: boolean;
}): Promise<DerivedSessionBootstrapSummary> {
  const markerKey = buildDerivedSessionBootstrapMarkerKey(data.userId);

  if (typeof window === "undefined") {
    throw new Error("Derived session bootstrap is only available in the browser.");
  }

  if (!LOCAL_DEV_HOSTNAMES.has(window.location.hostname)) {
    throw new Error("Derived session bootstrap only runs on localhost.");
  }

  const database = await getDB();
  const sessions = await getAllUserSessions(database, data.userId);
  const validSessions = sessions
    .filter(isValidSessionTimestamp)
    .sort((a, b) => getSessionStartMs(a) - getSessionStartMs(b));
  const sourceCount = validSessions.length;
  const targetFinalCount = sourceCount * DERIVED_SESSION_BOOTSTRAP_MULTIPLIER;

  const buildSummary = (
    status: DerivedSessionBootstrapSummary["status"],
    createdCount: number,
    skippedSourceCount: number
  ): DerivedSessionBootstrapSummary => ({
    status,
    userId: data.userId,
    sourceCount,
    createdCount,
    finalCount: sourceCount + createdCount,
    targetFinalCount,
    skippedSourceCount,
    markerKey,
  });

  if (sourceCount === 0) {
    return buildSummary("noop", 0, 0);
  }

  if (!data.force && localStorage.getItem(markerKey)) {
    return buildSummary("already_bootstrapped", 0, 0);
  }

  const [bigramHistory, bigramScores, letterScores, wordScores] = await Promise.all([
    getAllUserBigramScoreHistory(database, data.userId),
    getAllUserBigramScores(database, data.userId),
    getAllUserLetterScores(database, data.userId),
    getAllUserWordScores(database, data.userId),
  ]);

  const historyBySessionId = new Map<string, Array<{ bigram: string; normalizedScore: number }>>();
  for (const record of bigramHistory) {
    if (!record.session_id) {
      continue;
    }
    const existing = historyBySessionId.get(record.session_id) ?? [];
    existing.push({
      bigram: record.bigram,
      normalizedScore: Number(record.normalized_score) || 0,
    });
    historyBySessionId.set(record.session_id, existing);
  }

  const fallbackHistoryByContext = new Map<SessionContextKey, Array<{ bigram: string; normalizedScore: number }>>();
  for (const record of bigramScores) {
    const context = resolveScoreRecordContext(record);
    const existing = fallbackHistoryByContext.get(context.contextKey) ?? [];
    existing.push({
      bigram: record.bigram,
      normalizedScore: Number(record.normalized_score) || 0,
    });
    fallbackHistoryByContext.set(context.contextKey, existing);
  }

  let previousEndMs = validSessions.reduce(
    (max, session) => Math.max(max, getSessionEndMs(session)),
    getSessionEndMs(validSessions[validSessions.length - 1])
  );
  let createdCount = 0;
  const skippedSourceIds = new Set<string>();
  const targetCreatedCount = Math.max(0, targetFinalCount - sourceCount);

  for (let index = 0; index < targetCreatedCount; index += 1) {
    const sourceSession = validSessions[index % sourceCount];
    const sourceContext = resolveSessionRecordContext(sourceSession);
    const sourceHistory = historyBySessionId.get(sourceSession.id) ?? fallbackHistoryByContext.get(sourceContext.contextKey) ?? [];

    if (sourceHistory.length === 0) {
      skippedSourceIds.add(sourceSession.id);
      continue;
    }

    const sourceDurationMs = clampNumber(
      getSessionEndMs(sourceSession) - getSessionStartMs(sourceSession),
      20000,
      30 * 60 * 1000
    );
    const startedAtMs = previousEndMs + (12 * 60 * 1000) + randomInteger(60000, 4 * 60 * 1000);
    const endedAtMs = startedAtMs + clampNumber(
      Math.round(sourceDurationMs * randomBetween(0.92, 1.08)),
      20000,
      30 * 60 * 1000
    );
    previousEndMs = endedAtMs;

    const sessionId = await insertSession({
      userId: data.userId,
      startedAt: new Date(startedAtMs),
      endedAt: new Date(endedAtMs),
      mode: sourceSession.mode,
      captureSource: sourceContext.captureSource,
      textOrigin: sourceContext.textOrigin,
      contextKey: sourceContext.contextKey,
      wpm: Math.round(clampNumber((Number(sourceSession.wpm) || 0) + randomInteger(-6, 6), 10, 220)),
      accuracy: Math.round(clampNumber((Number(sourceSession.accuracy) || 95) + randomBetween(-2.5, 2.5), 70, 100)),
      rawErrorCount: Math.round(clampNumber((Number(sourceSession.raw_error_count) || 0) + randomInteger(-2, 3), 0, 999)),
    });

    if (!sessionId) {
      skippedSourceIds.add(sourceSession.id);
      continue;
    }

    createdCount += 1;

    for (const historyRecord of sourceHistory) {
      await insertBigramScoreHistory(
        data.userId,
        historyRecord.bigram,
        clampNumber(historyRecord.normalizedScore + randomBetween(-0.035, 0.035), 0, 1),
        sessionId
      );
    }
  }

  if (bigramScores.length > 0) {
    await upsertBigramScores(
      bigramScores.map((record) => {
        const context = resolveScoreRecordContext(record);
        return {
          userId: data.userId,
          item: record.bigram,
          captureSource: context.captureSource,
          textOrigin: context.textOrigin,
          contextKey: context.contextKey,
          avgLatencyMs: Math.round(clampNumber((Number(record.avg_latency_ms) || 0) * randomBetween(0.97, 1.03), 20, 3000)),
          errorRate: clampNumber((Number(record.error_rate) || 0) + randomBetween(-0.01, 0.01), 0, 1),
          normalizedScore: clampNumber((Number(record.normalized_score) || 0) + randomBetween(-0.02, 0.03), 0, 1),
          sampleCount: Math.max(1, Math.round((Number(record.sample_count) || 1) + Math.max(1, (Number(record.sample_count) || 1) * 0.35))),
        };
      })
    );
  }

  if (letterScores.length > 0) {
    await upsertLetterScores(
      letterScores.map((record) => {
        const context = resolveScoreRecordContext(record);
        return {
          userId: data.userId,
          item: record.letter,
          captureSource: context.captureSource,
          textOrigin: context.textOrigin,
          contextKey: context.contextKey,
          avgLatencyMs: Math.round(clampNumber((Number(record.avg_latency_ms) || 0) * randomBetween(0.97, 1.03), 20, 3000)),
          errorRate: clampNumber((Number(record.error_rate) || 0) + randomBetween(-0.01, 0.01), 0, 1),
          normalizedScore: clampNumber((Number(record.normalized_score) || 0) + randomBetween(-0.02, 0.03), 0, 1),
          sampleCount: Math.max(1, Math.round((Number(record.sample_count) || 1) + Math.max(1, (Number(record.sample_count) || 1) * 0.35))),
        };
      })
    );
  }

  if (wordScores.length > 0) {
    await upsertWordScores(
      wordScores.map((record) => {
        const context = resolveScoreRecordContext(record);
        return {
          userId: data.userId,
          item: record.word,
          captureSource: context.captureSource,
          textOrigin: context.textOrigin,
          contextKey: context.contextKey,
          avgLatencyMs: Math.round(clampNumber((Number(record.avg_latency_ms) || 0) * randomBetween(0.97, 1.03), 20, 3000)),
          errorRate: clampNumber((Number(record.error_rate) || 0) + randomBetween(-0.01, 0.01), 0, 1),
          normalizedScore: clampNumber((Number(record.normalized_score) || 0) + randomBetween(-0.02, 0.03), 0, 1),
          sampleCount: Math.max(1, Math.round((Number(record.sample_count) || 1) + Math.max(1, (Number(record.sample_count) || 1) * 0.35))),
        };
      })
    );
  }

  const typingArchetype = await computeTypingArchetype(data.userId);
  await upsertProfile({
    userId: data.userId,
    totalSessions: sourceCount + createdCount,
    typingArchetype,
  });

  localStorage.setItem(markerKey, JSON.stringify({
    createdAt: new Date().toISOString(),
    sourceCount,
    createdCount,
    finalCount: sourceCount + createdCount,
  }));

  return buildSummary("created", createdCount, skippedSourceIds.size);
}

// Clear ALL data from all stores (wipe clean while keeping infrastructure)
export async function clearAllData(): Promise<void> {
  try {
    const database = await getDB();
    const storeNames = ["sessions", "bigram_scores", "letter_scores", "word_scores", "bigram_score_history", "profiles"];

    for (const storeName of storeNames) {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }

    localStorage.removeItem("keymaxx_user_id");
    console.log("All data cleared successfully");
  } catch (error) {
    console.error("Failed to clear all data:", error);
    throw error;
  }
}

// Clear all sessions with invalid dates (for data cleanup)
export async function clearInvalidSessions(userId: string): Promise<number> {
  try {
    const database = await getDB();
    const minValidTimestamp = new Date("2020-01-01").getTime();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction("sessions", "readwrite");
      const store = transaction.objectStore("sessions");
      const index = store.index("user_id");
      const request = index.getAll(IDBKeyRange.only(userId));

      request.onsuccess = async () => {
        const invalidSessions = request.result.filter((s) => {
          const timestamp = new Date(s.started_at).getTime();
          return isNaN(timestamp) || timestamp < minValidTimestamp;
        });

        let deletedCount = 0;
        for (const session of invalidSessions) {
          await new Promise<void>((res, rej) => {
            const deleteRequest = store.delete(session.id);
            deleteRequest.onsuccess = () => {
              deletedCount += 1;
              res();
            };
            deleteRequest.onerror = () => rej(deleteRequest.error);
          });
        }

        console.log(`Cleared ${deletedCount} invalid sessions`);
        resolve(deletedCount);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to clear invalid sessions:", error);
    return 0;
  }
}

// Delete a single session by ID
export async function deleteSession(sessionId: string): Promise<void> {
  try {
    const database = await getDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(["sessions", "bigram_score_history"], "readwrite");
      const sessionsStore = transaction.objectStore("sessions");
      const historyStore = transaction.objectStore("bigram_score_history");
      const historyIndex = historyStore.index("session_id");

      transaction.oncomplete = () => {
        console.log(`Deleted session ${sessionId}`);
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);

      const historyRequest = historyIndex.getAllKeys(IDBKeyRange.only(sessionId));
      historyRequest.onsuccess = () => {
        for (const historyKey of historyRequest.result) {
          historyStore.delete(historyKey);
        }
        sessionsStore.delete(sessionId);
      };
      historyRequest.onerror = () => reject(historyRequest.error);
    });
  } catch (error) {
    console.error("Failed to delete session:", error);
    throw error;
  }
}

async function getUserSessions(userId: string): Promise<Session[]> {
  const database = await getDB();

  return new Promise((resolve, reject) => {
    const index = database.transaction("sessions", "readonly")
      .objectStore("sessions")
      .index("user_id");
    const request = index.getAll(IDBKeyRange.only(userId));

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function auditDuplicateFreeformSessions(
  userId: string,
  toleranceMs: number = 2000
): Promise<DuplicateFreeformSessionAudit> {
  try {
    const sessions = await getUserSessions(userId);
    return buildDuplicateFreeformAudit(sessions, toleranceMs);
  } catch (error) {
    console.error("Failed to audit duplicate freeform sessions:", error);
    return {
      totalSessions: 0,
      structuredSessions: 0,
      freeformSessions: 0,
      duplicateSessions: [],
      remainingSessionsAfterCleanup: 0,
    };
  }
}

export async function deleteDuplicateFreeformSessions(
  userId: string,
  toleranceMs: number = 2000
): Promise<{
  deletedCount: number;
  auditBeforeDelete: DuplicateFreeformSessionAudit;
  auditAfterDelete: DuplicateFreeformSessionAudit;
}> {
  const auditBeforeDelete = await auditDuplicateFreeformSessions(userId, toleranceMs);
  const duplicateIds = auditBeforeDelete.duplicateSessions.map((session) => session.id);

  for (const sessionId of duplicateIds) {
    await deleteSession(sessionId);
  }

  const auditAfterDelete = await auditDuplicateFreeformSessions(userId, toleranceMs);

  return {
    deletedCount: duplicateIds.length,
    auditBeforeDelete,
    auditAfterDelete,
  };
}
