import React, { useState } from 'react';
import { XIcon, DownloadIcon, UploadIcon } from './icons';
import desktopBridge from '../services/desktopBridge';

interface TitleBarProps {
  onSave?: () => void;
  onLoad?: () => void;
}

const TitleBar: React.FC<TitleBarProps> = ({ onSave, onLoad }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleMinimize = () => void desktopBridge.minimize();
  const handleMaximize = () => void desktopBridge.maximize();
  const handleClose = () => void desktopBridge.close();

  return (
    <div className="h-8 bg-slate-900 flex items-center justify-between select-none fixed top-0 left-0 right-0 z-[100] border-b border-slate-700">
      <div className="flex items-center h-full" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          onClick={() => setMenuOpen((open) => !open)}
          className="w-10 h-full flex items-center justify-center hover:bg-slate-800 text-slate-200"
          aria-label="Open menu"
        >
          <span className="flex flex-col gap-[3px]">
            <span className="w-4 h-[2px] bg-slate-200" />
            <span className="w-4 h-[2px] bg-slate-200" />
            <span className="w-4 h-[2px] bg-slate-200" />
          </span>
        </button>
        <div className="flex-grow h-full flex items-center px-4" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
          <span className="text-xs text-slate-400 font-mono mr-4">KDP E-Book Generator</span>
        </div>
        {menuOpen && (
          <div className="absolute top-8 left-0 mt-1 bg-slate-900 border border-slate-700 rounded-md shadow-lg w-48" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <div className="py-1">
              {onSave && (
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-slate-200 hover:bg-slate-800"
                  onClick={() => {
                    setMenuOpen(false);
                    onSave();
                  }}
                >
                  <DownloadIcon className="w-4 h-4" /> Save Project
                </button>
              )}
              {onLoad && (
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-slate-200 hover:bg-slate-800"
                  onClick={() => {
                    setMenuOpen(false);
                    onLoad();
                  }}
                >
                  <UploadIcon className="w-4 h-4" /> Load Project
                </button>
              )}
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-slate-200 hover:bg-slate-800"
                onClick={() => setMenuOpen(false)}
              >
                <XIcon className="w-4 h-4" /> Close Menu
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex h-full border-l border-slate-700" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          onClick={handleMinimize}
          className="w-12 h-full flex items-center justify-center hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
            <rect width="10" height="1" />
          </svg>
        </button>
        <button
          onClick={handleMaximize}
          className="w-12 h-full flex items-center justify-center hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor">
            <rect x="1.5" y="1.5" width="7" height="7" />
          </svg>
        </button>
        <button
          onClick={handleClose}
          className="w-12 h-full flex items-center justify-center hover:bg-red-600 text-slate-400 hover:text-white transition-colors"
        >
          <XIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default TitleBar;
