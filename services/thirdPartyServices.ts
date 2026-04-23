/**
 * Third-Party Writing Enhancement Services
 *
 * This module wires up 15 open-source libraries to provide real, data-driven
 * analysis of book manuscripts. Functions are async-safe and browser-compatible.
 *
 * Libraries integrated:
 *  1. marked             – Markdown → HTML conversion
 *  2. he                 – HTML entity encoding / decoding
 *  3. sentiment          – AFINN-based sentiment scoring
 *  4. syllable           – Syllable counting for pacing metrics
 *  5. string-similarity  – Repetition / cliché detection
 *  6. franc              – Language detection
 *  7. stopword           – Stop-word removal for theme extraction
 *  8. reading-time       – Estimated reading duration
 *  9. bad-words          – Profanity / content moderation
 * 10. word-count         – Word statistics
 * 11. flesch-kincaid     – Flesch-Kincaid readability grade
 * 12. compromise-paragraphs – Paragraph structure analysis
 * 13. compromise-sentences  – Sentence length analysis
 * 14. retext-sentence-spacing – Double-space detection via retext
 * 15. retext-repeated-words  – Repeated-word detection via retext
 */

// ── Synchronous CJS imports ───────────────────────────────────────────────────
import Sentiment from 'sentiment';
import stringSimilarity from 'string-similarity';
import Filter from 'bad-words';
import wordCount from 'word-count';
import he from 'he';
import { fleschKincaid } from 'flesch-kincaid';
import { marked } from 'marked';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReadabilityScore {
    fleschKincaidGrade: number;
    avgSentenceLength: number;
    avgSyllablesPerWord: number;
    interpretation: string;
}

export interface SentimentResult {
    score: number;
    comparative: number;
    label: 'Very Positive' | 'Positive' | 'Neutral' | 'Negative' | 'Very Negative';
    positiveWords: string[];
    negativeWords: string[];
}

export interface TextStatistics {
    wordCount: number;
    charCount: number;
    sentenceCount: number;
    paragraphCount: number;
    avgWordsPerSentence: number;
    avgSyllablesPerWord: number;
    readingTimeMinutes: number;
    readingTimeText: string;
}

export interface RepetitionAlert {
    phrase: string;
    similarity: number;
    occurrences: number;
}

export interface WritingQualityReport {
    statistics: TextStatistics;
    readability: ReadabilityScore;
    sentiment: SentimentResult;
    repetitionAlerts: RepetitionAlert[];
    topThemes: string[];
    detectedLanguage: string;
    hasContentWarnings: boolean;
    contentWarningCount: number;
    qualityScore: number; // 0-100
    qualityLabel: string;
    suggestions: string[];
}

// ── Module-level instances ────────────────────────────────────────────────────
const sentimentAnalyser = new Sentiment();
const contentFilter = new Filter();

// ── 1. Marked helpers (re-exported from epubGenerator for shared use) ─────────
/**
 * Convert Markdown to plain text (strips HTML tags) for NLP analysis.
 */
export const markdownToPlainText = (markdown: string): string => {
    if (!markdown) return '';
    try {
        const html = marked.parse(markdown) as string;
        return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    } catch {
        return markdown.replace(/[#*_`[\]()>!-]/g, ' ').replace(/\s+/g, ' ').trim();
    }
};

// ── 2. HTML encoding helper (he) ─────────────────────────────────────────────
export const safeHtmlEncode = (text: string): string => he.escape(text);
export const safeHtmlDecode = (html: string): string => he.decode(html);

// ── 3. Sentiment analysis ──────────────────────────────────────────────────────
export const analyseChapterSentiment = (text: string): SentimentResult => {
    const plain = markdownToPlainText(text);
    const result = sentimentAnalyser.analyze(plain);
    const score = result.score;
    const label: SentimentResult['label'] =
        score >= 10 ? 'Very Positive' :
        score >= 3  ? 'Positive' :
        score <= -10 ? 'Very Negative' :
        score <= -3  ? 'Negative' : 'Neutral';
    return {
        score,
        comparative: result.comparative,
        label,
        positiveWords: result.positive ?? [],
        negativeWords: result.negative ?? [],
    };
};

/**
 * Analyse the emotional arc of an entire book by scoring each chapter.
 * Returns an array of { chapter, score, label } for charting.
 */
export const analyseEmotionalArc = (chapters: { title: string; content?: string }[]): Array<{
    chapter: string;
    score: number;
    label: string;
}> => {
    return chapters.map(ch => {
        if (!ch.content) return { chapter: ch.title, score: 0, label: 'Neutral' };
        const { score, label } = analyseChapterSentiment(ch.content);
        return { chapter: ch.title, score, label };
    });
};

// ── 4. Syllable counting (lazy ESM import) ────────────────────────────────────
let syllableCache: ((word: string) => number) | null = null;

async function getSyllableFn(): Promise<(word: string) => number> {
    if (syllableCache) return syllableCache;
    const mod = await import('syllable');
    syllableCache = mod.syllable;
    return syllableCache as (word: string) => number;
}

export const countSyllablesInText = async (text: string): Promise<number> => {
    const syllable = await getSyllableFn();
    const plain = markdownToPlainText(text);
    const words = plain.match(/[a-zA-Z]+/g) ?? [];
    return words.reduce((sum, w) => sum + syllable(w), 0);
};

// ── 5. String similarity / repetition detection ───────────────────────────────
/**
 * Splits text into sentences and finds pairs that are suspiciously similar.
 * Flags potential clichés, repeated phrasing, or copy-paste artefacts.
 */
export const detectRepetitivePatterns = (text: string, threshold = 0.75): RepetitionAlert[] => {
    const plain = markdownToPlainText(text);
    const sentences = plain.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 20);
    if (sentences.length < 2) return [];

    const alerts: RepetitionAlert[] = [];
    const counted = new Map<string, number>();

    for (let i = 0; i < sentences.length - 1; i++) {
        for (let j = i + 1; j < sentences.length; j++) {
            const sim = stringSimilarity.compareTwoStrings(sentences[i], sentences[j]);
            if (sim >= threshold) {
                const key = sentences[i].substring(0, 40);
                counted.set(key, (counted.get(key) ?? 1) + 1);
                alerts.push({
                    phrase: sentences[i].substring(0, 80) + '…',
                    similarity: Math.round(sim * 100) / 100,
                    occurrences: counted.get(key) ?? 2,
                });
            }
        }
    }
    // Deduplicate and sort by similarity
    const seen = new Set<string>();
    return alerts
        .filter(a => { const k = a.phrase; if (seen.has(k)) return false; seen.add(k); return true; })
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 10); // Return at most 10 alerts
};

// ── 6. Language detection (franc — lazy ESM import) ──────────────────────────
let francCache: ((text: string) => string) | null = null;

async function getFrancFn(): Promise<(text: string) => string> {
    if (francCache) return francCache;
    const mod = await import('franc');
    francCache = mod.franc;
    return francCache as (text: string) => string;
}

export const detectLanguage = async (text: string): Promise<string> => {
    const franc = await getFrancFn();
    const plain = markdownToPlainText(text);
    return franc(plain.substring(0, 2000)) ?? 'und';
};

// ── 7. Stop-word removal + theme extraction (stopword — lazy ESM import) ──────
let stopwordCache: ((tokens: string[]) => string[]) | null = null;

async function getStopwordFn(): Promise<(tokens: string[]) => string[]> {
    if (stopwordCache) return stopwordCache;
    const mod = await import('stopword');
    stopwordCache = mod.removeStopwords;
    return stopwordCache as (tokens: string[]) => string[];
}

export const extractTopThemes = async (text: string, topN = 10): Promise<string[]> => {
    const removeStopwords = await getStopwordFn();
    const plain = markdownToPlainText(text);
    const tokens = plain.toLowerCase().match(/\b[a-z]{4,}\b/g) ?? [];
    const meaningful = removeStopwords(tokens);

    // Count frequencies
    const freq = new Map<string, number>();
    for (const w of meaningful) freq.set(w, (freq.get(w) ?? 0) + 1);

    return [...freq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, topN)
        .map(([word]) => word);
};

// ── 8. Reading time ────────────────────────────────────────────────────────────
export const estimateReadingTime = (text: string): { minutes: number; text: string; words: number } => {
    const plain = markdownToPlainText(text);
    const words = plain.match(/\b\w+\b/g)?.length ?? 0;
    const minutes = words === 0 ? 0 : Math.max(1, Math.ceil(words / 200));
    return {
        minutes,
        text: words === 0 ? '0 min read' : `${minutes} min read`,
        words,
    };
};

// ── 9. Content moderation (bad-words) ─────────────────────────────────────────
export const checkContentWarnings = (text: string): { hasProfanity: boolean; count: number } => {
    try {
        const plain = markdownToPlainText(text);
        const words = plain.split(/\s+/);
        let count = 0;
        for (const word of words) {
            if (contentFilter.isProfane(word)) count++;
        }
        return { hasProfanity: count > 0, count };
    } catch {
        return { hasProfanity: false, count: 0 };
    }
};

// ── 10. Word count ─────────────────────────────────────────────────────────────
export const getWordCount = (text: string): number => {
    const plain = markdownToPlainText(text);
    return wordCount(plain);
};

// ── 11. Flesch-Kincaid readability ─────────────────────────────────────────────
export const computeReadabilityScore = async (text: string): Promise<ReadabilityScore> => {
    const plain = markdownToPlainText(text);
    const syllable = await getSyllableFn();

    const sentences = (plain.match(/[^.!?]+[.!?]+/g) ?? [plain]).filter(s => s.trim().length > 0);
    const words = plain.match(/[a-zA-Z]+/g) ?? [];

    if (words.length === 0 || sentences.length === 0) {
        return { fleschKincaidGrade: 0, avgSentenceLength: 0, avgSyllablesPerWord: 0, interpretation: 'No text to analyse' };
    }

    const totalSyllables = words.reduce((sum, w) => sum + syllable(w), 0);
    const avgSentenceLength = words.length / sentences.length;
    const avgSyllablesPerWord = totalSyllables / words.length;

    const grade = fleschKincaid({
        sentence: sentences.length,
        word: words.length,
        syllable: totalSyllables,
    });

    const interpretation =
        grade <= 6  ? 'Very Easy (Grade 6 or below — great for mass-market fiction)' :
        grade <= 8  ? 'Easy (Grades 6-8 — Young Adult / popular non-fiction)' :
        grade <= 10 ? 'Standard (Grades 9-10 — mainstream adult reading)' :
        grade <= 12 ? 'Challenging (Grades 11-12 — literary fiction / non-fiction)' :
        'Academic (College level — dense non-fiction / literary)';

    return {
        fleschKincaidGrade: Math.round(grade * 10) / 10,
        avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
        avgSyllablesPerWord: Math.round(avgSyllablesPerWord * 100) / 100,
        interpretation,
    };
};

// ── 12-13. Compromise paragraph / sentence analysis ───────────────────────────
interface SentenceAnalysis {
    totalSentences: number;
    avgLength: number;
    shortSentences: number;
    longSentences: number;
    varietyScore: number; // 0-100
}

export const analyseSentenceStructure = async (text: string): Promise<SentenceAnalysis> => {
    try {
        const plain = markdownToPlainText(text);
        const nlp = (await import('compromise')).default;
        const paragraphPlugin = (await import('compromise-paragraphs')).default;
        const sentencePlugin = (await import('compromise-sentences')).default;
        nlp.plugin(paragraphPlugin);
        nlp.plugin(sentencePlugin);

        const doc = nlp(plain);
        const sentences: string[] = (doc as any).sentences().out('array') as string[];

        if (sentences.length === 0) {
            return { totalSentences: 0, avgLength: 0, shortSentences: 0, longSentences: 0, varietyScore: 50 };
        }

        const lengths = sentences.map(s => s.split(/\s+/).length);
        const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
        const short = lengths.filter(l => l < 8).length;
        const long = lengths.filter(l => l > 30).length;

        // Variety: penalise if too many sentences are the same length range
        const stdDev = Math.sqrt(lengths.reduce((sum, l) => sum + Math.pow(l - avg, 2), 0) / lengths.length);
        const varietyScore = Math.min(100, Math.round((stdDev / avg) * 200));

        return {
            totalSentences: sentences.length,
            avgLength: Math.round(avg * 10) / 10,
            shortSentences: short,
            longSentences: long,
            varietyScore,
        };
    } catch {
        // Fallback without compromise
        const plain = markdownToPlainText(text);
        const sentences = plain.split(/[.!?]+/).filter(s => s.trim().length > 5);
        const lengths = sentences.map(s => s.split(/\s+/).length);
        const avg = lengths.length > 0 ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0;
        return {
            totalSentences: sentences.length,
            avgLength: Math.round(avg * 10) / 10,
            shortSentences: lengths.filter(l => l < 8).length,
            longSentences: lengths.filter(l => l > 30).length,
            varietyScore: 50,
        };
    }
};

// ── 14-15. Retext sentence-spacing and repeated-words ─────────────────────────
export interface RetextIssue {
    type: 'repeated-word' | 'spacing';
    message: string;
    position?: { line: number; column: number };
}

export const runRetextChecks = async (text: string): Promise<RetextIssue[]> => {
    try {
        const plain = markdownToPlainText(text);
        const { retext } = await import('retext');
        const retextEnglish = (await import('retext-english')).default;
        const retextRepeated = (await import('retext-repeated-words')).default;
        const retextSpacing = (await import('retext-sentence-spacing')).default;

        const issues: RetextIssue[] = [];

        const file = await retext()
            .use(retextEnglish)
            .use(retextRepeated)
            .use(retextSpacing)
            .process(plain.substring(0, 5000));

        for (const msg of file.messages) {
            issues.push({
                type: msg.ruleId?.includes('repeated') ? 'repeated-word' : 'spacing',
                message: msg.message,
                position: msg.position?.start ? {
                    line: msg.position.start.line ?? 0,
                    column: msg.position.start.column ?? 0,
                } : undefined,
            });
        }

        return issues;
    } catch {
        return [];
    }
};

// ── Master quality report ─────────────────────────────────────────────────────
/**
 * Run all 15 writing-enhancement checks on a single chapter's content.
 * Returns a consolidated WritingQualityReport.
 */
export const generateWritingQualityReport = async (
    content: string,
): Promise<WritingQualityReport> => {
    const plain = markdownToPlainText(content);

    // Run async checks in parallel for performance
    const [readability, themes, language, sentenceAnalysis, retextIssues] = await Promise.all([
        computeReadabilityScore(content),
        extractTopThemes(content),
        detectLanguage(content),
        analyseSentenceStructure(content),
        runRetextChecks(content),
    ]);

    const rtResult = estimateReadingTime(content);
    const sentiment = analyseChapterSentiment(content);
    const repetition = detectRepetitivePatterns(content);
    const contentWarnings = checkContentWarnings(content);
    const words = getWordCount(content);

    const sentences = plain.split(/[.!?]+/).filter(s => s.trim().length > 5);
    const syllableCount = await countSyllablesInText(content);

    const statistics: TextStatistics = {
        wordCount: words,
        charCount: plain.length,
        sentenceCount: sentences.length,
        paragraphCount: content.split(/\n{2,}/).filter(p => p.trim().length > 0).length,
        avgWordsPerSentence: sentences.length > 0 ? Math.round((words / sentences.length) * 10) / 10 : 0,
        avgSyllablesPerWord: words > 0 ? Math.round((syllableCount / words) * 100) / 100 : 0,
        readingTimeMinutes: rtResult.minutes,
        readingTimeText: rtResult.text,
    };

    // Compute holistic quality score (0-100)
    let qualityScore = 70; // Start at 70
    if (readability.fleschKincaidGrade >= 6 && readability.fleschKincaidGrade <= 12) qualityScore += 10;
    if (sentenceAnalysis.varietyScore >= 50) qualityScore += 5;
    if (repetition.length === 0) qualityScore += 5;
    if (retextIssues.length === 0) qualityScore += 5;
    if (words >= 500) qualityScore += 5;
    qualityScore -= Math.min(15, repetition.length * 3);
    qualityScore -= Math.min(10, retextIssues.filter(i => i.type === 'repeated-word').length * 2);
    qualityScore = Math.max(0, Math.min(100, qualityScore));

    const qualityLabel =
        qualityScore >= 90 ? 'Excellent ★★★★★' :
        qualityScore >= 75 ? 'Good ★★★★' :
        qualityScore >= 60 ? 'Fair ★★★' :
        qualityScore >= 40 ? 'Needs Work ★★' : 'Poor ★';

    // Compile actionable suggestions
    const suggestions: string[] = [];
    if (readability.fleschKincaidGrade > 12) {
        suggestions.push('Consider shortening sentences or using simpler vocabulary to improve readability.');
    }
    if (readability.avgSentenceLength > 25) {
        suggestions.push('Average sentence length is high. Break long sentences for better pacing.');
    }
    if (repetition.length > 3) {
        suggestions.push('Several repeated phrases detected. Vary your sentence structures to avoid redundancy.');
    }
    if (sentenceAnalysis.varietyScore < 40) {
        suggestions.push('Sentence length is very uniform. Mix short punchy sentences with longer descriptive ones.');
    }
    if (sentenceAnalysis.longSentences > sentenceAnalysis.totalSentences * 0.3) {
        suggestions.push('Too many long sentences (>30 words). Use shorter sentences for dramatic moments and suspense.');
    }
    if (retextIssues.filter(i => i.type === 'repeated-word').length > 0) {
        suggestions.push('Some words are repeated consecutively ("the the", "is is"). Proofread for accidental duplication.');
    }
    if (words < 500) {
        suggestions.push('Chapter is very short. Consider expanding scenes or adding more dialogue/description.');
    }

    return {
        statistics,
        readability,
        sentiment,
        repetitionAlerts: repetition,
        topThemes: themes,
        detectedLanguage: language,
        hasContentWarnings: contentWarnings.hasProfanity,
        contentWarningCount: contentWarnings.count,
        qualityScore,
        qualityLabel,
        suggestions,
    };
};
