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
  createdAt: Date;
  lastReviewedAt?: Date;
}

export interface StreakData {
  id: string;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string;
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
