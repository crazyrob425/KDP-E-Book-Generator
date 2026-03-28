/**
 * Trend & SEO Agent
 *
 * Integrates realMarketService data + Gemini to produce evidence-backed:
 *   keywords / title / subtitle / blurb / category suggestions
 */

import { orchestratedCall, withCanon } from '../services/llmOrchestrator';
import { getAi } from '../services/geminiService';
import { Type } from '@google/genai';
import { MarketReport } from '../types';

export interface SeoSuggestions {
  titles: { title: string; subtitle: string; rationale: string }[];
  keywords: string[];     // 7 KDP-ready keywords
  categories: string[];   // up to 3 BISAC-approximations
  blurb: string;          // back-cover blurb ≤200 words
  evidenceSummary: string;
}

const SEO_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    titles: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title:     { type: Type.STRING },
          subtitle:  { type: Type.STRING },
          rationale: { type: Type.STRING },
        },
        required: ['title', 'subtitle', 'rationale'],
      },
    },
    keywords:        { type: Type.ARRAY, items: { type: Type.STRING } },
    categories:      { type: Type.ARRAY, items: { type: Type.STRING } },
    blurb:           { type: Type.STRING },
    evidenceSummary: { type: Type.STRING },
  },
  required: ['titles', 'keywords', 'categories', 'blurb', 'evidenceSummary'],
};

export async function runTrendSeoAgent(
  marketReport: MarketReport,
  currentTitle?: string,
  currentSubtitle?: string,
): Promise<SeoSuggestions> {
  const prompt = withCanon(
    `You are a top KDP SEO and market-positioning expert.\n` +
    `Analyse the market data and generate optimised metadata.\n\n` +
    `Market Report:\n` +
    `- Trend Analysis: ${marketReport.trendAnalysis}\n` +
    `- Target Audience: ${marketReport.targetAudience.demographics}\n` +
    `- Pain Points: ${marketReport.targetAudience.painPoints}\n` +
    `- Market Keywords: ${marketReport.keywords.join(', ')}\n` +
    `- Competitors: ${marketReport.competitorAnalysis.slice(0, 4).map(c => c.title).join(', ')}\n` +
    (currentTitle ? `\nCurrent Title: "${currentTitle}"\nCurrent Subtitle: "${currentSubtitle}"` : '') +
    `\n\nGenerate:\n` +
    `1. 2 title/subtitle A/B variants with rationale\n` +
    `2. Exactly 7 KDP keywords (high-search, low-competition)\n` +
    `3. Up to 3 category placements\n` +
    `4. A back-cover blurb ≤200 words that hooks the reader\n` +
    `5. A brief evidence summary of why these choices are data-backed`,
    'jsonOnly',
  );

  const raw = await orchestratedCall(
    'agent:trend_seo',
    prompt,
    (p) => getAi().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: p,
      config: { responseMimeType: 'application/json', responseSchema: SEO_SCHEMA },
    }),
    SEO_SCHEMA,
    { maxInputTokens: 2500 },
  );

  try {
    return JSON.parse(raw) as SeoSuggestions;
  } catch {
    return {
      titles: [],
      keywords: marketReport.keywords.slice(0, 7),
      categories: [],
      blurb: '',
      evidenceSummary: 'SEO analysis unavailable.',
    };
  }
}
