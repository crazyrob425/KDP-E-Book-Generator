
import React, { useState, useEffect } from 'react';
import { BookOutline, Chapter, GenerationSettings } from '../../types';
import Button from '../shared/Button';
import Card from '../shared/Card';
import { SparklesIcon, PhotoIcon, BookOpenIcon, ArrowPathIcon, PencilSquareIcon, XIcon, AcademicCapIcon } from '../icons';
import LoadingSpinner from '../shared/LoadingSpinner';
import Modal from '../shared/Modal';
import * as geminiService from '../../services/geminiService';
import GenerationSettingsPanel from './content/GenerationSettingsPanel';
import TokenDashboard from '../shared/TokenDashboard';

interface ContentGenerationStepProps {
  outline: BookOutline | null;
  onGenerateChapter: (chapterIndex: number, currentContent?: string, instructions?: string) => void;
  updateChapterContent: (chapterIndex: number, content: string) => void;
  chapterLoadingStates: { [key: number]: boolean };
  onGenerateImagePrompt: (chapterIndex: number) => void;
  onUpdateImagePrompt: (chapterIndex: number, prompt: string) => void;
  onGenerateIllustration: (chapterIndex: number) => void;
  onGenerateFullManuscript: () => void;
  isGeneratingFullManuscript: boolean;
  fullManuscriptGenerationProgress: string;
  onUpdateChapterStyle: (chapterIndex: number, style: string) => void;
  generationSettings?: GenerationSettings;
  onGenerationSettingsChange?: (settings: GenerationSettings) => void;
  tokenDashboardKey?: number;
}

const illustrationStyles = [
  { name: 'Cinematic', description: 'Dramatic, realistic lighting and epic feel.', icon: '🎬' },
  { name: 'Watercolor', description: 'Soft, blended colors with a hand-painted look.', icon: '🎨' },
  { name: 'Anime', description: 'Vibrant colors and expressive characters.', icon: '🌸' },
  { name: 'Vector Art', description: 'Clean lines and a modern, graphic style.', icon: '✒️' },
  { name: 'Photorealistic', description: 'Indistinguishable from a photograph.', icon: '📷' },
  { name: 'Fantasy Art', description: 'Epic, detailed, and imaginative.', icon: '🐲' },
  { name: 'Minimalist', description: 'Simple shapes and clean composition.', icon: '⚪' },
  { name: 'Ghibli-esque', description: 'Whimsical, detailed, and nostalgic.', icon: '🍃' }
];

const ContentGenerationStep: React.FC<ContentGenerationStepProps> = ({ 
  outline, 
  onGenerateChapter, 
  updateChapterContent, 
  chapterLoadingStates,
  onGenerateImagePrompt,
  onUpdateImagePrompt,
  onGenerateIllustration,
  onGenerateFullManuscript,
  isGeneratingFullManuscript,
  fullManuscriptGenerationProgress,
  onUpdateChapterStyle,
  generationSettings,
  onGenerationSettingsChange,
  tokenDashboardKey,
}) => {
  const [activeChapterIndex, setActiveChapterIndex] = useState<number | null>(0);
  const [editedContent, setEditedContent] = useState<string>('');
  
  // State for Guided Regeneration Modal
  const [isGuidanceModalOpen, setIsGuidanceModalOpen] = useState(false);
  const [guidanceInstructions, setGuidanceInstructions] = useState('');

  // State for Critic Modal
  const [isCriticModalOpen, setIsCriticModalOpen] = useState(false);
  const [critiqueText, setCritiqueText] = useState<string | null>(null);
  const [isGeneratingCritique, setIsGeneratingCritique] = useState(false);
  const [isApplyingCritique, setIsApplyingCritique] = useState(false);

  const activeChapter = activeChapterIndex !== null && outline ? outline.tableOfContents[activeChapterIndex] : null;

  useEffect(() => {
    if (activeChapter) {
      setEditedContent(activeChapter.content || '');
    } else if (outline && outline.tableOfContents.length > 0) {
        // Default to the first chapter if nothing is selected
        setActiveChapterIndex(0);
    }
  }, [activeChapter, outline]);

   useEffect(() => {
    if (activeChapter?.content) {
      setEditedContent(activeChapter.content);
    }
  }, [activeChapter?.content]);

  const handleSave = () => {
    if (activeChapterIndex !== null) {
      updateChapterContent(activeChapterIndex, editedContent);
    }
  };

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (activeChapterIndex !== null) {
      onUpdateImagePrompt(activeChapterIndex, e.target.value);
    }
  };

  const openGuidanceModal = () => {
      setGuidanceInstructions('');
      setIsGuidanceModalOpen(true);
  };

  const handleGuidedRegeneration = () => {
      if (activeChapterIndex !== null) {
          onGenerateChapter(activeChapterIndex, editedContent, guidanceInstructions);
          setIsGuidanceModalOpen(false);
      }
  };

  const handleConsultCritic = async () => {
      if (!activeChapter || !outline) return;
      setIsCriticModalOpen(true);
      setIsGeneratingCritique(true);
      setCritiqueText(null);
      try {
          const critique = await geminiService.generateLiteraryCritique(activeChapter.title, editedContent, outline);
          setCritiqueText(critique);
      } catch (error) {
          console.error("Failed to generate critique", error);
          setCritiqueText("The Grand Master Scholar is currently unavailable. Please try again.");
      } finally {
          setIsGeneratingCritique(false);
      }
  };

  const handleApplyCritique = async () => {
      if (!activeChapter || !critiqueText) return;
      setIsApplyingCritique(true);
      try {
          const newContent = await geminiService.applyLiteraryCritique(activeChapter.title, editedContent, critiqueText);
          updateChapterContent(activeChapterIndex!, newContent);
          setEditedContent(newContent);
          setIsCriticModalOpen(false);
      } catch (error) {
          console.error("Failed to apply critique", error);
          alert("Failed to apply improvements. Please try again.");
      } finally {
          setIsApplyingCritique(false);
      }
  };
  
  if (!outline) {
    return <Card><p>Please complete the outline step first.</p></Card>;
  }

  if (isGeneratingFullManuscript) {
    return (
        <Card className="w-full max-w-2xl mx-auto flex flex-col items-center gap-6">
            <h2 className="text-3xl font-bold text-center text-violet-400 mb-2 font-serif">AI Grand Master at Work</h2>
            <LoadingSpinner size="lg" message={fullManuscriptGenerationProgress} />
            <p className="text-slate-400 text-center">Please keep this window open. This process may take several minutes.</p>
        </Card>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto">
        {isGuidanceModalOpen && (
            <Modal onClose={() => setIsGuidanceModalOpen(false)}>
                <div className="w-full max-w-2xl bg-slate-800 p-0 rounded-lg overflow-hidden border border-amber-500/50 shadow-2xl">
                    <div className="bg-gradient-to-r from-amber-900/50 to-slate-900 p-6 border-b border-amber-500/30 flex justify-between items-center">
                        <div>
                            <h3 className="text-2xl font-bold text-amber-400 font-serif flex items-center gap-2">
                                <SparklesIcon className="w-6 h-6" />
                                Director's Mode: God-Like Edit
                            </h3>
                            <p className="text-sm text-slate-300">Instruct the Grand Master to rewrite this chapter with surgical precision.</p>
                        </div>
                         <button onClick={() => setIsGuidanceModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="bg-slate-900/50 p-4 rounded-md border-l-4 border-emerald-500">
                             <p className="text-sm text-slate-300">
                                <span className="font-bold text-emerald-400">System Note:</span> The AI will read your current draft (including all manual edits you've made) and preserve your creative intent while applying your new instructions below.
                             </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-amber-200 mb-2">
                                Your Orders (Additions, Subtractions, Tone Shifts)
                            </label>
                            <textarea
                                value={guidanceInstructions}
                                onChange={(e) => setGuidanceInstructions(e.target.value)}
                                className="w-full h-40 p-4 bg-slate-900 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-200 resize-none"
                                placeholder="e.g., 'Make the dialogue between John and Jane more aggressive. ADD a scene where a black cat crosses their path. REMOVE the paragraph about the weather. Keep the tone dark and suspenseful.'"
                            />
                        </div>
                    </div>
                    <div className="p-4 bg-slate-900/80 border-t border-slate-700 flex justify-end gap-3">
                         <Button variant="secondary" onClick={() => setIsGuidanceModalOpen(false)}>Cancel</Button>
                         <Button onClick={handleGuidedRegeneration} disabled={!guidanceInstructions.trim()} className="bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 border border-amber-500/50 text-white font-bold shadow-amber-900/20 shadow-lg">
                            <SparklesIcon className="w-5 h-5" />
                            Execute God-Like Edit
                         </Button>
                    </div>
                </div>
            </Modal>
        )}

        {isCriticModalOpen && (
            <Modal onClose={() => setIsCriticModalOpen(false)}>
                <div className="w-full max-w-3xl bg-slate-800 p-0 rounded-lg overflow-hidden border border-cyan-500/50 shadow-2xl">
                    <div className="bg-gradient-to-r from-cyan-900/50 to-slate-900 p-6 border-b border-cyan-500/30 flex justify-between items-center">
                        <div>
                            <h3 className="text-2xl font-bold text-cyan-400 font-serif flex items-center gap-2">
                                <AcademicCapIcon className="w-8 h-8" />
                                The Grand Master Scholar
                            </h3>
                            <p className="text-sm text-slate-300">Constructive criticism and literary analysis.</p>
                        </div>
                         <button onClick={() => setIsCriticModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>
                    <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                        {isGeneratingCritique ? (
                            <div className="py-12">
                                <LoadingSpinner message="Reading deeply and formulating critique..." size="lg"/>
                            </div>
                        ) : (
                            <div className="prose prose-invert max-w-none">
                                {/* Simple rendering of the markdown critique */}
                                {critiqueText?.split('\n').map((line, i) => (
                                    <p key={i} className={line.startsWith('**') || line.startsWith('##') ? "font-bold text-cyan-200 mt-4" : "text-slate-300"}>
                                        {line}
                                    </p>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="p-4 bg-slate-900/80 border-t border-slate-700 flex justify-end gap-3">
                         <Button variant="secondary" onClick={() => setIsCriticModalOpen(false)} disabled={isApplyingCritique}>Close</Button>
                         {!isGeneratingCritique && critiqueText && (
                             <Button onClick={handleApplyCritique} disabled={isApplyingCritique} className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 border border-cyan-500/50 text-white font-bold shadow-cyan-900/20 shadow-lg">
                                {isApplyingCritique ? (
                                    <>
                                        <LoadingSpinner size="sm" />
                                        Applying Improvements...
                                    </>
                                ) : (
                                    <>
                                        <SparklesIcon className="w-5 h-5" />
                                        Auto-Apply Improvements
                                    </>
                                )}
                             </Button>
                         )}
                    </div>
                </div>
            </Modal>
        )}

        <Card className="mb-8 bg-gradient-to-br from-violet-900/80 to-emerald-900/50 border-violet-600">
             <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
                <div>
                    <h3 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-300 to-emerald-300 font-serif">AI Grand Master</h3>
                    <p className="text-slate-300 mt-1">Generate the entire manuscript and all illustrations with a single click.</p>
                </div>
                <Button onClick={onGenerateFullManuscript} className="px-8 py-3 text-lg">
                    <SparklesIcon className="w-6 h-6" />
                    Generate Full Book
                </Button>
             </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-1 h-fit">
                <h3 className="text-xl font-bold text-emerald-400 mb-4 font-serif">Chapters</h3>
                <nav className="space-y-2">
                    {outline.tableOfContents.map((chapter, index) => (
                        <button
                            key={chapter.chapter}
                            onClick={() => setActiveChapterIndex(index)}
                            className={`w-full text-left p-3 rounded-md transition-all duration-200 flex items-center gap-3 ${
                                activeChapterIndex === index 
                                ? 'bg-violet-600 text-white shadow-lg' 
                                : 'bg-slate-700 hover:bg-slate-600'
                            }`}
                        >
                            <div className={`w-2 h-2 rounded-full ${chapter.content ? 'bg-emerald-400' : 'bg-slate-500'}`}></div>
                            <span>{chapter.chapter}. {chapter.title}</span>
                        </button>
                    ))}
                </nav>

                {/* Generation Settings Panel */}
                {generationSettings && onGenerationSettingsChange && (
                  <div className="mt-6">
                    <GenerationSettingsPanel
                      settings={generationSettings}
                      onChange={onGenerationSettingsChange}
                    />
                  </div>
                )}

                {/* Token Dashboard */}
                <div className="mt-4">
                  <TokenDashboard refreshKey={tokenDashboardKey} />
                </div>
            </Card>

            <div className="lg:col-span-2">
                {activeChapter ? (
                    <Card>
                        <h2 className="text-3xl font-bold text-violet-400 mb-2 font-serif">{activeChapter.title}</h2>
                        <p className="text-slate-400 italic mb-6">{activeChapter.summary}</p>

                        <div className="space-y-6">
                            {/* Content Section */}
                            <div>
                                <h3 className="text-lg font-semibold text-emerald-400 mb-2 flex items-center gap-2">
                                    <BookOpenIcon className="w-5 h-5" /> Chapter Content
                                </h3>
                                {chapterLoadingStates[activeChapter.chapter] ? (
                                    <LoadingSpinner message="Writing..." />
                                ) : activeChapter.content ? (
                                    <>
                                        <textarea
                                            value={editedContent}
                                            onChange={(e) => setEditedContent(e.target.value)}
                                            className="w-full h-80 p-4 bg-slate-900/50 border border-slate-700 rounded-md resize-y text-slate-300 focus:ring-2 focus:ring-violet-500 focus:outline-none font-serif leading-relaxed"
                                            aria-label="Chapter content editor"
                                            placeholder="Edit the chapter content here. Your manual edits will be preserved when using 'Director's Mode'."
                                        />
                                        <div className="flex flex-wrap gap-2 mt-4 items-center justify-between">
                                            <div className="flex gap-2">
                                                <Button onClick={handleSave}>Save Changes</Button>
                                                <Button onClick={() => onGenerateChapter(activeChapterIndex!, editedContent)} variant="secondary" title="Standard Regeneration (Clears specific styling)">
                                                    <ArrowPathIcon className="w-5 h-5"/> Quick Regen
                                                </Button>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button 
                                                    onClick={handleConsultCritic}
                                                    className="bg-cyan-800 hover:bg-cyan-700 text-white border border-cyan-500/50"
                                                    title="Get expert criticism and suggestions"
                                                >
                                                    <AcademicCapIcon className="w-5 h-5" /> Consult Critic
                                                </Button>
                                                <Button 
                                                    onClick={openGuidanceModal} 
                                                    className="bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 text-white font-bold border border-amber-400/30"
                                                    title="Advanced regeneration that obeys your manual edits and instructions"
                                                >
                                                    <SparklesIcon className="w-5 h-5"/> Director's Mode
                                                </Button>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <Button onClick={() => onGenerateChapter(activeChapterIndex!)}>
                                        <SparklesIcon className="w-5 h-5" /> Generate Content
                                    </Button>
                                )}
                            </div>
                            
                            {/* Illustration Section */}
                            {activeChapter.content && (
                                <div className="pt-6 border-t border-slate-700">
                                    <h3 className="text-lg font-semibold text-emerald-400 mb-2 flex items-center gap-2">
                                        <PhotoIcon className="w-5 h-5" /> Chapter Illustration
                                    </h3>
                                    
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-slate-300 mb-2">Choose an Illustration Style (Optional)</label>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            {illustrationStyles.map(style => (
                                                <button
                                                    key={style.name}
                                                    onClick={() => onUpdateChapterStyle(activeChapterIndex!, style.name)}
                                                    className={`p-2 rounded-md text-center transition-all duration-200 text-sm ${
                                                        activeChapter.illustrationStyle === style.name
                                                            ? 'bg-violet-600 text-white font-semibold ring-2 ring-violet-400'
                                                            : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                                                    }`}
                                                    title={style.description}
                                                >
                                                    <span className="text-xl" role="img" aria-label={style.name}>{style.icon}</span>
                                                    <span className="block mt-1 font-semibold">{style.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-300 mb-1">Image Prompt</label>
                                            {activeChapter.isGeneratingPrompt ? (
                                                <LoadingSpinner size="sm" />
                                            ) : activeChapter.imagePrompt ? (
                                                 <textarea
                                                    value={activeChapter.imagePrompt}
                                                    onChange={handlePromptChange}
                                                    className="w-full h-32 p-2 bg-slate-900/50 border border-slate-700 rounded-md resize-y text-slate-400 text-sm"
                                                    aria-label="Image prompt editor"
                                                />
                                            ) : (
                                                <Button onClick={() => onGenerateImagePrompt(activeChapterIndex!)} variant="secondary" className="w-full">
                                                    <SparklesIcon className="w-5 h-5" /> Generate Prompt
                                                </Button>
                                            )}
                                        </div>
                                        <div className="flex flex-col items-center gap-2">
                                             <div className="w-full h-48 bg-slate-700 rounded-md flex items-center justify-center overflow-hidden">
                                                {activeChapter.isGeneratingImage ? (
                                                    <LoadingSpinner size="sm" />
                                                ) : activeChapter.imageUrl ? (
                                                    <img src={activeChapter.imageUrl} alt={`Illustration for ${activeChapter.title}`} className="w-full h-full object-cover" />
                                                ) : (
                                                    <p className="text-xs text-slate-500">Image will appear here</p>
                                                )}
                                            </div>
                                            <Button onClick={() => onGenerateIllustration(activeChapterIndex!)} disabled={!activeChapter.imagePrompt || activeChapter.isGeneratingImage} className="w-full">
                                                <PhotoIcon className="w-5 h-5" /> {activeChapter.imageUrl ? 'Regenerate' : 'Generate'} Image
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>
                ) : (
                    <Card className="flex flex-col items-center justify-center h-full text-center">
                        <BookOpenIcon className="w-16 h-16 text-slate-600" />
                        <h2 className="mt-4 text-xl font-semibold text-slate-400">Select a chapter to begin</h2>
                        <p className="text-slate-500">Choose a chapter from the list to write, edit, and illustrate.</p>
                    </Card>
                )}
            </div>
        </div>
    </div>
  );
};

export default ContentGenerationStep;
