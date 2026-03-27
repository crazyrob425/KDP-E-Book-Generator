/**
 * emotionalPolish.ts
 *
 * Single LLM call to polish the stitched chapter:
 *   • Improve flow and remove repetition
 *   • Enhance emotional resonance (show/don't-tell, subtext, tension)
 *   • Hard cap: output must NOT expand beyond (input * (1 + expansionCapPct/100))
 *   • Must preserve all plot facts
 */

import { GoogleGenAI } from '@google/genai';
import { getAi } from '../../services/geminiService';
import { orchestratedCall } from '../../services/llmOrchestrator';

export interface PolishOptions {
  stitchedChapter: string;
  chapterSummary: string;
  voiceContract: string;
  /** e.g. 6 → max 6 % expansion (default 6) */
  expansionCapPct?: number;
  bookTitle?: string;
  chapterTitle?: string;
}

/**
 * Runs the emotional polish pass and returns the polished chapter markdown.
 * Enforces the expansion cap locally if the model goes over.
 */
export async function polishChapter(
  options: PolishOptions,
  ai?: GoogleGenAI
): Promise<string> {
  const {
    stitchedChapter,
    chapterSummary,
    voiceContract,
    expansionCapPct = 6,
    bookTitle = '',
    chapterTitle = '',
  } = options;

  const originalWordCount = stitchedChapter.trim().split(/\s+/).length;
  const maxWords = Math.round(originalWordCount * (1 + expansionCapPct / 100));

  const contextLabel = [bookTitle, chapterTitle].filter(Boolean).join(' — ');

  const prompt = `You are the Grand Master Emotional Editor${contextLabel ? ` for "${contextLabel}"` : ''}.

Voice contract: ${voiceContract}

Chapter summary (for continuity reference only):
${chapterSummary}

Chapter to polish:
---
${stitchedChapter}
---

Instructions:
1. Improve narrative flow and remove any repetition or transition artefacts.
2. Deepen emotional resonance: use subtext, sensory detail, and internal stakes — show, don't tell.
3. Preserve all plot facts and character names exactly.
4. Do NOT introduce new characters or plot points.
5. HARD LIMIT: your output must be at most ${maxWords} words (${expansionCapPct}% expansion cap).
6. Do NOT add a preamble. Return ONLY the polished Markdown prose.`;

  const instance = ai ?? getAi();
  const polished = await orchestratedCall(instance, {
    step: 'polish',
    model: 'gemini-2.5-flash',
    prompt,
    // Polish pass is content-heavy — bypass cache to ensure freshness
    noCache: true,
  });

  // Safety enforcement: if model exceeded the cap, hard-truncate at sentence boundary
  const words = polished.trim().split(/\s+/);
  if (words.length > maxWords) {
    // Find last sentence boundary within limit
    const truncated = words.slice(0, maxWords).join(' ');
    const lastPeriod = Math.max(
      truncated.lastIndexOf('.'),
      truncated.lastIndexOf('!'),
      truncated.lastIndexOf('?')
    );
    return lastPeriod > 0 ? truncated.slice(0, lastPeriod + 1) : truncated;
  }

  return polished.trim();
}
