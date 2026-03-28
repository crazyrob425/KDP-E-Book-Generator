import { MarketReport, GoogleTrendsData } from '../types';
import { getAi } from './geminiService';
import { GenerateContentResponse, Type } from "@google/genai";

/** Returns true when running inside an Electron window with the full IPC bridge. */
const hasElectron = (): boolean =>
    typeof window !== 'undefined' &&
    typeof (window as any).electronAPI !== 'undefined' &&
    typeof (window as any).electronAPI.fetchGoogleTrends === 'function';

export const generateRealMarketReport = async (topic: string, genre?: string): Promise<MarketReport> => {
    console.log(`Starting real market research for: ${topic}`);

    // 1. Fetch Google Trends Data (Electron only – graceful fallback for web)
    let trendsData: GoogleTrendsData | null = null;
    if (hasElectron()) {
        try {
            trendsData = await (window as any).electronAPI.fetchGoogleTrends(topic);
        } catch (e) {
            console.warn("Failed to fetch Google Trends:", e);
        }
    }

    // 2. Fetch Amazon Competitors (Electron only)
    let competitors: any[] = [];
    if (hasElectron()) {
        try {
            competitors = await (window as any).electronAPI.fetchAmazonCompetitors(topic);
        } catch (e) {
            console.warn("Failed to fetch Amazon competitors:", e);
        }
    }

    // 3. Fetch Amazon Suggestions (Electron only)
    let suggestions: string[] = [];
    if (hasElectron()) {
        try {
            suggestions = await (window as any).electronAPI.fetchAmazonSuggestions(topic);
        } catch (e) {
            console.warn("Failed to fetch Amazon suggestions:", e);
        }
    }

    // 4. Synthesize Report using Gemini (feeding it any real data we have)
    const hasRealData = trendsData || competitors.length > 0 || suggestions.length > 0;

    const prompt = hasRealData
        ? `
    Analyze the following REAL market data for the book topic "${topic}"${genre ? ` in genre "${genre}"` : ''}.
    
    **Google Trends Data:**
    ${trendsData ? JSON.stringify(trendsData.interestOverTime.slice(-12)) : "Not available"}
    
    **Top Amazon Competitors:**
    ${competitors.map(c => `- ${c.title} by ${c.author} (Rating: ${c.rating}, Reviews: ${c.reviewCount})`).join('\n') || 'Not available'}
    
    **Amazon Search Suggestions (Keywords):**
    ${suggestions.join(', ') || 'Not available'}

    Based on this REAL data, generate a comprehensive market report.
    - **Trend Analysis**: Interpret the trends data and competitor saturation.
    - **Target Audience**: Deduce from the competitor reviews and types.
    - **Keywords**: Select the best ones from suggestions + additional relevant terms.
    - **Competitor Analysis**: Summarize the success factors of the provided competitors.
    
    Return JSON matching the MarketReport schema.
    `
        : `
    Generate a comprehensive market report for a book about "${topic}"${genre ? ` in the genre "${genre}"` : ''}.
    Include trend analysis, target audience (demographics, interests, painPoints), high-value keywords,
    suggested book types (type, reasoning), and competitor analysis (title, successFactor).
    Also simulate google trends data showing interest over the past 12 months.
    Return JSON matching the MarketReport schema.
    `;

    const ai = getAi();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    trendAnalysis: { type: Type.STRING },
                    targetAudience: {
                        type: Type.OBJECT,
                        properties: {
                            demographics: { type: Type.STRING },
                            interests: { type: Type.STRING },
                            painPoints: { type: Type.STRING }
                        }
                    },
                    keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                    suggestedBookTypes: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                type: { type: Type.STRING },
                                reasoning: { type: Type.STRING }
                            }
                        }
                    },
                    competitorAnalysis: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                title: { type: Type.STRING },
                                successFactor: { type: Type.STRING }
                            }
                        }
                    },
                    googleTrends: {
                        type: Type.OBJECT,
                        properties: {
                            interestOverTime: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        month: { type: Type.STRING },
                                        value: { type: Type.NUMBER }
                                    }
                                }
                            },
                            relatedQueries: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        query: { type: Type.STRING },
                                        value: { type: Type.STRING }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    const report: MarketReport = JSON.parse(response.text || '{}');
    
    // Inject real trends data if available (overrides any simulated data the AI provided)
    if (trendsData) {
        report.googleTrends = trendsData;
    }
    
    return report;
};
