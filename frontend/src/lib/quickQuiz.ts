import type { Word } from '../types';

export function selectQuickQuizWords(words: Word[], riskWords: Word[], dailyGoal: number) {
  const goal = Number.isFinite(dailyGoal) ? Math.max(1, Math.floor(dailyGoal)) : 20;
  return { risk: riskWords.slice(0, goal), problem: words.filter(word => word.status === 'problem') };
}

