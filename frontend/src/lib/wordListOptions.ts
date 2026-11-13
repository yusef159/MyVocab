import type { Word } from '../types';

export const WORD_SORT_OPTIONS = [
  { value: 'newest', label: 'Newest added' },
  { value: 'oldest', label: 'Oldest added' },
  { value: 'az', label: 'Alphabetical: A–Z' },
  { value: 'za', label: 'Alphabetical: Z–A' },
  { value: 'mistakes', label: 'Most mistakes' },
  { value: 'progress', label: 'Lowest learning progress' },
  { value: 'reviewed', label: 'Least recently reviewed' },
  { value: 'risk', label: 'At risk first' },
] as const;

export type WordSort = typeof WORD_SORT_OPTIONS[number]['value'];
export const WORD_SORT_STORAGE_KEY = 'my-words-sort';

export function normalizeWordSort(value: unknown): WordSort {
  return WORD_SORT_OPTIONS.find(option => option.value === value)?.value ?? 'newest';
}

export function matchesWordTags(word: Pick<Word, 'tags'>, selected: string[], includeUntagged: boolean): boolean {
  if (!selected.length && !includeUntagged) return true;
  const tags = word.tags ?? [];
  return (includeUntagged && !tags.length) || selected.some(tag => tags.includes(tag));
}

function timestamp(date: Date | undefined): number {
  if (!date) return 0;
  const result = new Date(date).getTime();
  return Number.isFinite(result) ? result : 0;
}

export function sortWords(words: Word[], sort: WordSort, now = Date.now()): Word[] {
  const progress = (word: Word) => {
    const total = word.correctCount + word.wrongCount;
    return total ? word.correctCount / total : 0;
  };
  const riskDue = (word: Word) => {
    if (word.status !== 'known' || word.interval <= 0 || !word.lastReviewedAt) return Infinity;
    const due = timestamp(word.lastReviewedAt) + word.interval * 86400000;
    return due <= now ? due : Infinity;
  };
  return [...words].sort((a, b) => {
    let difference = 0;
    switch (sort) {
      case 'newest': difference = timestamp(b.createdAt) - timestamp(a.createdAt); break;
      case 'oldest': difference = timestamp(a.createdAt) - timestamp(b.createdAt); break;
      case 'az': difference = a.english.localeCompare(b.english); break;
      case 'za': difference = b.english.localeCompare(a.english); break;
      case 'mistakes': difference = b.wrongCount - a.wrongCount; break;
      case 'progress': difference = progress(a) - progress(b); break;
      case 'reviewed': difference = timestamp(a.lastReviewedAt) - timestamp(b.lastReviewedAt); break;
      case 'risk': {
        const aDue = riskDue(a);
        const bDue = riskDue(b);
        difference = aDue === bDue ? 0 : aDue < bDue ? -1 : 1;
        break;
      }
    }
    return difference || a.english.localeCompare(b.english) || a.id.localeCompare(b.id);
  });
}
