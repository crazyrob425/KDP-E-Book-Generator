






import React, { useState, useCallback, useEffect } from 'react';
import { AppStep, BookOutline, Chapter, MarketReport, AuthorProfile, GenreSuggestion, TopicSuggestion, KdpMarketingInfo, AppMode, BatchProject, KdpAutomationPayload } from './types';
import * as geminiService from './services/geminiService';


import StepIndicator from './components/shared/StepIndicator';
import MarketResearchStep from './components/steps/MarketResearchStep';
import MarketReportDisplay from './components/steps/market/MarketReportDisplay';
import OutlineStep from './components/steps/OutlineStep';
import ContentGenerationStep from './components/steps/ContentGenerationStep';
import IllustrationStep from './components/steps/IllustrationStep';
import ReviewStep from './components/steps/ReviewStep';
import LoadingSpinner from './components/shared/LoadingSpinner';
import { SparklesIcon, UserCircleIcon, TrashIcon } from './components/icons';
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

// Versioned storage key to prevent crashes from stale/corrupt state
const STORAGE_KEY = 'kdp-ai-booksmith-v4';

function App() {
  const [mode, setMode] = useState<AppMode>(AppMode.Single);
  const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.MarketResearch);
  const [isLoading, setIsLoading] = useState(false);
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
      if (message.includes('quota')) {
          setError('You have exceeded your image generation quota. Please check your plan and billing details.');
      } else {
          setError('Failed to generate an example cover. Please try again later.');
      }
    } finally {
      setIsGeneratingExampleCover(false);
    }
  }, []);
  
  // Load progress from localStorage on initial mount with validation
  useEffect(() => {
    try {
      const savedProgress = localStorage.getItem(STORAGE_KEY);
      if (savedProgress) {
        const parsedState = JSON.parse(savedProgress);
        
        // Validation logic to prevent bootloops from corrupted state
        let safeStep = parsedState.currentStep ?? AppStep.MarketResearch;
        
        // If we are past outline step but have no outline, reset to start
        if (safeStep > AppStep.MarketResearch && (!parsedState.bookOutline || !Array.isArray(parsedState.bookOutline.tableOfContents))) {
            console.warn("Corrupted state detected: Missing outline. Resetting to Market Research.");
            safeStep = AppStep.MarketResearch;
            parsedState.bookOutline = null;
        }

        setCurrentStep(safeStep);
        setMarketReport(parsedState.marketReport ?? null);
        setHasViewedReport(parsedState.hasViewedReport ?? false);
        setBookOutline(parsedState.bookOutline ?? null);
        setPagesPerChapter(parsedState.pagesPerChapter ?? '3-5 pages (medium)');
        setBookCoverUrl(parsedState.bookCoverUrl ?? null);
        setGenreSuggestions(parsedState.genreSuggestions ?? null);
        setTopicSuggestions(parsedState.topicSuggestions ?? null);
        setSelectedGenre(parsedState.selectedGenre ?? null);
        setAuthorProfile(parsedState.authorProfile ?? null);
        setKdpMarketingInfo(parsedState.kdpMarketingInfo ?? null);
      }
    } catch (e) {
      console.error("Failed to load progress from localStorage", e);
      setError("Could not load your saved session. Starting fresh.");
      // If error occurs, clear storage to prevent persistent crash
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Save progress to localStorage whenever it changes
  useEffect(() => {
    if (mode === AppMode.Single) {
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
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
        } catch (e) {
          console.error("Failed to save progress to localStorage", e);
          // Don't show error to user for this, just log it.
        }
    }
  }, [mode, currentStep, marketReport, hasViewedReport, bookOutline, pagesPerChapter, bookCoverUrl, genreSuggestions, topicSuggestions, selectedGenre, authorProfile, kdpMarketingInfo]);

  const handleSaveAuthorProfile = (profile: AuthorProfile) => {
    setAuthorProfile(profile);
    setIsAuthorModalOpen(false);
  };
  
  const handleResetProgress = () => {
    if (window.confirm("Are you sure you want to reset all progress? This action cannot be undone.")) {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (e) {
            console.error("Failed to clear localStorage", e);
        }
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

    if (bookOutline) { // Using bookOutline as a proxy for an existing project
        if (window.confirm("This will clear your current book project and start a new one. Are you sure you want to continue?")) {
            startNew();
        }
    } else {
        // No existing project, just start
        startNew();
    }
  };

  const handleFetchGenres = useCallback(async () => {
    setIsLoading(true);
    try {
      const genres = await geminiService.getHotGenres();
      setGenreSuggestions(genres);
    } catch (e) {
      console.error(e);
      setError('Failed to research genres. Please check your API key and try again.');
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
      setError('Failed to brainstorm topics. Please try again.');
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
        setHasViewedReport(false); // Ensure the report is shown
        setCurrentStep(AppStep.Outline);
      } catch (e) {
        console.error(e);
        setError('Failed to generate market report. Please try again.');
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
      setError('Failed to generate book outline. Please try again.');
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
      setBookOutline(prev => {
        if (!prev) return null;
        return { ...prev, title, subtitle };
      });
    } catch (e) {
        console.error(e);
        setError('Failed to regenerate title. Please try again.');
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
        // If instructions exist, we use the Grand Master editing mode.
        // If no instructions but currentContent exists, we treat it as a standard guided regen (without specific strict orders).
        // If no content, generate from scratch.
        if (currentContent && currentContent.trim().length > 0) {
            content = await geminiService.regenerateChapterWithGuidance(
                chapter.title, 
                chapter.summary, 
                currentContent, 
                pagesPerChapter,
                instructions // New parameter for the "God-like" edit
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
      setError(`Failed to generate image prompt for Chapter ${chapter.chapter}.`);
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
        // Toggle style off if the same one is clicked again
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

  const handleGenerateFullManuscript = useCallback(async () => {
    if (!bookOutline) return;
    setIsGeneratingFullManuscript(true);
    setFullManuscriptGenerationProgress('Initializing AI Grand Master...');
    setError(null);

    try {
        let currentToc = [...bookOutline.tableOfContents];
        
        for (let i = 0; i < currentToc.length; i++) {
            const chapter = currentToc[i];
            
            // 1. Generate content if it doesn't exist
            let content = chapter.content;
            if (!content) {
                setFullManuscriptGenerationProgress(`Writing Chapter ${chapter.chapter}: ${chapter.title}`);
                content = await geminiService.generateChapterContent(chapter.title, chapter.summary, pagesPerChapter);
                currentToc[i] = { ...currentToc[i], content };
                setBookOutline(prev => ({...prev!, tableOfContents: [...currentToc]}));
            }
            
            // 2. Generate image prompt
            setFullManuscriptGenerationProgress(`Designing illustration concept for Chapter ${chapter.chapter}...`);
            const imagePrompt = await geminiService.generateImagePrompt(content.substring(0, 500), chapter.illustrationStyle);
            currentToc[i] = { ...currentToc[i], imagePrompt };
            setBookOutline(prev => ({...prev!, tableOfContents: [...currentToc]}));

            // 3. Generate illustration
            setFullManuscriptGenerationProgress(`Creating illustration for Chapter ${chapter.chapter}...`);
            const imageUrl = await geminiService.generateIllustration(imagePrompt);
            currentToc[i] = { ...currentToc[i], imageUrl };
            setBookOutline(prev => ({...prev!, tableOfContents: [...currentToc]}));
        }

    } catch (e) {
        console.error(e);
        setError("The AI Grand Master encountered an issue. Please check the generated content and try again.");
    } finally {
        setIsGeneratingFullManuscript(false);
        setFullManuscriptGenerationProgress('');
    }
  }, [bookOutline, pagesPerChapter]);

  const handleGenerateCover = useCallback(async () => {
    if (!bookOutline || !authorProfile?.name) {
      setError("Please ensure you have a book outline and an author name in your profile before generating a cover.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
        const coverUrl = await geminiService.generateBookCover(bookOutline.title, bookOutline.subtitle, authorProfile.name);
        setBookCoverUrl(coverUrl);
    } catch (e) {
        console.error(e);
        setError("Failed to generate the book cover. Please try again.");
    } finally {
        setIsLoading(false);
    }
  }, [bookOutline, authorProfile]);

  const handleHumanizeBook = useCallback(async () => {
    if (!bookOutline) return;
    setIsHumanizing(true);
    setError(null);
    try {
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
    } catch (e) {
        console.error(e);
        setError("Failed to humanize the book content. Please try again.");
    } finally {
        setIsHumanizing(false);
    }
  }, [bookOutline]);

  const handleRegenerateWithFeedback = useCallback(async (feedback: string) => {
    if (!bookOutline) return;
    setIsRegeneratingWithFeedback(true);
    setError(null);
    try {
      const newOutline = await geminiService.regenerateFullBookWithFeedback(bookOutline, feedback);
      setBookOutline(newOutline);
    } catch (e) {
      console.error(e);
      setError("Failed to regenerate the book with your feedback. The AI may have returned an unexpected format.");
    } finally {
      setIsRegeneratingWithFeedback(false);
    }
  }, [bookOutline]);

  const handleGenerateKdpMarketingInfo = useCallback(async () => {
    if (!bookOutline || !marketReport) {
        setError("A market report and book outline are required to generate marketing materials.");
        return;
    };
    setIsGeneratingKdpMarketing(true);
    setError(null);
    try {
        const info = await geminiService.generateKdpMarketingInfo(marketReport, bookOutline);
        setKdpMarketingInfo(info);
    } catch (e) {
        console.error(e);
        setError("Failed to generate marketing materials. Please try again.");
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
            
            updateStatus('3/5: Writing manuscript...');
            let writtenChapters: Chapter[] = [];
            for (const [chapIdx, chapter] of outline.tableOfContents.entries()) {
                updateStatus(`3/5: Writing Ch. ${chapIdx + 1}/${outline.tableOfContents.length}`);
                const content = await geminiService.generateChapterContent(chapter.title, chapter.summary, '3-5 pages (medium)');
                writtenChapters.push({ ...chapter, content });
            }
            const outlineWithContent: BookOutline = { ...outline, tableOfContents: writtenChapters };

            updateStatus('4/5: Humanizing text...');
            let humanizedChapters: Chapter[] = [];
            for (const [chapIdx, chapter] of outlineWithContent.tableOfContents.entries()) {
                 updateStatus(`4/5: Humanizing Ch. ${chapIdx + 1}/${outlineWithContent.tableOfContents.length}`);
                if (chapter.content) {
                    const humanizedContent = await geminiService.humanizeChapterContent(chapter.content);
                    humanizedChapters.push({ ...chapter, content: humanizedContent });
                } else {
                    humanizedChapters.push(chapter);
                }
            }
            const finalOutline: BookOutline = { ...outlineWithContent, tableOfContents: humanizedChapters };
            
            updateStatus('5/5: Designing book cover...');
            const coverUrl = await geminiService.generateBookCover(finalOutline.title, finalOutline.subtitle, authorProfile?.name || 'The Author');
            
            updateStatus('Complete', { finalOutline, coverUrl });
            
            // Add a cool-down delay between books to prevent rate limiting/network congestion
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

  const renderCurrentStep = () => {
    if (isLoading && !marketReport && currentStep === AppStep.MarketResearch) {
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
    }
    
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
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans p-4 sm:p-6 md:p-8">
      {isAuthorModalOpen && (
        <AuthorProfileModal
          profile={authorProfile}
          onSave={handleSaveAuthorProfile}
          onClose={() => setIsAuthorModalOpen(false)}
          bookOutline={bookOutline}
          marketReport={marketReport}
        />
      )}
      <div className="max-w-7xl mx-auto">
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
        
        <footer className="text-center mt-12 flex justify-center gap-4">
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
    </div>
  );
}

export default App;