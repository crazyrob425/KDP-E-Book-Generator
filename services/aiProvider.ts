/// <reference types="vite/client" />

export interface AIProviderConfig {
  type: 'gemini' | 'openai-compatible';
  openaiBaseUrl?: string;   // e.g. http://localhost:11434/v1
  openaiApiKey?: string;
  openaiModel?: string;     // e.g. 'llama3', 'mistral', 'gpt-4'
}

const PROVIDER_CONFIG_KEY = 'kdp-provider-config';

export function loadProviderConfig(): AIProviderConfig {
  try {
    const stored = localStorage.getItem(PROVIDER_CONFIG_KEY);
    if (stored) return JSON.parse(stored) as AIProviderConfig;
  } catch {
    // ignore
  }
  return { type: 'gemini' };
}

export function saveProviderConfig(config: AIProviderConfig): void {
  try {
    localStorage.setItem(PROVIDER_CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn('[Provider] Failed to save config:', e);
  }
}

export async function testProviderConnection(
  config: AIProviderConfig
): Promise<{ success: boolean; message: string }> {
  if (config.type === 'gemini') {
    try {
      const { getAi } = await import('./geminiService');
      const ai = getAi();
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: 'Reply with only the word: OK',
      });
      return { success: true, message: `Gemini connected. Response: ${response.text?.trim()}` };
    } catch (e) {
      return { success: false, message: `Gemini failed: ${(e as Error).message}` };
    }
  }

  if (config.type === 'openai-compatible') {
    if (!config.openaiBaseUrl) {
      return { success: false, message: 'Base URL is required.' };
    }
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (config.openaiApiKey) headers['Authorization'] = `Bearer ${config.openaiApiKey}`;

      const res = await fetch(`${config.openaiBaseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: config.openaiModel || 'default',
          messages: [{ role: 'user', content: 'Reply with only: OK' }],
          stream: false,
          max_tokens: 10,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        return { success: false, message: `HTTP ${res.status}: ${txt.substring(0, 200)}` };
      }
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      return { success: true, message: `Connected. Response: ${text}` };
    } catch (e) {
      return { success: false, message: `Connection failed: ${(e as Error).message}` };
    }
  }

  return { success: false, message: 'Unknown provider type.' };
}

export async function generateText(prompt: string, systemPrompt?: string): Promise<string> {
  const config = loadProviderConfig();

  if (config.type === 'openai-compatible' && config.openaiBaseUrl) {
    try {
      const messages: { role: string; content: string }[] = [];
      if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
      messages.push({ role: 'user', content: prompt });

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (config.openaiApiKey) headers['Authorization'] = `Bearer ${config.openaiApiKey}`;

      const res = await fetch(`${config.openaiBaseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: config.openaiModel || 'default', messages, stream: false }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data?.choices?.[0]?.message?.content || '';
    } catch (e) {
      console.warn('[Provider] OpenAI-compatible failed, falling back to Gemini:', e);
    }
  }

  // Fallback: Gemini
  const { getAi } = await import('./geminiService');
  const ai = getAi();
  const contents = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
  const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents });
  return response.text || '';
}

export async function generateTextStream(
  prompt: string,
  onChunk: (text: string) => void,
  systemPrompt?: string
): Promise<string> {
  const config = loadProviderConfig();

  if (config.type === 'openai-compatible' && config.openaiBaseUrl) {
    try {
      const messages: { role: string; content: string }[] = [];
      if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
      messages.push({ role: 'user', content: prompt });

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (config.openaiApiKey) headers['Authorization'] = `Bearer ${config.openaiApiKey}`;

      const res = await fetch(`${config.openaiBaseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: config.openaiModel || 'default', messages, stream: true }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value, { stream: true }).split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const dataStr = line.slice(6).trim();
          if (dataStr === '[DONE]') continue;
          try {
            const data = JSON.parse(dataStr);
            const text: string = data?.choices?.[0]?.delta?.content || '';
            if (text) { accumulated += text; onChunk(text); }
          } catch { /* skip malformed SSE */ }
        }
      }
      return accumulated;
    } catch (e) {
      console.warn('[Provider] OpenAI stream failed, falling back to Gemini:', e);
    }
  }

  // Fallback: Gemini streaming
  const { getAi } = await import('./geminiService');
  const ai = getAi();
  const contents = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
  let accumulated = '';
  try {
    const streamResult = await ai.models.generateContentStream({ model: 'gemini-2.5-flash', contents });
    for await (const chunk of streamResult) {
      const text = chunk.text || '';
      if (text) { accumulated += text; onChunk(text); }
    }
  } catch (e) {
    // Last-resort: non-streaming
    const text = await generateText(prompt, systemPrompt);
    onChunk(text);
    return text;
  }
  return accumulated;
}
