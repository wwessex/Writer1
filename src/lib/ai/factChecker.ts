/**
 * AI-powered fact checker that identifies factual claims in text
 * and assesses their plausibility using the AI provider.
 */

import type { AIProvider, AIRequest } from './types';

export type FactCheckConfidence = 'verified' | 'uncertain' | 'likely-wrong';

export interface FactCheckClaim {
  id: string;
  text: string;
  from: number;
  to: number;
  confidence: FactCheckConfidence;
  explanation: string;
}

export interface FactCheckResult {
  claims: FactCheckClaim[];
  checkedAt: number;
}

const FACT_CHECK_PROMPT = `Analyze the following text and identify any factual claims (dates, statistics, historical events, scientific facts, geographic claims, etc.).

For each factual claim found, assess its accuracy and respond in the following JSON format ONLY (no other text):
[
  {
    "text": "the exact claim text",
    "confidence": "verified" | "uncertain" | "likely-wrong",
    "explanation": "brief explanation of why this assessment"
  }
]

If no factual claims are found, return an empty array: []

Text to analyze:
`;

export async function checkFacts(
  text: string,
  textOffset: number,
  provider: AIProvider,
  projectType: 'book' | 'screenplay',
  signal?: AbortSignal,
): Promise<FactCheckResult> {
  const request: AIRequest = {
    action: 'fact-check',
    prompt: FACT_CHECK_PROMPT + text,
    context: text,
    projectType,
    signal,
  };

  const response = await provider.execute(request);

  const claims = parseFactCheckResponse(response.text, text, textOffset);

  return {
    claims,
    checkedAt: Date.now(),
  };
}

function parseFactCheckResponse(
  responseText: string,
  originalText: string,
  textOffset: number,
): FactCheckClaim[] {
  try {
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      text: string;
      confidence: string;
      explanation: string;
    }>;

    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(item => item.text && item.confidence && item.explanation)
      .map((item, index) => {
        const claimIndex = originalText.indexOf(item.text);
        const from = claimIndex >= 0 ? textOffset + claimIndex : textOffset;
        const to = claimIndex >= 0 ? from + item.text.length : from;

        const confidence: FactCheckConfidence =
          item.confidence === 'verified' || item.confidence === 'uncertain' || item.confidence === 'likely-wrong'
            ? item.confidence
            : 'uncertain';

        return {
          id: `fact-${Date.now()}-${index}`,
          text: item.text,
          from,
          to,
          confidence,
          explanation: item.explanation,
        };
      });
  } catch {
    return [];
  }
}
