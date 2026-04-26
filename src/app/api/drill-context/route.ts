import { NextRequest, NextResponse } from "next/server";
import { createFallbackDrillBrief, deriveDrillContextData } from "@/lib/db/drills";

type RequestWeakestBigram = {
  bigram: string;
  normalized_score?: number;
};

type RequestWeakestWord = {
  word: string;
  normalized_score?: number;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const weakestBigrams = Array.isArray(body?.weakestBigrams)
      ? (body.weakestBigrams as RequestWeakestBigram[])
      : [];
    const weakestWords = Array.isArray(body?.weakestWords)
      ? (body.weakestWords as RequestWeakestWord[])
      : [];
    const targetText = typeof body?.targetText === "string" ? body.targetText : "";

    const drillContext = deriveDrillContextData(
      weakestBigrams.map((item) => ({
        bigram: item.bigram,
        normalized_score: item.normalized_score ?? 0,
      })),
      weakestWords.map((item) => ({
        word: item.word,
        normalized_score: item.normalized_score ?? 0,
      })),
      targetText
    );
    const fallbackBrief = createFallbackDrillBrief(drillContext);

    if (!process.env.ANTHROPIC_API_KEY || !drillContext.focusBigrams.length) {
      return NextResponse.json({ brief: fallbackBrief, source: "local" });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 180,
        system:
          "You write short side-panel drill briefings for a typing trainer. Keep the tone casual, sharp, and encouraging. Write 2 or 3 sentences, stay under 85 words, mention 2 to 4 letter pairs using hyphen format like i-n or q-u, mention 4 to 6 example words, and return plain text only with no markdown or bullets.",
        messages: [
          {
            role: "user",
            content: [
              `Focus pairs: ${drillContext.focusBigrams.join(", ") || "none"}`,
              `Weak words: ${drillContext.focusWords.join(", ") || "none"}`,
              `Words in this drill: ${drillContext.highlightedWords.join(", ") || "none"}`,
              `Fallback brief: ${fallbackBrief}`,
            ].join("\n"),
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Anthropic drill context error:", error);
      return NextResponse.json({ brief: fallbackBrief, source: "local" });
    }

    const data = await response.json();
    const brief = data.content?.[0]?.text?.trim() || fallbackBrief;

    return NextResponse.json({ brief, source: "ai" });
  } catch (error) {
    console.error("Drill context route error:", error);
    return NextResponse.json(
      {
        brief: "This drill is set up to reinforce your weakest transitions with focused repetition.",
        source: "local",
      },
      { status: 200 }
    );
  }
}
