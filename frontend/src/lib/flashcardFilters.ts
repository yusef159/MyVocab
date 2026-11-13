import type { Word } from '../types';

export type FilterType = 'all' | 'new' | 'problem' | 'risk' | 'date';
export type ProgressFilter = 'all' | 'moderate' | 'hard' | 'very hard';

// Calculate learning progress percentage
export function calculateLearningPercentage(correctCount: number, wrongCount: number): number {
  const total = correctCount + wrongCount;
  if (total === 0) return 0;
  return Math.round((correctCount / total) * 100);
}

// Filter words based on learning progress
function filterByProgress(words: Word[], progressFilter: ProgressFilter): Word[] {
  if (progressFilter === 'all') return words;
  
  return words.filter(w => {
    const progress = calculateLearningPercentage(w.correctCount, w.wrongCount);
    switch (progressFilter) {
      case 'moderate':
        return progress >= 66 && progress < 90;
      case 'hard':
        return progress >= 33 && progress < 66;
      case 'very hard':
        return progress < 33;
      default:
        return true;
    }
  });
}

// Filter words based on selection
export function filterWords(
  words: Word[],
  riskWords: Word[],
  filterType: FilterType,
  dateRange: number,
  progressFilter?: ProgressFilter,
  selectedTag = ''
): Word[] {
  if (selectedTag) {
    words = words.filter(word => word.tags?.includes(selectedTag));
    riskWords = riskWords.filter(word => word.tags?.includes(selectedTag));
  }
  const now = new Date();
  switch (filterType) {
    case 'new':
      return words.filter(w => w.status === 'new');
    case 'problem': {
      // Only show words with status "problem" (not known)
      let problemWords = words.filter(w => w.status === 'problem');
      
      // Apply learning progress filter if specified
      if (progressFilter) {
        problemWords = filterByProgress(problemWords, progressFilter);
      }
      
      return problemWords;
    }
    case 'all': {
      // Apply learning progress filter if specified
      if (progressFilter) {
        return filterByProgress(words, progressFilter);
      }
      return words;
    }
    case 'risk':
      return riskWords;
    case 'date': {
      const cutoff =
        dateRange === 0
          ? (() => {
              const startOfToday = new Date(now);
              startOfToday.setHours(0, 0, 0, 0);
              return startOfToday;
            })()
          : new Date(now.getTime() - dateRange * 24 * 60 * 60 * 1000);
      return words.filter(w => new Date(w.createdAt) >= cutoff);
    }
    default:
      return words;
  }
}

