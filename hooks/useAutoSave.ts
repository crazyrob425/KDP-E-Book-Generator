import { useEffect, useRef, useState } from 'react';
import { AppStep, BookOutline, MarketReport, AuthorProfile, KdpMarketingInfo, GenreSuggestion, AppMode } from '../types';
import desktopBridge from '../services/desktopBridge';

interface AutoSaveState {
    mode: AppMode;
    currentStep: AppStep;
    marketReport: MarketReport | null;
    bookOutline: BookOutline | null;
    authorProfile: AuthorProfile | null;
    pagesPerChapter: string;
    bookCoverUrl: string | null;
    kdpMarketingInfo: KdpMarketingInfo | null;
    selectedGenre: GenreSuggestion | null;
    hasViewedReport: boolean;
}

export const useAutoSave = (state: AutoSaveState, intervalMs: number = 120000) => { // Default 2 mins
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const stateRef = useRef(state);

    // Keep ref updated to avoid stale closures in interval
    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    useEffect(() => {
        const timer = setInterval(async () => {
            // Don't auto-save if empty state
            if (!stateRef.current.marketReport && !stateRef.current.bookOutline) return;

            setIsSaving(true);
            try {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const projectTitle = stateRef.current.bookOutline?.title 
                    ? stateRef.current.bookOutline.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() 
                    : 'untitled_project';
                
                const filename = `autosave_${projectTitle}.json`;
                
                // Construct payload similar to standard save
                const payload = JSON.stringify({
                    version: 1,
                    autosave: true,
                    date: new Date().toISOString(),
                    ...stateRef.current
                }, null, 2);

                // Use the electron API to save
                if (desktopBridge.saveFile) {
                    // We save to a specific autosave file, avoiding main project overwrite if possible users wants that distinction
                    // For now, saving as a distinct file is safer.
                   await desktopBridge.saveFile(payload, filename);
                   setLastSaved(new Date());
                }
            } catch (error) {
                console.error("Auto-save failed", error);
            } finally {
                setIsSaving(false);
            }
        }, intervalMs);

        return () => clearInterval(timer);
    }, [intervalMs]);

    return { lastSaved, isSaving };
};
