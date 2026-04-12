import React, { useState } from 'react';
import { BookOutline, MarketReport, AuthorProfile } from '../../types';
import Button from '../shared/Button';
import Card from '../shared/Card';
import Modal from '../shared/Modal';
import { SparklesIcon, GlobeAltIcon, MegaphoneIcon } from '../icons';
import * as geminiService from '../../services/geminiService';
import AudioProductionPanel from './AudioProductionPanel';

interface ExpansionHubProps {
    bookOutline: BookOutline;
    marketReport: MarketReport | null;
    authorProfile: AuthorProfile | null;
    onLoadNewProject: (outline: BookOutline) => void;
}

type ExpansionMode = 'SEQUEL' | 'SPINOFF' | 'TRANSLATE' | 'AUDIOBOOK' | null;
type HubTab = 'expand' | 'distribute' | 'audiobook';

interface PlatformCard {
  name: string;
  icon: string;
  description: string;
  cost: string;
  nicheStrengths: string;
  restrictions: string;
  status: 'active' | 'coming-soon' | 'configure';
}

const platforms: PlatformCard[] = [
  {
    name: 'Amazon KDP',
    icon: '📦',
    description: 'Upload directly to Amazon Kindle Direct Publishing.',
    cost: 'Free (35–70% royalties)',
    nicheStrengths: 'Largest ebook marketplace. Kindle Unlimited integration available.',
    restrictions: 'KDP Select requires 90-day exclusivity from all other ebook retailers.',
    status: 'active',
  },
  {
    name: 'Draft2Digital',
    icon: '📚',
    description: 'Wide distribution to 40+ retailers including Apple Books, Kobo, B&N.',
    cost: 'Free (15% commission)',
    nicheStrengths: 'Best for: Reaching libraries (OverDrive, Hoopla). No exclusive restrictions.',
    restrictions: 'Distributes to Apple Books, Kobo, B&N, and 40+ more retailers.',
    status: 'configure',
  },
  {
    name: 'Smashwords',
    icon: '🌐',
    description: 'Maximum reach with a single upload to global retailers.',
    cost: 'Free (15% commission)',
    nicheStrengths: 'Best for: Maximum global reach with one upload.',
    restrictions: 'Strict formatting via "Meatgrinder". Distributes to Kobo, libraries, and international retailers.',
    status: 'coming-soon',
  },
  {
    name: 'IngramSpark',
    icon: '🏢',
    description: 'Professional print and ebook distribution to 40,000+ retailers.',
    cost: '$49 setup fee (waived with promo)',
    nicheStrengths: 'Best for: Print distribution to bookstores and libraries worldwide.',
    restrictions: 'Requires print-ready PDF. Setup fee $49 per title. Global 40,000+ retailer network.',
    status: 'coming-soon',
  },
  {
    name: 'B&N Press',
    icon: '🟢',
    description: 'Direct access to Barnes & Noble Nook readers.',
    cost: 'Free',
    nicheStrengths: 'Best for: Nook device users. Strong US-focused audience.',
    restrictions: 'No exclusivity required. Simple upload process.',
    status: 'coming-soon',
  },
  {
    name: 'Apple Books',
    icon: '🍎',
    description: 'Reach high-income iOS users in US, UK, and AU markets.',
    cost: 'Free',
    nicheStrengths: 'Best for: High-income iOS users. Strong in US, UK, and Australia.',
    restrictions: 'Requires Mac + iTunes Producer or Apple Books for Authors web tool.',
    status: 'coming-soon',
  },
  {
    name: 'Google Play Books',
    icon: '▶️',
    description: 'Distribute to Android users worldwide via Google Play.',
    cost: 'Free',
    nicheStrengths: 'Best for: Android users globally. Formal Partner API available.',
    restrictions: 'Requires Google Play Partner account approval. Formal API integration.',
    status: 'configure',
  },
  {
    name: 'Kobo Writing Life',
    icon: '🌍',
    description: 'Strong international reach, especially Canada and Europe.',
    cost: 'Free',
    nicheStrengths: 'Best for: International markets — Canada, Europe, Asia. Strong in Canada and UK.',
    restrictions: 'No exclusivity required. Solid royalty rates internationally.',
    status: 'coming-soon',
  },
];

const ExpansionHub: React.FC<ExpansionHubProps> = ({ bookOutline, marketReport, authorProfile, onLoadNewProject }) => {
    const [mode, setMode] = useState<ExpansionMode>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [activeTab, setActiveTab] = useState<HubTab>('expand');
    const [hoveredPlatform, setHoveredPlatform] = useState<string | null>(null);
    const [comingSoonModal, setComingSoonModal] = useState<string | null>(null);

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

            {/* Tab Navigation */}
            <div className="flex border-b border-slate-700">
                <button
                    onClick={() => setActiveTab('expand')}
                    className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'expand' ? 'border-violet-500 text-violet-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                >
                    ✨ Expand
                </button>
                <button
                    onClick={() => setActiveTab('distribute')}
                    className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'distribute' ? 'border-violet-500 text-violet-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                >
                    🚀 Distribute
                </button>
                <button
                    onClick={() => setActiveTab('audiobook')}
                    className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'audiobook' ? 'border-violet-500 text-violet-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                >
                    🎙️ Audiobook
                </button>
            </div>

            {/* Expand Tab */}
            {activeTab === 'expand' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Card className="hover:border-violet-500/50 transition-colors cursor-pointer group" onClick={handleGenerateSequel}>
                        <div className="p-4 flex flex-col items-center text-center gap-4">
                            <div className="p-3 bg-violet-900/30 rounded-full group-hover:scale-110 transition-transform">
                                <SparklesIcon className="w-8 h-8 text-violet-400" />
                            </div>
                            <div>
                                <h3 className="font-bold text-white">Write the Sequel</h3>
                                <p className="text-xs text-slate-400 mt-2">Continue the story with a direct follow-up.</p>
                            </div>
                        </div>
                    </Card>

                    <Card className="hover:border-emerald-500/50 transition-colors cursor-pointer group" onClick={handleGenerateSpinoff}>
                        <div className="p-4 flex flex-col items-center text-center gap-4">
                            <div className="p-3 bg-emerald-900/30 rounded-full group-hover:scale-110 transition-transform">
                                <GlobeAltIcon className="w-8 h-8 text-emerald-400" />
                            </div>
                            <div>
                                <h3 className="font-bold text-white">Universe Spin-off</h3>
                                <p className="text-xs text-slate-400 mt-2">New characters, same world and rules.</p>
                            </div>
                        </div>
                    </Card>

                    <Card className="hover:border-blue-500/50 transition-colors cursor-pointer group" onClick={() => setComingSoonModal('Translation')}>
                        <div className="p-4 flex flex-col items-center text-center gap-4">
                            <div className="p-3 bg-blue-900/30 rounded-full group-hover:scale-110 transition-transform">
                                <span className="text-2xl">文</span>
                            </div>
                            <div>
                                <h3 className="font-bold text-white">Global Translation</h3>
                                <p className="text-xs text-slate-400 mt-2">Translate into Spanish, German, French, etc.</p>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {/* Distribute Tab */}
            {activeTab === 'distribute' && (
                <div className="space-y-4">
                    <p className="text-slate-400 text-sm">Publish your book to these platforms to maximize reach and royalties.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {platforms.map(platform => (
                            <div
                                key={platform.name}
                                className="relative"
                                onMouseEnter={() => setHoveredPlatform(platform.name)}
                                onMouseLeave={() => setHoveredPlatform(null)}
                            >
                                <Card className="h-full hover:border-slate-500/70 transition-colors">
                                    <div className="p-4 flex flex-col gap-3 h-full">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-2xl">{platform.icon}</span>
                                                <h3 className="font-bold text-white text-sm">{platform.name}</h3>
                                            </div>
                                            {platform.status === 'active' && (
                                                <span className="px-2 py-0.5 bg-emerald-900/50 text-emerald-400 text-xs rounded-full border border-emerald-700">Active</span>
                                            )}
                                            {platform.status === 'coming-soon' && (
                                                <span className="px-2 py-0.5 bg-slate-700 text-slate-400 text-xs rounded-full">Soon</span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-400 flex-1">{platform.description}</p>
                                        <div className="text-xs text-slate-500">💰 {platform.cost}</div>
                                        {platform.status === 'configure' && (
                                            <Button
                                                variant="secondary"
                                                onClick={() => setComingSoonModal(platform.name)}
                                                className="text-xs py-1"
                                            >
                                                Configure
                                            </Button>
                                        )}
                                        {platform.status === 'active' && (
                                            <div className="text-xs text-emerald-400/70">✓ Automated via KDP Bot</div>
                                        )}
                                    </div>
                                </Card>

                                {/* Hover Tooltip */}
                                {hoveredPlatform === platform.name && (
                                    <div className="absolute z-50 bottom-full left-0 mb-2 w-64 bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-xl text-xs pointer-events-none">
                                        <div className="font-semibold text-white mb-1">{platform.name}</div>
                                        <div className="text-slate-300 mb-1">
                                            <span className="text-slate-500">Cost: </span>{platform.cost}
                                        </div>
                                        <div className="text-slate-300 mb-1">{platform.nicheStrengths}</div>
                                        <div className="text-slate-400 italic">{platform.restrictions}</div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Audiobook Tab */}
            {activeTab === 'audiobook' && (
                <Card className="border-amber-500/30">
                    <div className="p-4 border-b border-slate-700">
                        <h3 className="font-bold text-amber-400 flex items-center gap-2">
                            <MegaphoneIcon className="w-5 h-5" /> Audiobook Production
                        </h3>
                    </div>
                    <div className="p-6">
                        <AudioProductionPanel bookOutline={bookOutline} />
                    </div>
                </Card>
            )}

            {/* Coming Soon Modal */}
            {comingSoonModal && (
                <Modal onClose={() => setComingSoonModal(null)}>
                    <div className="text-center py-6 px-8 max-w-sm">
                        <div className="text-5xl mb-4">🚀</div>
                        <h3 className="font-bold text-white text-lg mb-2">{comingSoonModal} Integration</h3>
                        <p className="text-slate-400 mb-4">
                            This integration is being prepared for a future release. It will allow you to automatically publish your book directly to {comingSoonModal}.
                        </p>
                        <Button onClick={() => setComingSoonModal(null)}>Got it</Button>
                    </div>
                </Modal>
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
