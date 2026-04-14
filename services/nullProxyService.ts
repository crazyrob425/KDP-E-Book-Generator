/**
 * NullProxy Engine — nullProxyService.ts
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  WHAT IS THE NULLPROXY ENGINE?  (Plain English)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Instead of needing expensive paid API keys to use AI, this system logs
 *  into AI tools the same way any normal user would — through the real browser
 *  login pages (Google, Anthropic, OpenAI, etc.).
 *
 *  Once you log in, it saves the resulting "session token" (a temporary
 *  digital ID card) to your local machine. When the app needs AI, it uses
 *  that saved token to make requests that look exactly like a logged-in user
 *  browsing the web — bypassing the need for an API key entirely.
 *
 *  HOW:
 *  1. A tiny local web server opens briefly to catch the login callback.
 *  2. Your real browser opens to the provider's login page (Google, etc.).
 *  3. You log in normally. The callback token is captured automatically.
 *  4. The token is stored securely in your app's local data folder.
 *  5. Every AI call routes through that token going forward.
 *
 *  WHY:
 *  - No API costs for casual use (these are free-tier user accounts).
 *  - Add multiple accounts per provider → spread load so no single account
 *    hits rate limits (round-robin load balancing).
 *  - Smart routing picks the best model for each type of task.
 *  - If a token expires or fails, the app automatically falls back to your
 *    manually entered API key, and then to free Google Gemini as last resort.
 *
 *  FAILSAFE CHAIN:
 *    OAuth Proxy → Manual API Key → Free Google Account (Gemini)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { ProxyProvider, ProxyAccount, ProxySettings, TaskType } from '../types';
import desktopBridge from './desktopBridge';

// ─── Default task-to-provider routing table ──────────────────────────────────
//  Maps each task type to an ordered list of preferred providers.
//  The engine tries them in order, picking the first healthy one.

export const DEFAULT_TASK_ROUTING: Record<TaskType, ProxyProvider[]> = {
  'creative-writing':  ['gemini-cli', 'gemini-antigravity', 'openai-codex'],
  'market-research':   ['gemini-cli', 'gemini-antigravity', 'claude-kiro'],
  'marketing-copy':    ['claude-kiro', 'openai-codex', 'gemini-cli'],
  'image-prompt':      ['gemini-cli', 'gemini-antigravity'],
  'critique':          ['claude-kiro', 'gemini-cli', 'openai-codex'],
  'general':           ['gemini-cli', 'gemini-antigravity', 'claude-kiro', 'openai-codex'],
};

// ─── Default provider priority order ────────────────────────────────────────
export const DEFAULT_PROVIDER_PRIORITY: ProxyProvider[] = [
  'gemini-cli',
  'gemini-antigravity',
  'claude-kiro',
  'openai-codex',
  'openai-qwen',
  'openai-iflow',
];

// ─── Default proxy settings ──────────────────────────────────────────────────
export const DEFAULT_PROXY_SETTINGS: ProxySettings = {
  enabled: true,
  roundRobinEnabled: true,
  providerPriority: DEFAULT_PROVIDER_PRIORITY,
  taskRouting: DEFAULT_TASK_ROUTING,
  failsafeEnabled: true,
  manualApiKey: undefined,
  manualClaudeApiKey: undefined,
  manualOpenAiApiKey: undefined,
  accounts: [],
};

// ─── Round-robin state (in-memory per session) ───────────────────────────────
const roundRobinIndexes: Record<string, number> = {};

// ─── Settings cache ──────────────────────────────────────────────────────────
let _settingsCache: ProxySettings | null = null;

/**
 * Load proxy settings from disk (via Electron IPC), with in-memory cache.
 */
export async function loadProxySettings(): Promise<ProxySettings> {
  if (_settingsCache) return _settingsCache;
  try {
    const saved = await desktopBridge.proxyGetSettings();
    _settingsCache = saved
      ? { ...DEFAULT_PROXY_SETTINGS, ...saved }
      : { ...DEFAULT_PROXY_SETTINGS };
  } catch {
    _settingsCache = { ...DEFAULT_PROXY_SETTINGS };
  }
  return _settingsCache;
}

/**
 * Save proxy settings to disk and update cache.
 */
export async function saveProxySettings(settings: ProxySettings): Promise<void> {
  _settingsCache = settings;
  try {
    await desktopBridge.proxySaveSettings(settings);
  } catch (e) {
    console.error('[NullProxy] Failed to persist settings:', e);
  }
}

/**
 * Invalidate the in-memory settings cache (call after adding/removing accounts).
 */
export function invalidateSettingsCache(): void {
  _settingsCache = null;
}

// ─── Account selection ───────────────────────────────────────────────────────

/**
 * Get all healthy, enabled accounts for a given provider.
 */
function getHealthyAccounts(settings: ProxySettings, provider: ProxyProvider): ProxyAccount[] {
  return settings.accounts.filter(
    (a) => a.provider === provider && a.isHealthy && !a.isDisabled
  );
}

/**
 * Pick the next account for a provider using round-robin rotation.
 * Returns null if no healthy accounts are available.
 */
export function selectAccount(
  settings: ProxySettings,
  provider: ProxyProvider
): ProxyAccount | null {
  const accounts = getHealthyAccounts(settings, provider);
  if (accounts.length === 0) return null;
  if (!settings.roundRobinEnabled) return accounts[0];

  const key = provider;
  const idx = (roundRobinIndexes[key] ?? 0) % accounts.length;
  roundRobinIndexes[key] = idx + 1;
  return accounts[idx];
}

// ─── Provider-to-API-base-URL mapping ────────────────────────────────────────
export const PROVIDER_API_BASE: Record<ProxyProvider, string> = {
  'gemini-cli':         'https://generativelanguage.googleapis.com/v1beta',
  'gemini-antigravity': 'https://generativelanguage.googleapis.com/v1beta',
  'claude-kiro':        'https://api.anthropic.com/v1',
  'openai-codex':       'https://api.openai.com/v1',
  'openai-qwen':        'https://api.openai.com/v1',
  'openai-iflow':       'https://api.openai.com/v1',
};

// Best model to use per provider for each task type
export const PROVIDER_MODELS: Record<ProxyProvider, Record<TaskType, string>> = {
  'gemini-cli': {
    'creative-writing': 'gemini-2.5-flash',
    'market-research':  'gemini-2.5-flash',
    'marketing-copy':   'gemini-2.5-flash',
    'image-prompt':     'gemini-2.5-flash',
    'critique':         'gemini-2.5-flash',
    'general':          'gemini-2.5-flash',
  },
  'gemini-antigravity': {
    'creative-writing': 'gemini-2.5-flash',
    'market-research':  'gemini-2.5-flash',
    'marketing-copy':   'gemini-2.5-flash',
    'image-prompt':     'gemini-2.5-flash',
    'critique':         'gemini-2.5-flash',
    'general':          'gemini-2.5-flash',
  },
  'claude-kiro': {
    'creative-writing': 'claude-3-5-haiku-20241022',
    'market-research':  'claude-3-5-haiku-20241022',
    'marketing-copy':   'claude-3-7-sonnet-20250219',
    'image-prompt':     'claude-3-5-haiku-20241022',
    'critique':         'claude-3-7-sonnet-20250219',
    'general':          'claude-3-5-haiku-20241022',
  },
  'openai-codex': {
    'creative-writing': 'gpt-4o-mini',
    'market-research':  'gpt-4o-mini',
    'marketing-copy':   'gpt-4o-mini',
    'image-prompt':     'gpt-4o-mini',
    'critique':         'gpt-4o',
    'general':          'gpt-4o-mini',
  },
  'openai-qwen': {
    'creative-writing': 'qwen3-coder-flash',
    'market-research':  'qwen3-coder-flash',
    'marketing-copy':   'qwen3-coder-flash',
    'image-prompt':     'qwen3-coder-flash',
    'critique':         'qwen3-coder-flash',
    'general':          'qwen3-coder-flash',
  },
  'openai-iflow': {
    'creative-writing': 'qwen3-coder-plus',
    'market-research':  'qwen3-coder-plus',
    'marketing-copy':   'qwen3-coder-plus',
    'image-prompt':     'qwen3-coder-plus',
    'critique':         'qwen3-coder-plus',
    'general':          'qwen3-coder-plus',
  },
};

// ─── Core routing logic ───────────────────────────────────────────────────────

export interface ProxySelection {
  /** Which provider was chosen */
  provider: ProxyProvider;
  /** The account to use */
  account: ProxyAccount;
  /** Which model to call on that provider */
  model: string;
  /** Base URL for the provider's API */
  baseUrl: string;
  /** Authorization header value (Bearer <token>) */
  authHeader: string;
}

/**
 * Find the best available proxy selection for a given task type.
 *
 * Tries each provider in the task's routing order (respecting the user's
 * priority override), picks the first healthy account via round-robin.
 *
 * Returns null if no proxy accounts are available for this task.
 */
export async function selectProxyForTask(
  taskType: TaskType
): Promise<ProxySelection | null> {
  const settings = await loadProxySettings();
  if (!settings.enabled) return null;

  const preferredProviders = settings.taskRouting[taskType] ?? DEFAULT_TASK_ROUTING[taskType];

  // Apply user's provider priority ordering as a secondary sort
  const priorityMap = Object.fromEntries(
    settings.providerPriority.map((p, i) => [p, i])
  );
  const orderedProviders = [...preferredProviders].sort(
    (a, b) => (priorityMap[a] ?? 99) - (priorityMap[b] ?? 99)
  );

  for (const provider of orderedProviders) {
    const account = selectAccount(settings, provider);
    if (!account) continue;

    // Get the stored OAuth token for this account
    const credPath = await desktopBridge.proxyGetCredPath(provider, account.id);
    const token = credPath ? await readTokenFromCredPath(credPath, provider) : null;
    if (!token) continue;

    return {
      provider,
      account,
      model: PROVIDER_MODELS[provider][taskType],
      baseUrl: PROVIDER_API_BASE[provider],
      authHeader: `Bearer ${token}`,
    };
  }

  return null;
}

/**
 * Read the access token from a credential file path.
 * Delegates to Electron main process for filesystem access.
 * In browser mode this always returns null (no filesystem access).
 */
async function readTokenFromCredPath(
  credPath: string,
  provider: ProxyProvider
): Promise<string | null> {
  try {
    // In Electron, use IPC to read the file from the main process
    if (typeof window !== 'undefined' && window.electronAPI) {
      const result = await (window as any).electronAPI.readCredFile?.(credPath);
      if (!result) return null;
      const creds = typeof result === 'string' ? JSON.parse(result) : result;
      // Different providers use different field names for the access token
      return (
        creds.access_token ||
        creds.accessToken ||
        creds.token ||
        creds.userAccessToken ||
        null
      );
    }
  } catch (e) {
    console.warn(`[NullProxy] Failed to read token for ${provider}:`, e);
  }
  return null;
}

// ─── Gemini-specific proxy call ───────────────────────────────────────────────

/**
 * Make a Gemini API call using an OAuth access token instead of an API key.
 * This is the core "spoofing" mechanism for Gemini providers.
 */
export async function callGeminiViaProxy(
  selection: ProxySelection,
  contents: any[],
  config?: Record<string, unknown>
): Promise<any> {
  const url = `${selection.baseUrl}/models/${selection.model}:generateContent`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': selection.authHeader,
    },
    body: JSON.stringify({ contents, generationConfig: config }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`[NullProxy/Gemini] ${response.status}: ${err}`);
  }

  return response.json();
}

/**
 * Make a Claude API call via the Kiro OAuth token.
 */
export async function callClaudeViaProxy(
  selection: ProxySelection,
  messages: any[],
  systemPrompt?: string,
  maxTokens = 8096
): Promise<any> {
  const url = `${selection.baseUrl}/messages`;
  const body: Record<string, unknown> = {
    model: selection.model,
    max_tokens: maxTokens,
    messages,
  };
  if (systemPrompt) body.system = systemPrompt;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': selection.authHeader.replace('Bearer ', ''),
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`[NullProxy/Claude] ${response.status}: ${err}`);
  }

  return response.json();
}

/**
 * Make an OpenAI-compatible API call via an OAuth token
 * (works for Codex/GPT, Qwen, iFlow providers).
 */
export async function callOpenAIViaProxy(
  selection: ProxySelection,
  messages: { role: string; content: string }[],
  options?: { temperature?: number; responseFormat?: 'json' }
): Promise<any> {
  const url = `${selection.baseUrl}/chat/completions`;
  const body: Record<string, unknown> = {
    model: selection.model,
    messages,
  };
  if (options?.temperature !== undefined) body.temperature = options.temperature;
  if (options?.responseFormat === 'json') {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': selection.authHeader,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`[NullProxy/OpenAI] ${response.status}: ${err}`);
  }

  return response.json();
}

// ─── Mark account as unhealthy after failure ──────────────────────────────────
export async function markAccountUnhealthy(accountId: string): Promise<void> {
  const settings = await loadProxySettings();
  const updated: ProxySettings = {
    ...settings,
    accounts: settings.accounts.map((a) =>
      a.id === accountId
        ? { ...a, errorCount: a.errorCount + 1, isHealthy: a.errorCount + 1 >= 3 ? false : a.isHealthy }
        : a
    ),
  };
  await saveProxySettings(updated);
}

// ─── Update usage stats for an account ───────────────────────────────────────
export async function recordAccountUsage(accountId: string): Promise<void> {
  const settings = await loadProxySettings();
  const updated: ProxySettings = {
    ...settings,
    accounts: settings.accounts.map((a) =>
      a.id === accountId
        ? { ...a, usageCount: a.usageCount + 1, lastUsed: Date.now() }
        : a
    ),
  };
  await saveProxySettings(updated);
}

// ─── Get human-readable provider display names ────────────────────────────────
export const PROVIDER_DISPLAY_NAMES: Record<ProxyProvider, string> = {
  'gemini-cli':         'Google Gemini (CLI OAuth)',
  'gemini-antigravity': 'Google Gemini (Antigravity)',
  'claude-kiro':        'Anthropic Claude (Kiro IDE)',
  'openai-codex':       'OpenAI GPT (Codex OAuth)',
  'openai-qwen':        'Qwen AI (QwenCoder)',
  'openai-iflow':       'Qwen Plus (iFlow)',
};

// ─── Get provider login URL descriptions ─────────────────────────────────────
export const PROVIDER_LOGIN_DESCRIPTIONS: Record<ProxyProvider, string> = {
  'gemini-cli':         'Log in with your Google account to access Gemini 2.5 Flash for free.',
  'gemini-antigravity': 'Connect a second Google account for Gemini load balancing.',
  'claude-kiro':        'Log in to Kiro IDE with your account to access Claude Sonnet & Haiku.',
  'openai-codex':       'Connect via GitHub/Microsoft account to access GPT-4o mini for free.',
  'openai-qwen':        'Log in with Alibaba/Qwen account for structured AI tasks.',
  'openai-iflow':       'Connect iFlow account for Qwen Plus access (backup).',
};
