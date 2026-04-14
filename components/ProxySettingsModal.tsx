import React, { useState, useEffect, useCallback } from 'react';
import Modal from './shared/Modal';
import Button from './shared/Button';
import LoadingSpinner from './shared/LoadingSpinner';
import { ProxyProvider, ProxyAccount, ProxySettings } from '../types';
import {
  PROVIDER_DISPLAY_NAMES,
  PROVIDER_LOGIN_DESCRIPTIONS,
  DEFAULT_PROXY_SETTINGS,
  loadProxySettings,
  saveProxySettings,
  invalidateSettingsCache,
} from '../services/nullProxyService';
import { startOAuthFlow, removeAccount, isElectronRuntime } from '../services/oauthSetupService';
import desktopBridge from '../services/desktopBridge';

interface ProxySettingsModalProps {
  onClose: () => void;
}

const PROXY_PROVIDERS: ProxyProvider[] = [
  'gemini-cli',
  'gemini-antigravity',
  'claude-kiro',
  'openai-codex',
  'openai-qwen',
  'openai-iflow',
];

const TASK_LABELS: Record<string, string> = {
  'creative-writing': 'Long-form Creative Writing',
  'market-research':  'Market Research & Structured Data',
  'marketing-copy':   'Marketing Copy & Book Descriptions',
  'image-prompt':     'Image Prompt Generation',
  'critique':         'Quality Critique & Proofreading',
  'general':          'General / Unclassified Tasks',
};

const ProxySettingsModal: React.FC<ProxySettingsModalProps> = ({ onClose }) => {
  const [settings, setSettings] = useState<ProxySettings | null>(null);
  const [activeTab, setActiveTab] = useState<'status' | 'accounts' | 'routing' | 'keys'>('status');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [connectingProvider, setConnectingProvider] = useState<ProxyProvider | null>(null);
  const [oauthMessage, setOauthMessage] = useState<Record<string, string>>({});
  const [isElectron] = useState(isElectronRuntime);

  useEffect(() => {
    loadProxySettings().then((s) => {
      setSettings(s);
      setIsLoading(false);
    });
  }, []);

  const handleSave = useCallback(async (updated: ProxySettings) => {
    setIsSaving(true);
    try {
      await saveProxySettings(updated);
      setSettings(updated);
    } finally {
      setIsSaving(false);
    }
  }, []);

  const handleToggle = (field: keyof ProxySettings) => {
    if (!settings) return;
    const updated = { ...settings, [field]: !settings[field as keyof ProxySettings] };
    handleSave(updated as ProxySettings);
  };

  const handleConnectAccount = useCallback(async (provider: ProxyProvider) => {
    setConnectingProvider(provider);
    setOauthMessage((prev) => ({ ...prev, [provider]: 'Connecting…' }));
    const account = await startOAuthFlow(provider, (status) => {
      setOauthMessage((prev) => ({ ...prev, [provider]: status.message }));
    });
    setConnectingProvider(null);
    if (account) {
      invalidateSettingsCache();
      const refreshed = await loadProxySettings();
      setSettings(refreshed);
      setOauthMessage((prev) => ({ ...prev, [provider]: '✅ Connected!' }));
    } else {
      setOauthMessage((prev) => ({
        ...prev,
        [provider]: prev[provider]?.includes('✅') ? prev[provider] : '❌ Failed — try again',
      }));
    }
  }, []);

  const handleRemoveAccount = useCallback(async (accountId: string) => {
    if (!window.confirm('Remove this account?')) return;
    await removeAccount(accountId);
    invalidateSettingsCache();
    const refreshed = await loadProxySettings();
    setSettings(refreshed);
  }, []);

  const handlePriorityMove = (provider: ProxyProvider, direction: 'up' | 'down') => {
    if (!settings) return;
    const list = [...settings.providerPriority];
    const idx = list.indexOf(provider);
    if (idx < 0) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= list.length) return;
    [list[idx], list[newIdx]] = [list[newIdx], list[idx]];
    handleSave({ ...settings, providerPriority: list });
  };

  const handleKeyChange = (field: 'manualApiKey' | 'manualClaudeApiKey' | 'manualOpenAiApiKey', value: string) => {
    if (!settings) return;
    setSettings({ ...settings, [field]: value });
  };

  const handleKeySave = () => {
    if (!settings) return;
    handleSave(settings);
  };

  if (isLoading || !settings) {
    return (
      <Modal title="AI Proxy Settings" onClose={onClose} size="lg">
        <div className="flex items-center justify-center h-48">
          <LoadingSpinner size="lg" message="Loading settings…" />
        </div>
      </Modal>
    );
  }

  const accountsByProvider: Record<string, ProxyAccount[]> = {};
  for (const account of settings.accounts ?? []) {
    if (!accountsByProvider[account.provider]) accountsByProvider[account.provider] = [];
    accountsByProvider[account.provider].push(account);
  }

  const totalAccounts = settings.accounts?.length ?? 0;
  const healthyAccounts = settings.accounts?.filter((a) => a.isHealthy && !a.isDisabled).length ?? 0;

  return (
    <Modal title="AI Proxy Settings — NullProxy Engine" onClose={onClose} size="lg">
      {/* Explanation banner */}
      <div className="mb-5 bg-slate-800/60 border border-slate-700 rounded-xl p-4 text-sm text-slate-400 leading-relaxed">
        <strong className="text-violet-300">What is the NullProxy Engine?</strong>{' '}
        Instead of paid API keys, this system logs into AI tools through real browser login pages
        (Google, Anthropic, etc.) and stores your session tokens locally. AI calls are routed
        through those tokens — <em>free, private, on your machine</em>.{' '}
        <strong className="text-slate-300">Failsafe chain:</strong>{' '}
        <span className="text-violet-400">OAuth Proxy</span>{' → '}
        <span className="text-blue-400">Manual API Key</span>{' → '}
        <span className="text-emerald-400">Free Gemini</span>
      </div>

      {/* Master toggle */}
      <div className="flex items-center justify-between mb-5 bg-slate-900 border border-slate-700 rounded-lg px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-slate-200">NullProxy Engine</div>
          <div className="text-xs text-slate-500">Master switch for all proxy AI access</div>
        </div>
        <button
          onClick={() => handleToggle('enabled')}
          className={`relative w-12 h-6 rounded-full transition-colors ${settings.enabled ? 'bg-violet-600' : 'bg-slate-700'}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-slate-900 rounded-lg p-1 border border-slate-700">
        {(['status', 'accounts', 'routing', 'keys'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors capitalize ${
              activeTab === tab
                ? 'bg-violet-600 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            {tab === 'status' ? '📊 Status' :
             tab === 'accounts' ? '👤 Accounts' :
             tab === 'routing' ? '🔀 Routing' :
             '🔑 API Keys'}
          </button>
        ))}
      </div>

      {/* ── Status Tab ──────────────────────────────────────────────────────── */}
      {activeTab === 'status' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Accounts', value: totalAccounts, color: 'text-white' },
              { label: 'Healthy', value: healthyAccounts, color: 'text-emerald-400' },
              { label: 'Unhealthy', value: totalAccounts - healthyAccounts, color: 'text-red-400' },
              { label: 'Providers', value: Object.keys(accountsByProvider).length, color: 'text-violet-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-slate-900 border border-slate-700 rounded-xl p-3 text-center">
                <div className={`text-2xl font-bold ${color}`}>{value}</div>
                <div className="text-xs text-slate-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Per-Provider Status</h3>
            <div className="space-y-2">
              {PROXY_PROVIDERS.map((provider) => {
                const accounts = accountsByProvider[provider] ?? [];
                const healthy = accounts.filter((a) => a.isHealthy && !a.isDisabled);
                return (
                  <div key={provider} className="flex items-center justify-between bg-slate-900 border border-slate-700 rounded-lg px-3 py-2">
                    <div className="text-sm text-slate-300">{PROVIDER_DISPLAY_NAMES[provider]}</div>
                    <div className="flex items-center gap-2">
                      {accounts.length === 0 ? (
                        <span className="text-xs text-slate-600">Not connected</span>
                      ) : (
                        <>
                          <span className="text-xs text-slate-500">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</span>
                          <span className={`w-2 h-2 rounded-full ${healthy.length > 0 ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Round-robin toggle */}
          <div className="flex items-center justify-between bg-slate-900 border border-slate-700 rounded-lg px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-slate-200">Multi-Account Round Robin</div>
              <div className="text-xs text-slate-500">Rotate through all accounts to spread API load evenly</div>
            </div>
            <button
              onClick={() => handleToggle('roundRobinEnabled')}
              className={`relative w-12 h-6 rounded-full transition-colors ${settings.roundRobinEnabled ? 'bg-violet-600' : 'bg-slate-700'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.roundRobinEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* Failsafe toggle */}
          <div className="flex items-center justify-between bg-slate-900 border border-slate-700 rounded-lg px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-slate-200">Failsafe Mode</div>
              <div className="text-xs text-slate-500">Fall back to free Google Gemini if all proxy accounts fail</div>
            </div>
            <button
              onClick={() => handleToggle('failsafeEnabled')}
              className={`relative w-12 h-6 rounded-full transition-colors ${settings.failsafeEnabled ? 'bg-violet-600' : 'bg-slate-700'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.failsafeEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>
      )}

      {/* ── Accounts Tab ────────────────────────────────────────────────────── */}
      {activeTab === 'accounts' && (
        <div className="space-y-4">
          {!isElectron && (
            <div className="bg-amber-950/30 border border-amber-800/50 text-amber-300 rounded-lg px-4 py-3 text-sm">
              ⚠️ Adding OAuth accounts requires the Null Library desktop app (Electron).
            </div>
          )}

          {PROXY_PROVIDERS.map((provider) => {
            const accounts = accountsByProvider[provider] ?? [];
            const isConnecting = connectingProvider === provider;
            const msg = oauthMessage[provider];

            return (
              <div key={provider} className="bg-slate-900 border border-slate-700 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-200">{PROVIDER_DISPLAY_NAMES[provider]}</div>
                    <div className="text-xs text-slate-500">{PROVIDER_LOGIN_DESCRIPTIONS[provider]}</div>
                  </div>
                  <button
                    onClick={() => handleConnectAccount(provider)}
                    disabled={!isElectron || isConnecting || connectingProvider !== null}
                    className="px-3 py-1.5 text-xs font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    {isConnecting ? <><LoadingSpinner size="sm" /> Connecting…</> : '+ Add Account'}
                  </button>
                </div>

                {msg && (
                  <div className={`text-xs px-2 py-1 rounded mb-2 ${
                    msg.startsWith('✅') ? 'text-emerald-400 bg-emerald-950/30' :
                    msg.startsWith('❌') ? 'text-red-400 bg-red-950/30' :
                    'text-slate-400 bg-slate-800'
                  }`}>{msg}</div>
                )}

                {accounts.length > 0 ? (
                  <div className="space-y-1.5">
                    {accounts.map((account) => (
                      <div key={account.id} className="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2">
                        <div>
                          <div className="text-xs text-slate-300 font-mono">
                            {account.displayName ?? account.email ?? account.id.substring(0, 24) + '…'}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-600">
                            <span>{account.usageCount} calls</span>
                            {account.lastUsed && (
                              <span>Last: {new Date(account.lastUsed).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${account.isHealthy && !account.isDisabled ? 'bg-emerald-500' : 'bg-red-500'}`} />
                          <button
                            onClick={() => handleRemoveAccount(account.id)}
                            className="text-xs text-slate-500 hover:text-red-400 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-600 italic">No accounts connected</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Routing Tab ─────────────────────────────────────────────────────── */}
      {activeTab === 'routing' && (
        <div className="space-y-5">
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Provider Priority Order</h3>
            <p className="text-xs text-slate-600 mb-3">
              Drag or use arrows to reorder. The engine tries providers from top to bottom.
            </p>
            <div className="space-y-1.5">
              {settings.providerPriority.map((provider, idx) => (
                <div key={provider} className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2">
                  <span className="text-xs text-slate-600 w-4 text-center">{idx + 1}</span>
                  <span className="text-sm text-slate-300 flex-1">{PROVIDER_DISPLAY_NAMES[provider]}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handlePriorityMove(provider, 'up')}
                      disabled={idx === 0}
                      className="text-xs text-slate-500 hover:text-slate-200 disabled:opacity-30 px-1"
                    >▲</button>
                    <button
                      onClick={() => handlePriorityMove(provider, 'down')}
                      disabled={idx === settings.providerPriority.length - 1}
                      className="text-xs text-slate-500 hover:text-slate-200 disabled:opacity-30 px-1"
                    >▼</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Task → Provider Routing</h3>
            <p className="text-xs text-slate-600 mb-3">
              Which providers to try for each type of AI task (in order of preference).
            </p>
            <div className="space-y-2">
              {Object.entries(settings.taskRouting).map(([task, providers]) => (
                <div key={task} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2">
                  <div className="text-xs font-semibold text-slate-300 mb-1">{TASK_LABELS[task] ?? task}</div>
                  <div className="flex flex-wrap gap-1">
                    {(providers as ProxyProvider[]).map((p) => (
                      <span key={p} className="text-xs bg-violet-900/40 text-violet-300 border border-violet-700/50 rounded px-2 py-0.5">
                        {PROVIDER_DISPLAY_NAMES[p]}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── API Keys Tab ─────────────────────────────────────────────────────── */}
      {activeTab === 'keys' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-amber-800/30 rounded-xl p-4 text-sm text-slate-400">
            <strong className="text-amber-300">⚠️ Fallback Only:</strong> These API keys are only used
            when all proxy accounts fail or are unavailable. The NullProxy Engine takes priority.
          </div>

          {[
            {
              label: 'Google Gemini API Key',
              field: 'manualApiKey' as const,
              placeholder: 'AIza…',
              hint: 'From https://aistudio.google.com/apikey',
            },
            {
              label: 'Anthropic Claude API Key',
              field: 'manualClaudeApiKey' as const,
              placeholder: 'sk-ant-…',
              hint: 'From https://console.anthropic.com',
            },
            {
              label: 'OpenAI API Key',
              field: 'manualOpenAiApiKey' as const,
              placeholder: 'sk-…',
              hint: 'From https://platform.openai.com/api-keys',
            },
          ].map(({ label, field, placeholder, hint }) => (
            <div key={field}>
              <label className="block text-sm font-medium text-slate-300 mb-1">{label}</label>
              <input
                type="password"
                placeholder={placeholder}
                value={settings[field] ?? ''}
                onChange={(e) => handleKeyChange(field, e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <p className="mt-1 text-xs text-slate-600">{hint}</p>
            </div>
          ))}

          <Button onClick={handleKeySave} variant="primary" disabled={isSaving} className="w-full">
            {isSaving ? 'Saving…' : 'Save API Keys'}
          </Button>
        </div>
      )}

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-slate-700 flex justify-between items-center">
        <span className="text-xs text-slate-600">
          All credentials stored locally on your machine. Never sent to any server.
        </span>
        <Button onClick={onClose} variant="secondary">Close</Button>
      </div>
    </Modal>
  );
};

export default ProxySettingsModal;
