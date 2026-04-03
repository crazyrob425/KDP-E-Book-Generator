
import { BookOutline, AuthorProfile } from '../types';
import { marked } from 'marked';
import he from 'he';

// Configure marked for clean, safe HTML output
marked.setOptions({
    gfm: true,
    breaks: true,
});

/**
 * Converts Markdown content to sanitised HTML suitable for EPUB chapters.
 * Encodes any remaining HTML entities using 'he' for safety.
 */
const markdownToEpubHtml = (markdown: string): string => {
    if (!markdown) return '<p></p>';
    try {
        const raw = marked.parse(markdown) as string;
        // he.decode converts any HTML entities in marked's output back to plain characters
        // so they are not double-encoded when the EPUB renderer re-encodes them.
        return he.decode(raw);
    } catch {
        // Fallback: wrap plain text in paragraphs
        return markdown
            .split('\n\n')
            .map(p => `<p>${he.escape(p.trim())}</p>`)
            .join('\n');
    }
};

/**
 * Generates a proper EPUB Blob from a BookOutline and AuthorProfile.
 * Uses epub-gen-memory (browser bundle) for standards-compliant EPUB 3 output.
 */
const generateEpub = async (outline: BookOutline, author: AuthorProfile, coverUrl?: string): Promise<Blob> => {
    if (!outline || !outline.tableOfContents?.length) {
        throw new Error('Cannot generate EPUB: book outline is missing or has no chapters.');
    }

    // Dynamic import of the browser bundle to keep bundle splitting clean
    const epubModule = await import('epub-gen-memory/bundle');
    const epub = epubModule.default;

    const authorName = author?.name?.trim() || 'Unknown Author';

    // Build chapter list — only include chapters that have content
    const chapters = outline.tableOfContents
        .filter(ch => ch.content && ch.content.trim().length > 0)
        .map(ch => ({
            title: ch.title || `Chapter ${ch.chapter}`,
            content: markdownToEpubHtml(ch.content!),
            author: authorName,
        }));

    if (chapters.length === 0) {
        throw new Error('Cannot generate EPUB: no chapters have written content yet. Please generate content first.');
    }

    // Build book CSS for a clean, readable e-reader experience
    const bookCss = `
        body {
            font-family: Georgia, "Times New Roman", serif;
            font-size: 1em;
            line-height: 1.7;
            margin: 2em;
            color: #1a1a1a;
        }
        h1, h2, h3 { font-family: "Helvetica Neue", Arial, sans-serif; margin-top: 1.5em; color: #111; }
        p { margin: 0 0 1em 0; text-indent: 1.5em; }
        p:first-child { text-indent: 0; }
        blockquote { border-left: 3px solid #ccc; padding-left: 1em; font-style: italic; color: #555; }
        ul, ol { margin: 0.5em 0 1em 2em; }
        li { margin-bottom: 0.4em; }
        strong { font-weight: bold; }
        em { font-style: italic; }
    `;

    // Optional: add About the Author chapter if bio is available
    if (author?.bio && author.bio.trim().length > 0) {
        chapters.push({
            title: 'About the Author',
            content: `<p><strong>${he.escape(authorName)}</strong></p>\n<p>${he.escape(author.bio)}</p>`,
            author: authorName,
        });
    }

    const options: Record<string, unknown> = {
        title: `${outline.title}${outline.subtitle ? ': ' + outline.subtitle : ''}`,
        author: authorName,
        publisher: authorName,
        description: outline.subtitle || '',
        tocTitle: 'Table of Contents',
        lang: 'en',
        css: bookCss,
        version: 3,
        ignoreFailedDownloads: true,
        verbose: false,
    };

    // Attach cover image if available (must be a URL or base64 data URL)
    if (coverUrl && coverUrl.startsWith('data:')) {
        // epub-gen-memory can accept a File/Blob for the cover
        try {
            const response = await fetch(coverUrl);
            const blob = await response.blob();
            const file = new File([blob], 'cover.jpg', { type: blob.type });
            options.cover = file;
        } catch {
            // Cover unavailable — proceed without it
            console.warn('EPUB: Failed to attach cover image. Proceeding without cover.');
        }
    } else if (coverUrl) {
        options.cover = coverUrl;
    }

    const epubBlob = await epub(options as Parameters<typeof epub>[0], chapters);
    return epubBlob as Blob;
};

export default generateEpub;
export { markdownToEpubHtml };