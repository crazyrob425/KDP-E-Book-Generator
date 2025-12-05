import React, { useState } from 'react';
import { BatchSettings } from '../../types';
import Card from '../shared/Card';
import Button from '../shared/Button';
import LoadingSpinner from '../shared/LoadingSpinner';
import * as geminiService from '../../services/geminiService';
import { SparklesIcon } from '../icons';

const pageRanges = [
  '30-50 pages', '55-120 pages', '120-175 pages', '175-300 pages', '300-500 pages'
];

interface BatchSetupStepProps {
    onStartBatch: (projects: { title: string, subtitle: string }[], settings: { genre: string, pageRange: string }) => Promise<void>;
}

const BatchSetupStep: React.FC<BatchSetupStepProps> = ({ onStartBatch }) => {
    const [settings, setSettings] = useState<BatchSettings>({
        genre: 'Sci-Fi',
        pageRange: pageRanges[1],
        numTitles: 2,
        numSequels: 1,
    });
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [titles, setTitles] = useState<{ title: string, subtitle: string }[]>([]);

    const handleSettingsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setSettings(prev => ({...prev, [name]: name === 'numTitles' || name === 'numSequels' ? parseInt(value, 10) : value }));
    };

    const handleGenerateTitles = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            const generatedTitles = await geminiService.generateBatchTitles(settings.genre, settings.numTitles);
            setTitles(generatedTitles);
            setStep(2);
        } catch (err) {
            console.error(err);
            setError('Failed to generate titles. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleTitleChange = (index: number, field: 'title' | 'subtitle', value: string) => {
        const newTitles = [...titles];
        newTitles[index][field] = value;
        setTitles(newTitles);
    };

    const handleStartGeneration = () => {
        const projectsToGenerate: { title: string, subtitle: string }[] = [];
        titles.forEach(mainTitle => {
            projectsToGenerate.push(mainTitle); // Add the main book
            for (let i = 1; i <= settings.numSequels; i++) {
                projectsToGenerate.push({
                    title: `${mainTitle.title}: Book ${i + 1}`,
                    subtitle: `${mainTitle.subtitle} (Part ${i + 1})`
                });
            }
        });
        onStartBatch(projectsToGenerate, { genre: settings.genre, pageRange: settings.pageRange });
    }

    if (isLoading) {
        return <Card className="max-w-2xl mx-auto"><LoadingSpinner message="Brainstorming titles..." size="lg" /></Card>;
    }

    if (step === 2) {
         return (
             <Card className="max-w-4xl mx-auto">
                 <h2 className="text-3xl font-bold text-center text-violet-400 mb-2 font-serif">Step 2: Confirm Your Titles</h2>
                 <p className="text-slate-400 text-center mb-6">Review, edit, and confirm the generated titles for your book series.</p>
                 <div className="space-y-4">
                     {titles.map((t, index) => (
                         <Card key={index} className="bg-slate-700/50">
                             <label className="text-sm font-medium text-slate-300">Title {index + 1}</label>
                             <input type="text" value={t.title} onChange={e => handleTitleChange(index, 'title', e.target.value)} className="w-full mt-1 mb-2 px-3 py-2 bg-slate-800 border border-slate-600 rounded-md" />
                             <label className="text-sm font-medium text-slate-300">Subtitle {index + 1}</label>
                             <input type="text" value={t.subtitle} onChange={e => handleTitleChange(index, 'subtitle', e.target.value)} className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-md" />
                         </Card>
                     ))}
                 </div>
                 <div className="mt-8 flex justify-center gap-4">
                     <Button variant="secondary" onClick={() => setStep(1)}>Back to Settings</Button>
                     <Button onClick={handleStartGeneration}>
                         Start Generation ({titles.length * (settings.numSequels + 1)} Books)
                    </Button>
                 </div>
             </Card>
         );
    }

    return (
        <Card className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-violet-400 mb-2 font-serif">Step 1: Configure Batch</h2>
            <p className="text-slate-400 text-center mb-6">Define the parameters for your book series generation.</p>
            {error && <p className="text-red-400 text-center mb-4">{error}</p>}
            <form onSubmit={handleGenerateTitles} className="space-y-4">
                <div>
                    <label htmlFor="genre" className="block text-sm font-medium text-slate-300 mb-1">Book Genre</label>
                    <input type="text" id="genre" name="genre" value={settings.genre} onChange={handleSettingsChange} className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-md" />
                </div>
                <div>
                    <label htmlFor="pageRange" className="block text-sm font-medium text-slate-300 mb-1">Desired Page Count</label>
                    <select id="pageRange" name="pageRange" value={settings.pageRange} onChange={handleSettingsChange} className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-md">
                        {pageRanges.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                         <label htmlFor="numTitles" className="block text-sm font-medium text-slate-300 mb-1"># of Unique Series</label>
                         <input type="number" id="numTitles" name="numTitles" value={settings.numTitles} min="1" max="10" onChange={handleSettingsChange} className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-md" />
                    </div>
                    <div>
                        <label htmlFor="numSequels" className="block text-sm font-medium text-slate-300 mb-1"># of Sequels per Series</label>
                        <input type="number" id="numSequels" name="numSequels" value={settings.numSequels} min="0" max="5" onChange={handleSettingsChange} className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-md" />
                    </div>
                </div>
                <div className="pt-4 flex justify-center">
                    <Button type="submit" className="px-8 py-3 text-lg">
                        <SparklesIcon className="w-6 h-6" />
                        Generate & Confirm Titles
                    </Button>
                </div>
            </form>
        </Card>
    );
};

export default BatchSetupStep;
