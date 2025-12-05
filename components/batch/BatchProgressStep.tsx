import React from 'react';
import { BatchProject } from '../../types';
import Card from '../shared/Card';
import LoadingSpinner from '../shared/LoadingSpinner';

interface BatchProgressStepProps {
    projects: BatchProject[];
}

const BatchProgressStep: React.FC<BatchProgressStepProps> = ({ projects }) => {
    return (
        <div className="w-full max-w-5xl mx-auto">
            <Card>
                <h2 className="text-3xl font-bold text-center text-violet-400 mb-2 font-serif">Batch Production Progress</h2>
                <p className="text-slate-400 text-center mb-8">
                    Your AI agents are hard at work. You can monitor the progress of each book below.
                </p>
                <div className="space-y-4">
                    {projects.map((project) => (
                        <Card key={project.id} className="bg-slate-800/80 flex flex-col sm:flex-row items-center gap-4">
                            <div className="w-24 h-32 bg-slate-700 rounded-md flex-shrink-0 flex items-center justify-center overflow-hidden border-2 border-slate-600">
                                {project.coverUrl ? (
                                    <img src={project.coverUrl} alt={`Cover for ${project.title}`} className="w-full h-full object-cover" />
                                ) : project.status.startsWith('5/5') || project.status === 'Complete' ? (
                                    <LoadingSpinner size="sm" />
                                ) : (
                                    <div className="text-xs text-slate-500 p-1 text-center">Cover</div>
                                )}
                            </div>
                            <div className="flex-grow text-center sm:text-left">
                                <h3 className="font-bold text-slate-200">{project.title}</h3>
                                <p className="text-xs text-slate-400 italic">{project.subtitle}</p>
                                <div className="mt-2">
                                    {project.status === 'Complete' ? (
                                        <p className="text-emerald-400 font-semibold">✅ Generation Complete</p>
                                    ) : project.status === 'Error' ? (
                                        <p className="text-red-400 font-semibold">❌ Error: {project.error}</p>
                                    ) : (
                                        <>
                                            <div className="w-full bg-slate-700 rounded-full h-2.5 my-1">
                                                <div 
                                                    className="bg-violet-600 h-2.5 rounded-full transition-all duration-500" 
                                                    style={{ width: `${(parseInt(project.status[0], 10) / 5) * 100}%` }}
                                                ></div>
                                            </div>
                                            <p className="text-sm text-violet-300 animate-pulse">{project.status}</p>
                                        </>
                                    )}
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            </Card>
        </div>
    );
};

export default BatchProgressStep;
