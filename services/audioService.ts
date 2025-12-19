import { AudiobookConfig } from '../types';

// Pricing estimates (approximate)
const PRICING = {
    elevenlabs: 0.0003, // per char ($0.30 per 1000 chars)
    openai: 0.000015, // per char ($0.015 per 1000 chars)
};

export const estimateCost = (text: string, provider: 'elevenlabs' | 'openai'): number => {
    return text.length * PRICING[provider];
};

export const getVoices = async (config: AudiobookConfig): Promise<{id: string, name: string, previewUrl?: string}[]> => {
    if (config.provider === 'elevenlabs' && config.apiKey) {
        try {
            const response = await fetch('https://api.elevenlabs.io/v1/voices', {
                headers: { 'xi-api-key': config.apiKey }
            });
            const data = await response.json();
            return data.voices.map((v: any) => ({
                id: v.voice_id,
                name: `${v.name} (${v.labels?.accent || 'US'} ${v.labels?.gender || ''})`,
                previewUrl: v.preview_url
            }));
        } catch (e) {
            console.error("Failed to fetch ElevenLabs voices", e);
            return [];
        }
    } 
    
    if (config.provider === 'openai') {
        // OpenAI has fixed voices
        return [
            { id: 'alloy', name: 'Alloy (Neutral)' },
            { id: 'echo', name: 'Echo (Male)' },
            { id: 'fable', name: 'Fable (British)' },
            { id: 'onyx', name: 'Onyx (Deep Male)' },
            { id: 'nova', name: 'Nova (Female)' },
            { id: 'shimmer', name: 'Shimmer (Female)' }
        ];
    }
    
    return [];
};

export const generateSpeech = async (text: string, config: AudiobookConfig): Promise<ArrayBuffer> => {
    if (!config.apiKey) throw new Error("API Key required");

    if (config.provider === 'openai') {
        const response = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: config.model || 'tts-1-hd',
                input: text,
                voice: config.voiceId,
            })
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || "OpenAI TTS failed");
        }
        
        return await response.arrayBuffer();
    }

    if (config.provider === 'elevenlabs') {
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${config.voiceId}`, {
            method: 'POST',
            headers: {
                'xi-api-key': config.apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                model_id: config.model || "eleven_monolingual_v1",
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75
                }
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail?.message || "ElevenLabs TTS failed");
        }

        return await response.arrayBuffer();
    }

    throw new Error("Invalid provider");
};
