

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
    // STUB: Real EPUB generation disabled due to dependency issues.
    console.warn("EPUB generation is currently disabled.");
    return new Blob(["EPUB generation disabled in this version."], { type: "text/plain" });
};

export default generateEpub;