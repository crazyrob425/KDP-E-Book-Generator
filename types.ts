

export interface GoogleTrendsData {
  interestOverTime: { month: string; value: number }[];
  relatedQueries: { query: string; value: string }[];
}

export interface MarketReport {
  trendAnalysis: string;
  targetAudience: {
    demographics: string;
    interests: string;
    painPoints: string;
  };
  keywords: string[];
  suggestedBookTypes: { type: string; reasoning: string }[];
  competitorAnalysis: {
    title: string;
    successFactor: string;
  }[];
  googleTrends?: GoogleTrendsData;
}

export interface Chapter {
  chapter: number;
  title: string;
  summary: string;
  content?: string;
  imagePrompt?: string;
  imageUrl?: string;
  illustrationStyle?: string;
  isGeneratingPrompt?: boolean;
  isGeneratingImage?: boolean;
}

export interface BookOutline {
  title: string;
  subtitle: string;
  tableOfContents: Chapter[];
}

export interface CriticReview {
    source: string;
    quote: string;
}

export interface AuthorProfile {
  name: string;
  contact: string;
  bio: string;
  expertise: string;
  birthday: string;
  socialMedia: {
    twitter?: string;
    linkedin?: string;
    website?: string;
    instagram?: string;
    facebook?: string;
  };
  marketing?: {
    ctaText: string;
    ctaUrl: string;
    includeInEpub: boolean;
  };
  photo: {
    base64: string;
    mimeType: string;
  } | null;
  actionPhoto: {
    base64: string;
    mimeType: string;
  } | null;
  criticReviews: CriticReview[];
  autoGenerate: boolean;
}

export interface GenreSuggestion {
    genre: string;
    reasoning: string;
}

export interface TopicSuggestion {
    topic: string;
    reasoning: string;
}

export interface KdpMarketingInfo {
  shortDescription: string;
  longDescription: string;
  categories: string[];
  keywords: string[];
  backCoverBlurb: string;
}

export enum AppStep {
  MarketResearch,
  Outline,
  Content,
  Illustration,
  Review,
}

export enum AppMode {
  Single,
  Batch
}

export interface BatchSettings {
  genre: string;
  pageRange: string;
  numTitles: number;
  numSequels: number;
}

export interface BatchProject {
  id: string;
  title: string;
  subtitle: string;
  status: string; // e.g., 'Pending', 'Generating Report', 'Writing Chapter 5/10', 'Complete'
  finalOutline?: BookOutline; // The full book data once complete
  coverUrl?: string;
  error?: string;
}

export interface KdpAutomationPayload {
  outline: BookOutline;
  kdpMarketingInfo: KdpMarketingInfo;
  authorProfile: AuthorProfile;
  epubBlob: Blob;
  coverImageUrl: string;
}

export type BotStatus = 'initializing' | 'running' | 'captcha' | 'uploading' | 'success' | 'error';

export type BotUpdate =
  | { type: 'log'; message: string }
  | { type: 'status'; status: BotStatus }
  | { type: 'progress'; progress: number }
  | { type: 'captcha'; imageUrl?: string }
  | { type: 'success' }
  | { type: 'success' }
  | { type: 'error'; message: string };

export interface ElectronAPI {
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
  
  startAutomation: (payload: KdpAutomationPayload) => Promise<void>;
  submitCaptcha: (solution: string) => Promise<void>;
  stopAutomation: () => Promise<void>;
  
  saveFile: (data: string, filename: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  loadFile: () => Promise<{ success: boolean; data?: string; error?: string }>;

  onAutomationUpdate: (callback: (update: BotUpdate) => void) => () => void;

  // Market Research
  fetchGoogleTrends: (keyword: string) => Promise<GoogleTrendsData | null>;
  fetchAmazonCompetitors: (keyword: string) => Promise<any[]>; // Using any[] to avoid circular dependency or duplication for now, strictly it's ScrapedBook[]
  fetchAmazonSuggestions: (keyword: string) => Promise<string[]>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

// --- TOKEN EFFICIENCY & CHUNKED GENERATION TYPES ---

export interface GenerationSettings {
  /** 'chunked' = scene-by-scene (default) | 'single_pass' = legacy full chapter */
  strategy: 'chunked' | 'single_pass';
  /** Min scenes per chapter when strategy = 'chunked' (default 11) */
  sceneCountMin: number;
  /** Max scenes per chapter when strategy = 'chunked' (default 14) */
  sceneCountMax: number;
  /** Whether to run the emotional polish pass after stitching (default true) */
  emotionalPolish: boolean;
  /** Max % the polish pass may expand the text (default 6) */
  polishExpansionCapPct: number;
  /** Per-project random seed (uuid, generated once at project creation) */
  projectSeed: string;
}

export const DEFAULT_GENERATION_SETTINGS: GenerationSettings = {
  strategy: 'chunked',
  sceneCountMin: 11,
  sceneCountMax: 14,
  emotionalPolish: true,
  polishExpansionCapPct: 6,
  projectSeed: '',
};

export interface TokenMetrics {
  /** Estimated input tokens for the call (chars / 4 heuristic) */
  estimatedInputTokens: number;
  /** Estimated output tokens for the call */
  estimatedOutputTokens: number;
  /** Whether result was served from cache */
  cacheHit: boolean;
  /** Which agent / step produced this call */
  step: string;
  /** Unix timestamp */
  timestamp: number;
}

export interface ProjectTokenTotals {
  totalEstimatedInput: number;
  totalEstimatedOutput: number;
  cacheHits: number;
  cacheMisses: number;
  /** Calls list (kept for per-chapter breakdown) */
  calls: TokenMetrics[];
}

export interface ScenePlan {
  id: string;
  purpose: string;
  conflict: string;
  turn: string;
  requiredFactIds: string[];
  wordTarget: number;
  styleNotes: string;
  endingHandoff: string;
}

export interface ChapterScenePlan {
  chapterNumber: number;
  sceneCount: number;
  scenes: ScenePlan[];
  /** rerollNonce incremented by "Re-roll" button */
  rerollNonce: number;
}

export interface ChapterMemory {
  chapterNumber: number;
  summary: string;
  microSummaries: string[];   // one per scene
  continuityDelta: string[];  // new facts introduced in this chapter
}

// --- NEW EXPANSION TYPES ---

export interface AudiobookConfig {
    provider: 'elevenlabs' | 'openai';
    voiceId: string;
    model?: string; // e.g. 'eleven_monolingual_v1' or 'tts-1-hd'
    apiKey?: string; // Optional, user might provide it in UI
}

export interface UniverseContext {
    id: string;
    name: string;
    description: string;
    // Shared elements across books
    factions: { name: string; description: string }[];
    characters: { name: string; description: string; role: string }[]; 
    locations: { name: string; description: string }[];
    lore: { topic: string; details: string }[];
    
    // Books in this universe
    books: { 
        id: string; // matches Project ID
        title: string; 
        seriesOrder?: number;
        isSequel?: boolean; 
    }[];
}

export interface ProjectFileV2 {
    version: 2;
    lastSaved: string; // ISO Date
    
    // Core Data
    bookOutline: BookOutline;
    marketReport: MarketReport | null;
    authorProfile: AuthorProfile | null;
    marketingInfo: KdpMarketingInfo | null;
    
    // Visuals
    covers: {
        current: string | null;
        history: string[]; // Keep track of gen iterations
    };
    
    // Expansion Data
    universeId?: string; // Link to a UniverseContext
    seriesName?: string;
    
    // Configs
    audiobookConfig?: AudiobookConfig;
    
    // App State Preservation
    uiState: {
        currentStep: AppStep;
        pagesPerChapter: string;
        selectedGenre?: GenreSuggestion;
    };
}
