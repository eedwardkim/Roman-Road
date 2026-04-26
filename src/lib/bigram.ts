import { KeystrokeEvent, BigramLatency, BigramStats } from "@/types/typing";

/**
 * Computes bigram transition latencies from a raw keystroke log.
 * A bigram is a pair of consecutive characters typed.
 * Latency is measured as the time between keydown events of consecutive keys.
 *
 * @param keystrokes - Array of keystroke events with timestamps
 * @returns Array of bigram latencies
 */
export function computeBigramLatencies(
  keystrokes: KeystrokeEvent[]
): BigramLatency[] {
  const keydownEvents = keystrokes
    .filter((event) => event.type === "keydown")
    .filter((event) => isPrintableKey(event.key));

  const bigramLatencies: BigramLatency[] = [];

  for (let i = 1; i < keydownEvents.length; i++) {
    const prevEvent = keydownEvents[i - 1];
    const currEvent = keydownEvents[i];

    const bigram = `${normalizeKey(prevEvent.key)}${normalizeKey(currEvent.key)}`;
    const latency = currEvent.timestamp - prevEvent.timestamp;

    if (latency > 0 && latency < 2000) {
      bigramLatencies.push({ bigram, latency });
    }
  }

  return bigramLatencies;
}

/**
 * Aggregates bigram latencies into statistics per bigram.
 *
 * @param bigramLatencies - Array of individual bigram latency measurements
 * @returns Record mapping bigram strings to their aggregated stats
 */
export function aggregateBigramStats(
  bigramLatencies: BigramLatency[]
): Record<string, BigramStats> {
  const statsMap: Record<string, BigramStats> = {};

  for (const { bigram, latency } of bigramLatencies) {
    if (!statsMap[bigram]) {
      statsMap[bigram] = {
        bigram,
        count: 0,
        avgLatency: 0,
        minLatency: Infinity,
        maxLatency: -Infinity,
        latencies: [],
      };
    }

    const stats = statsMap[bigram];
    stats.count++;
    stats.latencies.push(latency);
    stats.minLatency = Math.min(stats.minLatency, latency);
    stats.maxLatency = Math.max(stats.maxLatency, latency);
  }

  for (const bigram in statsMap) {
    const stats = statsMap[bigram];
    stats.avgLatency =
      stats.latencies.reduce((sum, l) => sum + l, 0) / stats.count;
  }

  return statsMap;
}

/**
 * Identifies the slowest bigrams based on average latency.
 *
 * @param stats - Aggregated bigram statistics
 * @param topN - Number of slowest bigrams to return
 * @param minCount - Minimum occurrences required to be considered
 * @returns Array of the slowest bigrams sorted by average latency (descending)
 */
export function getSlowestBigrams(
  stats: Record<string, BigramStats>,
  topN: number = 10,
  minCount: number = 2
): BigramStats[] {
  return Object.values(stats)
    .filter((s) => s.count >= minCount)
    .sort((a, b) => b.avgLatency - a.avgLatency)
    .slice(0, topN);
}

/**
 * Checks if a key is a printable character (letters, numbers, punctuation).
 */
function isPrintableKey(key: string): boolean {
  return key.length === 1 && /[\w\s\.,;:'"!?@#$%^&*()\-+=\[\]{}\\|/<>]/.test(key);
}

/**
 * Normalizes a key to lowercase for consistent bigram tracking.
 */
function normalizeKey(key: string): string {
  return key.toLowerCase();
}
