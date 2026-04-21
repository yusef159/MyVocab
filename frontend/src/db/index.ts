import axios from 'axios';
import Dexie from 'dexie';
import type { Word, RiskWord, StreakData, WordReviewEvent, GrammarProgress } from '../types';

export interface DailyReviewCount {
  date: string; // YYYY-MM-DD
  count: number;
}

export type FlashcardSessionFilterType = 'all' | 'new' | 'problem' | 'risk' | 'date';

export interface FlashcardSessionSnapshot {
  wordIds: string[];
  currentIndex: number;
  filterType: FlashcardSessionFilterType;
  dateRange: number;
  savedAt: string;
  knownCount: number;
  problemCount: number;
}

export type AppStateKey =
  | 'flashcards:last_completed_session'
  | 'flashcards:active_session'
  | 'flashcards:session_size'
  | 'risk:completed_date'
  | 'reading_fluency:state';

const API_URL = '';

export async function wordExists(english: string): Promise<boolean> {
  const res = await axios.get<{ exists: boolean }>(`${API_URL}/api/data/words/exists`, {
    params: { english },
  });
  return res.data.exists;
}

export async function addWord(word: Omit<Word, 'id' | 'createdAt' | 'wrongCount' | 'correctCount' | 'status' | 'streak'>): Promise<{ id: string | null; isDuplicate: boolean }> {
  const res = await axios.post<{ id: string | null; isDuplicate: boolean }>(`${API_URL}/api/data/words`, {
    english: word.english,
    arabicMeanings: word.arabicMeanings,
    exampleSentences: word.exampleSentences,
    topic: word.topic,
  });
  return res.data;
}

export async function getAllWords(): Promise<Word[]> {
  const res = await axios.get<{ words: Word[] }>(`${API_URL}/api/data/words`);
  return res.data.words;
}

export async function getWordsByStatus(status: Word['status']): Promise<Word[]> {
  const res = await axios.get<{ words: Word[] }>(`${API_URL}/api/data/words/status/${status}`);
  return res.data.words;
}

/** Min days since last review to consider a known word "at risk" of being forgotten */
export async function getRiskWords(): Promise<RiskWord[]> {
  const res = await axios.get<{ words: RiskWord[] }>(`${API_URL}/api/data/words/risk`);
  return res.data.words;
}

export async function incrementWrongCount(id: string): Promise<void> {
  await axios.post(`${API_URL}/api/data/words/${id}/review`, { result: 'problem' });
}

export async function incrementCorrectCount(id: string): Promise<void> {
  await axios.post(`${API_URL}/api/data/words/${id}/review`, { result: 'known' });
}

/**
 * Manually update a word's review counts.
 * Used from the UI when the user edits the Known / Didn't Know counters.
 */
export async function updateWordReviewCounts(id: string, correctCount: number, wrongCount: number): Promise<void> {
  await axios.patch(`${API_URL}/api/data/words/${id}/review-counts`, { correctCount, wrongCount });
}

export async function getWordReviewHistory(wordId: string): Promise<WordReviewEvent[]> {
  const res = await axios.get<{ events: WordReviewEvent[] }>(`${API_URL}/api/data/words/${wordId}/reviews`);
  return res.data.events;
}

export async function updateWordContent(
  id: string,
  updates: { arabicMeanings?: string[]; exampleSentences?: string[] }
): Promise<void> {
  await axios.patch(`${API_URL}/api/data/words/${id}/content`, updates);
}

export async function deleteWord(id: string): Promise<void> {
  await axios.delete(`${API_URL}/api/data/words/${id}`);
}

export async function bulkAddWords(words: Array<{
  english: string;
  arabicMeanings: string[];
  exampleSentences: string[];
}>): Promise<{ added: number; skipped: number; skippedWords: string[] }> {
  const res = await axios.post<{ added: number; skipped: number; skippedWords: string[] }>(
    `${API_URL}/api/data/words/import`,
    words
  );
  return res.data;
}

export async function getWordStats(): Promise<{
  total: number;
  known: number;
  problem: number;
  new: number;
}> {
  const res = await axios.get<{ total: number; known: number; problem: number; new: number }>(`${API_URL}/api/data/words/stats`);
  return res.data;
}

// Streak operations
export async function getStreakData(): Promise<StreakData> {
  const res = await axios.get<StreakData>(`${API_URL}/api/data/streak`);
  return res.data;
}

export async function updateStreak(): Promise<StreakData> {
  const res = await axios.post<StreakData>(`${API_URL}/api/data/streak/increment`);
  return res.data;
}

export async function getReviewCountsByDateRange(
  startDate: string,
  endDate: string
): Promise<{ date: string; count: number }[]> {
  const res = await axios.get<{ counts: { date: string; count: number }[] }>(`${API_URL}/api/data/reviews/counts`, {
    params: { startDate, endDate },
  });
  return res.data.counts;
}

export async function getEarliestReviewDate(): Promise<string | null> {
  const res = await axios.get<{ date: string | null }>(`${API_URL}/api/data/reviews/earliest`);
  return res.data.date;
}

export async function getFlashcardsLastCompletedSession(): Promise<FlashcardSessionSnapshot | null> {
  const res = await axios.get<{ session: FlashcardSessionSnapshot | null }>(
    `${API_URL}/api/data/flashcards/last-completed-session`
  );
  return res.data.session;
}

export async function saveFlashcardsLastCompletedSession(session: FlashcardSessionSnapshot): Promise<void> {
  await axios.put(`${API_URL}/api/data/flashcards/last-completed-session`, session);
}

export async function getAppState<T>(key: AppStateKey): Promise<T | null> {
  const res = await axios.get<{ value: T | null }>(`${API_URL}/api/data/app-state/${key}`);
  return res.data.value;
}

export async function setAppState<T>(key: AppStateKey, value: T): Promise<void> {
  await axios.put(`${API_URL}/api/data/app-state/${key}`, { value });
}

export async function getFlashcardsActiveSession(): Promise<FlashcardSessionSnapshot | null> {
  return getAppState<FlashcardSessionSnapshot>('flashcards:active_session');
}

export async function saveFlashcardsActiveSession(session: FlashcardSessionSnapshot | null): Promise<void> {
  await setAppState('flashcards:active_session', session);
}

export async function getFlashcardsSessionSize(): Promise<number | null> {
  return getAppState<number>('flashcards:session_size');
}

export async function saveFlashcardsSessionSize(size: number): Promise<void> {
  await setAppState('flashcards:session_size', size);
}

export async function getRiskSessionCompletedDate(): Promise<string | null> {
  return getAppState<string>('risk:completed_date');
}

export async function saveRiskSessionCompletedDate(date: string): Promise<void> {
  await setAppState('risk:completed_date', date);
}

export async function getReadingFluencyState<T>(): Promise<T | null> {
  return getAppState<T>('reading_fluency:state');
}

export async function saveReadingFluencyState<T>(state: T): Promise<void> {
  await setAppState('reading_fluency:state', state);
}

// Grammar progress operations
export async function getAllGrammarProgress(): Promise<GrammarProgress[]> {
  const res = await axios.get<{ items: GrammarProgress[] }>(`${API_URL}/api/data/grammar/progress`);
  return res.data.items;
}

export async function getGrammarProgressForSkill(skillId: string): Promise<GrammarProgress | undefined> {
  const items = await getAllGrammarProgress();
  return items.find((item) => item.skillId === skillId);
}

export async function saveGrammarProgress(progress: GrammarProgress): Promise<void> {
  await axios.put(`${API_URL}/api/data/grammar/progress/${progress.skillId}`, progress);
}

export async function resetGrammarProgressForSkill(skillId: string): Promise<void> {
  await axios.delete(`${API_URL}/api/data/grammar/progress/${skillId}`);
}

export interface BackupPayloadV1 {
  schemaVersion: 1;
  exportedAt: string;
  words: Word[];
  wordReviewEvents: WordReviewEvent[];
  streakData: StreakData[];
  dailyReviewCounts: DailyReviewCount[];
  grammarProgress: GrammarProgress[];
}

export async function exportFullBackup(): Promise<BackupPayloadV1> {
  const res = await axios.get<BackupPayloadV1>(`${API_URL}/api/data/backup/export`);
  return res.data;
}

export async function importFullBackup(payload: BackupPayloadV1): Promise<{
  imported: {
    words: number;
    wordReviewEvents: number;
    streakData: number;
    dailyReviewCounts: number;
    grammarProgress: number;
  };
}> {
  const res = await axios.post<{
    imported: {
      words: number;
      wordReviewEvents: number;
      streakData: number;
      dailyReviewCounts: number;
      grammarProgress: number;
    };
  }>(`${API_URL}/api/data/backup/import`, payload);
  return res.data;
}

const legacyDb = new Dexie('MyVocabDB');
legacyDb.version(6).stores({
  words: 'id, english, status, createdAt',
  streakData: 'id',
  dailyReviewCounts: 'date',
  wordReviewEvents: 'id, wordId, createdAt',
  grammarProgress: 'skillId, levelId',
});

function toDateOrNow(input: unknown): Date {
  if (input instanceof Date) return input;
  if (typeof input === 'string' && input) {
    const parsed = new Date(input);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

export async function exportLegacyIndexedDbBackup(): Promise<BackupPayloadV1 | null> {
  const wordsTable = legacyDb.table('words');
  const streakTable = legacyDb.table('streakData');
  const dailyTable = legacyDb.table('dailyReviewCounts');
  const eventsTable = legacyDb.table('wordReviewEvents');
  const grammarTable = legacyDb.table('grammarProgress');

  const [wordsRaw, streakRaw, dailyRaw, eventsRaw, grammarRaw] = await Promise.all([
    wordsTable.toArray(),
    streakTable.toArray(),
    dailyTable.toArray(),
    eventsTable.toArray(),
    grammarTable.toArray(),
  ]);

  if (
    wordsRaw.length === 0 &&
    streakRaw.length === 0 &&
    dailyRaw.length === 0 &&
    eventsRaw.length === 0 &&
    grammarRaw.length === 0
  ) {
    return null;
  }

  const words: Word[] = wordsRaw.map((w: Record<string, unknown>) => ({
    id: String(w.id),
    english: String(w.english ?? ''),
    arabicMeanings: Array.isArray(w.arabicMeanings) ? (w.arabicMeanings as string[]) : [],
    exampleSentences: Array.isArray(w.exampleSentences) && w.exampleSentences.length > 0
      ? (w.exampleSentences as string[])
      : typeof w.exampleSentence === 'string' && w.exampleSentence.trim()
        ? [String(w.exampleSentence)]
        : [''],
    topic: typeof w.topic === 'string' ? w.topic : undefined,
    status: (w.status as Word['status']) ?? 'new',
    wrongCount: Number(w.wrongCount ?? 0),
    correctCount: Number(w.correctCount ?? 0),
    streak: Number(w.streak ?? 0),
    createdAt: toDateOrNow(w.createdAt),
    lastReviewedAt: w.lastReviewedAt ? toDateOrNow(w.lastReviewedAt) : undefined,
  }));

  const wordReviewEvents: WordReviewEvent[] = eventsRaw.map((e: Record<string, unknown>) => ({
    id: String(e.id),
    wordId: String(e.wordId),
    result: e.result === 'problem' ? 'problem' : 'known',
    delta: e.delta === -1 ? -1 : 1,
    createdAt: toDateOrNow(e.createdAt),
  }));

  const streakData: StreakData[] = streakRaw.map((s: Record<string, unknown>) => ({
    id: String(s.id ?? 'main-streak'),
    currentStreak: Number(s.currentStreak ?? 0),
    longestStreak: Number(s.longestStreak ?? 0),
    lastActivityDate: String(s.lastActivityDate ?? ''),
    reviewsToday: Number(s.reviewsToday ?? 0),
    reviewsDate: String(s.reviewsDate ?? ''),
  }));

  const dailyReviewCounts: DailyReviewCount[] = dailyRaw.map((d: Record<string, unknown>) => ({
    date: String(d.date),
    count: Number(d.count ?? 0),
  }));

  const grammarProgress: GrammarProgress[] = grammarRaw.map((g: Record<string, unknown>) => ({
    skillId: String(g.skillId),
    levelId: String(g.levelId) as GrammarProgress['levelId'],
    attempts: Number(g.attempts ?? 0),
    correct: Number(g.correct ?? 0),
    masteryPercent: Number(g.masteryPercent ?? 0),
    status: (g.status as GrammarProgress['status']) ?? 'not_started',
    lastResult: g.lastResult === 'incorrect' ? 'incorrect' : g.lastResult === 'correct' ? 'correct' : undefined,
    lastUpdated: g.lastUpdated ? String(g.lastUpdated) : undefined,
  }));

  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    words,
    wordReviewEvents,
    streakData,
    dailyReviewCounts,
    grammarProgress,
  };
}
