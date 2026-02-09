export type WordStatus = 'new' | 'known' | 'problem';

export interface Word {
  id: string;
  english: string;
  arabicMeanings: string[];  // Now supports multiple meanings
  exampleSentence: string;
  topic?: string;
  status: WordStatus;
  wrongCount: number;
  correctCount: number;
  streak: number;  // Streak counter for problem words (0-3)
  createdAt: Date;
  lastReviewedAt?: Date;
}

export interface StreakData {
  id: string;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string; // Last day streak was incremented (last day with 20+ reviews)
  reviewsToday: number; // Number of word reviews today (can be same word multiple times)
  reviewsDate: string; // The date that reviewsToday belongs to
}

export interface WordSuggestion {
  english: string;
  arabicMeanings: string[];
  exampleSentences: string[];
}

export interface GenerateWordsRequest {
  count: number;
  topic?: string;
}

export interface GenerateWordsResponse {
  words: WordSuggestion[];
}

export interface SuggestMeaningsRequest {
  word: string;
}

export interface SuggestMeaningsResponse {
  suggestion: WordSuggestion;
}
