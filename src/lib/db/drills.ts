import { encyclopediaContent } from "@/lib/wordSources";

export interface WeakestBigram {
  bigram: string;
  normalized_score: number;
}

export interface WeakestWord {
  word: string;
  normalized_score: number;
}

export interface DrillContextData {
  focusBigrams: string[];
  focusWords: string[];
  highlightedWords: string[];
  exampleWordsByBigram: Array<{
    bigram: string;
    words: string[];
  }>;
}

function sanitizeDrillWord(word: string): string {
  return word.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, "");
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function formatNaturalList(values: string[]): string {
  if (values.length <= 1) {
    return values[0] || "";
  }

  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }

  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

export function formatDrillBigram(bigram: string): string {
  return bigram.split("").join("-");
}

export function deriveDrillContextData(
  weakestBigrams: WeakestBigram[],
  weakestWords: WeakestWord[],
  targetText: string = ""
): DrillContextData {
  const focusBigrams = uniqueValues(
    weakestBigrams.map(({ bigram }) => bigram.toLowerCase().trim())
  ).slice(0, 4);
  const focusWords = uniqueValues(
    weakestWords.map(({ word }) => sanitizeDrillWord(word))
  ).slice(0, 8);
  const targetWords = uniqueValues(
    targetText.split(/\s+/).map((word) => sanitizeDrillWord(word))
  );
  const encyclopediaWords = uniqueValues(
    encyclopediaContent
      .join(" ")
      .toLowerCase()
      .split(/\s+/)
      .map((word) => sanitizeDrillWord(word))
  );
  const highlightedWords = uniqueValues([
    ...focusWords,
    ...targetWords.filter((word) => focusBigrams.some((bigram) => word.includes(bigram))),
    ...encyclopediaWords.filter((word) => focusBigrams.some((bigram) => word.includes(bigram))),
  ]).slice(0, 10);
  const exampleWordsByBigram = focusBigrams.map((bigram) => ({
    bigram,
    words: uniqueValues(
      highlightedWords.filter((word) => word.includes(bigram))
    ).slice(0, 3),
  }));

  return {
    focusBigrams,
    focusWords,
    highlightedWords,
    exampleWordsByBigram,
  };
}

export function createFallbackDrillBrief(context: DrillContextData): string {
  if (!context.focusBigrams.length && !context.highlightedWords.length) {
    return "This drill is set up to reinforce your weakest transitions with focused repetition.";
  }

  const patternText = context.focusBigrams.length
    ? formatNaturalList(context.focusBigrams.map((bigram) => formatDrillBigram(bigram)))
    : "a few tricky key transitions";
  const watchWords = context.highlightedWords.slice(0, 6);

  if (!watchWords.length) {
    return `In this drill, watch for ${patternText}. Keep those transitions smooth and deliberate instead of rushing them.`;
  }

  return `In this drill, watch for ${patternText}. Words to look out for: ${formatNaturalList(watchWords)}. Keep those transitions smooth and deliberate instead of rushing them.`;
}

/**
 * Generates drill text based on the user's historically worst bigrams and words.
 * Algorithm:
 * 1. Use as many words from the "bad" batch (worst words) as possible
 * 2. Fill remaining slots with encyclopedia words that contain the worst bigrams
 * 3. No concern for coherent sentences
 *
 * @param weakestBigrams - Array of weakest bigrams with their scores
 * @param weakestWords - Array of weakest words with their scores
 * @param targetWordCount - Target number of words in the drill (default: 100)
 * @returns A string suitable for typing practice
 */
export function generateDrillText(
  weakestBigrams: WeakestBigram[],
  weakestWords: WeakestWord[],
  targetWordCount: number = 100
): string {
  if (weakestBigrams.length === 0 && weakestWords.length === 0) {
    return "the quick brown fox jumps over the lazy dog";
  }

  const drillWords: string[] = [];
  const worstBigramSet = new Set(weakestBigrams.map(b => b.bigram.toLowerCase()));

  // Step 1: Add all worst words (repeat them if needed to reach target)
  let wordIndex = 0;
  while (drillWords.length < targetWordCount && weakestWords.length > 0) {
    const word = weakestWords[wordIndex % weakestWords.length];
    drillWords.push(word.word);
    wordIndex++;
  }

  // Step 2: If we still need more words, fill with encyclopedia words containing worst bigrams
  if (drillWords.length < targetWordCount) {
    // Extract all words from encyclopedia
    const allEncyclopediaWords = encyclopediaContent
      .join(" ")
      .toLowerCase()
      .split(/\s+/)
      .map((word) => sanitizeDrillWord(word))
      .filter(w => w.length > 0);

    // Find words that contain any of the worst bigrams
    const wordsWithWorstBigrams = allEncyclopediaWords.filter(word => {
      const lowerWord = word.toLowerCase();
      for (const bigram of worstBigramSet) {
        if (lowerWord.includes(bigram)) {
          return true;
        }
      }
      return false;
    });

    // If we have words with worst bigrams, use them; otherwise use all encyclopedia words
    const fillerWords = wordsWithWorstBigrams.length > 0 ? wordsWithWorstBigrams : allEncyclopediaWords;

    // Add filler words until we reach target
    let fillerIndex = 0;
    while (drillWords.length < targetWordCount && fillerWords.length > 0) {
      drillWords.push(fillerWords[fillerIndex % fillerWords.length]);
      fillerIndex++;
    }
  }

  // Shuffle the array to randomize the order
  for (let i = drillWords.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [drillWords[i], drillWords[j]] = [drillWords[j], drillWords[i]];
  }

  // Join with spaces
  return drillWords.join(" ");
}

/**
 * Legacy function for backward compatibility. Uses only bigrams.
 */
export function generateDrillTextLegacy(weakestBigrams: WeakestBigram[]): string {
  if (weakestBigrams.length === 0) {
    return "the quick brown fox jumps over the lazy dog";
  }

  const drillText: string[] = [];
  const repetitionsPerBigram = 12;

  for (const bigram of weakestBigrams) {
    for (let i = 0; i < repetitionsPerBigram; i++) {
      drillText.push(bigram.bigram);
    }
  }

  for (let i = drillText.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [drillText[i], drillText[j]] = [drillText[j], drillText[i]];
  }

  return drillText.join(" ");
}
