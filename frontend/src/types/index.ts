export type WordStatus = 'new' | 'known' | 'problem';

/** Up to 3 example sentences per word */
export const MAX_EXAMPLE_SENTENCES = 3;

export interface Word {
  id: string;
  english: string;
  arabicMeanings: string[];  // Now supports multiple meanings
  /** 1–3 example sentences (optional legacy: exampleSentence is migrated to this) */
  exampleSentences: string[];
  topic?: string;
  status: WordStatus;
  wrongCount: number;
  correctCount: number;
  streak: number;  // Streak counter for problem words (0-3)
  createdAt: Date;
  lastReviewedAt?: Date;
}

/** Word with risk metadata for the recall reminder (known words at risk of being forgotten) */
export interface RiskWord extends Word {
  daysSinceReview: number;
}

export interface WordReviewEvent {
  id: string;
  wordId: string;
  result: 'known' | 'problem';
  delta: 1 | -1;
  createdAt: Date;
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

// -----------------------------
// Grammar learning types
// -----------------------------

export type GrammarLevelId = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export type GrammarExerciseType = 'mcq' | 'fillBlank' | 'rewrite' | 'freeSentence';

export type GrammarSkillStatus = 'not_started' | 'in_progress' | 'mastered';

export interface GrammarSkill {
  id: string;
  levelId: GrammarLevelId;
  title: string;
  description?: string;
  aiTopicHint?: string;
  order?: number;
}

export interface GrammarLessonExample {
  sentence: string;
  explanation?: string;
}

export interface GrammarLessonSection {
  title: string;
  body: string;
  examples?: GrammarLessonExample[];
  commonMistakes?: string[];
}

export interface GrammarLesson {
  skillId: string;
  levelId: GrammarLevelId;
  intro?: string;
  sections: GrammarLessonSection[];
}

export interface GrammarExerciseOption {
  id: string;
  text: string;
}

export interface GrammarExercise {
  id: string;
  skillId: string;
  levelId: GrammarLevelId;
  type: GrammarExerciseType;
  prompt: string;
  options?: GrammarExerciseOption[];
  correctOptionId?: string;
  correctAnswerText?: string;
  explanation?: string;
}

export interface GrammarProgress {
  skillId: string;
  levelId: GrammarLevelId;
  attempts: number;
  correct: number;
  masteryPercent: number;
  status: GrammarSkillStatus;
  lastResult?: 'correct' | 'incorrect';
  lastUpdated?: string; // ISO date string
}

export interface GrammarLevelSummary {
  id: GrammarLevelId;
  title: string;
  description?: string;
  skills: GrammarSkill[];
}

export interface GrammarCatalogResponse {
  levels: GrammarLevelSummary[];
}

export interface GrammarAnswerEvaluation {
  isCorrect: boolean;
  score: number;
  feedback: string;
  correctedAnswer?: string;
}
