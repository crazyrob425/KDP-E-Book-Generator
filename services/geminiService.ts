/// <reference types="vite/client" />
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { BookOutline, MarketReport, GenreSuggestion, TopicSuggestion, KdpMarketingInfo, AuthorProfile, Chapter } from '../types';


let aiInstance: GoogleGenAI | null = null;
const getAi = () => {
  if (!aiInstance) {
    const key = import.meta.env.VITE_GOOGLE_API_KEY || process.env.API_KEY;
    if (!key) {
      throw new Error("API Key is missing. Please set VITE_GOOGLE_API_KEY in your .env file.");
    }
    aiInstance = new GoogleGenAI({ apiKey: key });
  }
  return aiInstance;
};

async function callWithRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
  throw new Error("Max retries reached");
}

export const getHotGenres = async (): Promise<GenreSuggestion[]> => {
  const response = await callWithRetry<GenerateContentResponse>(() => getAi().models.generateContent({
    model: 'gemini-2.5-flash',
    contents: 'Identify 5 currently trending book genres for self-publishing.',
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            genre: { type: Type.STRING },
            reasoning: { type: Type.STRING }
          },
          required: ['genre', 'reasoning']
        }
      }
    }
  }));
  return JSON.parse(response.text || '[]');
};

export const getTopicSuggestions = async (genre: string, reasoning: string): Promise<TopicSuggestion[]> => {
  const response = await callWithRetry<GenerateContentResponse>(() => getAi().models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Suggest 5 marketable book topics for the genre "${genre}". Context: ${reasoning}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            topic: { type: Type.STRING },
            reasoning: { type: Type.STRING }
          },
          required: ['topic', 'reasoning']
        }
      }
    }
  }));
  return JSON.parse(response.text || '[]');
};

export const generateMarketReport = async (topic: string, genre?: string): Promise<MarketReport> => {
  const prompt = `Generate a comprehensive market report for a book about "${topic}"${genre ? ` in the genre "${genre}"` : ''}. Include trend analysis, target audience (demographics, interests, painPoints), high-value keywords, suggested book types (type, reasoning), and competitor analysis (title, successFactor). Also simulate google trends data.`;
  
  const response = await callWithRetry<GenerateContentResponse>(() => getAi().models.generateContent({
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
  }));
  return JSON.parse(response.text || '{}');
};

export const generateBookOutline = async (marketReport: MarketReport, bookType: string, numChapters: number, pageRange: string): Promise<BookOutline> => {
    const prompt = `Create a detailed book outline for a "${bookType}" book.
    Market Report Summary: ${marketReport.trendAnalysis}
    Target Audience: ${marketReport.targetAudience.demographics}
    Number of Chapters: ${numChapters}
    Target Length: ${pageRange}
    
    Return a JSON object with title, subtitle, and tableOfContents (chapter number, title, summary).`;

    const response = await callWithRetry<GenerateContentResponse>(() => getAi().models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    subtitle: { type: Type.STRING },
                    tableOfContents: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                chapter: { type: Type.NUMBER },
                                title: { type: Type.STRING },
                                summary: { type: Type.STRING }
                            }
                        }
                    }
                }
            }
        }
    }));
    return JSON.parse(response.text || '{}');
};

export const regenerateBookTitle = async (marketReport: MarketReport): Promise<{ title: string; subtitle: string }> => {
  const prompt = `Generate a catchy, bestselling title and subtitle for a book based on this market trend: ${marketReport.trendAnalysis}. Target Audience: ${marketReport.targetAudience.demographics}. Keywords: ${marketReport.keywords.join(', ')}.`;
  
  const response = await callWithRetry<GenerateContentResponse>(() => getAi().models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          subtitle: { type: Type.STRING }
        }
      }
    }
  }));
  return JSON.parse(response.text || '{}');
};

export const generateChapterContent = async (chapterTitle: string, chapterSummary: string, lengthGuidance: string): Promise<string> => {
  const prompt = `Write the full content for the chapter "${chapterTitle}".
  Summary: ${chapterSummary}
  Target Length: ${lengthGuidance}
  Style: Engaging, well-structured, suitable for the genre.
  Format: Markdown.
  Do not include the chapter title at the start.`;

  const response = await callWithRetry<GenerateContentResponse>(() => getAi().models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt
  }));
  return response.text || '';
};

export const regenerateChapterWithGuidance = async (chapterTitle: string, chapterSummary: string, currentContent: string, lengthGuidance: string, instructions?: string): Promise<string> => {
    const prompt = `Rewrite the chapter "${chapterTitle}".
    Summary: ${chapterSummary}
    Current Draft:
    ---
    ${currentContent}
    ---
    Instructions: ${instructions || 'Improve flow, clarity, and engagement. Maintain the core message.'}
    Target Length: ${lengthGuidance}
    Format: Markdown.`;

    const response = await callWithRetry<GenerateContentResponse>(() => getAi().models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
    }));
    return response.text || '';
};

export const generateImagePrompt = async (chapterExcerpt: string, style?: string): Promise<string> => {
    const prompt = `Create a detailed image generation prompt for an illustration based on this excerpt: "${chapterExcerpt.substring(0, 300)}...".
    Style: ${style || 'Cinematic, high quality, detailed'}.
    The prompt should be descriptive and suitable for an AI image generator.`;

    const response = await callWithRetry<GenerateContentResponse>(() => getAi().models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
    }));
    return response.text || '';
};

async function generateImageWithFlash(prompt: string): Promise<string> {
    const response = await callWithRetry<GenerateContentResponse>(() => getAi().models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] }
    }));
    
    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
             return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
    }
    throw new Error("No image generated");
}

export const generateIllustration = async (prompt: string): Promise<string> => {
    return generateImageWithFlash(prompt);
};

export const generateBookCover = async (title: string, subtitle: string, author: string): Promise<string> => {
    const prompt = `A professional, high-quality book cover for a book titled "${title}". Subtitle: "${subtitle}". Author: "${author}". The cover should be eye-catching, relevant to the title, and text should be legible if possible, but primarily focus on the artwork.`;
    return generateImageWithFlash(prompt);
};

export const generateExampleBookCover = async (): Promise<string> => {
    const prompt = `A creative and abstract book cover design for a bestselling novel. High quality, vivid colors.`;
    return generateImageWithFlash(prompt);
};

export const generateStockPhotoSuggestions = async (query: string): Promise<{prompt: string, url: string}[]> => {
    const prompt = `Create 3 distinct, detailed image prompts for stock photos based on the search query: "${query}". Return as JSON array of strings.`;
     const response = await callWithRetry<GenerateContentResponse>(() => getAi().models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
            }
        }
    }));
    const prompts: string[] = JSON.parse(response.text || '[]');
    
    const results = await Promise.all(prompts.map(async (p) => {
        try {
            const url = await generateImageWithFlash(p);
            return { prompt: p, url };
        } catch (e) {
            return null;
        }
    }));
    
    return results.filter(r => r !== null) as {prompt: string, url: string}[];
};

export const humanizeChapterContent = async (content: string): Promise<string> => {
    const prompt = `Rewrite the following text to sound more natural, human, and engaging. Remove robotic phrasing and repetitive structures.
    Text:
    ${content.substring(0, 5000)}... (truncated for length)`;
    
    const response = await callWithRetry<GenerateContentResponse>(() => getAi().models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
    }));
    return response.text || content;
};

export const generateKdpMarketingInfo = async (marketReport: MarketReport, outline: BookOutline): Promise<KdpMarketingInfo> => {
    const prompt = `Generate Amazon KDP marketing metadata for the book "${outline.title}".
    Subtitle: ${outline.subtitle}
    Market Context: ${marketReport.trendAnalysis}
    Keywords: ${marketReport.keywords.join(', ')}
    
    Return JSON with shortDescription, longDescription (HTML format with b, i, ul, li tags), categories (array of 3 strings), keywords (array of 7 strings), and backCoverBlurb.`;

    const response = await callWithRetry<GenerateContentResponse>(() => getAi().models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    shortDescription: { type: Type.STRING },
                    longDescription: { type: Type.STRING },
                    categories: { type: Type.ARRAY, items: { type: Type.STRING } },
                    keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                    backCoverBlurb: { type: Type.STRING }
                }
            }
        }
    }));
    return JSON.parse(response.text || '{}');
};

export const personalizeAuthorBio = async (currentBio: string, bookTopic: string): Promise<string> => {
    const prompt = `Rewrite this author bio to highlight expertise relevant to the book topic: "${bookTopic}".
    Current Bio: ${currentBio}
    Keep it professional but engaging.`;
    
    const response = await callWithRetry<GenerateContentResponse>(() => getAi().models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
    }));
    return response.text || currentBio;
};

export const generateQuickEnding = async (title: string, subtitle: string, lastChapterContent: string): Promise<string> => {
     const prompt = `Write a satisfying conclusion/ending paragraph for the book "${title}: ${subtitle}".
     Context (Last Chapter): ${lastChapterContent.substring(0, 1000)}...`;
     
     const response = await callWithRetry<GenerateContentResponse>(() => getAi().models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
    }));
    return response.text || '';
};

export const reimagineAuthorPersona = async (currentProfile: AuthorProfile, bookTitle: string, bookSubtitle: string, genre: string, marketReport: MarketReport | null): Promise<AuthorProfile> => {
    const prompt = `Create a persona for an author who would write the book "${bookTitle}: ${bookSubtitle}" in the genre "${genre}".
    Market Context: ${marketReport?.trendAnalysis || 'N/A'}.
    
    Generate a name, bio, expertise, and suggested social media handles.
    Also generate 3 fictional critic reviews.
    
    Return JSON matching the AuthorProfile structure (excluding photos/marketing).`;
    
    const response = await callWithRetry<GenerateContentResponse>(() => getAi().models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
             responseSchema: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    contact: { type: Type.STRING },
                    bio: { type: Type.STRING },
                    expertise: { type: Type.STRING },
                    birthday: { type: Type.STRING },
                    socialMedia: {
                        type: Type.OBJECT,
                        properties: {
                            twitter: { type: Type.STRING },
                            linkedin: { type: Type.STRING },
                            website: { type: Type.STRING },
                            facebook: { type: Type.STRING },
                            instagram: { type: Type.STRING }
                        }
                    },
                    criticReviews: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                source: { type: Type.STRING },
                                quote: { type: Type.STRING }
                            }
                        }
                    }
                }
            }
        }
    }));
    
    const data = JSON.parse(response.text || '{}');
    return {
        ...currentProfile,
        ...data,
        marketing: currentProfile.marketing, // preserve
        photo: null,
        actionPhoto: null,
        autoGenerate: true
    };
};

export const generateBatchTitles = async (genre: string, count: number): Promise<{ title: string; subtitle: string }[]> => {
    const prompt = `Generate ${count} unique, marketable book title and subtitle pairs for the genre "${genre}". Return JSON array.`;
    
    const response = await callWithRetry<GenerateContentResponse>(() => getAi().models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        subtitle: { type: Type.STRING }
                    }
                }
            }
        }
    }));
    return JSON.parse(response.text || '[]');
};

export const regenerateFullBookWithFeedback = async (currentOutline: BookOutline, feedback: string): Promise<BookOutline> => {
     const prompt = `Regenerate the book outline and summaries based on this feedback: "${feedback}".
     Current Title: ${currentOutline.title}
     Current Outline: ${JSON.stringify(currentOutline.tableOfContents.map(c => ({ ch: c.chapter, title: c.title, summary: c.summary })))}
     
     Return updated JSON with title, subtitle, and tableOfContents (empty content).`;
     
     const response = await callWithRetry<GenerateContentResponse>(() => getAi().models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
         config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    subtitle: { type: Type.STRING },
                    tableOfContents: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                chapter: { type: Type.NUMBER },
                                title: { type: Type.STRING },
                                summary: { type: Type.STRING }
                            }
                        }
                    }
                }
            }
        }
    }));
    const newOutline = JSON.parse(response.text || '{}');
    return {
        ...newOutline,
        tableOfContents: newOutline.tableOfContents.map((c: any) => ({
            ...c,
            content: '', // Clear content
            isGeneratingPrompt: false,
            isGeneratingImage: false
        }))
    };
};


export const generateLiteraryCritique = async (chapterTitle: string, chapterContent: string, bookOutline: BookOutline): Promise<string> => {
    const prompt = `
    You are the **Grand Master Scholar and Literary Critic**. 
    You possess an infinite understanding of narrative structure, emotional resonance, and character psychology. 
    Your mission is to read the provided chapter with deep empathy, imagining yourself living the story alongside the characters.
    You must feel their pain, their joy, and their conflicts.

    **Book Context:**
    Title: ${bookOutline.title}
    Subtitle: ${bookOutline.subtitle}

    **Chapter to Review:**
    Title: "${chapterTitle}"
    Content:
    ---
    ${chapterContent}
    ---

    **Your Task:**
    Provide a constructive, expert critique of this chapter. 
    1.  **Emotional Connection:** Do the characters feel real? Is their emotional journey impactful?
    2.  **Pacing & Flow:** Does the narrative move at the right speed? Are there boring parts or rushed parts?
    3.  **Digital Medium Awareness:** Ensure the writing style fits an e-book format (engaging, scrollable, no "page turning" references).
    4.  **Specific Suggestions:** Provide 3-4 concrete, actionable improvements.

    **Output Format:**
    Return a structured critique in Markdown. Be encouraging but rigorously honest. 
    Start with a brief "Scholar's Impression" summary, followed by bullet points of "Critical Analysis", and end with "Actionable Improvements".
    `;

    const response = await callWithRetry<GenerateContentResponse>(() => getAi().models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
    }));

    return response.text?.trim() || "Critique generation failed.";
};

export const applyLiteraryCritique = async (chapterTitle: string, currentContent: string, critique: string): Promise<string> => {
    const prompt = `
    You are the **Grand Master Editor**.
    You have received a specific critique from the Grand Master Scholar.
    Your task is to rewrite the chapter to incorporate these improvements **automatically**.

    **Chapter Title:** "${chapterTitle}"
    
    **Original Content:**
    ---
    ${currentContent}
    ---

    **Scholar's Critique & Instructions:**
    ---
    ${critique}
    ---

    **Instructions:**
    1.  **Apply the Improvements:** Rewrite the content to address the points raised in the critique (improve emotional resonance, fix pacing, etc.).
    2.  **Preserve Core Plot:** Do not change the fundamental events of the chapter unless the critique explicitly asks to fix a plot hole.
    3.  **Digital Medium Awareness:** Ensure no references to physical pages/books remain.
    4.  **Output ONLY the Content:** Return the full, rewritten chapter text in Markdown. No preambles.
    `;

    const response = await callWithRetry<GenerateContentResponse>(() => getAi().models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
    }));

    let content = response.text || "";
    content = content.replace(/^Of course[\s\S]*?Here is the.*?(\*\*\*\s*)?/i, '');
    content = content.trim().replace(/^Chapter\s+\d+[:\s].*?\n+/i, '');

    return content.trim();
};