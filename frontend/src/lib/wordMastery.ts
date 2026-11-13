import type { Word } from '../types';

export const MASTERY_LEVELS = [
  { id: 'new', label: 'New', min: 0, range: '0 days' },
  { id: 'learning', label: 'Learning', min: 1, range: '1–2 days' },
  { id: 'familiar', label: 'Familiar', min: 3, range: '3–5 days' },
  { id: 'strong', label: 'Strong', min: 6, range: '6–9 days' },
  { id: 'mastered', label: 'Mastered', min: 10, range: '10+ days' },
] as const;

export type MasteryLevel = typeof MASTERY_LEVELS[number];

export function getMasteryLevel(interval: number): MasteryLevel {
  return [...MASTERY_LEVELS].reverse().find(level => interval >= level.min) ?? MASTERY_LEVELS[0];
}

export function summarizeWordMastery(words: Pick<Word, 'interval'>[]) {
  return MASTERY_LEVELS.map(level => {
    const count = words.filter(word => getMasteryLevel(word.interval).id === level.id).length;
    return { ...level, count, percent: words.length ? count / words.length * 100 : 0 };
  });
}
