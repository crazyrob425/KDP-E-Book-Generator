/**
 * stitcher.ts
 *
 * Local (zero-token) step: concatenates scene drafts into a coherent chapter.
 *
 * Cleanup performed:
 *   • Removes duplicated transition phrases between scenes
 *   • Normalises heading levels (scene headings → consistent level)
 *   • Collapses triple+ blank lines to double
 *   • Removes stray JSON/preamble artefacts
 */

export interface StitchResult {
  markdown: string;
  wordCount: number;
}

/** Approximate word count */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Stitches an ordered array of scene markdown strings into a single chapter.
 * This is a purely local transformation — 0 LLM tokens.
 */
export function stitchScenes(scenes: string[]): StitchResult {
  if (scenes.length === 0) return { markdown: '', wordCount: 0 };

  const cleaned = scenes.map((scene, i) => {
    let s = scene;

    // Strip stray preambles ("Here is the scene:", "Scene 1:", etc.)
    s = s.replace(/^(here is|scene\s+\d+[:.]?|---+)\s*/gi, '');

    // Strip trailing JSON artefacts that leaked out
    s = s.replace(/\{[\s\S]*\}$/, '').trim();

    // Normalise headings: ### or #### → ##
    s = s.replace(/^#{3,}\s/gm, '## ');

    return s.trim();
  });

  // Join scenes with a scene break marker
  const joined = cleaned.join('\n\n---\n\n');

  // Collapse 3+ blank lines → 2
  const normalised = joined.replace(/\n{3,}/g, '\n\n');

  // Remove duplicate consecutive sentences (basic check)
  const deduped = removeDuplicateSentences(normalised);

  return {
    markdown: deduped.trim(),
    wordCount: countWords(deduped),
  };
}

/**
 * Lightweight duplicate-sentence removal: if the same sentence appears in
 * both the last 200 chars of the previous scene and the first 200 chars of
 * the next scene, remove it from the start of the next scene.
 */
function removeDuplicateSentences(text: string): string {
  // Split on scene break marker and process pairwise
  const parts = text.split('\n\n---\n\n');
  const result: string[] = [parts[0]];

  for (let i = 1; i < parts.length; i++) {
    const prev = parts[i - 1];
    const curr = parts[i];

    // Grab last sentence of prev
    const prevSentences = prev.match(/[^.!?]+[.!?]+/g) ?? [];
    const lastSentence = prevSentences[prevSentences.length - 1]?.trim() ?? '';

    // If the current part starts with essentially the same sentence, remove it
    if (lastSentence.length > 20 && curr.trimStart().startsWith(lastSentence)) {
      result.push(curr.trimStart().slice(lastSentence.length).trim());
    } else {
      result.push(curr);
    }
  }

  return result.join('\n\n---\n\n');
}
