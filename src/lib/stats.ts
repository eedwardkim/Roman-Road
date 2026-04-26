import { KeystrokeEvent } from "@/types/typing";

/**
 * Extracts per-letter latency statistics from a keystroke log.
 * Latency for a letter is measured as the gap between the previous keydown
 * and this letter's keydown. Only printable letters are included.
 */
export function extractLetterStats(
  keystrokes: KeystrokeEvent[]
): Record<string, { count: number; avgLatency: number }> {
  const keydownEvents = keystrokes
    .filter((e) => e.type === "keydown" && e.key.length === 1)
    .filter((e) => /[a-z]/i.test(e.key));

  const letterMap: Record<string, { count: number; latencies: number[] }> = {};

  for (let i = 1; i < keydownEvents.length; i++) {
    const letter = keydownEvents[i].key.toLowerCase();
    const latency = keydownEvents[i].timestamp - keydownEvents[i - 1].timestamp;

    if (!letterMap[letter]) {
      letterMap[letter] = { count: 0, latencies: [] };
    }
    letterMap[letter].count++;
    letterMap[letter].latencies.push(latency);
  }

  const stats: Record<string, { count: number; avgLatency: number }> = {};
  for (const letter in letterMap) {
    const data = letterMap[letter];
    stats[letter] = {
      count: data.count,
      avgLatency: data.latencies.reduce((sum, l) => sum + l, 0) / data.count,
    };
  }

  return stats;
}

/**
 * Extracts per-word latency and error-rate statistics from a keystroke log
 * given the actual typed text (used for word boundaries / labels).
 */
export function extractWordStats(
  keystrokes: KeystrokeEvent[],
  text: string
): Record<string, { count: number; avgLatency: number; errorRate: number }> {
  const typedWords = text
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 0);

  const wordMap: Record<string, { latencies: number[]; errors: number }> = {};

  let currentWordIndex = 0;
  let currentWordStartTime: number | null = null;
  let wordCharCount = 0;
  let wordBackspaceCount = 0;

  const keydownEvents = keystrokes.filter((e) => e.type === "keydown");

  for (let i = 0; i < keydownEvents.length; i++) {
    const event = keydownEvents[i];

    if (event.key === "Backspace") {
      if (currentWordStartTime !== null) {
        wordBackspaceCount++;
      }
      wordCharCount = Math.max(0, wordCharCount - 1);
      continue;
    }

    if (event.key === " " && currentWordStartTime !== null) {
      const word = typedWords[currentWordIndex];
      if (word) {
        const duration = event.timestamp - currentWordStartTime;
        if (!wordMap[word]) {
          wordMap[word] = { latencies: [], errors: 0 };
        }
        wordMap[word].latencies.push(duration);
        wordMap[word].errors += wordBackspaceCount;
      }

      currentWordStartTime = null;
      wordCharCount = 0;
      wordBackspaceCount = 0;
      currentWordIndex++;
      continue;
    }

    if (event.key.length === 1 && /[a-z]/i.test(event.key)) {
      if (currentWordStartTime === null) {
        currentWordStartTime = event.timestamp;
      }
      wordCharCount++;
    }
  }

  if (currentWordStartTime !== null && currentWordIndex < typedWords.length) {
    const word = typedWords[currentWordIndex];
    if (word) {
      const duration =
        keydownEvents[keydownEvents.length - 1].timestamp - currentWordStartTime;
      if (!wordMap[word]) {
        wordMap[word] = { latencies: [], errors: 0 };
      }
      wordMap[word].latencies.push(duration);
      wordMap[word].errors += wordBackspaceCount;
    }
  }

  const stats: Record<
    string,
    { count: number; avgLatency: number; errorRate: number }
  > = {};
  for (const word in wordMap) {
    const data = wordMap[word];
    const avgLatency =
      data.latencies.length > 0
        ? data.latencies.reduce((sum, l) => sum + l, 0) / data.latencies.length
        : 0;
    const totalChars = data.latencies.length * word.length;
    const errorRate = totalChars > 0 ? data.errors / totalChars : 0;

    stats[word] = {
      count: data.latencies.length,
      avgLatency,
      errorRate,
    };
  }

  return stats;
}

/**
 * Reconstructs the typed text from a keystroke log, applying backspaces.
 * Useful for system-wide capture where there is no `targetText`.
 */
export function reconstructTypedText(keystrokes: KeystrokeEvent[]): string {
  const out: string[] = [];
  for (const e of keystrokes) {
    if (e.type !== "keydown") continue;
    if (e.key === "Backspace") {
      out.pop();
    } else if (e.key.length === 1) {
      out.push(e.key);
    }
  }
  return out.join("");
}

/**
 * Normalizes a latency in ms to a 1-10 score (50ms = 10, 500ms = 1).
 */
export function normalizeLatencyScore(latency: number): number {
  const minLatency = 50;
  const maxLatency = 500;
  const normalized =
    10 - ((latency - minLatency) / (maxLatency - minLatency)) * 9;
  return Math.max(1, Math.min(10, normalized));
}
