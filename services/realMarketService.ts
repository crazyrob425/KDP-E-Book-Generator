import { MarketReport, GoogleTrendsData } from '../types';
import { getAi } from './geminiService';
import { GenerateContentResponse, Type } from "@google/genai";
import desktopBridge from './desktopBridge';

export const generateRealMarketReport = async (topic: string, genre?: string): Promise<MarketReport> => {
    console.log(`Starting real market research for: ${topic}`);

    // 1. Fetch Google Trends Data
    let trendsData: GoogleTrendsData | null = null;
    try {
        trendsData = await desktopBridge.fetchGoogleTrends(topic);
    } catch (e) {
        console.warn("Failed to fetch Google Trends:", e);
    }

    // 2. Fetch Amazon Competitors
    let competitors: any[] = [];
    try {
        competitors = await desktopBridge.fetchAmazonCompetitors(topic);
    } catch (e) {
        console.warn("Failed to fetch Amazon competitors:", e);
    }

    // 3. Fetch Amazon Suggestions (for keywords)
    let suggestions: string[] = [];
    try {
        suggestions = await desktopBridge.fetchAmazonSuggestions(topic);
    } catch (e) {
        console.warn("Failed to fetch Amazon suggestions:", e);
    }

    // 4. Synthesize Report using Gemini (feeding it valid data)
    const prompt = `
    Analyze the following REAL market data for the book topic "${topic}"${genre ? ` in genre "${genre}"` : ''}.
    
    **Google Trends Data:**
    ${trendsData ? JSON.stringify(trendsData.interestOverTime.slice(-12)) : "Not available"}
    
    **Top Amazon Competitors:**
    ${competitors.map(c => `- ${c.title} by ${c.author} (Rating: ${c.rating}, Reviews: ${c.reviewCount})`).join('\n')}
    
    **Amazon Search Suggestions (Keywords):**
    ${suggestions.join(', ')}

    Based on this REAL data, generate a comprehensive market report.
    - **Trend Analysis**: Interpret the trends data and competitor saturation.
    - **Target Audience**: Deduce from the competitor reviews and types.
    - **Keywords**: Select the best ones from suggestions + others.
    - **Competitor Analysis**: Summarize the success factors of the provided competitors.
    
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
                    }
                }
            }
        }
    });

    const report: MarketReport = JSON.parse(response.text || '{}');
    
    // Inject the REAL trends data back into the report object so the UI displays the real chart
    if (trendsData) {
        report.googleTrends = trendsData;
    }

    // If we have real competitor data, we might want to ensure the report reflects it accurately.
    // The AI might have summarized it, but let's double check. 
    // Actually, passing it to the AI to "summarize success factors" is good.
    // But maybe we want to augment the UI to show the raw book covers? 
    // For now, we stick to the existing UI contract.
    
    return report;
};
