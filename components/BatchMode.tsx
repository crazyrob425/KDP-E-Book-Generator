import React from 'react';
import BatchSetupStep from './batch/BatchSetupStep';
import BatchProgressStep from './batch/BatchProgressStep';
import { BatchProject } from '../types';
import { SparklesIcon } from './icons';

interface BatchModeProps {
    onExit: () => void;
    onStartBatch: (projects: { title: string, subtitle: string }[], settings: { genre: string, pageRange: string }) => Promise<void>;
    projects: BatchProject[];
    isRunning: boolean;
}

const BatchMode: React.FC<BatchModeProps> = ({ onExit, onStartBatch, projects, isRunning }) => {
    return (
        <div className="min-h-screen bg-slate-900 text-slate-200 font-sans p-4 sm:p-6 md:p-8">
            <div className="max-w-7xl mx-auto">
                <header className="text-center relative">
                     <div className="absolute top-0 left-0">
                        <button onClick={onExit} className="text-slate-400 hover:text-white transition-colors">
                            &larr; Back to Single Mode
                        </button>
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-emerald-400 font-serif flex items-center justify-center gap-3">
                        <SparklesIcon className="w-10 h-10" />
                        Batch Production Mode
                    </h1>
                    <p className="mt-2 text-slate-400">Generate entire book series in a single run.</p>
                </header>
                <main className="mt-12">
                   {isRunning || projects.length > 0 ? (
                       <BatchProgressStep projects={projects} />
                   ) : (
                       <BatchSetupStep onStartBatch={onStartBatch} />
                   )}
                </main>
            </div>
        </div>
    );
};

export default BatchMode;
