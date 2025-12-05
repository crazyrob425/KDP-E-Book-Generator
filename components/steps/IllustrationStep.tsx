
import React from 'react';
import { Chapter } from '../../types';
import Button from '../shared/Button';
import Card from '../shared/Card';
import { SparklesIcon } from '../icons';
import LoadingSpinner from '../shared/LoadingSpinner';

interface IllustrationStepProps {
  chapters: Chapter[];
  onGenerateImage: (chapterIndex: number) => void;
}

const IllustrationStep: React.FC<IllustrationStepProps> = ({ chapters, onGenerateImage }) => {
  return (
    <div className="w-full max-w-5xl mx-auto">
      <Card>
        <h2 className="text-3xl font-bold text-center text-violet-400 mb-2 font-serif">Step 4: Design & Illustrate</h2>
        <p className="text-slate-400 text-center mb-8">
          Generate high-quality, royalty-free graphics for your chapters with our AI Book Designer.
        </p>
        <div className="space-y-6">
          {chapters.map((chapter, index) => (
            <Card key={index} className="bg-slate-900/50 flex flex-col md:flex-row items-center gap-6">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-emerald-400">Chapter {chapter.chapter}: {chapter.title}</h3>
                <p className="text-sm text-slate-400 mt-2 mb-4 line-clamp-3">
                  {chapter.content ? chapter.content : chapter.summary}
                </p>
                <Button 
                  onClick={() => onGenerateImage(index)} 
                  disabled={!chapter.content || chapter.isGeneratingImage}
                  className="text-sm py-1"
                >
                  {chapter.isGeneratingImage ? "Designing..." : (
                    <>
                      <SparklesIcon className="w-4 h-4" />
                      {chapter.imageUrl ? "Regenerate Image" : "Generate Image"}
                    </>
                  )}
                </Button>
              </div>
              <div className="w-48 h-48 bg-slate-700 rounded-md flex items-center justify-center overflow-hidden">
                {chapter.isGeneratingImage ? (
                  <LoadingSpinner size="sm" />
                ) : chapter.imageUrl ? (
                  <img src={chapter.imageUrl} alt={`Illustration for ${chapter.title}`} className="w-full h-full object-cover" />
                ) : (
                  <p className="text-xs text-slate-500 text-center p-2">No image generated yet</p>
                )}
              </div>
            </Card>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default IllustrationStep;
