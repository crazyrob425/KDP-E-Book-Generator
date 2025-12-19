import React, { useState, useEffect } from 'react';
import { BookOutline, AudiobookConfig } from '../../types';
import Button from '../shared/Button';
import { getVoices, generateSpeech, estimateCost } from '../../services/audioService';

interface AudioProductionPanelProps {
    bookOutline: BookOutline;
}

const AudioProductionPanel: React.FC<AudioProductionPanelProps> = ({ bookOutline }) => {
    const [config, setConfig] = useState<AudiobookConfig>({
        provider: 'openai',
        voiceId: 'alloy',
        apiKey: ''
    });
    
    const [voices, setVoices] = useState<{id: string, name: string}[]>([]);
    const [isLoadingVoices, setIsLoadingVoices] = useState(false);
    
    // Voice fetching
    useEffect(() => {
        if ((config.provider === 'elevenlabs' && config.apiKey) || config.provider === 'openai') {
            setIsLoadingVoices(true);
            getVoices(config).then(setVoices).finally(() => setIsLoadingVoices(false));
        }
    }, [config.provider, config.apiKey]);
    
    const [previewText, setPreviewText] = useState("This is how your audiobook will sound. The quick brown fox jumps over the lazy dog.");
    const [isPlaying, setIsPlaying] = useState(false);

    const handlePreview = async () => {
        if (!config.apiKey) {
            alert("Please enter an API Key first.");
            return;
        }
        setIsPlaying(true);
        try {
            const buffer = await generateSpeech(previewText, config);
            const blob = new Blob([buffer], { type: 'audio/mpeg' });
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.play();
            audio.onended = () => setIsPlaying(false);
        } catch (e) {
            console.error(e);
            alert("Failed to generate audio preview. Check API Key.");
            setIsPlaying(false);
        }
    };
    
    const totalChars = bookOutline.tableOfContents.reduce((acc, ch) => acc + (ch.content?.length || 0), 0);
    const estimatedPrice = estimateCost('a'.repeat(totalChars), config.provider);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <label className="block text-sm font-medium text-slate-300">Provider</label>
                    <div className="flex gap-4">
                        <label className={`flex-1 p-3 border rounded-md cursor-pointer ${config.provider === 'openai' ? 'bg-indigo-900/40 border-indigo-500' : 'bg-slate-800 border-slate-700'}`}>
                            <input type="radio" className="sr-only" name="provider" checked={config.provider === 'openai'} onChange={() => setConfig({...config, provider: 'openai', voiceId: 'alloy'})} />
                            <div className="font-bold">OpenAI Audio</div>
                            <div className="text-xs text-slate-400">High quality, lower cost</div>
                        </label>
                        <label className={`flex-1 p-3 border rounded-md cursor-pointer ${config.provider === 'elevenlabs' ? 'bg-indigo-900/40 border-indigo-500' : 'bg-slate-800 border-slate-700'}`}>
                            <input type="radio" className="sr-only" name="provider" checked={config.provider === 'elevenlabs'} onChange={() => setConfig({...config, provider: 'elevenlabs', voiceId: ''})} />
                             <div className="font-bold">ElevenLabs</div>
                            <div className="text-xs text-slate-400">Ultra-realistic, premium</div>
                        </label>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">API Key</label>
                        <input 
                            type="password" 
                            value={config.apiKey} 
                            onChange={e => setConfig({...config, apiKey: e.target.value})}
                            placeholder={`Enter your ${config.provider === 'openai' ? 'OpenAI' : 'ElevenLabs'} API Key`}
                            className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm"
                        />
                         <p className="text-xs text-slate-500 mt-1">Keys are never stored on our server.</p>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Select Voice</label>
                        <select 
                            value={config.voiceId}
                            onChange={e => setConfig({...config, voiceId: e.target.value})}
                            disabled={voices.length === 0}
                            className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm"
                        >
                            {voices.length === 0 && <option>Enter API Key to load voices...</option>}
                            {voices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                    </div>
                </div>

                <div className="bg-slate-900/50 p-4 rounded-lg space-y-4">
                    <h4 className="text-sm font-bold text-slate-300">Preview & Cost</h4>
                    <textarea 
                        value={previewText}
                        onChange={e => setPreviewText(e.target.value)}
                        rows={3}
                        className="w-full bg-slate-800 border border-slate-700 rounded-md p-2 text-sm"
                    />
                    <Button onClick={handlePreview} disabled={isPlaying} variant="secondary" className="w-full">
                        {isPlaying ? 'Playing...' : 'Test Voice'}
                    </Button>
                    
                    <div className="border-t border-slate-700 pt-4 mt-4">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-400">Total Characters:</span>
                            <span className="text-white">{totalChars.toLocaleString()}</span>
                        </div>
                         <div className="flex justify-between text-sm mt-2">
                            <span className="text-slate-400">Estimated Cost:</span>
                            <span className="text-emerald-400 font-bold">${estimatedPrice.toFixed(2)}</span>
                        </div>
                    </div>
                    
                     <Button className="w-full bg-amber-600 hover:bg-amber-500 text-white mt-4" disabled>
                        Generate Full Audiobook (Coming Soon)
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default AudioProductionPanel;
