import { create } from 'zustand';
import axios from 'axios';
import type { Word, WordSuggestion, StreakData } from '../types';
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
} from '../db';

// Use relative URL since frontend is served from the same server as the API
const API_URL = '';

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

  // Actions
  loadWords: () => Promise<void>;
  loadProblemWords: () => Promise<void>;
  loadStats: () => Promise<void>;
  loadStreak: () => Promise<void>;
  
  generateWords: (count: number, topic?: string, level?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2') => Promise<void>;
  suggestMeanings: (word: string) => Promise<void>;
  clearSuggestions: () => void;
  
  saveWord: (
    english: string,
    arabicMeanings: string[],
    exampleSentence: string,
    topic?: string
  ) => Promise<{ success: boolean; isDuplicate: boolean }>;
  
  markAsKnown: (id: string) => Promise<void>;
  markAsProblem: (id: string) => Promise<void>;
  markProblemAsKnown: (id: string) => Promise<void>;
  markProblemAsStillProblem: (id: string) => Promise<void>;
  removeWord: (id: string) => Promise<void>;
  updateWordContent: (id: string, arabicMeanings: string[], exampleSentence: string) => Promise<void>;
  importWords: (words: Array<{ english: string; arabicMeanings: string[]; exampleSentence: string }>) => Promise<{ added: number; skipped: number; skippedWords: string[] }>;
  
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

  generateScenarios: (words: Word[]) => Promise<Array<{ scenarioId: string; description: string; wordIds: string[] }>>;
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

  saveWord: async (english, arabicMeanings, exampleSentence, topic) => {
    try {
      const result = await addWord({ english, arabicMeanings, exampleSentence, topic });
      
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
    try {
      await incrementCorrectCount(id);
      await updateStreak();
      await get().loadWords();
      await get().loadStats();
      await get().loadStreak();
    } catch (error) {
      set({ error: 'Failed to update word' });
    }
  },

  markAsProblem: async (id) => {
    try {
      await incrementWrongCount(id);
      await updateStreak();
      await get().loadWords();
      await get().loadStats();
      await get().loadStreak();
    } catch (error) {
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

  updateWordContent: async (id, arabicMeanings, exampleSentence) => {
    try {
      await dbUpdateWordContent(id, { arabicMeanings, exampleSentence });
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

  analyzeSentence: async (words, sentence, targetWordId, scenarioDescription) => {
    try {
      const response = await axios.post(`${API_URL}/api/words/test/feedback`, {
        words: words.map(w => ({
          id: w.id,
          english: w.english,
          arabicMeanings: w.arabicMeanings,
          exampleSentence: w.exampleSentence,
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
          exampleSentence: w.exampleSentence,
        })),
      });
      return response.data.prompt;
    } catch (error) {
      console.error('Error generating context prompt:', error);
      throw new Error('Failed to generate context prompt');
    }
  },

  generateScenarios: async (words) => {
    try {
      const response = await axios.post(`${API_URL}/api/words/test/scenarios`, {
        words: words.map(w => ({
          id: w.id,
          english: w.english,
          arabicMeanings: w.arabicMeanings,
          exampleSentence: w.exampleSentence,
        })),
      });
      return response.data.scenarios ?? [];
    } catch (error) {
      console.error('Error generating scenarios:', error);
      throw new Error('Failed to generate scenarios');
    }
  },
}));
