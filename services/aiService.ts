/**
 * aiService.ts — Unified AI Client (NullProxy Engine)
 *
 * This is the single entry point for all AI calls in Null Library.
 *
 * FALLBACK CHAIN (tried in order):
 *   1. NullProxy OAuth accounts  (free, browser-spoofed, no API key needed)
 *   2. Manual API keys           (user-entered in Settings)
 *   3. Free Google Gemini        (via VITE_GOOGLE_API_KEY env var or google login)
 *
 * Usage:
 *   import * as aiService from './aiService';
 *   const text = await aiService.generateText('creative-writing', prompt);
 */

/// <reference types="vite/client" />

import { GoogleGenAI, GenerateContentResponse, Type } from '@google/genai';
import { TaskType } from '../types';
import {
  selectProxyForTask,
  callGeminiViaProxy,
  callClaudeViaProxy,
  callOpenAIViaProxy,
  markAccountUnhealthy,
  recordAccountUsage,
} from './nullProxyService';
import { loadProxySettings } from './nullProxyService';

// ─── Gemini direct client (fallback) ─────────────────────────────────────────

let _geminiInstance: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!_geminiInstance) {
    const key = import.meta.env.VITE_GOOGLE_API_KEY || (typeof process !== 'undefined' ? process.env?.API_KEY : undefined);
    if (!key) {
      throw new Error(
        'No API key configured. Please connect an AI account in Settings, or add a VITE_GOOGLE_API_KEY to your .env file.'
      );
    }
    _geminiInstance = new GoogleGenAI({ apiKey: key });
  }
  return _geminiInstance;
}

/** Reset the Gemini client (e.g. after key change in settings). */
export function resetGeminiClient(): void {
  _geminiInstance = null;
}

// ─── Retry helper ─────────────────────────────────────────────────────────────

async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
  throw new Error('Max retries reached');
}

// ─── Core text generation ─────────────────────────────────────────────────────

export interface GenerateOptions {
  systemPrompt?: string;
  responseMimeType?: 'application/json' | 'text/plain';
  responseSchema?: any;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Generate text using the best available AI for the given task type.
 *
 * Tries the NullProxy Engine first, then falls back to manual API keys,
 * then to the free Gemini client.
 */
export async function generateText(
  taskType: TaskType,
  prompt: string,
  options: GenerateOptions = {}
): Promise<string> {
  const settings = await loadProxySettings();

  // ── Tier 1: NullProxy Engine ──────────────────────────────────────────────
  if (settings.enabled) {
    try {
      const selection = await selectProxyForTask(taskType);
      if (selection) {
        const result = await withRetry(async () => {
          let response: any;

          if (selection.provider.startsWith('gemini')) {
            // Convert simple text prompt to Gemini content format
            const contents = [{ role: 'user', parts: [{ text: prompt }] }];
            const config: Record<string, unknown> = {};
            if (options.responseMimeType) config.responseMimeType = options.responseMimeType;
            if (options.responseSchema) config.responseSchema = options.responseSchema;
            if (options.temperature !== undefined) config.temperature = options.temperature;
            response = await callGeminiViaProxy(selection, contents, config);
            return response?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

          } else if (selection.provider === 'claude-kiro') {
            const messages = [{ role: 'user', content: prompt }];
            response = await callClaudeViaProxy(
              selection,
              messages,
              options.systemPrompt,
              options.maxTokens ?? 8096
            );
            return response?.content?.[0]?.text ?? '';

          } else {
            // OpenAI-compatible providers
            const messages: { role: string; content: string }[] = [];
            if (options.systemPrompt) {
              messages.push({ role: 'system', content: options.systemPrompt });
            }
            messages.push({ role: 'user', content: prompt });
            response = await callOpenAIViaProxy(selection, messages, {
              temperature: options.temperature,
              responseFormat: options.responseMimeType === 'application/json' ? 'json' : undefined,
            });
            return response?.choices?.[0]?.message?.content ?? '';
          }
        });

        await recordAccountUsage(selection.account.id);
        return result;
      }
    } catch (proxyError) {
      console.warn('[NullProxy] Proxy attempt failed, falling back:', proxyError);
      // If we had a selection, mark the account as potentially unhealthy
      try {
        const sel = await selectProxyForTask(taskType);
        if (sel) await markAccountUnhealthy(sel.account.id);
      } catch {
        // ignore
      }
    }
  }

  // ── Tier 2 & 3: Manual API key / Free Gemini ──────────────────────────────
  return withRetry(async () => {
    const ai = getGeminiClient();

    const model = taskType === 'critique' ? 'gemini-2.5-pro' : 'gemini-2.5-flash';

    const genConfig: Record<string, unknown> = {};
    if (options.responseMimeType) genConfig.responseMimeType = options.responseMimeType;
    if (options.responseSchema) genConfig.responseSchema = options.responseSchema;

    let contents: any = prompt;
    if (options.systemPrompt) {
      contents = `${options.systemPrompt}\n\n${prompt}`;
    }

    const response = await ai.models.generateContent({
      model,
      contents,
      config: genConfig,
    } as any);

    return (response as any).text ?? '';
  });
}

/**
 * Generate structured JSON using the best available AI.
 * Convenience wrapper around generateText with JSON mode.
 */
export async function generateJSON<T = unknown>(
  taskType: TaskType,
  prompt: string,
  schema?: any
): Promise<T> {
  const text = await generateText(taskType, prompt, {
    responseMimeType: 'application/json',
    responseSchema: schema,
  });

  try {
    // Strip markdown code fences if present
    const clean = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    return JSON.parse(clean) as T;
  } catch {
    throw new Error(`[aiService] Failed to parse JSON response: ${text.substring(0, 200)}`);
  }
}

// ─── Re-export the legacy Gemini service functions for backward compatibility ──
// This allows existing code that imports from geminiService to continue working
// through the new routing layer.

export { Type };

export function getAi(): GoogleGenAI {
  return getGeminiClient();
}

// ─── Direct Gemini call (for functions that need the full response object) ────

export async function generateContentDirect(
  model: string,
  contents: any,
  config?: any
): Promise<GenerateContentResponse> {
  // Try proxy first for Gemini models
  const taskType: TaskType = 'general';
  const settings = await loadProxySettings();

  if (settings.enabled) {
    try {
      const selection = await selectProxyForTask(taskType);
      if (selection && selection.provider.startsWith('gemini')) {
        const contentsArray = typeof contents === 'string'
          ? [{ role: 'user', parts: [{ text: contents }] }]
          : contents;
        const result = await callGeminiViaProxy(selection, contentsArray, config);
        await recordAccountUsage(selection.account.id);
        return result as GenerateContentResponse;
      }
    } catch {
      // fall through to direct
    }
  }

  const ai = getGeminiClient();
  return ai.models.generateContent({ model, contents, config } as any) as Promise<GenerateContentResponse>;
}
