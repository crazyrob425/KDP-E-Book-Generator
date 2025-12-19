import React from 'react';
import { SparklesIcon } from '../icons';

interface AutoSaveIndicatorProps {
    isSaving: boolean;
    lastSaved: Date | null;
}

const AutoSaveIndicator: React.FC<AutoSaveIndicatorProps> = ({ isSaving, lastSaved }) => {
    if (!lastSaved && !isSaving) return null;

    return (
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-800/50 px-3 py-1 rounded-full border border-slate-700/50">
            {isSaving ? (
                <>
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                    <span>Auto-saving...</span>
                </>
            ) : (
                <>
                     <span className="w-2 h-2 bg-slate-600 rounded-full"></span>
                    <span>Saved {lastSaved?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </>
            )}
        </div>
    );
};

export default AutoSaveIndicator;
