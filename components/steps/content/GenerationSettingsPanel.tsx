/**
 * GenerationSettingsPanel.tsx
 *
 * UI panel for managing GenerationSettings:
 *   - Strategy toggle (chunked / single-pass)
 *   - Scene count range (min/max)
 *   - Emotional polish toggle + expansion cap
 *   - "Re-roll scene split" button (per chapter)
 */

import React from 'react';
import { GenerationSettings } from '../../../types';

interface Props {
  settings: GenerationSettings;
  onChange: (updated: GenerationSettings) => void;
  onReroll?: () => void;
}

const labelClass = 'text-sm font-medium text-gray-300 mb-1 block';
const inputClass =
  'w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500';

const GenerationSettingsPanel: React.FC<Props> = ({ settings, onChange, onReroll }) => {
  const update = <K extends keyof GenerationSettings>(key: K, value: GenerationSettings[K]) =>
    onChange({ ...settings, [key]: value });

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-4">
      <h3 className="text-base font-semibold text-white">Generation Settings</h3>

      {/* Strategy */}
      <div>
        <label className={labelClass}>Chapter Strategy</label>
        <div className="flex gap-3">
          {(['chunked', 'single_pass'] as const).map((s) => (
            <button
              key={s}
              onClick={() => update('strategy', s)}
              className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
                settings.strategy === s
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {s === 'chunked' ? '⚡ Chunked (default)' : '📄 Single Pass'}
            </button>
          ))}
        </div>
        {settings.strategy === 'chunked' && (
          <p className="mt-1 text-xs text-gray-400">
            Scene-by-scene generation with rolling memory — lowest token cost.
          </p>
        )}
      </div>

      {/* Scene count range — only relevant in chunked mode */}
      {settings.strategy === 'chunked' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Min Scenes</label>
            <input
              type="number"
              className={inputClass}
              min={3}
              max={settings.sceneCountMax}
              value={settings.sceneCountMin}
              onChange={(e) => update('sceneCountMin', Math.max(3, Number(e.target.value)))}
            />
          </div>
          <div>
            <label className={labelClass}>Max Scenes</label>
            <input
              type="number"
              className={inputClass}
              min={settings.sceneCountMin}
              max={30}
              value={settings.sceneCountMax}
              onChange={(e) => update('sceneCountMax', Math.max(settings.sceneCountMin, Number(e.target.value)))}
            />
          </div>
          <p className="col-span-2 text-xs text-gray-400 -mt-1">
            Deterministic randomness picks a count in this range per chapter (reproducible unless you Re-roll).
          </p>
        </div>
      )}

      {/* Emotional polish */}
      <div className="flex items-center justify-between">
        <div>
          <label className={labelClass}>Emotional Polish Pass</label>
          <p className="text-xs text-gray-400">Enhances flow, emotion, and subtext after stitching.</p>
        </div>
        <button
          onClick={() => update('emotionalPolish', !settings.emotionalPolish)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            settings.emotionalPolish ? 'bg-indigo-600' : 'bg-gray-600'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              settings.emotionalPolish ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Expansion cap */}
      {settings.emotionalPolish && (
        <div>
          <label className={labelClass}>
            Expansion Cap: <span className="text-indigo-400 font-bold">{settings.polishExpansionCapPct}%</span>
          </label>
          <input
            type="range"
            min={0}
            max={15}
            step={1}
            value={settings.polishExpansionCapPct}
            onChange={(e) => update('polishExpansionCapPct', Number(e.target.value))}
            className="w-full accent-indigo-500"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-0.5">
            <span>0% (no expansion)</span>
            <span>15% (moderate)</span>
          </div>
        </div>
      )}

      {/* Re-roll button */}
      {settings.strategy === 'chunked' && onReroll && (
        <button
          onClick={onReroll}
          className="w-full py-2 rounded-md text-sm font-medium bg-yellow-700 hover:bg-yellow-600 text-white transition-colors"
        >
          🎲 Re-roll Scene Split
        </button>
      )}
    </div>
  );
};

export default GenerationSettingsPanel;
