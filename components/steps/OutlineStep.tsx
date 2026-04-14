import React, { useState, useMemo } from 'react';
import { MarketReport, BookOutline, BookGenre } from '../../types';
import Button from '../shared/Button';
import Card from '../shared/Card';
import { SparklesIcon, ArrowPathIcon } from '../icons';
import * as geminiService from '../../services/geminiService';

interface OutlineStepProps {
  marketReport: MarketReport | null;
  onOutlineGenerated: (bookType: string, numChapters: number, pagesPerChapter: string) => void;
  isLoading: boolean;
  bookOutline: BookOutline | null;
  setBookOutline: (outline: BookOutline | null) => void;
  onRegenerateTitle: () => void;
  isRegeneratingTitle: boolean;
  bookGenre: BookGenre;
  onSetBookGenre: (genre: BookGenre) => void;
}

const pagesPerChapterOptions = [
  '1-2 pages (short)',
  '3-5 pages (medium)',
  '6-10 pages (long)',
  '11-15 pages (very long)',
];

const OutlineStep: React.FC<OutlineStepProps> = ({ marketReport, onOutlineGenerated, isLoading, bookOutline, setBookOutline, onRegenerateTitle, isRegeneratingTitle, bookGenre, onSetBookGenre }) => {
  const [numChapters, setNumChapters] = useState(10);
  const [pagesPerChapter, setPagesPerChapter] = useState(pagesPerChapterOptions[1]);
  const [isRegeneratingSubtitle, setIsRegeneratingSubtitle] = useState(false);

  const { estimatedPages, estimatedWords } = useMemo(() => {
    const match = pagesPerChapter.match(/(\d+)-(\d+)/);
    if (!match) return { estimatedPages: 'N/A', estimatedWords: 'N/A' };

    const minPages = parseInt(match[1], 10);
    const maxPages = parseInt(match[2], 10);
    const wordsPerPage = 250; // A reasonable average

    const totalMinPages = minPages * numChapters;
    const totalMaxPages = maxPages * numChapters;

    const totalMinWords = totalMinPages * wordsPerPage;
    const totalMaxWords = totalMaxPages * wordsPerPage;

    return {
      estimatedPages: `${totalMinPages}-${totalMaxPages} pages`,
      estimatedWords: `${totalMinWords.toLocaleString()}-${totalMaxWords.toLocaleString()} words`,
    };
  }, [numChapters, pagesPerChapter]);

  const handleGenerateOutline = (bookType: string) => {
    onOutlineGenerated(bookType, numChapters, pagesPerChapter);
  };
  
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (bookOutline) {
      setBookOutline({ ...bookOutline, title: e.target.value });
    }
  };

  const handleSubtitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (bookOutline) {
      setBookOutline({ ...bookOutline, subtitle: e.target.value });
    }
  };

  const handleRegenerateSubtitle = async () => {
    if (!marketReport || !bookOutline) return;
    setIsRegeneratingSubtitle(true);
    try {
      const { subtitle: newSubtitle } = await geminiService.regenerateBookTitle(marketReport);
      setBookOutline({ ...bookOutline, subtitle: newSubtitle });
    } catch (error) {
      console.error("Failed to regenerate subtitle", error);
      // You could set an error state here to inform the user
    } finally {
      setIsRegeneratingSubtitle(false);
    }
  };

  if (!marketReport) {
    return <Card><p>Please complete the market research step first.</p></Card>;
  }

  if (bookOutline) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-center text-violet-400 mb-2 font-serif">
          Step 2: Review Your Outline
        </h2>
        <p className="text-slate-400 text-center mb-6">
          Your book's structure is ready. Feel free to edit or regenerate the title and subtitle.
        </p>

        <div className="space-y-4 mb-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-slate-300 mb-1">Title</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                id="title"
                value={bookOutline.title}
                onChange={handleTitleChange}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <Button onClick={onRegenerateTitle} disabled={isRegeneratingTitle} variant="secondary" className="px-3" aria-label="Regenerate title and subtitle">
                {isRegeneratingTitle 
                  ? <ArrowPathIcon className="w-5 h-5 animate-spin" />
                  : <ArrowPathIcon className="w-5 h-5" />
                }
              </Button>
            </div>
          </div>
          <div>
            <label htmlFor="subtitle" className="block text-sm font-medium text-slate-300 mb-1">Subtitle</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                id="subtitle"
                value={bookOutline.subtitle}
                onChange={handleSubtitleChange}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <Button onClick={handleRegenerateSubtitle} disabled={isRegeneratingSubtitle} variant="secondary" className="px-3" aria-label="Regenerate subtitle">
                {isRegeneratingSubtitle 
                  ? <ArrowPathIcon className="w-5 h-5 animate-spin" />
                  : <SparklesIcon className="w-5 h-5" />
                }
              </Button>
            </div>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-emerald-400 mb-2">Table of Contents</h3>
        <ul className="space-y-2 bg-slate-900/50 p-4 rounded-lg">
          {bookOutline.tableOfContents.map((chapter) => (
            <li key={chapter.chapter} className="p-2 border-b border-slate-700 last:border-b-0">
              <p className="font-semibold text-slate-200">Chapter {chapter.chapter}: {chapter.title}</p>
              <p className="text-sm text-slate-400 mt-1">{chapter.summary}</p>
            </li>
          ))}
        </ul>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      <Card>
        <h2 className="text-3xl font-bold text-center text-violet-400 mb-2 font-serif">
          Step 2: Blueprint Your Bestseller
        </h2>
        <p className="text-slate-400 text-center mb-6">
          Configure the structure of your book. Our AI Master Author will then craft a compelling title and chapter-by-chapter outline tailored to your vision.
        </p>
        <div className="bg-slate-900/50 p-6 rounded-lg">
          <h3 className="text-xl font-semibold text-emerald-400 mb-6 text-center">Book Structure Configuration</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* Left side: Inputs */}
            <div className="space-y-6">

              {/* Fiction / Non-Fiction toggle */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Book Type</label>
                <div className="flex rounded-md overflow-hidden border border-slate-600">
                  <button
                    type="button"
                    onClick={() => onSetBookGenre('non-fiction')}
                    className={`flex-1 py-2 text-sm font-medium transition-colors ${bookGenre === 'non-fiction' ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                  >
                    📚 Non-Fiction
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetBookGenre('fiction')}
                    className={`flex-1 py-2 text-sm font-medium transition-colors ${bookGenre === 'fiction' ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                  >
                    ✨ Fiction
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {bookGenre === 'non-fiction'
                    ? 'Multi-agent research will gather facts, expert knowledge, and sources for your topic.'
                    : 'Character Bible and Scene Planning will track narrative continuity across chapters.'}
                </p>
              </div>

              <div>
                <label htmlFor="numChapters" className="block text-sm font-medium text-slate-300 mb-2">Number of Chapters</label>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setNumChapters(c => Math.max(3, c - 1))} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-md">-</button>
                  <input
                    type="number"
                    id="numChapters"
                    value={numChapters}
                    onChange={(e) => setNumChapters(Math.max(3, parseInt(e.target.value, 10)) || 3)}
                    min="3"
                    className="w-full text-center px-4 py-2 bg-slate-800 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                  <button type="button" onClick={() => setNumChapters(c => c + 1)} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-md">+</button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Average Length per Chapter</label>
                <div className="grid grid-cols-2 gap-2">
                  {pagesPerChapterOptions.map(range => (
                    <button
                      key={range}
                      type="button"
                      onClick={() => setPagesPerChapter(range)}
                      className={`w-full p-3 text-sm rounded-md transition-all duration-200 ${
                        pagesPerChapter === range 
                        ? 'bg-violet-600 text-white font-semibold ring-2 ring-violet-400' 
                        : 'bg-slate-700 hover:bg-slate-600'
                      }`}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right side: Dynamic Info */}
            <div className="space-y-4">
               <Card className="bg-slate-800/70 border-emerald-500/30">
                  <h4 className="font-semibold text-lg text-center text-emerald-400 mb-4">Estimated Book Length</h4>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-slate-100">{estimatedPages}</p>
                    <p className="text-sm text-slate-400">approx. {estimatedWords}</p>
                  </div>
               </Card>
            </div>
          </div>
          
          <div className="mt-8 pt-6 border-t border-slate-700">
            <h3 className="text-lg font-semibold text-emerald-400 mb-2">Market Research Summary:</h3>
            <p className="text-sm text-slate-300 mb-4">{marketReport.trendAnalysis}</p>
            <h4 className="font-semibold text-slate-300">Suggested Book Types:</h4>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {marketReport.suggestedBookTypes.map((suggestion, index) => (
                <Card key={index} className="bg-slate-700/80">
                  <h5 className="font-bold text-violet-400">{suggestion.type}</h5>
                  <p className="text-sm text-slate-400 mt-1 mb-4">{suggestion.reasoning}</p>
                   <Button onClick={() => handleGenerateOutline(suggestion.type)} disabled={isLoading} className="w-full text-sm py-1">
                     {isLoading ? 'Generating...' : `Generate Outline for this Type`}
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default OutlineStep;