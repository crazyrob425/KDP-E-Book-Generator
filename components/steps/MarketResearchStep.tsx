
import React, { useState } from 'react';
import { GenreSuggestion, TopicSuggestion, BookOutline, AuthorProfile } from '../../types';
import Button from '../shared/Button';
import Card from '../shared/Card';
import { SparklesIcon, RectangleStackIcon, ArrowPathIcon } from '../icons';
import LoadingSpinner from '../shared/LoadingSpinner';

interface MarketResearchStepProps {
  onStartWithNicheFinder: () => void;
  onStartWithCustomTopic: (topic: string) => void;
  /** Called when the user selects AI-only (simulated) market research for a custom topic. */
  onStartWithAISimulation: (topic: string) => void;
  onSelectGenre: (genre: GenreSuggestion) => void;
  onSelectTopic: (topic: TopicSuggestion) => void;
  genres: GenreSuggestion[] | null;
  topics: TopicSuggestion[] | null;
  isLoading: boolean;
  bookCoverUrl: string | null;
  bookOutline: BookOutline | null;
  authorProfile: AuthorProfile | null;
  onSetMode: (mode: 'batch') => void;
  exampleCoverUrl: string | null;
  isGeneratingExampleCover: boolean;
  onGenerateExampleCover: () => void;
  /** True when running in Electron/Tauri (real market data via IPC is available). */
  supportsRealResearch?: boolean;
}

const MarketResearchStep: React.FC<MarketResearchStepProps> = ({ 
  onStartWithNicheFinder,
  onStartWithCustomTopic,
  onStartWithAISimulation,
  onSelectGenre,
  onSelectTopic,
  genres,
  topics,
  isLoading,
  bookCoverUrl,
  bookOutline,
  authorProfile,
  onSetMode,
  exampleCoverUrl,
  isGeneratingExampleCover,
  onGenerateExampleCover,
  supportsRealResearch = false,
}) => {
  const [customTopic, setCustomTopic] = useState('');
  // MR-01: research mode selector — 'real' uses IPC-backed live data; 'ai' is pure AI simulation
  const [researchMode, setResearchMode] = useState<'ai' | 'real'>('ai');

  const handleCustomTopicSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTopic.trim()) return;
    if (researchMode === 'real' && supportsRealResearch) {
      onStartWithCustomTopic(customTopic.trim());
    } else {
      onStartWithAISimulation(customTopic.trim());
    }
  };

  const hasExistingProject = bookCoverUrl && bookOutline && authorProfile;

  if (isLoading && !hasExistingProject && !genres && !topics) {
    let message = "Analyzing market...";
    return <div className="mt-20"><LoadingSpinner message={message} size="lg" /></div>;
  }

  if (topics) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-center text-violet-400 mb-2 font-serif">
          Step 1c: Choose Your Topic
        </h2>
        <p className="text-slate-400 text-center mb-6">
          Here are 5 marketable topics within your chosen genre. Select one to generate a full market report.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {topics.map((topic, index) => (
            <Card key={index} className="bg-slate-700/80 flex flex-col">
              <h5 className="font-bold text-emerald-400">{topic.topic}</h5>
              <p className="text-sm text-slate-400 mt-1 mb-4 flex-grow">{topic.reasoning}</p>
              <Button onClick={() => onSelectTopic(topic)} className="w-full mt-auto text-sm py-1">
                Select this Topic
              </Button>
            </Card>
          ))}
        </div>
      </Card>
    );
  }

  if (genres) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-center text-violet-400 mb-2 font-serif">
          Step 1b: Choose Your Genre
        </h2>
        <p className="text-slate-400 text-center mb-6">
          Based on current trends, these are the 5 most promising genres. Pick one to explore further.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {genres.map((genre, index) => (
             <Card key={index} className="bg-slate-700/80 flex flex-col">
              <h5 className="font-bold text-violet-400">{genre.genre}</h5>
              <p className="text-sm text-slate-400 mt-1 mb-4 flex-grow">{genre.reasoning}</p>
              <Button onClick={() => onSelectGenre(genre)} className="w-full mt-auto text-sm py-1">
                Explore this Genre
              </Button>
            </Card>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <>
      {hasExistingProject && (
        <Card className="mb-8 w-full max-w-4xl mx-auto animate-fade-in">
            <div className="flex flex-col sm:flex-row items-center gap-6">
                <img src={bookCoverUrl} alt="Generated book cover" className="w-40 h-auto rounded-md shadow-lg object-contain" />
                <div className="text-center sm:text-left">
                    <h2 className="text-2xl font-serif text-slate-300">Welcome Back!</h2>
                    <h3 className="text-3xl font-bold text-violet-400 font-serif mt-1">{bookOutline.title}</h3>
                    <p className="text-slate-400 italic">{bookOutline.subtitle}</p>
                    <p className="mt-2 text-sm text-slate-500">by {authorProfile.name}</p>
                    <p className="text-sm text-slate-400 mt-4">Continue where you left off, or start a new project below.</p>
                </div>
            </div>
        </Card>
      )}
      <Card className="w-full max-w-5xl mx-auto">
        <div className={`grid ${!hasExistingProject ? 'md:grid-cols-5' : 'grid-cols-1'} gap-8 items-center`}>
          {!hasExistingProject && (
              <div className="hidden md:flex flex-col items-center justify-center animate-fade-in md:col-span-2">
                  <p className="text-sm text-slate-400 mb-2 font-serif italic">AI-Generated Inspiration</p>
                  <div className="w-60 h-80 bg-slate-800 rounded-md flex items-center justify-center overflow-hidden shadow-lg border-4 border-slate-700 relative group">
                      {isGeneratingExampleCover ? (
                          <LoadingSpinner message="Generating..." />
                      ) : exampleCoverUrl ? (
                          <>
                            <img src={exampleCoverUrl} alt="Example generated book cover" className="w-full h-full object-cover" />
                             <button 
                                onClick={onGenerateExampleCover} 
                                className="absolute bottom-2 right-2 bg-black/50 p-2 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Regenerate inspiration"
                            >
                                <ArrowPathIcon className="w-5 h-5" />
                            </button>
                          </>
                      ) : (
                          <div className="text-center text-slate-500 p-4 flex flex-col items-center">
                              <SparklesIcon className="w-12 h-12 mx-auto" />
                              <p className="text-sm mt-2 mb-4">Feeling stuck?</p>
                              <Button onClick={onGenerateExampleCover} variant="secondary">
                                  Generate Example
                              </Button>
                          </div>
                      )}
                  </div>
              </div>
          )}
          
          <div className={`${!hasExistingProject ? 'md:col-span-3' : ''}`}>
            <h2 className="text-3xl font-bold text-center text-violet-400 mb-2 font-serif">
              Step 1a: Market & Trend Research
            </h2>
            <p className="text-slate-400 text-center mb-6">
              Start a new project with your own idea or let our AI find a hot niche for you.
            </p>

            <form onSubmit={handleCustomTopicSubmit} className="mb-6">
              <label htmlFor="custom-topic" className="block text-sm font-medium text-slate-300 mb-1">
                Start with your own book idea:
              </label>
              {/* MR-01: Research mode selector */}
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setResearchMode('ai')}
                  className={`flex-1 py-1.5 rounded-md text-sm font-medium border transition-colors ${researchMode === 'ai' ? 'bg-violet-700 border-violet-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'}`}
                  title="Use Gemini AI to simulate market data (works in all environments)"
                >
                  🤖 AI Simulation
                </button>
                <button
                  type="button"
                  onClick={() => setResearchMode('real')}
                  className={`flex-1 py-1.5 rounded-md text-sm font-medium border transition-colors ${researchMode === 'real' ? 'bg-emerald-700 border-emerald-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'} ${!supportsRealResearch ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={supportsRealResearch ? 'Fetch live Google Trends + Amazon data (desktop only)' : 'Live market data is only available in Electron/Tauri desktop mode'}
                  disabled={!supportsRealResearch}
                >
                  📡 Real Data {!supportsRealResearch && <span className="text-xs opacity-60">(desktop only)</span>}
                </button>
              </div>
              {researchMode === 'real' && supportsRealResearch && (
                <p className="text-xs text-emerald-400 mb-2">📡 Live Google Trends + Amazon scraping will be used. Gemini will synthesise the results.</p>
              )}
              {researchMode === 'ai' && (
                <p className="text-xs text-violet-400 mb-2">🤖 Gemini AI will simulate trend and competitor data. No external requests.</p>
              )}
              <div className="flex gap-2">
                <input
                  id="custom-topic"
                  type="text"
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  placeholder="e.g., 'A cookbook for busy programmers'"
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500"
                  aria-label="Custom book topic"
                />
                <Button type="submit" disabled={!customTopic || isLoading}>
                  Analyze Topic
                </Button>
              </div>
            </form>

            <div className="flex items-center my-8">
              <div className="flex-grow border-t border-slate-700"></div>
              <span className="flex-shrink mx-4 text-slate-400 text-sm">OR</span>
              <div className="flex-grow border-t border-slate-700"></div>
            </div>

            <div className="flex flex-col items-center">
              <p className="text-sm text-slate-300 mb-4">Let our AI agents find profitable niches or generate books in bulk.</p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button onClick={onStartWithNicheFinder} disabled={isLoading} className="w-auto px-8 py-3 text-lg">
                    {isLoading ? 'Researching...' : (
                        <>
                        <SparklesIcon className="w-6 h-6" />
                        Find Hot Niches For Me
                        </>
                    )}
                </Button>
                <Button onClick={() => onSetMode('batch')} variant="secondary" className="w-auto px-8 py-3 text-lg">
                    <RectangleStackIcon className="w-6 h-6" />
                    Create Books in Batch
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </>
  );
};

export default MarketResearchStep;
