import type { JSONContent } from '@tiptap/core';

/**
 * Debounce function - delays execution until after wait ms have elapsed
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Convert Tiptap JSON content to plain text
 */
export function editorToPlainText(doc: JSONContent | null): string {
  if (!doc || !doc.content) return '';

  const lines: string[] = [];

  function extractText(node: JSONContent): string {
    if (node.type === 'text') {
      return node.text || '';
    }
    if (node.content) {
      return node.content.map(extractText).join('');
    }
    return '';
  }

  for (const node of doc.content) {
    const text = extractText(node);
    if (text || node.type === 'paragraph') {
      lines.push(text);
    }
  }

  return lines.join('\n');
}

/**
 * Count words in text
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Count sentences in text
 */
export function countSentences(text: string): number {
  const matches = text.match(/[.!?]+/g);
  return matches ? matches.length : 0;
}

/**
 * Count paragraphs in text
 */
export function countParagraphs(text: string): number {
  if (!text.trim()) return 0;
  return text.split(/\n+/).filter(p => p.trim().length > 0).length;
}

/**
 * Count characters excluding whitespace
 */
export function countCharacters(text: string): number {
  return text.replace(/\s/g, '').length;
}

/**
 * Calculate Flesch Reading Ease score
 * Higher scores = easier to read (60-70 is standard)
 */
export function calculateFleschScore(text: string): number {
  const words = countWords(text);
  const sentences = countSentences(text);
  const syllables = countSyllables(text);

  if (words === 0 || sentences === 0) return 0;

  const score =
    206.835 -
    1.015 * (words / sentences) -
    84.6 * (syllables / words);

  return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
}

/**
 * Estimate syllable count (English approximation)
 */
function countSyllables(text: string): number {
  const words = text.toLowerCase().match(/[a-z]+/g) || [];
  let count = 0;

  for (const word of words) {
    // Count vowel groups
    let syllables = (word.match(/[aeiouy]+/g) || []).length;

    // Adjust for silent e
    if (word.endsWith('e') && syllables > 1) {
      syllables--;
    }

    // Every word has at least one syllable
    count += Math.max(1, syllables);
  }

  return count;
}

// Common English stop words to exclude from repetition analysis
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he',
  'she', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your',
  'his', 'our', 'their', 'mine', 'yours', 'hers', 'ours', 'theirs', 'what',
  'which', 'who', 'whom', 'whose', 'where', 'when', 'why', 'how', 'all',
  'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such',
  'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
  'just', 'also', 'now', 'here', 'there', 'then', 'once', 'if', 'because',
  'until', 'while', 'about', 'into', 'through', 'during', 'before', 'after',
  'above', 'below', 'between', 'under', 'again', 'further', 'any', 'said',
  'like', 'even', 'still', 'well', 'back', 'much', 'many', 'being', 'get',
  'got', 'going', 'go', 'went', 'come', 'came', 'know', 'knew', 'see',
  'saw', 'seen', 'take', 'took', 'make', 'made', 'say', 'think', 'thought'
]);

/**
 * Find repeated words (excluding stop words)
 */
export function findRepetitions(text: string, minCount: number = 3): Map<string, number> {
  const words = text.toLowerCase().match(/[a-z']+/g) || [];
  const counts = new Map<string, number>();

  for (const word of words) {
    if (word.length < 4 || STOP_WORDS.has(word)) continue;
    counts.set(word, (counts.get(word) || 0) + 1);
  }

  // Filter to only repeated words
  const repetitions = new Map<string, number>();
  for (const [word, count] of counts) {
    if (count >= minCount) {
      repetitions.set(word, count);
    }
  }

  // Sort by count descending
  return new Map(
    [...repetitions.entries()].sort((a, b) => b[1] - a[1])
  );
}

/**
 * Find long sentences (potential pacing issues)
 */
export function findLongSentences(text: string, maxWords: number = 30): string[] {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim());
  const long: string[] = [];

  for (const sentence of sentences) {
    const wordCount = countWords(sentence);
    if (wordCount > maxWords) {
      long.push(sentence.trim());
    }
  }

  return long;
}

/**
 * Full text analysis
 */
export function analyzeText(text: string) {
  const wordCount = countWords(text);
  const sentenceCount = countSentences(text);
  const paragraphCount = countParagraphs(text);
  const characterCount = countCharacters(text);

  return {
    wordCount,
    sentenceCount,
    paragraphCount,
    characterCount,
    avgSentenceLength: sentenceCount > 0 ? Math.round(wordCount / sentenceCount * 10) / 10 : 0,
    fleschScore: calculateFleschScore(text),
    repetitions: findRepetitions(text),
    longSentences: findLongSentences(text)
  };
}

/**
 * Format timestamp as relative time
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 7) {
    return new Date(timestamp).toLocaleDateString();
  }
  if (days > 0) {
    return `${days}d ago`;
  }
  if (hours > 0) {
    return `${hours}h ago`;
  }
  if (minutes > 0) {
    return `${minutes}m ago`;
  }
  return 'Just now';
}

/**
 * Format timestamp as date/time
 */
export function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

/**
 * Generate a unique ID.
 * Falls back to a manual UUID v4 when crypto.randomUUID() is unavailable
 * (e.g. Safari on insecure HTTP origins).
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // Safari throws in insecure contexts – fall through
    }
  }
  // RFC 4122 v4 UUID via crypto.getRandomValues
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Clamp a number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Download data as a file
 */
export function downloadFile(data: string | Blob, filename: string, type?: string): void {
  const blob = typeof data === 'string'
    ? new Blob([data], { type: type || 'application/json' })
    : data;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Escape HTML special characters to prevent XSS in generated markup
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
