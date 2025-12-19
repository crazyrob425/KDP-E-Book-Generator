import React from 'react';
import { XIcon } from './icons';

const TitleBar: React.FC = () => {
  const handleMinimize = () => window.electronAPI.minimize();
  const handleMaximize = () => window.electronAPI.maximize();
  const handleClose = () => window.electronAPI.close();

  return (
    <div className="h-8 bg-slate-900 flex items-center justify-between select-none fixed top-0 left-0 right-0 z-[100] border-b border-slate-700">
      {/* Draggable Region */}
      <div className="flex-grow h-full flex items-center px-4" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        <span className="text-xs text-slate-400 font-mono">KDP E-Book Generator</span>
      </div>

      {/* Window Controls (Non-draggable) */}
      <div className="flex h-full" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
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
