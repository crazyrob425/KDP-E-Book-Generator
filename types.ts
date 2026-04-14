

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

// ─── NullProxy Engine Types ───────────────────────────────────────────────────

/**
 * The AI providers Null Library can connect to via OAuth proxy spoofing.
 * Each maps to a real AI backend.
 */
export type ProxyProvider =
  | 'gemini-cli'         // Google Gemini via Gemini-CLI OAuth (best for writing & research)
  | 'gemini-antigravity' // Google Gemini via Antigravity OAuth (backup Gemini channel)
  | 'claude-kiro'        // Claude via Kiro IDE OAuth (best for critique & marketing copy)
  | 'openai-codex'       // GPT via GitHub Copilot/Codex OAuth (creative & marketing)
  | 'openai-qwen'        // Qwen via QwenCoder OAuth (coding tasks, structured output)
  | 'openai-iflow';      // Qwen Plus via iFlow OAuth (fallback structured tasks)

/**
 * Types of AI tasks, used for smart routing to the best model.
 */
export type TaskType =
  | 'creative-writing'  // Long-form chapters, narrative content
  | 'market-research'   // Structured JSON, competitive analysis
  | 'marketing-copy'    // Book blurbs, KDP descriptions, ad copy
  | 'image-prompt'      // Illustration prompt generation
  | 'critique'          // Quality review, proofreading, feedback
  | 'general';          // Fallback for unclassified tasks

/** A single OAuth-authenticated account for a provider. */
export interface ProxyAccount {
  id: string;
  provider: ProxyProvider;
  email?: string;
  displayName?: string;
  isHealthy: boolean;
  isDisabled: boolean;
  lastUsed?: number;
  tokenExpiry?: number;
  usageCount: number;
  errorCount: number;
}

/** Full proxy engine configuration stored in settings. */
export interface ProxySettings {
  /** Master toggle: use proxy at all */
  enabled: boolean;
  /** Rotate through multiple accounts per provider */
  roundRobinEnabled: boolean;
  /** Provider preference order (first tried first) */
  providerPriority: ProxyProvider[];
  /** Which providers to use for each task type */
  taskRouting: Record<TaskType, ProxyProvider[]>;
  /** Fall back to free Google account login if all else fails */
  failsafeEnabled: boolean;
  /** User-supplied manual API keys (used as fallback) */
  manualApiKey?: string;
  manualClaudeApiKey?: string;
  manualOpenAiApiKey?: string;
  /** All connected OAuth accounts */
  accounts: ProxyAccount[];
}

/** Status reported back to the UI during an OAuth login flow */
export interface OAuthFlowStatus {
  provider: ProxyProvider;
  phase: 'starting' | 'waiting-for-browser' | 'callback-received' | 'saving' | 'done' | 'error';
  message: string;
  error?: string;
}

/** Phase of the first-run setup wizard */
export type WizardPhase = 'welcome' | 'connect-accounts' | 'api-keys' | 'ready';

export type BotUpdate =
  | { type: 'log'; message: string }
  | { type: 'status'; status: BotStatus }
  | { type: 'progress'; progress: number }
  | { type: 'captcha'; imageUrl?: string }
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
  fetchAmazonCompetitors: (keyword: string) => Promise<any[]>;
  fetchAmazonSuggestions: (keyword: string) => Promise<string[]>;

  // ── NullProxy OAuth ──
  /** Start OAuth login flow for a provider; opens browser */
  oauthStart: (provider: ProxyProvider) => Promise<{ success: boolean; error?: string }>;
  /** Cancel an in-progress OAuth flow */
  oauthCancel: (provider: ProxyProvider) => Promise<void>;
  /** Subscribe to OAuth flow status updates */
  onOAuthStatus: (callback: (status: OAuthFlowStatus) => void) => () => void;

  // ── NullProxy Proxy Operations ──
  /** Get current status/health of all proxy accounts */
  proxyGetStatus: () => Promise<ProxyAccount[]>;
  /** Add an additional account to a provider (starts OAuth flow) */
  proxyAddAccount: (provider: ProxyProvider) => Promise<{ success: boolean; error?: string }>;
  /** Remove an account by id */
  proxyRemoveAccount: (accountId: string) => Promise<void>;
  /** Load saved proxy settings */
  proxyGetSettings: () => Promise<ProxySettings | null>;
  /** Save updated proxy settings */
  proxySaveSettings: (settings: ProxySettings) => Promise<void>;
  /** Read a credential file path for a provider (for token refresh) */
  proxyGetCredPath: (provider: ProxyProvider, accountId: string) => Promise<string | null>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  }
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
