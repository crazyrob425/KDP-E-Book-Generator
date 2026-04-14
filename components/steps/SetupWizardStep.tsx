import React, { useState, useEffect, useCallback } from 'react';
import NullLibraryLogo from '../NullLibraryLogo';
import Button from '../shared/Button';
import LoadingSpinner from '../shared/LoadingSpinner';
import {
  ProxyProvider,
  OAuthFlowStatus,
  ProxySettings,
  WizardPhase,
} from '../../types';
import {
  startOAuthFlow,
  isElectronRuntime,
  markWizardComplete,
  getConnectedAccountsSummary,
} from '../../services/oauthSetupService';
import {
  PROVIDER_DISPLAY_NAMES,
  PROVIDER_LOGIN_DESCRIPTIONS,
  DEFAULT_PROXY_SETTINGS,
  loadProxySettings,
  saveProxySettings,
} from '../../services/nullProxyService';

interface SetupWizardStepProps {
  onComplete: (settings: ProxySettings) => void;
  onSkip: () => void;
}

const OAUTH_PROVIDERS: ProxyProvider[] = [
  'gemini-cli',
  'gemini-antigravity',
  'claude-kiro',
  'openai-codex',
  'openai-qwen',
  'openai-iflow',
];

const PROVIDER_ICONS: Record<ProxyProvider, string> = {
  'gemini-cli':         '🔵',
  'gemini-antigravity': '🟣',
  'claude-kiro':        '🟠',
  'openai-codex':       '⚫',
  'openai-qwen':        '🔴',
  'openai-iflow':       '🟤',
};

const SetupWizardStep: React.FC<SetupWizardStepProps> = ({ onComplete, onSkip }) => {
  const [phase, setPhase] = useState<WizardPhase>('welcome');
  const [connectingProvider, setConnectingProvider] = useState<ProxyProvider | null>(null);
  const [oauthStatuses, setOauthStatuses] = useState<Record<string, string>>({});
  const [connectedProviders, setConnectedProviders] = useState<Set<ProxyProvider>>(new Set());
  const [manualApiKey, setManualApiKey] = useState('');
  const [manualClaudeKey, setManualClaudeKey] = useState('');
  const [manualOpenAiKey, setManualOpenAiKey] = useState('');
  const [isElectron] = useState(isElectronRuntime);
  const [isSaving, setIsSaving] = useState(false);
  const [summary, setSummary] = useState<Record<string, { count: number; healthy: number }>>({});

  // Load any already-connected accounts on mount
  useEffect(() => {
    getConnectedAccountsSummary().then(setSummary).catch(() => {});
  }, []);

  const handleConnect = useCallback(async (provider: ProxyProvider) => {
    setConnectingProvider(provider);
    setOauthStatuses((prev) => ({ ...prev, [provider]: 'Connecting…' }));

    const account = await startOAuthFlow(provider, (status: OAuthFlowStatus) => {
      setOauthStatuses((prev) => ({ ...prev, [provider]: status.message }));
    });

    setConnectingProvider(null);

    if (account) {
      setConnectedProviders((prev) => new Set([...prev, provider]));
      setOauthStatuses((prev) => ({ ...prev, [provider]: '✅ Connected!' }));
      // Refresh summary
      getConnectedAccountsSummary().then(setSummary).catch(() => {});
    } else {
      setOauthStatuses((prev) => ({
        ...prev,
        [provider]: oauthStatuses[provider]?.includes('error') || oauthStatuses[provider]?.includes('Error')
          ? oauthStatuses[provider]
          : '❌ Not connected (try again)',
      }));
    }
  }, [oauthStatuses]);

  const handleFinish = async () => {
    setIsSaving(true);
    try {
      const existing = await loadProxySettings();
      const updated: ProxySettings = {
        ...DEFAULT_PROXY_SETTINGS,
        ...existing,
        enabled: connectedProviders.size > 0 || existing.accounts.length > 0,
        manualApiKey: manualApiKey.trim() || existing.manualApiKey,
        manualClaudeApiKey: manualClaudeKey.trim() || existing.manualClaudeApiKey,
        manualOpenAiApiKey: manualOpenAiKey.trim() || existing.manualOpenAiApiKey,
        failsafeEnabled: true,
      };
      await saveProxySettings(updated);
      markWizardComplete();
      onComplete(updated);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = () => {
    markWizardComplete();
    onSkip();
  };

  // ── Render: Welcome ──────────────────────────────────────────────────────────
  if (phase === 'welcome') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full text-center">
          <div className="flex justify-center mb-6">
            <NullLibraryLogo size={100} />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent mb-2">
            Null Library
          </h1>
          <p className="text-slate-400 text-lg mb-8 font-light italic">
            The Art of Infinite Production
          </p>

          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 mb-8 text-left">
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span>🧠</span> What is the NullProxy Engine?
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed mb-4">
              Instead of requiring expensive API keys, Null Library uses a smart system that
              logs into AI tools the way any normal user would — through real browser login pages
              (Google, Anthropic, OpenAI, etc.). Once you log in, it saves your session token
              locally and uses it to power all AI features <strong className="text-slate-200">completely free</strong>.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
              {[
                { icon: '🔑', title: 'No API Keys', desc: 'Log in once with your browser' },
                { icon: '⚖️', title: 'Load Balancing', desc: 'Multiple accounts = no rate limits' },
                { icon: '🛡️', title: 'Failsafe', desc: 'Falls back to free Gemini if needed' },
              ].map(({ icon, title, desc }) => (
                <div key={title} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                  <div className="text-2xl mb-1">{icon}</div>
                  <div className="text-sm font-semibold text-slate-200">{title}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={() => setPhase('connect-accounts')} variant="primary">
              Set Up AI Connections →
            </Button>
            <Button onClick={handleSkip} variant="secondary">
              Skip (Use Manual API Key)
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Connect Accounts ─────────────────────────────────────────────────
  if (phase === 'connect-accounts') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-3xl w-full">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-3">
              <NullLibraryLogo size={48} />
            </div>
            <h2 className="text-2xl font-bold text-white">Connect AI Accounts</h2>
            <p className="text-slate-400 mt-1 text-sm">
              Click <strong>Connect</strong> next to each provider. Your browser will open the login page — just log in normally.
            </p>
            {!isElectron && (
              <div className="mt-3 inline-flex items-center gap-2 bg-amber-950/40 border border-amber-800/50 text-amber-300 rounded-lg px-4 py-2 text-sm">
                ⚠️ OAuth proxy requires the desktop app. You can still use manual API keys.
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            {OAUTH_PROVIDERS.map((provider) => {
              const isConnected = connectedProviders.has(provider) || (summary[provider]?.count ?? 0) > 0;
              const isConnecting = connectingProvider === provider;
              const status = oauthStatuses[provider];
              const accountCount = summary[provider]?.count ?? 0;

              return (
                <div
                  key={provider}
                  className={`bg-slate-900 border rounded-xl p-4 flex flex-col gap-2 transition-all ${
                    isConnected ? 'border-violet-600/50 bg-violet-950/10' : 'border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{PROVIDER_ICONS[provider]}</span>
                      <div>
                        <div className="text-sm font-semibold text-slate-200">
                          {PROVIDER_DISPLAY_NAMES[provider]}
                        </div>
                        {isConnected && accountCount > 0 && (
                          <div className="text-xs text-emerald-400">
                            {accountCount} account{accountCount > 1 ? 's' : ''} connected
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleConnect(provider)}
                      disabled={!isElectron || isConnecting || connectingProvider !== null}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                        isConnected
                          ? 'bg-violet-900/50 text-violet-300 border border-violet-700 hover:bg-violet-900'
                          : 'bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed'
                      }`}
                    >
                      {isConnecting ? (
                        <>
                          <LoadingSpinner size="sm" />
                          <span>Connecting…</span>
                        </>
                      ) : isConnected ? (
                        '+ Add Account'
                      ) : (
                        'Connect'
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">{PROVIDER_LOGIN_DESCRIPTIONS[provider]}</p>
                  {status && (
                    <div className={`text-xs px-2 py-1 rounded ${
                      status.startsWith('✅') ? 'text-emerald-400 bg-emerald-950/30' :
                      status.startsWith('❌') ? 'text-red-400 bg-red-950/30' :
                      'text-slate-400 bg-slate-800/50'
                    }`}>
                      {status}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex justify-between items-center">
            <button
              onClick={() => setPhase('welcome')}
              className="text-slate-400 hover:text-slate-200 text-sm"
            >
              ← Back
            </button>
            <div className="flex gap-3">
              <Button onClick={() => setPhase('api-keys')} variant="secondary">
                Next: API Keys →
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Manual API Keys ──────────────────────────────────────────────────
  if (phase === 'api-keys') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-xl w-full">
          <div className="text-center mb-8">
            <NullLibraryLogo size={48} className="mx-auto mb-3" />
            <h2 className="text-2xl font-bold text-white">Manual API Keys</h2>
            <p className="text-slate-400 mt-1 text-sm">
              Optional. These are used as <strong>fallback only</strong> if all proxy accounts fail.
              Leave blank to rely entirely on the connected accounts above.
            </p>
          </div>

          <div className="space-y-4 mb-8">
            {[
              {
                label: 'Google Gemini API Key (VITE_GOOGLE_API_KEY)',
                placeholder: 'AIza…',
                value: manualApiKey,
                onChange: setManualApiKey,
                hint: 'From https://aistudio.google.com/apikey — free tier available',
              },
              {
                label: 'Anthropic Claude API Key',
                placeholder: 'sk-ant-…',
                value: manualClaudeKey,
                onChange: setManualClaudeKey,
                hint: 'From https://console.anthropic.com — paid plans only',
              },
              {
                label: 'OpenAI API Key',
                placeholder: 'sk-…',
                value: manualOpenAiKey,
                onChange: setManualOpenAiKey,
                hint: 'From https://platform.openai.com/api-keys — paid plans only',
              },
            ].map(({ label, placeholder, value, onChange, hint }) => (
              <div key={label}>
                <label className="block text-sm font-medium text-slate-300 mb-1">{label}</label>
                <input
                  type="password"
                  placeholder={placeholder}
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
                <p className="mt-1 text-xs text-slate-600">{hint}</p>
              </div>
            ))}
          </div>

          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 mb-6 text-sm text-slate-400">
            <strong className="text-slate-300">Failsafe chain:</strong>{' '}
            <span className="text-violet-400">OAuth Proxy</span>{' '}
            <span className="text-slate-600">→</span>{' '}
            <span className="text-blue-400">Manual API Key</span>{' '}
            <span className="text-slate-600">→</span>{' '}
            <span className="text-emerald-400">Free Google Gemini</span>
            <p className="mt-1 text-xs text-slate-600">
              The app always has a way to make AI calls. If everything else fails, it falls back to
              the free Google Gemini tier — you'll just need a Google account.
            </p>
          </div>

          <div className="flex justify-between items-center">
            <button
              onClick={() => setPhase('connect-accounts')}
              className="text-slate-400 hover:text-slate-200 text-sm"
            >
              ← Back
            </button>
            <Button onClick={() => setPhase('ready')} variant="primary">
              Review & Finish →
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Ready ────────────────────────────────────────────────────────────
  const summaryValues = Object.values(summary) as { count: number; healthy: number }[];
  const totalConnected = summaryValues.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-xl w-full text-center">
        <NullLibraryLogo size={80} className="mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">You're All Set!</h2>
        <p className="text-slate-400 text-sm mb-8">
          Null Library is ready to create infinite books for you.
        </p>

        <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 mb-6 text-left space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">OAuth accounts connected</span>
            <span className={`font-semibold ${totalConnected > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {totalConnected > 0 ? `${totalConnected} account${totalConnected !== 1 ? 's' : ''}` : 'None — will use fallback'}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Gemini API key</span>
            <span className={`font-semibold ${manualApiKey ? 'text-emerald-400' : 'text-slate-600'}`}>
              {manualApiKey ? 'Provided ✓' : 'Not set'}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Failsafe (free Gemini)</span>
            <span className="text-emerald-400 font-semibold">Always enabled ✓</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Round-robin load balancing</span>
            <span className={`font-semibold ${totalConnected > 1 ? 'text-emerald-400' : 'text-slate-600'}`}>
              {totalConnected > 1 ? 'Active ✓' : 'N/A (need 2+ accounts)'}
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-600 mb-6">
          You can change all of this later in <strong>AI Proxy Settings</strong> from the menu bar.
        </p>

        <Button
          onClick={handleFinish}
          variant="primary"
          disabled={isSaving}
          className="w-full"
        >
          {isSaving ? (
            <span className="flex items-center justify-center gap-2">
              <LoadingSpinner size="sm" /> Saving…
            </span>
          ) : (
            '🚀 Start Creating'
          )}
        </Button>
      </div>
    </div>
  );
};

export default SetupWizardStep;
