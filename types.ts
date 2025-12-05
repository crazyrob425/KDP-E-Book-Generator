

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
  | { type: 'error'; message: string };