import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { bigramData, wordData } = await request.json();

    // Build the data context
    let dataContext = '';
    
    if (bigramData && bigramData.length > 0) {
      dataContext += 'BIGRAM DATA:\n';
      bigramData.forEach((item: any) => {
        dataContext += `- ${item.bigram}: latency ${item.avg_latency_ms || item.avgLatency}ms, score ${item.normalized_score || item.score}, count ${item.sample_count || item.count || item.occurrences || 1}\n`;
      });
    }
    
    if (wordData && wordData.length > 0) {
      dataContext += '\nWORD DATA:\n';
      wordData.forEach((item: any) => {
        dataContext += `- ${item.word}: latency ${item.avg_latency_ms}ms, error rate ${(item.error_rate * 100).toFixed(1)}%, score ${item.normalized_score}\n`;
      });
    }

    const systemPrompt = `You are a friendly typing coach explaining someone's typing patterns in plain, everyday language. NEVER use technical terms like "bigram", "latency", "normalized score", or jargon. Instead:
- Call letter combinations "finger movements" or "key pairs" (e.g., "typing 't' then 'h'" not "the t→h bigram")
- Say "slower" or "takes longer" instead of "high latency"
- Mention specific letters and give common word examples where they appear

CRITICAL: You MUST explicitly reference the poorest performing words (those with the lowest scores) in every response. These words should be called out by name to make them impossible to miss. Do not let them get lost in general advice.

Structure your response like this:
1. Start with an encouraging observation about their typing
2. Explicitly call out 2-3 of the worst performing words by name (e.g., "Your slowest words are 'because', 'different', and 'important'")
3. Explain 1-2 specific finger movements that are slowing them down, using real words as examples (e.g., "When you type words like 'the' or 'that', your fingers hesitate between 't' and 'h'")
4. End with: "In your next drill, we'll focus on [specific patterns] by practicing words like [2-3 example words including the poor performers] to build that muscle memory!"

Keep it warm, conversational, and under 5 sentences. Make it feel like advice from a supportive friend, not a technical report.`;

    const userPrompt = dataContext || 'No bigram or word data available. Provide general typing improvement advice.';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Anthropic API error:', error);
      return NextResponse.json(
        { error: 'Failed to generate AI summary' },
        { status: 500 }
      );
    }

    const data = await response.json();
    const summary = data.content[0]?.text || 'Unable to generate summary.';

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('AI summary error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
