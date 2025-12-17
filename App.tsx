
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { AppStep, BookOutline, Chapter, MarketReport, AuthorProfile, GenreSuggestion, TopicSuggestion, KdpMarketingInfo, AppMode, BatchProject, KdpAutomationPayload } from './types';
import * as geminiService from './services/geminiService';
import * as storageService from './services/storageService';

import StepIndicator from './components/shared/StepIndicator';
import MarketResearchStep from './components/steps/MarketResearchStep';
import MarketReportDisplay from './components/steps/market/MarketReportDisplay';
import OutlineStep from './components/steps/OutlineStep';
import ContentGenerationStep from './components/steps/ContentGenerationStep';
import IllustrationStep from './components/steps/IllustrationStep';
import ReviewStep from './components/steps/ReviewStep';
import LoadingSpinner from './components/shared/LoadingSpinner';
import { SparklesIcon, UserCircleIcon, TrashIcon, RocketLaunchIcon, CheckBadgeIcon } from './components/icons';
import AuthorProfileModal from './components/AuthorProfileModal';
import BatchMode from './components/BatchMode';
import KdpAutomationBot from './components/KdpAutomationBot';


const pageRangeToChapterCount = (pageRange: string): number => {
    const firstNum = parseInt(pageRange.split('-')[0], 10);
    if (firstNum <= 50) return 5;
    if (firstNum <= 120) return 7;
    if (firstNum <= 175) return 10;
    if (firstNum <= 300) return 12;
    if (firstNum <= 500) return 15;
    if (firstNum <= 1000) return 20;
    return 25;
};

// Versioned storage key
const STORAGE_KEY = 'kdp-ai-booksmith-v5-db';

function App() {
  const [mode, setMode] = useState<AppMode>(AppMode.Single);
  const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.MarketResearch);
  const [isLoading, setIsLoading] = useState(true); // Start true to allow DB load
  const [error, setError] = useState<string | null>(null);
  
  // SINGLE BOOK MODE STATE
  const [genreSuggestions, setGenreSuggestions] = useState<GenreSuggestion[] | null>(null);
  const [topicSuggestions, setTopicSuggestions] = useState<TopicSuggestion[] | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<GenreSuggestion | null>(null);
  const [marketReport, setMarketReport] = useState<MarketReport | null>(null);
  const [hasViewedReport, setHasViewedReport] = useState(false);
  const [bookOutline, setBookOutline] = useState<BookOutline | null>(null);
  const [pagesPerChapter, setPagesPerChapter] = useState<string>('3-5 pages (medium)');
  const [bookCoverUrl, setBookCoverUrl] = useState<string | null>(null);
  const [chapterLoadingStates, setChapterLoadingStates] = useState<{[key: number]: boolean}>({});
  const [isRegeneratingTitle, setIsRegeneratingTitle] = useState(false);
  const [isHumanizing, setIsHumanizing] = useState(false);
  const [isGeneratingKdpMarketing, setIsGeneratingKdpMarketing] = useState(false);
  const [kdpMarketingInfo, setKdpMarketingInfo] = useState<KdpMarketingInfo | null>(null);
  const [authorProfile, setAuthorProfile] = useState<AuthorProfile | null>(null);
  const [isAuthorModalOpen, setIsAuthorModalOpen] = useState(false);
  const [exampleCoverUrl, setExampleCoverUrl] = useState<string | null>(null);
  const [isGeneratingExampleCover, setIsGeneratingExampleCover] = useState(false);
  const [automationPayload, setAutomationPayload] = useState<KdpAutomationPayload | null>(null);
  const [isGeneratingFullManuscript, setIsGeneratingFullManuscript] = useState(false);
  const [fullManuscriptGenerationProgress, setFullManuscriptGenerationProgress] = useState('');
  const [isRegeneratingWithFeedback, setIsRegeneratingWithFeedback] = useState(false);

  // System Resources
  const [isPersistentStorage, setIsPersistentStorage] = useState(false);
  const [storageQuota, setStorageQuota] = useState<{usage: number, quota: number} | null>(null);
  const [isHighPerformanceMode, setIsHighPerformanceMode] = useState(true);

  // BATCH MODE STATE
  const [batchProjects, setBatchProjects] = useState<BatchProject[]>([]);
  const [isBatchRunning, setIsBatchRunning] = useState(false);

  const handleGenerateExampleCover = useCallback(async () => {
    setIsGeneratingExampleCover(true);
    setError(null);
    try {
      const url = await geminiService.generateExampleBookCover();
      setExampleCoverUrl(url);
    } catch (e) {
      console.error("Failed to generate example cover", e);
      const message = e instanceof Error ? e.message : 'An unknown error occurred.';
      setError('Failed to generate an example cover. ' + message);
    } finally {
      setIsGeneratingExampleCover(false);
    }
  }, []);
  
  // 1. Initial Load from IndexedDB
  useEffect(() => {
    const loadData = async () => {
        try {
            const savedState = await storageService.loadState(STORAGE_KEY);
            if (savedState) {
                 // Validation logic
                 let safeStep = savedState.currentStep ?? AppStep.MarketResearch;
                 if (safeStep > AppStep.MarketResearch && (!savedState.bookOutline || !Array.isArray(savedState.bookOutline.tableOfContents))) {
                    console.warn("Corrupted state detected: Missing outline. Resetting to Market Research.");
                    safeStep = AppStep.MarketResearch;
                    savedState.bookOutline = null;
                }

                setCurrentStep(safeStep);
                setMarketReport(savedState.marketReport ?? null);
                setHasViewedReport(savedState.hasViewedReport ?? false);
                setBookOutline(savedState.bookOutline ?? null);
                setPagesPerChapter(savedState.pagesPerChapter ?? '3-5 pages (medium)');
                setBookCoverUrl(savedState.bookCoverUrl ?? null);
                setGenreSuggestions(savedState.genreSuggestions ?? null);
                setTopicSuggestions(savedState.topicSuggestions ?? null);
                setSelectedGenre(savedState.selectedGenre ?? null);
                setAuthorProfile(savedState.authorProfile ?? null);
                setKdpMarketingInfo(savedState.kdpMarketingInfo ?? null);
            }
        } catch (e) {
            console.error("Failed to load state from DB", e);
            // Fallback: Check localStorage for migration
            const legacyState = localStorage.getItem('kdp-ai-booksmith-v4');
            if (legacyState) {
                console.log("Migrating from legacy localStorage...");
                try {
                    const parsed = JSON.parse(legacyState);
                    setAuthorProfile(parsed.authorProfile);
                    // We don't load everything to avoid bugs, just profile is useful
                } catch(err) {}
            }
        } finally {
            setIsLoading(false);
        }
        
        // Check storage status
        const isPersisted = await navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false;
        setIsPersistentStorage(isPersisted);
        const quota = await storageService.checkStorageQuota();
        setStorageQuota(quota);
    };
    
    loadData();
  }, []);

  // 2. Debounced Save to IndexedDB
  // Use a ref to store the timeout ID to debounce saves
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isLoading) return; // Don't save empty state during load

    if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
        const stateToSave = {
          currentStep,
          marketReport,
          hasViewedReport,
          bookOutline,
          pagesPerChapter,
          bookCoverUrl,
          genreSuggestions,
          topicSuggestions,
          selectedGenre,
          authorProfile,
          kdpMarketingInfo,
        };
        storageService.saveState(STORAGE_KEY, stateToSave).catch(e => console.error("Save failed", e));
        
        // Update quota info occasionally
        storageService.checkStorageQuota().then(setStorageQuota);

    }, 1000); // 1 second debounce
    
    return () => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    }
  }, [mode, currentStep, marketReport, hasViewedReport, bookOutline, pagesPerChapter, bookCoverUrl, genreSuggestions, topicSuggestions, selectedGenre, authorProfile, kdpMarketingInfo, isLoading]);

  const handleRequestPersistence = async () => {
      const granted = await storageService.requestPersistentStorage();
      if (granted) {
          setIsPersistentStorage(true);
          alert("High-Capacity Storage Mode Enabled! Your browser will now allow gigabytes of data storage.");
      } else {
          alert("Browser denied persistent storage. You may need to manually clear space or change browser settings.");
      }
  };

  const handleSaveAuthorProfile = (profile: AuthorProfile) => {
    setAuthorProfile(profile);
    setIsAuthorModalOpen(false);
  };
  
  const handleResetProgress = async () => {
    if (window.confirm("Are you sure you want to reset all progress? This action cannot be undone.")) {
        await storageService.clearState(STORAGE_KEY);
        window.location.reload();
    }
  };

  const handleStepChange = (step: AppStep) => {
    if (step < currentStep) {
      setCurrentStep(step);
    }
  };

  const handleStartNewProject = (startAction: () => void) => {
    const startNew = () => {
        // Reset all project-specific state
        setMarketReport(null);
        setHasViewedReport(false);
        setBookOutline(null);
        setBookCoverUrl(null);
        setKdpMarketingInfo(null);
        setGenreSuggestions(null);
        setTopicSuggestions(null);
        setSelectedGenre(null);
        setCurrentStep(AppStep.MarketResearch);
        setError(null);
        
        startAction();
    };

    if (bookOutline) {
        if (window.confirm("This will clear your current book project and start a new one. Are you sure?")) {
            startNew();
        }
    } else {
        startNew();
    }
  };

  // --- API WRAPPERS ---

  const handleFetchGenres = useCallback(async () => {
    setIsLoading(true);
    try {
      const genres = await geminiService.getHotGenres();
      setGenreSuggestions(genres);
    } catch (e) {
      console.error(e);
      setError('Failed to research genres. ' + (e as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleFetchTopics = useCallback(async (genre: GenreSuggestion) => {
    setSelectedGenre(genre);
    setIsLoading(true);
    setError(null);
    setTopicSuggestions(null);
    try {
      const topics = await geminiService.getTopicSuggestions(genre.genre, genre.reasoning);
      setTopicSuggestions(topics);
    } catch (e) {
      console.error(e);
      setError('Failed to brainstorm topics.');
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  const handleGenerateFinalReport = useCallback(async (topic: TopicSuggestion | string) => {
      const topicString = typeof topic === 'string' ? topic : topic.topic;
      const genreString = typeof topic === 'string' ? undefined : selectedGenre?.genre;
      
      setIsLoading(true);
      setError(null);
      try {
        let report = await geminiService.generateMarketReport(topicString, genreString);
        setMarketReport(report);
        setHasViewedReport(false);
        setCurrentStep(AppStep.Outline);
      } catch (e) {
        console.error(e);
        setError('Failed to generate market report.');
      } finally {
        setIsLoading(false);
      }
  }, [selectedGenre]);

  const handleStartWithNicheFinder = () => {
    handleStartNewProject(handleFetchGenres);
  };

  const handleStartWithCustomTopic = (topic: string) => {
    handleStartNewProject(() => handleGenerateFinalReport(topic));
  };

  const handleOutline = useCallback(async (bookType: string, numChapters: number, pagesPerChapterValue: string) => {
    if (!marketReport) return;
    setIsLoading(true);
    setError(null);
    setPagesPerChapter(pagesPerChapterValue);
    try {
      const match = pagesPerChapterValue.match(/(\d+)-(\d+)/);
      if (!match) throw new Error("Invalid pages per chapter format");
      const minPages = parseInt(match[1], 10) * numChapters;
      const maxPages = parseInt(match[2], 10) * numChapters;
      const totalPageRange = `${minPages}-${maxPages} pages`;

      const outline = await geminiService.generateBookOutline(marketReport, bookType, numChapters, totalPageRange);
      setBookOutline(outline);
    } catch (e) {
      console.error(e);
      setError('Failed to generate book outline.');
    } finally {
      setIsLoading(false);
    }
  }, [marketReport]);
  
  const handleRegenerateTitle = useCallback(async () => {
    if (!marketReport) return;
    setIsRegeneratingTitle(true);
    setError(null);
    try {
      const { title, subtitle } = await geminiService.regenerateBookTitle(marketReport);
      setBookOutline(prev => prev ? { ...prev, title, subtitle } : null);
    } catch (e) {
        console.error(e);
        setError('Failed to regenerate title.');
    } finally {
        setIsRegeneratingTitle(false);
    }
  }, [marketReport]);

  const handleGenerateChapter = useCallback(async (chapterIndex: number, currentContent?: string, instructions?: string) => {
    if (!bookOutline) return;
    const chapter = bookOutline.tableOfContents[chapterIndex];
    setChapterLoadingStates(prev => ({...prev, [chapter.chapter]: true}));
    setError(null);

    try {
        let content;
        if (currentContent && currentContent.trim().length > 0) {
            content = await geminiService.regenerateChapterWithGuidance(
                chapter.title, 
                chapter.summary, 
                currentContent, 
                pagesPerChapter,
                instructions
            );
        } else {
            content = await geminiService.generateChapterContent(chapter.title, chapter.summary, pagesPerChapter);
        }

        setBookOutline(prev => {
            if (!prev) return null;
            const newToc = [...prev.tableOfContents];
            newToc[chapterIndex] = { ...newToc[chapterIndex], content };
            return { ...prev, tableOfContents: newToc };
        });
    } catch (e) {
        console.error(e);
        setError(`Failed to generate content for Chapter ${chapter.chapter}.`);
    } finally {
        setChapterLoadingStates(prev => ({...prev, [chapter.chapter]: false}));
    }
  }, [bookOutline, pagesPerChapter]);

  const handleUpdateChapterContent = useCallback((chapterIndex: number, content: string) => {
    setBookOutline(prev => {
        if (!prev) return null;
        const newToc = [...prev.tableOfContents];
        newToc[chapterIndex] = { ...newToc[chapterIndex], content };
        return { ...prev, tableOfContents: newToc };
    });
  }, []);

  const handleGenerateImageForIllustrationStep = useCallback(async (chapterIndex: number) => {
    if (!bookOutline) return;
    const chapter = bookOutline.tableOfContents[chapterIndex];
    if (!chapter.content) return;

    setBookOutline(prev => {
      if (!prev) return null;
      const newToc = [...prev.tableOfContents];
      newToc[chapterIndex] = { ...newToc[chapterIndex], isGeneratingImage: true };
      return { ...prev, tableOfContents: newToc };
    });
    setError(null);

    try {
      const imagePrompt = await geminiService.generateImagePrompt(chapter.content.substring(0, 500), chapter.illustrationStyle);
      const imageUrl = await geminiService.generateIllustration(imagePrompt);
      
      setBookOutline(prev => {
          if (!prev) return null;
          const newToc = [...prev.tableOfContents];
          newToc[chapterIndex] = { ...newToc[chapterIndex], imageUrl, imagePrompt };
          return { ...prev, tableOfContents: newToc };
      });
    } catch (e) {
        console.error(e);
        setError(`Failed to generate illustration for Chapter ${chapter.chapter}.`);
    } finally {
      setBookOutline(prev => {
          if (!prev) return null;
          const newToc = [...prev.tableOfContents];
          newToc[chapterIndex] = { ...newToc[chapterIndex], isGeneratingImage: false };
          return { ...prev, tableOfContents: newToc };
      });
    }
  }, [bookOutline]);

  const handleGenerateImagePrompt = useCallback(async (chapterIndex: number) => {
    if (!bookOutline) return;
    const chapter = bookOutline.tableOfContents[chapterIndex];
    if (!chapter.content) return;

    setBookOutline(prev => {
      if (!prev) return null;
      const newToc = [...prev.tableOfContents];
      newToc[chapterIndex] = { ...newToc[chapterIndex], isGeneratingPrompt: true };
      return { ...prev, tableOfContents: newToc };
    });
    setError(null);

    try {
      const prompt = await geminiService.generateImagePrompt(chapter.content.substring(0, 500), chapter.illustrationStyle);
      setBookOutline(prev => {
        if (!prev) return null;
        const newToc = [...prev.tableOfContents];
        newToc[chapterIndex] = { ...newToc[chapterIndex], imagePrompt: prompt };
        return { ...prev, tableOfContents: newToc };
      });
    } catch (e) {
      console.error(e);
      setError(`Failed to generate image prompt.`);
    } finally {
      setBookOutline(prev => {
        if (!prev) return null;
        const newToc = [...prev.tableOfContents];
        newToc[chapterIndex] = { ...newToc[chapterIndex], isGeneratingPrompt: false };
        return { ...prev, tableOfContents: newToc };
      });
    }
  }, [bookOutline]);
  
  const handleUpdateImagePrompt = useCallback((chapterIndex: number, prompt: string) => {
    setBookOutline(prev => {
        if (!prev) return null;
        const newToc = [...prev.tableOfContents];
        newToc[chapterIndex] = { ...newToc[chapterIndex], imagePrompt: prompt };
        return { ...prev, tableOfContents: newToc };
    });
  }, []);
  
  const handleUpdateChapterStyle = useCallback((chapterIndex: number, style: string) => {
    setBookOutline(prev => {
        if (!prev) return null;
        const newToc = [...prev.tableOfContents];
        const currentStyle = newToc[chapterIndex].illustrationStyle;
        newToc[chapterIndex] = { ...newToc[chapterIndex], illustrationStyle: currentStyle === style ? undefined : style };
        return { ...prev, tableOfContents: newToc };
    });
  }, []);

  const handleGenerateIllustrationFromContentStep = useCallback(async (chapterIndex: number) => {
    if (!bookOutline) return;
    const chapter = bookOutline.tableOfContents[chapterIndex];
    if (!chapter.imagePrompt) return;

    setBookOutline(prev => {
      if (!prev) return null;
      const newToc = [...prev.tableOfContents];
      newToc[chapterIndex] = { ...newToc[chapterIndex], isGeneratingImage: true };
      return { ...prev, tableOfContents: newToc };
    });
    setError(null);

    try {
      const imageUrl = await geminiService.generateIllustration(chapter.imagePrompt);
      setBookOutline(prev => {
        if (!prev) return null;
        const newToc = [...prev.tableOfContents];
        newToc[chapterIndex] = { ...newToc[chapterIndex], imageUrl };
        return { ...prev, tableOfContents: newToc };
      });
    } catch(e) {
      console.error(e);
      setError(`Failed to generate illustration.`);
    } finally {
       setBookOutline(prev => {
        if (!prev) return null;
        const newToc = [...prev.tableOfContents];
        newToc[chapterIndex] = { ...newToc[chapterIndex], isGeneratingImage: false };
        return { ...prev, tableOfContents: newToc };
      });
    }
  }, [bookOutline]);


  // --- PARALLEL EXECUTION ENGINE ---
  const handleGenerateFullManuscript = useCallback(async () => {
    if (!bookOutline) return;
    setIsGeneratingFullManuscript(true);
    setFullManuscriptGenerationProgress('Initializing High-Throughput AI Engine...');
    setError(null);

    // Helper to process a single chapter fully
    const processChapter = async (chapter: Chapter, index: number): Promise<Chapter> => {
        let updatedChapter = { ...chapter };

        try {
             // 1. Content
            if (!updatedChapter.content) {
                updatedChapter.content = await geminiService.generateChapterContent(updatedChapter.title, updatedChapter.summary, pagesPerChapter);
            }
            
            // 2. Prompt
            if (!updatedChapter.imagePrompt) {
                 updatedChapter.imagePrompt = await geminiService.generateImagePrompt(updatedChapter.content!.substring(0, 500), updatedChapter.illustrationStyle);
            }

            // 3. Image
            if (!updatedChapter.imageUrl) {
                 updatedChapter.imageUrl = await geminiService.generateIllustration(updatedChapter.imagePrompt!);
            }
            return updatedChapter;

        } catch (e) {
            console.error(`Error in chapter ${index + 1}`, e);
            return updatedChapter; // Return what we have
        }
    };

    try {
        if (isHighPerformanceMode) {
             // Parallel Execution: Run chunks of chapters concurrently
             // 5 concurrent threads is usually safe for paid accounts without hitting rate limits immediately if retries are handled
             const CONCURRENCY_LIMIT = 4; 
             const chapters = [...bookOutline.tableOfContents];
             const results: Chapter[] = new Array(chapters.length);
             
             for (let i = 0; i < chapters.length; i += CONCURRENCY_LIMIT) {
                 const chunk = chapters.slice(i, i + CONCURRENCY_LIMIT);
                 setFullManuscriptGenerationProgress(`Processing Chapters ${i + 1} to ${Math.min(i + CONCURRENCY_LIMIT, chapters.length)} of ${chapters.length} in parallel...`);
                 
                 const chunkPromises = chunk.map((chapter, idx) => processChapter(chapter, i + idx));
                 const chunkResults = await Promise.all(chunkPromises);
                 
                 chunkResults.forEach((res, idx) => {
                     results[i + idx] = res;
                 });
                 
                 // Update state incrementally so user sees progress
                 setBookOutline(prev => prev ? { ...prev, tableOfContents: [...results].map((r, idx) => r || prev.tableOfContents[idx]) } : null);
             }
        } else {
             // Sequential Execution (Old method)
             let currentToc = [...bookOutline.tableOfContents];
             for (let i = 0; i < currentToc.length; i++) {
                setFullManuscriptGenerationProgress(`Processing Chapter ${i + 1} of ${currentToc.length}...`);
                const updated = await processChapter(currentToc[i], i);
                currentToc[i] = updated;
                setBookOutline(prev => prev ? { ...prev, tableOfContents: [...currentToc] } : null);
             }
        }

    } catch (e) {
        console.error(e);
        setError("The AI Engine encountered an issue. Some chapters may be incomplete.");
    } finally {
        setIsGeneratingFullManuscript(false);
        setFullManuscriptGenerationProgress('');
    }
  }, [bookOutline, pagesPerChapter, isHighPerformanceMode]);

  const handleGenerateCover = useCallback(async () => {
    if (!bookOutline || !authorProfile?.name) {
      setError("Please ensure you have a book outline and an author name in your profile.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
        const coverUrl = await geminiService.generateBookCover(bookOutline.title, bookOutline.subtitle, authorProfile.name);
        setBookCoverUrl(coverUrl);
    } catch (e) {
        console.error(e);
        setError("Failed to generate the book cover.");
    } finally {
        setIsLoading(false);
    }
  }, [bookOutline, authorProfile]);

  const handleHumanizeBook = useCallback(async () => {
    if (!bookOutline) return;
    setIsHumanizing(true);
    setError(null);
    try {
        // Parallelize humanization if high performance
        if (isHighPerformanceMode) {
             const CONCURRENCY_LIMIT = 5;
             const chapters = [...bookOutline.tableOfContents];
             const results = [...chapters];
             
             for (let i = 0; i < chapters.length; i += CONCURRENCY_LIMIT) {
                 const chunk = chapters.slice(i, i + CONCURRENCY_LIMIT);
                 const chunkPromises = chunk.map(async (chapter) => {
                     if (chapter.content) {
                         const h = await geminiService.humanizeChapterContent(chapter.content);
                         return { ...chapter, content: h };
                     }
                     return chapter;
                 });
                 const chunkResults = await Promise.all(chunkPromises);
                 chunkResults.forEach((res, idx) => { results[i + idx] = res; });
             }
             setBookOutline({ ...bookOutline, tableOfContents: results });

        } else {
            const humanizedChapters = await Promise.all(
                bookOutline.tableOfContents.map(async (chapter) => {
                    if (chapter.content) {
                        const humanizedContent = await geminiService.humanizeChapterContent(chapter.content);
                        return { ...chapter, content: humanizedContent };
                    }
                    return chapter;
                })
            );
            setBookOutline({ ...bookOutline, tableOfContents: humanizedChapters });
        }
    } catch (e) {
        console.error(e);
        setError("Failed to humanize the book content.");
    } finally {
        setIsHumanizing(false);
    }
  }, [bookOutline, isHighPerformanceMode]);

  const handleRegenerateWithFeedback = useCallback(async (feedback: string) => {
    if (!bookOutline) return;
    setIsRegeneratingWithFeedback(true);
    setError(null);
    try {
      const newOutline = await geminiService.regenerateFullBookWithFeedback(bookOutline, feedback);
      setBookOutline(newOutline);
    } catch (e) {
      console.error(e);
      setError("Failed to regenerate the book with your feedback.");
    } finally {
      setIsRegeneratingWithFeedback(false);
    }
  }, [bookOutline]);

  const handleGenerateKdpMarketingInfo = useCallback(async () => {
    if (!bookOutline || !marketReport) {
        setError("A market report and book outline are required.");
        return;
    };
    setIsGeneratingKdpMarketing(true);
    setError(null);
    try {
        const info = await geminiService.generateKdpMarketingInfo(marketReport, bookOutline);
        setKdpMarketingInfo(info);
    } catch (e) {
        console.error(e);
        setError("Failed to generate marketing materials.");
    } finally {
        setIsGeneratingKdpMarketing(false);
    }
  }, [bookOutline, marketReport]);

  const handleStartKdpAutomation = (payload: KdpAutomationPayload) => {
    setAutomationPayload(payload);
  };

  const handleStartBatchGeneration = useCallback(async (projectsToGenerate: {title: string, subtitle: string}[], settings: { genre: string, pageRange: string }) => {
    setIsBatchRunning(true);
    const initialProjects: BatchProject[] = projectsToGenerate.map((p, i) => ({
      id: `${Date.now()}-${i}`,
      title: p.title,
      subtitle: p.subtitle,
      status: 'Pending',
    }));
    setBatchProjects(initialProjects);

    // In Batch Mode, we process ONE book at a time to check for errors, but internal book steps can be parallel
    for (let i = 0; i < initialProjects.length; i++) {
        const currentProject = initialProjects[i];

        const updateStatus = (status: string, data?: Partial<BatchProject>) => {
            setBatchProjects(prev => prev.map(p => p.id === currentProject.id ? { ...p, status, ...data } : p));
        };
        
        try {
            updateStatus('1/5: Generating market report...');
            const report = await geminiService.generateMarketReport(currentProject.title, settings.genre);
            
            updateStatus('2/5: Creating book outline...');
            const numChapters = pageRangeToChapterCount(settings.pageRange);
            const outline = await geminiService.generateBookOutline(report, settings.genre, numChapters, settings.pageRange);
            
            updateStatus('3/5: Mass-Producing manuscript...');
            // Parallel batch generation
            const chapters = [...outline.tableOfContents];
            const writtenChapters = new Array(chapters.length);
            const CONCURRENCY = 4;
            
            for(let j=0; j<chapters.length; j+=CONCURRENCY) {
                const chunk = chapters.slice(j, j+CONCURRENCY);
                const results = await Promise.all(chunk.map(async (ch) => {
                     const content = await geminiService.generateChapterContent(ch.title, ch.summary, '3-5 pages (medium)');
                     return { ...ch, content };
                }));
                results.forEach((res, idx) => writtenChapters[j+idx] = res);
            }
            const outlineWithContent: BookOutline = { ...outline, tableOfContents: writtenChapters };

            updateStatus('4/5: Humanizing & Polishing...');
            // Parallel humanization
            const humanizedChapters = new Array(writtenChapters.length);
            for(let j=0; j<writtenChapters.length; j+=CONCURRENCY) {
                const chunk = writtenChapters.slice(j, j+CONCURRENCY);
                const results = await Promise.all(chunk.map(async (ch) => {
                     if (ch.content) {
                        const h = await geminiService.humanizeChapterContent(ch.content);
                        return { ...ch, content: h };
                     }
                     return ch;
                }));
                results.forEach((res, idx) => humanizedChapters[j+idx] = res);
            }

            const finalOutline: BookOutline = { ...outlineWithContent, tableOfContents: humanizedChapters };
            
            updateStatus('5/5: Designing book cover...');
            const coverUrl = await geminiService.generateBookCover(finalOutline.title, finalOutline.subtitle, authorProfile?.name || 'The Author');
            
            updateStatus('Complete', { finalOutline, coverUrl });
            
            await new Promise(resolve => setTimeout(resolve, 3000));

        } catch(e) {
            console.error(`Failed to generate book "${currentProject.title}":`, e);
            updateStatus('Error', { error: (e as Error).message });
        }
    }
  }, [authorProfile]);


  if (mode === AppMode.Batch) {
    return <BatchMode
              onExit={() => {
                setMode(AppMode.Single);
                setIsBatchRunning(false);
                setBatchProjects([]);
              }}
              onStartBatch={handleStartBatchGeneration}
              projects={batchProjects}
              isRunning={isBatchRunning}
           />
  }

  if (automationPayload) {
    return <KdpAutomationBot {...automationPayload} onClose={() => setAutomationPayload(null)} />;
  }
  
  // Loading State for DB
  if (isLoading) {
      return (
          <div className="min-h-screen bg-slate-900 flex items-center justify-center">
              <LoadingSpinner size="lg" message="Loading your workspace..." />
          </div>
      );
  }

  const renderCurrentStep = () => {
    switch (currentStep) {
      case AppStep.MarketResearch:
        return <MarketResearchStep
          onStartWithNicheFinder={handleStartWithNicheFinder}
          onStartWithCustomTopic={handleStartWithCustomTopic}
          onSelectGenre={handleFetchTopics}
          onSelectTopic={(topic) => handleGenerateFinalReport(topic)}
          genres={genreSuggestions}
          topics={topicSuggestions}
          isLoading={isLoading}
          bookCoverUrl={bookCoverUrl}
          bookOutline={bookOutline}
          authorProfile={authorProfile}
          onSetMode={() => setMode(AppMode.Batch)}
          exampleCoverUrl={exampleCoverUrl}
          isGeneratingExampleCover={isGeneratingExampleCover}
          onGenerateExampleCover={handleGenerateExampleCover}
        />;
      case AppStep.Outline:
        if (marketReport && !hasViewedReport) {
          return <MarketReportDisplay 
                    report={marketReport} 
                    onProceed={() => setHasViewedReport(true)}
                 />;
        }
        return <OutlineStep 
                  marketReport={marketReport} 
                  onOutlineGenerated={handleOutline} 
                  isLoading={isLoading} 
                  bookOutline={bookOutline} 
                  setBookOutline={setBookOutline} 
                  onRegenerateTitle={handleRegenerateTitle}
                  isRegeneratingTitle={isRegeneratingTitle}
                />;
      case AppStep.Content:
        return <ContentGenerationStep 
                  outline={bookOutline} 
                  onGenerateChapter={handleGenerateChapter} 
                  updateChapterContent={handleUpdateChapterContent} 
                  chapterLoadingStates={chapterLoadingStates}
                  onGenerateImagePrompt={handleGenerateImagePrompt}
                  onUpdateImagePrompt={handleUpdateImagePrompt}
                  onGenerateIllustration={handleGenerateIllustrationFromContentStep}
                  onGenerateFullManuscript={handleGenerateFullManuscript}
                  isGeneratingFullManuscript={isGeneratingFullManuscript}
                  fullManuscriptGenerationProgress={fullManuscriptGenerationProgress}
                  onUpdateChapterStyle={handleUpdateChapterStyle}
               />;
      case AppStep.Illustration:
        return <IllustrationStep chapters={bookOutline?.tableOfContents || []} onGenerateImage={handleGenerateImageForIllustrationStep} />;
      case AppStep.Review:
        return <ReviewStep 
                  outline={bookOutline} 
                  authorProfile={authorProfile} 
                  marketReport={marketReport}
                  onGenerateCover={handleGenerateCover}
                  bookCoverUrl={bookCoverUrl}
                  onUpdateBookCover={setBookCoverUrl}
                  isLoading={isLoading}
                  onHumanizeBook={handleHumanizeBook}
                  isHumanizing={isHumanizing}
                  onGenerateKdpMarketing={handleGenerateKdpMarketingInfo}
                  isGeneratingKdpMarketing={isGeneratingKdpMarketing}
                  kdpMarketingInfo={kdpMarketingInfo}
                  onStartKdpAutomation={handleStartKdpAutomation}
                  onRegenerateWithFeedback={handleRegenerateWithFeedback}
                  isRegeneratingWithFeedback={isRegeneratingWithFeedback}
                  onRegenerateChapter={handleGenerateChapter}
                  chapterLoadingStates={chapterLoadingStates}
               />;
      default:
        return <p>Something went wrong.</p>;
    }
  };
  
  const canProceed = () => {
    switch(currentStep){
      case AppStep.MarketResearch: return !!marketReport;
      case AppStep.Outline: return (!!marketReport && hasViewedReport && !!bookOutline);
      case AppStep.Content: return !!bookOutline && bookOutline.tableOfContents.some(c => c.content);
      case AppStep.Illustration: return !!bookOutline;
      default: return false;
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans p-4 sm:p-6 md:p-8 flex flex-col">
      {isAuthorModalOpen && (
        <AuthorProfileModal
          profile={authorProfile}
          onSave={handleSaveAuthorProfile}
          onClose={() => setIsAuthorModalOpen(false)}
          bookOutline={bookOutline}
          marketReport={marketReport}
        />
      )}
      <div className="max-w-7xl mx-auto w-full flex-grow">
        <header className="text-center relative">
          <div className="absolute top-0 right-0 flex items-center gap-2">
            <button
              onClick={handleResetProgress}
              className="p-2 text-slate-400 hover:text-red-400 transition-colors"
              aria-label="Reset Progress"
              title="Reset Progress"
            >
              <TrashIcon className="w-7 h-7" />
            </button>
            <button 
              onClick={() => setIsAuthorModalOpen(true)} 
              className="p-2 text-slate-400 hover:text-violet-400 transition-colors"
              aria-label="Author Profile"
              title="Author Profile"
            >
              <UserCircleIcon className="w-8 h-8" />
            </button>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-emerald-400 font-serif flex items-center justify-center gap-3">
            <SparklesIcon className="w-10 h-10" />
            FraudRob's AI Book Factory
          </h1>
          <p className="mt-2 text-slate-400">Your AI-powered partner for creating bestselling Amazon KDP books.</p>
        </header>

        <main className="mt-8">
          <StepIndicator currentStep={currentStep} setStep={handleStepChange} />
          {error && <div className="my-4 p-4 bg-red-900/50 border border-red-700 text-red-300 rounded-md text-center">{error}</div>}
          <div className="mt-8">
            {renderCurrentStep()}
          </div>
        </main>
        
        <footer className="text-center mt-12 flex justify-center gap-4 pb-8">
            {currentStep > AppStep.MarketResearch && (
                <button onClick={() => setCurrentStep(s => s - 1)} className="text-slate-400 hover:text-white transition-colors">
                    &larr; Back
                </button>
            )}
            {currentStep < AppStep.Review && (
                 <button 
                    onClick={() => setCurrentStep(s => s + 1)} 
                    disabled={!canProceed()}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-6 rounded-md transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed"
                >
                    Next Step &rarr;
                </button>
            )}
        </footer>
      </div>

      {/* System Resource Footer Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-950 border-t border-slate-800 p-2 flex justify-between items-center text-xs text-slate-500 z-40 px-6">
        <div className="flex items-center gap-4">
             <div className="flex items-center gap-1">
                 <span className={isPersistentStorage ? "text-emerald-500" : "text-amber-500"}>●</span>
                 <span>Storage: {isPersistentStorage ? "High-Capacity (Persistent)" : "Standard (Volatile)"}</span>
                 {storageQuota && (
                     <span className="ml-1 opacity-70">
                         ({(storageQuota.usage / (1024 * 1024)).toFixed(1)} MB used)
                     </span>
                 )}
             </div>
             {!isPersistentStorage && (
                 <button onClick={handleRequestPersistence} className="text-violet-400 hover:underline">
                     Enable High-Capacity Mode
                 </button>
             )}
        </div>
        <div className="flex items-center gap-4">
             <div className="flex items-center gap-2">
                 <span>Execution Engine:</span>
                 <button 
                    onClick={() => setIsHighPerformanceMode(!isHighPerformanceMode)} 
                    className={`flex items-center gap-1 px-2 py-0.5 rounded ${isHighPerformanceMode ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}
                    title={isHighPerformanceMode ? "Parallel processing enabled. Uses more API quota." : "Sequential processing enabled. Slower but safer."}
                 >
                     {isHighPerformanceMode ? <RocketLaunchIcon className="w-3 h-3" /> : null}
                     {isHighPerformanceMode ? "High Concurrency" : "Sequential"}
                 </button>
             </div>
             <span>App v1.5.0</span>
        </div>
      </div>
    </div>
  );
}

export default App;
