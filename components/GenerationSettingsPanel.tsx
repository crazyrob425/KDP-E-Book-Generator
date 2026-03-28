import React from 'react';
import { GenerationSettings } from '../types';
import { DEFAULT_GENERATION_SETTINGS } from '../services/sceneChunkedGenerator';

interface GenerationSettingsPanelProps {
  settings: GenerationSettings;
  onChange: (settings: GenerationSettings) => void;
  onRerollChapter?: (chapterNumber: number) => void;
  chapterNumbers?: number[];
}

const GenerationSettingsPanel: React.FC<GenerationSettingsPanelProps> = ({
  settings,
  onChange,
  onRerollChapter,
  chapterNumbers = [],
}) => {
  const update = (partial: Partial<GenerationSettings>) =>
    onChange({ ...settings, ...partial });

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-4">
      <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
        <span>⚙️</span> Generation Settings
      </h3>

      {/* Strategy toggle */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-300">Strategy</span>
        <div className="flex rounded overflow-hidden border border-slate-600">
          {(['chunked', 'single'] as const).map((s) => (
            <button
              key={s}
              onClick={() => update({ strategy: s })}
              className={`px-3 py-1 text-xs transition-colors ${
                settings.strategy === s
                  ? 'bg-violet-600 text-white'
                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
              }`}
            >
              {s === 'chunked' ? '🎬 Scene-Chunked' : '📄 Single-Pass'}
            </button>
          ))}
        </div>
      </div>

      {/* Scene range (only relevant when chunked) */}
      {settings.strategy === 'chunked' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-300">Scene Range</span>
            <span className="text-xs text-violet-400 font-mono">
              {settings.sceneMin}–{settings.sceneMax} scenes
            </span>
          </div>
          <div className="flex gap-4">
            <label className="flex-1 space-y-1">
              <span className="text-xs text-slate-400">Min</span>
              <input
                type="range"
                min={3}
                max={settings.sceneMax}
                value={settings.sceneMin}
                onChange={(e) => update({ sceneMin: Number(e.target.value) })}
                className="w-full accent-violet-500"
              />
            </label>
            <label className="flex-1 space-y-1">
              <span className="text-xs text-slate-400">Max</span>
              <input
                type="range"
                min={settings.sceneMin}
                max={20}
                value={settings.sceneMax}
                onChange={(e) => update({ sceneMax: Number(e.target.value) })}
                className="w-full accent-violet-500"
              />
            </label>
          </div>

          {/* Re-roll buttons */}
          {chapterNumbers.length > 0 && onRerollChapter && (
            <div>
              <span className="text-xs text-slate-400 block mb-1">Re-roll scene split</span>
              <div className="flex flex-wrap gap-1">
                {chapterNumbers.map((n) => (
                  <button
                    key={n}
                    onClick={() => onRerollChapter(n)}
                    title={`Re-roll scene split for chapter ${n}`}
                    className="px-2 py-0.5 text-xs bg-slate-700 hover:bg-violet-700 text-slate-300 rounded transition-colors"
                  >
                    Ch{n} 🎲 {settings.rerollNonces[n] ? `(×${settings.rerollNonces[n]})` : ''}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Emotional polish toggle */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-300">Emotional Polish</span>
        <button
          onClick={() => update({ emotionalPolish: !settings.emotionalPolish })}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            settings.emotionalPolish ? 'bg-violet-600' : 'bg-slate-600'
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
              settings.emotionalPolish ? 'translate-x-4' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Expansion cap */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-300">Expansion Cap</span>
          <span className="text-xs text-violet-400 font-mono">{settings.expansionCapPct}%</span>
        </div>
        <input
          type="range"
          min={5}
          max={8}
          step={1}
          value={settings.expansionCapPct}
          onChange={(e) => update({ expansionCapPct: Number(e.target.value) })}
          className="w-full accent-violet-500"
        />
        <div className="flex justify-between text-xs text-slate-500">
          <span>5%</span><span>8%</span>
        </div>
      </div>

      {/* Reset */}
      <button
        onClick={() => onChange({ ...DEFAULT_GENERATION_SETTINGS, projectSeed: settings.projectSeed })}
        className="w-full text-xs text-slate-400 hover:text-slate-200 border border-slate-600 rounded py-1 transition-colors"
      >
        Reset to defaults
      </button>
    </div>
  );
};

export default GenerationSettingsPanel;
