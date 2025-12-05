

import { BookOutline, AuthorProfile } from '../types';

const simpleMarkdownToHtml = (markdown: string): string => {
    if (!markdown) return '';
    const lines = markdown.split('\n');
    let html = '';
    let inList = false;

    const closeList = () => {
        if (inList) {
            html += '</ul>\n';
            inList = false;
        }
    };

    for (const line of lines) {
        let processedLine = line.trim();

        // Handle bold and italics first
        processedLine = processedLine
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');

        if (processedLine.startsWith('### ')) {
            closeList();
            html += `<h3>${processedLine.substring(4)}</h3>\n`;
        } else if (processedLine.startsWith('## ')) {
            closeList();
            html += `<h2>${processedLine.substring(3)}</h2>\n`;
        } else if (processedLine.startsWith('# ')) {
            closeList();
            html += `<h1>${processedLine.substring(2)}</h1>\n`;
        } else if (processedLine.startsWith('* ')) {
            if (!inList) {
                html += '<ul>\n';
                inList = true;
            }
            html += `<li>${processedLine.substring(2)}</li>\n`;
        } else if (processedLine) {
            closeList();
            html += `<p>${processedLine}</p>\n`;
        } else {
             html += '<br />';
        }
    }

    closeList(); // Ensure any open list is closed at the end of the content.
    return html;
};

const generateEpub = async (outline: BookOutline, author: AuthorProfile, coverUrl?: string): Promise<Blob> => {
    const content = outline.tableOfContents.map(chapter => {
        let chapterHtml = '';
        if (chapter.imageUrl) {
            // epub-gen-es supports data URLs directly for images
            chapterHtml += `<img src="${chapter.imageUrl}" alt="Illustration for ${chapter.title}" style="max-width: 100%; height: auto; display: block; margin: 1em 0;" />`;
        }
        chapterHtml += simpleMarkdownToHtml(chapter.content || '');

        // Add CTA if configured
        if (author.marketing?.includeInEpub && author.marketing.ctaText && author.marketing.ctaUrl) {
            chapterHtml += `
                <div style="margin-top: 3em; padding-top: 1.5em; border-top: 1px solid #ccc; text-align: center;">
                    <p style="margin-bottom: 1em; font-style: italic;">Enjoying the book?</p>
                    <a href="${author.marketing.ctaUrl}" style="display: inline-block; background-color: #6d28d9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; border: none;">
                        ${author.marketing.ctaText}
                    </a>
                </div>
            `;
        }

        return {
            title: chapter.title,
            data: chapterHtml
        };
    });

    const options = {
        title: outline.title,
        author: author.name,
        publisher: author.name, // Can be customized
        cover: coverUrl, // Optional: URL or data: URL
        content: content,
        css: `body { font-family: sans-serif; line-height: 1.6; } h1, h2, h3 { line-height: 1.2; } a { color: #6d28d9; }`,
    };

    // Robustly handle Epub instantiation using dynamic import
    let EpubGen;
    try {
         const EpubImport = await import('epub-gen-es');
         
         // Check if module exists at all
         if (!EpubImport) throw new Error("Epub module not found");
         
         // Try to find the constructor in various export locations
         EpubGen = (EpubImport as any).default || EpubImport;
         
         // Some browser bundles put the class under a named export or nested default
         if (typeof EpubGen !== 'function') {
             if ((EpubImport as any).EpubGen) {
                 EpubGen = (EpubImport as any).EpubGen;
             } else if ((EpubImport as any).default && (EpubImport as any).default.EpubGen) {
                 EpubGen = (EpubImport as any).default.EpubGen;
             }
         }
         
         // Fallback to window object if import didn't work but script loaded
         if (typeof EpubGen !== 'function' && typeof (window as any).EpubGen === 'function') {
             EpubGen = (window as any).EpubGen;
         }

         if (typeof EpubGen !== 'function') {
             console.error("EpubImport structure:", EpubImport);
             throw new Error("Epub generator constructor not found. The library might not be compatible.");
         }
    } catch (e) {
        console.error("Failed to load epub-gen-es", e);
        throw new Error("EPUB generation library failed to load.");
    }
    
    try {
        const epub = new EpubGen(options);
        const blob = await epub.genEpub();
        return blob;
    } catch (e) {
        console.error("EPUB generation logic error", e);
        throw new Error("Failed to generate EPUB file.");
    }
};

export default generateEpub;