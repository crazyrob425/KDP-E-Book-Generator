import React, { useState } from 'react';
import { XIcon, DownloadIcon, UploadIcon } from './icons';
import desktopBridge from '../services/desktopBridge';
import NullLibraryLogo from './NullLibraryLogo';

interface TitleBarProps {
  onSave?: () => void;
  onLoad?: () => void;
  onOpenSettings?: () => void;
}

const TitleBar: React.FC<TitleBarProps> = ({ onSave, onLoad, onOpenSettings }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleMinimize = () => void desktopBridge.minimize();
  const handleMaximize = () => void desktopBridge.maximize();
  const handleClose = () => void desktopBridge.close();

  return (
    <div className="h-8 bg-slate-900 flex items-center justify-between select-none fixed top-0 left-0 right-0 z-[100] border-b border-slate-700">
      {/* Left cluster: app menu and draggable title area */}
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
        <div className="flex-grow h-full flex items-center gap-2 px-2" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
          <NullLibraryLogo size={18} />
          <span className="text-xs text-slate-300 font-semibold tracking-wide">Null Library</span>
          <span className="text-xs text-slate-600 font-mono hidden sm:inline">— The Art of Infinite Production</span>
        </div>
        {menuOpen && (
          <div className="absolute top-8 left-0 mt-1 bg-slate-900 border border-slate-700 rounded-md shadow-lg w-52" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
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
              {onOpenSettings && (
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-slate-200 hover:bg-slate-800"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenSettings();
                  }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  AI Proxy Settings
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
