import React, { useState, useEffect, useRef } from 'react';
import { AIProviderConfig, saveProviderConfig, testProviderConnection } from '../../services/aiProvider';

interface ProviderSettingsPanelProps {
  config: AIProviderConfig;
  onConfigChange: (config: AIProviderConfig) => void;
  onClose: () => void;
}

const ProviderSettingsPanel: React.FC<ProviderSettingsPanelProps> = ({
  config,
  onConfigChange,
  onClose,
}) => {
  const [local, setLocal] = useState<AIProviderConfig>(config);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Dismiss when clicking outside the panel
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Use capture so the event fires before any bubbling stopPropagation
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [onClose]);

  const handleChange = (updates: Partial<AIProviderConfig>) => {
    const next = { ...local, ...updates };
    setLocal(next);
    saveProviderConfig(next);
    onConfigChange(next);
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testProviderConnection(local);
      setTestResult(result);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div ref={panelRef} className="absolute bottom-full right-0 mb-2 w-80 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-4 z-50 text-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-white">AI Provider Settings</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-white text-lg leading-none">×</button>
      </div>

      <div className="space-y-3">
        {/* Provider toggle */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Provider</label>
          <div className="flex gap-2">
            <button
              onClick={() => handleChange({ type: 'gemini' })}
              className={`flex-1 py-1.5 text-xs rounded transition-colors ${local.type === 'gemini' ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            >
              Gemini ✦
            </button>
            <button
              onClick={() => handleChange({ type: 'openai-compatible' })}
              className={`flex-1 py-1.5 text-xs rounded transition-colors ${local.type === 'openai-compatible' ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            >
              OpenAI-Compatible
            </button>
          </div>
        </div>

        {local.type === 'openai-compatible' && (
          <>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Base URL</label>
              <input
                type="text"
                value={local.openaiBaseUrl || ''}
                onChange={e => handleChange({ openaiBaseUrl: e.target.value })}
                placeholder="http://localhost:11434/v1"
                className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">API Key (optional)</label>
              <input
                type="password"
                value={local.openaiApiKey || ''}
                onChange={e => handleChange({ openaiApiKey: e.target.value })}
                placeholder="sk-..."
                className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Model</label>
              <input
                type="text"
                value={local.openaiModel || ''}
                onChange={e => handleChange({ openaiModel: e.target.value })}
                placeholder="llama3, mistral, gpt-4..."
                className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
              />
            </div>
          </>
        )}

        <button
          onClick={handleTest}
          disabled={isTesting}
          className="w-full py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded transition-colors disabled:opacity-50"
        >
          {isTesting ? 'Testing…' : 'Test Connection'}
        </button>

        {testResult && (
          <div
            className={`p-2 rounded text-xs ${testResult.success ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700' : 'bg-red-900/40 text-red-300 border border-red-800'}`}
          >
            {testResult.success ? '✓ ' : '✗ '}{testResult.message}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProviderSettingsPanel;
