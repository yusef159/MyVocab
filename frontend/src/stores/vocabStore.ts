import { create } from 'zustand';
import axios from 'axios';
import type {
  Word,
  WordSuggestion,
  StreakData,
  WordReviewEvent,
  ReadingArticle,
  ReadingFluencyEvaluation,
  ReadingArticleLength,
} from '../types';
import {
  getAllWords,
  getWordsByStatus,
  addWord,
  incrementWrongCount,
  incrementCorrectCount,
  deleteWord,
  bulkAddWords,
  getWordStats,
  getStreakData,
  updateStreak,
  updateWordContent as dbUpdateWordContent,
  updateWordReviewCounts as dbUpdateWordReviewCounts,
  getReviewCountsByDateRange,
  getEarliestReviewDate,
  getWordReviewHistory as dbGetWordReviewHistory,
} from '../db';

// Use relative URL since frontend is served from the same server as the API
const API_URL = '';
const MAX_READING_ARTICLE_WORDS = 120;

function applyLocalReviewUpdate(
  state: Pick<VocabState, 'words' | 'stats' | 'streak'>,
  id: string,
  result: 'known' | 'problem'
): Pick<VocabState, 'words' | 'stats' | 'streak'> {
  let didUpdate = false;
  const now = new Date();
  const nextWords = state.words.map((word) => {
    if (word.id !== id) return word;
    didUpdate = true;

    if (result === 'problem') {
      return {
        ...word,
        wrongCount: word.wrongCount + 1,
        status: 'problem' as const,
        streak: 0,
        lastReviewedAt: now,
      };
    }

    const nextCorrect = word.correctCount + 1;
    let nextStatus: Word['status'];
    let nextStreak: number;

    if (word.status === 'new') {
      nextStatus = 'known';
      nextStreak = 0;
    } else if (word.status === 'problem') {
      nextStreak = word.streak + 1;
      if (nextStreak >= 3) {
        nextStatus = 'known';
        nextStreak = 0;
      } else {
        nextStatus = 'problem';
      }
    } else {
      nextStatus = 'known';
      nextStreak = 0;
    }

    return {
      ...word,
      correctCount: nextCorrect,
      status: nextStatus,
      streak: nextStreak,
      lastReviewedAt: now,
    };
  });

  if (!didUpdate) {
    return state;
  }

  const previousWord = state.words.find((word) => word.id === id);
  const currentWord = nextWords.find((word) => word.id === id);
  const nextStats = { ...state.stats };

  if (previousWord && currentWord && previousWord.status !== currentWord.status) {
    const prevStatusKey = previousWord.status as 'new' | 'known' | 'problem';
    const nextStatusKey = currentWord.status as 'new' | 'known' | 'problem';
    nextStats[prevStatusKey] = Math.max(0, nextStats[prevStatusKey] - 1);
    nextStats[nextStatusKey] += 1;
  }

  let nextStreak = state.streak;
  if (state.streak) {
    const today = now.toISOString().slice(0, 10);
    const isSameDay = state.streak.reviewsDate === today;
    nextStreak = {
      ...state.streak,
      reviewsDate: today,
      reviewsToday: (isSameDay ? state.streak.reviewsToday : 0) + 1,
    };
  }

  return {
    words: nextWords,
    stats: nextStats,
    streak: nextStreak,
  };
}

interface VocabState {
  // Words
  words: Word[];
  problemWords: Word[];
  isLoading: boolean;
  error: string | null;

  // Suggestions from AI
  suggestions: WordSuggestion[];
  isSuggestingLoading: boolean;

  // Stats
  stats: {
    total: number;
    known: number;
    problem: number;
    new: number;
  };
  streak: StreakData | null;
  reviewCounts: { date: string; count: number }[];

  // Actions
  loadWords: () => Promise<void>;
  loadProblemWords: () => Promise<void>;
  loadStats: () => Promise<void>;
  loadStreak: () => Promise<void>;
  loadReviewCounts: (startDate: string, endDate: string) => Promise<void>;
  getEarliestReviewDate: () => Promise<string | null>;
  
  generateWords: (count: number, topic?: string, level?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2') => Promise<void>;
  suggestMeanings: (word: string) => Promise<void>;
  clearSuggestions: () => void;
  
  saveWord: (
    english: string,
    arabicMeanings: string[],
    exampleSentences: string[],
    topic?: string
  ) => Promise<{ success: boolean; isDuplicate: boolean }>;
  
  markAsKnown: (id: string) => Promise<void>;
  markAsProblem: (id: string) => Promise<void>;
  markProblemAsKnown: (id: string) => Promise<void>;
  markProblemAsStillProblem: (id: string) => Promise<void>;
  removeWord: (id: string) => Promise<void>;
  updateWordContent: (id: string, arabicMeanings: string[], exampleSentences: string[]) => Promise<void>;
  importWords: (words: Array<{ english: string; arabicMeanings: string[]; exampleSentences: string[] }>) => Promise<{ added: number; skipped: number; skippedWords: string[] }>;
  updateWordReviewCounts: (id: string, correctCount: number, wrongCount: number) => Promise<void>;
  getWordReviewHistory: (wordId: string) => Promise<WordReviewEvent[]>;
  
  analyzeSentence: (words: Word[], sentence: string, targetWordId?: string, scenarioDescription?: string) => Promise<{
    detectedWords: string[];
    grammarFeedback: { isCorrect: boolean; issues: string[]; corrections: string };
    contextFeedback: { isAppropriate: boolean; issues: string[]; explanation: string };
    naturalnessFeedback: { isNatural: boolean; comment: string };
    scenarioFitFeedback?: { fitsScenario: boolean; comment: string };
    score: number;
    overallFeedback: string;
  }>;
  generateContextPrompt: (words: Word[]) => Promise<{ prompt: string; suggestedFocus?: string[]; context?: string }>;

  generateScenarios: (words: Word[], wordsPerScenario?: 1 | 2 | 3) => Promise<Array<{ scenarioId: string; description: string; wordIds: string[] }>>;
  generateReadingArticleFromWords: (
    words: Word[],
    length: ReadingArticleLength
  ) => Promise<{
    article: ReadingArticle;
    expectedWords: string[];
  }>;
  generateReadingArticleFromKnownWords: (length: ReadingArticleLength) => Promise<{
    article: ReadingArticle;
    expectedWords: string[];
  }>;
  evaluateReadingFluency: (
    audioBlob: Blob,
    articleText: string,
    expectedWords: string[],
    audioDurationSeconds?: number
  ) => Promise<ReadingFluencyEvaluation>;
}

export const useVocabStore = create<VocabState>((set, get) => ({
  words: [],
  problemWords: [],
  isLoading: false,
  error: null,
  suggestions: [],
  isSuggestingLoading: false,
  stats: { total: 0, known: 0, problem: 0, new: 0 },
  streak: null,
  reviewCounts: [],

  loadWords: async () => {
    set({ isLoading: true, error: null });
    try {
      const words = await getAllWords();
      set({ words, isLoading: false });
    } catch (error) {
      set({ error: 'Failed to load words', isLoading: false });
    }
  },

  loadProblemWords: async () => {
    set({ isLoading: true, error: null });
    try {
      const problemWords = await getWordsByStatus('problem');
      set({ problemWords, isLoading: false });
    } catch (error) {
      set({ error: 'Failed to load problem words', isLoading: false });
    }
  },

  loadStats: async () => {
    try {
      const stats = await getWordStats();
      set({ stats });
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  },

  loadStreak: async () => {
    try {
      const streak = await getStreakData();
      set({ streak });
    } catch (error) {
      console.error('Failed to load streak:', error);
    }
  },

  loadReviewCounts: async (startDate, endDate) => {
    try {
      const reviewCounts = await getReviewCountsByDateRange(startDate, endDate);
      set({ reviewCounts });
    } catch (error) {
      console.error('Failed to load review counts:', error);
      set({ reviewCounts: [] });
    }
  },

  getEarliestReviewDate: async () => {
    try {
      return await getEarliestReviewDate();
    } catch (error) {
      console.error('Failed to get earliest review date:', error);
      return null;
    }
  },

  generateWords: async (count, topic, level) => {
    set({ isSuggestingLoading: true, error: null, suggestions: [] });
    try {
      const response = await axios.post(`${API_URL}/api/words/generate`, {
        count,
        topic: topic || undefined,
        level: level || 'B2',
      });
      set({ suggestions: response.data.words, isSuggestingLoading: false });
    } catch (error) {
      set({ error: 'Failed to generate words', isSuggestingLoading: false });
    }
  },

  suggestMeanings: async (word) => {
    set({ isSuggestingLoading: true, error: null, suggestions: [] });
    try {
      const response = await axios.post(`${API_URL}/api/words/suggest`, { word });
      set({ suggestions: [response.data.suggestion], isSuggestingLoading: false });
    } catch (error) {
      set({ error: 'Failed to get suggestions', isSuggestingLoading: false });
    }
  },

  clearSuggestions: () => {
    set({ suggestions: [], error: null });
  },

  saveWord: async (english, arabicMeanings, exampleSentences, topic) => {
    try {
      const result = await addWord({ english, arabicMeanings, exampleSentences, topic });
      
      if (result.isDuplicate) {
        set({ error: `Word "${english}" already exists in your vocabulary` });
        return { success: false, isDuplicate: true };
      }
      
      await updateStreak();
      await get().loadWords();
      await get().loadStats();
      await get().loadStreak();
      set({ error: null });
      return { success: true, isDuplicate: false };
    } catch (error) {
      set({ error: 'Failed to save word' });
      return { success: false, isDuplicate: false };
    }
  },

  markAsKnown: async (id) => {
    set((state) => ({
      ...applyLocalReviewUpdate(state, id, 'known'),
      error: null,
    }));

    try {
      await incrementCorrectCount(id);
      const streak = await updateStreak();
      set({ streak, error: null });
    } catch (error) {
      await Promise.allSettled([get().loadWords(), get().loadStats(), get().loadStreak()]);
      set({ error: 'Failed to update word' });
    }
  },

  markAsProblem: async (id) => {
    set((state) => ({
      ...applyLocalReviewUpdate(state, id, 'problem'),
      error: null,
    }));

    try {
      await incrementWrongCount(id);
      const streak = await updateStreak();
      set({ streak, error: null });
    } catch (error) {
      await Promise.allSettled([get().loadWords(), get().loadStats(), get().loadStreak()]);
      set({ error: 'Failed to update word' });
    }
  },

  markProblemAsKnown: async (id) => {
    try {
      await incrementCorrectCount(id);
      await updateStreak();
      await get().loadProblemWords();
      await get().loadStats();
      await get().loadStreak();
    } catch (error) {
      set({ error: 'Failed to update word' });
    }
  },

  markProblemAsStillProblem: async (id) => {
    try {
      await incrementWrongCount(id);
      await updateStreak();
      await get().loadProblemWords();
      await get().loadStats();
      await get().loadStreak();
    } catch (error) {
      set({ error: 'Failed to update word' });
    }
  },

  removeWord: async (id) => {
    try {
      await deleteWord(id);
      await get().loadWords();
      await get().loadProblemWords();
      await get().loadStats();
    } catch (error) {
      set({ error: 'Failed to delete word' });
    }
  },

  updateWordReviewCounts: async (id, correctCount, wrongCount) => {
    try {
      await dbUpdateWordReviewCounts(id, correctCount, wrongCount);
      await get().loadWords();
      await get().loadStats();
    } catch (error) {
      set({ error: 'Failed to update review counts' });
    }
  },

  updateWordContent: async (id, arabicMeanings, exampleSentences) => {
    try {
      await dbUpdateWordContent(id, { arabicMeanings, exampleSentences });
      await get().loadWords();
      await get().loadProblemWords();
    } catch (error) {
      set({ error: 'Failed to update word' });
    }
  },

  importWords: async (words) => {
    try {
      const result = await bulkAddWords(words);
      await get().loadWords();
      await get().loadStats();
      return result;
    } catch (error) {
      set({ error: 'Failed to import words' });
      return { added: 0, skipped: 0, skippedWords: [] };
    }
  },

  getWordReviewHistory: async (wordId) => {
    try {
      return await dbGetWordReviewHistory(wordId);
    } catch (error) {
      console.error('Failed to load review history:', error);
      return [];
    }
  },

  analyzeSentence: async (words, sentence, targetWordId, scenarioDescription) => {
    try {
      const response = await axios.post(`${API_URL}/api/words/test/feedback`, {
        words: words.map(w => ({
          id: w.id,
          english: w.english,
          arabicMeanings: w.arabicMeanings,
          exampleSentence: (w.exampleSentences && w.exampleSentences[0]) || '',
        })),
        sentence,
        targetWordId,
        scenarioDescription,
      });
      return response.data.feedback;
    } catch (error) {
      console.error('Error analyzing sentence:', error);
      throw new Error('Failed to analyze sentence');
    }
  },

  generateContextPrompt: async (words) => {
    try {
      const response = await axios.post(`${API_URL}/api/words/test/prompt`, {
        words: words.map(w => ({
          english: w.english,
          arabicMeanings: w.arabicMeanings,
          exampleSentence: (w.exampleSentences && w.exampleSentences[0]) || '',
        })),
      });
      return response.data.prompt;
    } catch (error) {
      console.error('Error generating context prompt:', error);
      throw new Error('Failed to generate context prompt');
    }
  },

  generateScenarios: async (words, wordsPerScenario = 2) => {
    try {
      const response = await axios.post(`${API_URL}/api/words/test/scenarios`, {
        words: words.map(w => ({
          id: w.id,
          english: w.english,
          arabicMeanings: w.arabicMeanings,
          exampleSentence: (w.exampleSentences && w.exampleSentences[0]) || '',
        })),
        wordsPerScenario,
      });
      return response.data.scenarios ?? [];
    } catch (error) {
      console.error('Error generating scenarios:', error);
      throw new Error('Failed to generate scenarios');
    }
  },

  generateReadingArticleFromWords: async (words, length) => {
    try {
      if (words.length === 0) {
        throw new Error('No words available to build a reading article.');
      }

      // Avoid oversized payloads and overly long prompts for article generation.
      const wordsForArticle = words.slice(0, MAX_READING_ARTICLE_WORDS);

      const maxWordsByLength: Record<ReadingArticleLength, 80 | 140 | 200> = {
        short: 80,
        medium: 140,
        large: 200,
      };

      const response = await axios.post(`${API_URL}/api/words/reading/article`, {
        words: wordsForArticle.map((w) => ({
          id: w.id,
          english: w.english,
          arabicMeanings: w.arabicMeanings,
          exampleSentence: (w.exampleSentences && w.exampleSentences[0]) || '',
        })),
        maxWords: maxWordsByLength[length],
      });

      const article = response.data.article as ReadingArticle;
      const usedWordsFromIds = wordsForArticle
        .filter((w) => article.usedWordIds.includes(w.id))
        .map((w) => w.english);
      const expectedWords =
        usedWordsFromIds.length > 0
          ? usedWordsFromIds
          : wordsForArticle.map((w) => w.english);

      return {
        article,
        expectedWords,
      };
    } catch (error) {
      console.error('Error generating reading article:', error);
      throw new Error('Failed to generate reading article');
    }
  },

  generateReadingArticleFromKnownWords: async (length) => {
    try {
      if (get().words.length === 0) {
        await get().loadWords();
      }

      const knownWords = get().words.filter((w) => w.status === 'known');
      if (knownWords.length === 0) {
        throw new Error('No known words available. Mark words as known first.');
      }

      return await get().generateReadingArticleFromWords(knownWords, length);
    } catch (error) {
      console.error('Error generating reading article:', error);
      throw new Error('Failed to generate reading article');
    }
  },

  evaluateReadingFluency: async (
    audioBlob,
    articleText,
    expectedWords,
    audioDurationSeconds
  ) => {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'reading-audio.webm');
      formData.append('articleText', articleText);
      formData.append('expectedWords', JSON.stringify(expectedWords));
      if (typeof audioDurationSeconds === 'number' && Number.isFinite(audioDurationSeconds)) {
        formData.append('audioDurationSeconds', String(audioDurationSeconds));
      }

      const response = await axios.post(`${API_URL}/api/words/reading/evaluate`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return response.data.evaluation as ReadingFluencyEvaluation;
    } catch (error) {
      console.error('Error evaluating reading fluency:', error);
      throw new Error('Failed to evaluate reading fluency');
    }
  },
}));
