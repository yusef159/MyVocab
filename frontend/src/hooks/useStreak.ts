import { useEffect } from 'react';
import { useVocabStore } from '../stores/vocabStore';

export function useStreak() {
  const { streak, loadStreak } = useVocabStore();

  useEffect(() => {
    loadStreak();
  }, [loadStreak]);

  return streak;
}
