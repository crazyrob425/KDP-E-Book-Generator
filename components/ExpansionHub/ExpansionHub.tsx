import React, { useState } from 'react';
import { BookOutline, MarketReport, AuthorProfile, AudiobookConfig } from '../../types';
import Button from '../shared/Button';
import Card from '../shared/Card';
import { SparklesIcon, GlobeAltIcon, MegaphoneIcon } from '../icons'; // Using existing icons
import * as geminiService from '../../services/geminiService';
import AudioProductionPanel from './AudioProductionPanel';

interface ExpansionHubProps {
    bookOutline: BookOutline;
    marketReport: MarketReport | null;
    authorProfile: AuthorProfile | null;
    onLoadNewProject: (outline: BookOutline) => void;
}

type ExpansionMode = 'SEQUEL' | 'SPINOFF' | 'TRANSLATE' | 'AUDIOBOOK' | null;

const ExpansionHub: React.FC<ExpansionHubProps> = ({ bookOutline, marketReport, authorProfile, onLoadNewProject }) => {
    const [mode, setMode] = useState<ExpansionMode>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    
    // Translation State
    const [targetLang, setTargetLang] = useState('Spanish');
    
    // New Book Generation Logic
    const handleGenerateSequel = async () => {
        if (!marketReport) return;
        setIsGenerating(true);
        try {
            const sequelOutline = await geminiService.generateSequelOutline(bookOutline, marketReport);
            onLoadNewProject(sequelOutline);
        } catch (e) {
            console.error(e);
            alert("Failed to generate sequel.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleGenerateSpinoff = async () => {
        if (!marketReport) return;
        setIsGenerating(true);
        try {
             const spinoffOutline = await geminiService.generateSpinoffOutline(bookOutline, marketReport);
             onLoadNewProject(spinoffOutline);
        } catch (e) {
            console.error(e);
             alert("Failed to generate spin-off.");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-emerald-400">
                    Book Expansion Hub
                </h2>
                <p className="text-slate-400">
                    Your book is finished, but the universe is just beginning.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* 1. Sequel Generator */}
                <Card className="hover:border-violet-500/50 transition-colors cursor-pointer group" onClick={handleGenerateSequel}>
                    <div className="p-4 flex flex-col items-center text-center gap-4">
                        <div className="p-3 bg-violet-900/30 rounded-full group-hover:scale-110 transition-transform">
                            <SparklesIcon className="w-8 h-8 text-violet-400" />
                        </div>
                        <div>
                            <h3 className="font-bold text-white">Write the Sequel</h3>
                            <p className="text-xs text-slate-400 mt-2">
                                Continue the story with the same characters in a direct follow-up.
                            </p>
                        </div>
                    </div>
                </Card>

                {/* 2. Shared Universe Spin-off */}
                <Card className="hover:border-emerald-500/50 transition-colors cursor-pointer group" onClick={handleGenerateSpinoff}>
                     <div className="p-4 flex flex-col items-center text-center gap-4">
                        <div className="p-3 bg-emerald-900/30 rounded-full group-hover:scale-110 transition-transform">
                            <GlobeAltIcon className="w-8 h-8 text-emerald-400" />
                        </div>
                        <div>
                            <h3 className="font-bold text-white">Universe Spin-off</h3>
                            <p className="text-xs text-slate-400 mt-2">
                                New characters and plot, but same world, factions, and rules.
                            </p>
                        </div>
                    </div>
                </Card>

                {/* 3. Audiobooks */}
                <Card className="hover:border-amber-500/50 transition-colors cursor-pointer group" onClick={() => setMode('AUDIOBOOK')}>
                     <div className="p-4 flex flex-col items-center text-center gap-4">
                        <div className="p-3 bg-amber-900/30 rounded-full group-hover:scale-110 transition-transform">
                            <MegaphoneIcon className="w-8 h-8 text-amber-400" />
                        </div>
                        <div>
                            <h3 className="font-bold text-white">Audiobook Studio</h3>
                            <p className="text-xs text-slate-400 mt-2">
                                Production-grade TTS using ElevenLabs or OpenAI.
                            </p>
                        </div>
                    </div>
                </Card>

                 {/* 4. Translation */}
                 <Card className="hover:border-blue-500/50 transition-colors cursor-pointer group" onClick={() => setMode('TRANSLATE')}>
                     <div className="p-4 flex flex-col items-center text-center gap-4">
                        <div className="p-3 bg-blue-900/30 rounded-full group-hover:scale-110 transition-transform">
                            <span className="text-2xl">文</span>
                        </div>
                        <div>
                            <h3 className="font-bold text-white">Global Translation</h3>
                            <p className="text-xs text-slate-400 mt-2">
                                Translate full manuscript into Spanish, German, French, etc.
                            </p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* EXPANSION MODALS / PANELS below */}
            
            {mode === 'AUDIOBOOK' && (
                <Card className="border-amber-500/30">
                    <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                        <h3 className="font-bold text-amber-400 flex items-center gap-2">
                            <MegaphoneIcon className="w-5 h-5" /> Audiobook Production
                        </h3>
                        <Button variant="secondary" onClick={() => setMode(null)}>Close</Button>
                    </div>
                    <div className="p-6">
                        <AudioProductionPanel bookOutline={bookOutline} />
                    </div>
                </Card>
            )}

            {mode === 'TRANSLATE' && (
                <Card className="border-blue-500/30">
                     <div className="p-6 text-center">
                        <h3 className="font-bold text-blue-400 mb-4">Coming Soon in v2.0</h3>
                        <p className="text-slate-400 mb-4">Full book translation requires high-context batch processing. This module is being prepared.</p>
                        <Button variant="secondary" onClick={() => setMode(null)}>Close</Button>
                     </div>
                </Card>
            )}
            
            {isGenerating && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                    <div className="text-center animate-pulse">
                        <SparklesIcon className="w-12 h-12 text-violet-400 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-white">Expanding your Universe...</h2>
                        <p className="text-slate-400">Consulting the Grand Master Architect</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExpansionHub;
