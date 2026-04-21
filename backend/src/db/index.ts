import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import path from 'path';

export type WordStatus = 'new' | 'known' | 'problem';
export type ReviewResult = 'known' | 'problem';

export interface Word {
  id: string;
  english: string;
  arabicMeanings: string[];
  exampleSentences: string[];
  topic?: string;
  status: WordStatus;
  wrongCount: number;
  correctCount: number;
  streak: number;
  createdAt: string;
  lastReviewedAt?: string;
}

export interface RiskWord extends Word {
  daysSinceReview: number;
}

export interface WordReviewEvent {
  id: string;
  wordId: string;
  result: ReviewResult;
  delta: 1 | -1;
  createdAt: string;
}

export interface StreakData {
  id: string;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string;
  reviewsToday: number;
  reviewsDate: string;
}

export interface DailyReviewCount {
  date: string;
  count: number;
}

export type GrammarSkillStatus = 'not_started' | 'in_progress' | 'mastered';

export interface GrammarProgress {
  skillId: string;
  levelId: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  attempts: number;
  correct: number;
  masteryPercent: number;
  status: GrammarSkillStatus;
  lastResult?: 'correct' | 'incorrect';
  lastUpdated?: string;
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

export interface BackupPayloadV1 {
  schemaVersion: 1;
  exportedAt: string;
  words: Word[];
  wordReviewEvents: WordReviewEvent[];
  streakData: StreakData[];
  dailyReviewCounts: DailyReviewCount[];
  grammarProgress: GrammarProgress[];
}

const STREAK_ID = 'main-streak';
const RISK_DAYS_THRESHOLD = 14;
const FLASHCARD_LAST_COMPLETED_SESSION_KEY = 'flashcards:last_completed_session';

const DB_PATH = process.env.DB_PATH || './data/myvocab.db';
mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeSentences(input: string[]): string[] {
  const out = (input ?? []).filter(Boolean).map((s) => String(s).trim()).slice(0, 3);
  return out.length ? out : [''];
}

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x) => typeof x === 'string');
  } catch {
    return [];
  }
}

function isFlashcardSessionFilterType(value: unknown): value is FlashcardSessionFilterType {
  return value === 'all' || value === 'new' || value === 'problem' || value === 'risk' || value === 'date';
}

function normalizeFlashcardSessionSnapshot(input: unknown): FlashcardSessionSnapshot | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  if (!Array.isArray(raw.wordIds) || raw.wordIds.some((id) => typeof id !== 'string')) return null;
  if (!isFlashcardSessionFilterType(raw.filterType)) return null;

  const currentIndex = Number(raw.currentIndex);
  const dateRange = Number(raw.dateRange);
  const knownCount = Number(raw.knownCount);
  const problemCount = Number(raw.problemCount);

  return {
    wordIds: raw.wordIds,
    currentIndex: Number.isFinite(currentIndex) ? Math.max(0, Math.floor(currentIndex)) : 0,
    filterType: raw.filterType,
    dateRange: Number.isFinite(dateRange) ? Math.max(0, Math.floor(dateRange)) : 30,
    savedAt: typeof raw.savedAt === 'string' ? raw.savedAt : nowIso(),
    knownCount: Number.isFinite(knownCount) ? Math.max(0, Math.floor(knownCount)) : 0,
    problemCount: Number.isFinite(problemCount) ? Math.max(0, Math.floor(problemCount)) : 0,
  };
}

function toWord(row: Record<string, unknown>): Word {
  return {
    id: String(row.id),
    english: String(row.english),
    arabicMeanings: parseJsonArray(String(row.arabic_meanings ?? '[]')),
    exampleSentences: normalizeSentences(parseJsonArray(String(row.example_sentences ?? '[]'))),
    topic: row.topic ? String(row.topic) : undefined,
    status: String(row.status) as WordStatus,
    wrongCount: Number(row.wrong_count ?? 0),
    correctCount: Number(row.correct_count ?? 0),
    streak: Number(row.streak ?? 0),
    createdAt: String(row.created_at),
    lastReviewedAt: row.last_reviewed_at ? String(row.last_reviewed_at) : undefined,
  };
}

function toReviewEvent(row: Record<string, unknown>): WordReviewEvent {
  return {
    id: String(row.id),
    wordId: String(row.word_id),
    result: String(row.result) as ReviewResult,
    delta: Number(row.delta) as 1 | -1,
    createdAt: String(row.created_at),
  };
}

function toStreakData(row: Record<string, unknown> | undefined): StreakData {
  if (!row) {
    return {
      id: STREAK_ID,
      currentStreak: 0,
      longestStreak: 0,
      lastActivityDate: '',
      reviewsToday: 0,
      reviewsDate: '',
    };
  }

  return {
    id: String(row.id),
    currentStreak: Number(row.current_streak ?? 0),
    longestStreak: Number(row.longest_streak ?? 0),
    lastActivityDate: String(row.last_activity_date ?? ''),
    reviewsToday: Number(row.reviews_today ?? 0),
    reviewsDate: String(row.reviews_date ?? ''),
  };
}

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS words (
      id TEXT PRIMARY KEY,
      english TEXT NOT NULL COLLATE NOCASE UNIQUE,
      arabic_meanings TEXT NOT NULL,
      example_sentences TEXT NOT NULL,
      topic TEXT,
      status TEXT NOT NULL,
      wrong_count INTEGER NOT NULL DEFAULT 0,
      correct_count INTEGER NOT NULL DEFAULT 0,
      streak INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      last_reviewed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS word_review_events (
      id TEXT PRIMARY KEY,
      word_id TEXT NOT NULL,
      result TEXT NOT NULL,
      delta INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS streak_data (
      id TEXT PRIMARY KEY,
      current_streak INTEGER NOT NULL DEFAULT 0,
      longest_streak INTEGER NOT NULL DEFAULT 0,
      last_activity_date TEXT NOT NULL DEFAULT '',
      reviews_today INTEGER NOT NULL DEFAULT 0,
      reviews_date TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS daily_review_counts (
      date TEXT PRIMARY KEY,
      count INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS grammar_progress (
      skill_id TEXT PRIMARY KEY,
      level_id TEXT NOT NULL,
      attempts INTEGER NOT NULL,
      correct INTEGER NOT NULL,
      mastery_percent INTEGER NOT NULL,
      status TEXT NOT NULL,
      last_result TEXT,
      last_updated TEXT
    );

    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_words_status ON words(status);
    CREATE INDEX IF NOT EXISTS idx_word_review_events_word_id ON word_review_events(word_id);
    CREATE INDEX IF NOT EXISTS idx_word_review_events_created_at ON word_review_events(created_at);
  `);
}

export function saveFlashcardLastCompletedSession(session: FlashcardSessionSnapshot): void {
  const normalized = normalizeFlashcardSessionSnapshot(session);
  if (!normalized) return;
  db.prepare(
    `INSERT INTO app_state (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at`
  ).run(FLASHCARD_LAST_COMPLETED_SESSION_KEY, JSON.stringify(normalized), nowIso());
}

export function getFlashcardLastCompletedSession(): FlashcardSessionSnapshot | null {
  const row = db.prepare('SELECT value FROM app_state WHERE key = ?').get(FLASHCARD_LAST_COMPLETED_SESSION_KEY) as
    | { value: string }
    | undefined;
  if (!row?.value) return null;
  try {
    const parsed = JSON.parse(row.value);
    return normalizeFlashcardSessionSnapshot(parsed);
  } catch {
    return null;
  }
}

export function saveAppStateJson(key: AppStateKey, value: unknown): void {
  db.prepare(
    `INSERT INTO app_state (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at`
  ).run(key, JSON.stringify(value ?? null), nowIso());
}

export function getAppStateJson<T = unknown>(key: AppStateKey): T | null {
  const row = db.prepare('SELECT value FROM app_state WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  if (!row?.value) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

export function wordExists(english: string): boolean {
  const row = db.prepare('SELECT 1 FROM words WHERE lower(english) = lower(?) LIMIT 1').get(english);
  return Boolean(row);
}

export function getAllWords(): Word[] {
  const rows = db.prepare('SELECT * FROM words ORDER BY created_at ASC, id ASC').all() as Record<string, unknown>[];
  return rows.map(toWord);
}

export function getWordsByStatus(status: WordStatus): Word[] {
  const rows = db
    .prepare('SELECT * FROM words WHERE status = ? ORDER BY created_at ASC, id ASC')
    .all(status) as Record<string, unknown>[];
  return rows.map(toWord);
}

export function addWord(input: {
  english: string;
  arabicMeanings: string[];
  exampleSentences: string[];
  topic?: string;
}): { id: string | null; isDuplicate: boolean } {
  if (wordExists(input.english)) {
    return { id: null, isDuplicate: true };
  }

  const id = randomUUID();
  db.prepare(`
    INSERT INTO words (
      id, english, arabic_meanings, example_sentences, topic, status,
      wrong_count, correct_count, streak, created_at, last_reviewed_at
    ) VALUES (?, ?, ?, ?, ?, 'new', 0, 0, 0, ?, NULL)
  `).run(
    id,
    input.english.trim(),
    JSON.stringify(input.arabicMeanings ?? []),
    JSON.stringify(normalizeSentences(input.exampleSentences ?? [])),
    input.topic ?? null,
    nowIso()
  );

  return { id, isDuplicate: false };
}

function logWordReviewEvent(wordId: string, result: ReviewResult, createdAt = nowIso()): void {
  db.prepare(
    'INSERT INTO word_review_events (id, word_id, result, delta, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(randomUUID(), wordId, result, result === 'known' ? 1 : -1, createdAt);
}

function incrementDailyReviewCount(date: string): void {
  db.prepare(
    `INSERT INTO daily_review_counts (date, count)
     VALUES (?, 1)
     ON CONFLICT(date) DO UPDATE SET count = count + 1`
  ).run(date);
}

export function getStreakData(): StreakData {
  const row = db.prepare('SELECT * FROM streak_data WHERE id = ?').get(STREAK_ID) as Record<string, unknown> | undefined;
  const streak = toStreakData(row);
  if (!row) {
    db.prepare(
      'INSERT INTO streak_data (id, current_streak, longest_streak, last_activity_date, reviews_today, reviews_date) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(streak.id, streak.currentStreak, streak.longestStreak, streak.lastActivityDate, streak.reviewsToday, streak.reviewsDate);
  }
  return streak;
}

export function updateStreak(): StreakData {
  const today = new Date().toISOString().split('T')[0];
  const streak = getStreakData();

  let reviewsToday = streak.reviewsToday || 0;
  let reviewsDate = streak.reviewsDate || '';

  if (reviewsDate !== today) {
    reviewsToday = 0;
    reviewsDate = today;
  }

  reviewsToday += 1;
  incrementDailyReviewCount(today);

  let updated: StreakData;
  if (reviewsToday === 20) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const newCurrentStreak = streak.lastActivityDate === yesterdayStr ? streak.currentStreak + 1 : 1;
    const newLongestStreak = Math.max(streak.longestStreak, newCurrentStreak);

    updated = {
      ...streak,
      currentStreak: newCurrentStreak,
      longestStreak: newLongestStreak,
      lastActivityDate: today,
      reviewsToday,
      reviewsDate,
    };
  } else {
    updated = {
      ...streak,
      reviewsToday,
      reviewsDate,
    };
  }

  db.prepare(
    `INSERT INTO streak_data (id, current_streak, longest_streak, last_activity_date, reviews_today, reviews_date)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
      current_streak = excluded.current_streak,
      longest_streak = excluded.longest_streak,
      last_activity_date = excluded.last_activity_date,
      reviews_today = excluded.reviews_today,
      reviews_date = excluded.reviews_date`
  ).run(
    updated.id,
    updated.currentStreak,
    updated.longestStreak,
    updated.lastActivityDate,
    updated.reviewsToday,
    updated.reviewsDate
  );

  return updated;
}

export function incrementWrongCount(id: string): void {
  const row = db.prepare('SELECT * FROM words WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return;

  const word = toWord(row);
  const updates = {
    wrongCount: word.wrongCount + 1,
    correctCount: word.correctCount,
    status: 'problem' as WordStatus,
    streak: 0,
    lastReviewedAt: nowIso(),
  };

  db.prepare(
    'UPDATE words SET wrong_count = ?, correct_count = ?, status = ?, streak = ?, last_reviewed_at = ? WHERE id = ?'
  ).run(updates.wrongCount, updates.correctCount, updates.status, updates.streak, updates.lastReviewedAt, id);

  logWordReviewEvent(id, 'problem', updates.lastReviewedAt);
}

export function incrementCorrectCount(id: string): void {
  const row = db.prepare('SELECT * FROM words WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return;

  const word = toWord(row);
  const newCorrect = word.correctCount + 1;

  let newStatus: WordStatus;
  let newStreak: number;

  if (word.status === 'new') {
    newStatus = 'known';
    newStreak = 0;
  } else if (word.status === 'problem') {
    newStreak = word.streak + 1;
    if (newStreak >= 3) {
      newStatus = 'known';
      newStreak = 0;
    } else {
      newStatus = 'problem';
    }
  } else {
    newStatus = 'known';
    newStreak = 0;
  }

  const reviewedAt = nowIso();
  db.prepare(
    'UPDATE words SET correct_count = ?, wrong_count = ?, status = ?, streak = ?, last_reviewed_at = ? WHERE id = ?'
  ).run(newCorrect, word.wrongCount, newStatus, newStreak, reviewedAt, id);

  logWordReviewEvent(id, 'known', reviewedAt);
}

export function updateWordReviewCounts(id: string, correctCount: number, wrongCount: number): void {
  const safeCorrect = Math.max(0, Math.floor(Number.isFinite(correctCount) ? correctCount : 0));
  const safeWrong = Math.max(0, Math.floor(Number.isFinite(wrongCount) ? wrongCount : 0));

  let newStatus: WordStatus;
  if (safeCorrect === 0 && safeWrong === 0) {
    newStatus = 'new';
  } else if (safeCorrect >= safeWrong) {
    newStatus = 'known';
  } else {
    newStatus = 'problem';
  }

  db.prepare('UPDATE words SET correct_count = ?, wrong_count = ?, status = ?, streak = 0 WHERE id = ?').run(
    safeCorrect,
    safeWrong,
    newStatus,
    id
  );
}

export function updateWordContent(
  id: string,
  updates: { arabicMeanings?: string[]; exampleSentences?: string[] }
): void {
  const current = db.prepare('SELECT * FROM words WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!current) return;

  const word = toWord(current);
  const nextArabic = updates.arabicMeanings ?? word.arabicMeanings;
  const nextSentences = updates.exampleSentences ? normalizeSentences(updates.exampleSentences) : word.exampleSentences;

  db.prepare('UPDATE words SET arabic_meanings = ?, example_sentences = ? WHERE id = ?').run(
    JSON.stringify(nextArabic),
    JSON.stringify(nextSentences),
    id
  );
}

export function deleteWord(id: string): void {
  db.prepare('DELETE FROM words WHERE id = ?').run(id);
}

export function getWordReviewHistory(wordId: string): WordReviewEvent[] {
  const rows = db
    .prepare('SELECT * FROM word_review_events WHERE word_id = ? ORDER BY created_at ASC, id ASC')
    .all(wordId) as Record<string, unknown>[];
  return rows.map(toReviewEvent);
}

export function bulkAddWords(
  words: Array<{ english: string; arabicMeanings: string[]; exampleSentences: string[] }>
): { added: number; skipped: number; skippedWords: string[] } {
  const existingRows = db.prepare('SELECT english FROM words').all() as Array<{ english: string }>;
  const existingSet = new Set(existingRows.map((w) => w.english.toLowerCase()));

  const seenInImport = new Set<string>();
  const skippedWords: string[] = [];

  const insertStmt = db.prepare(`
    INSERT INTO words (
      id, english, arabic_meanings, example_sentences, topic, status,
      wrong_count, correct_count, streak, created_at, last_reviewed_at
    ) VALUES (?, ?, ?, ?, NULL, 'new', 0, 0, 0, ?, NULL)
  `);

  let added = 0;
  const tx = db.transaction(() => {
    for (const word of words) {
      const lower = word.english.toLowerCase();
      if (existingSet.has(lower) || seenInImport.has(lower)) {
        skippedWords.push(word.english);
        continue;
      }
      seenInImport.add(lower);
      insertStmt.run(
        randomUUID(),
        word.english,
        JSON.stringify(word.arabicMeanings ?? []),
        JSON.stringify(normalizeSentences(word.exampleSentences ?? [])),
        nowIso()
      );
      added += 1;
    }
  });

  tx();
  return { added, skipped: skippedWords.length, skippedWords };
}

export function getWordStats(): { total: number; known: number; problem: number; new: number } {
  const total = Number((db.prepare('SELECT COUNT(*) AS c FROM words').get() as { c: number }).c);
  const known = Number((db.prepare("SELECT COUNT(*) AS c FROM words WHERE status = 'known'").get() as { c: number }).c);
  const problem = Number((db.prepare("SELECT COUNT(*) AS c FROM words WHERE status = 'problem'").get() as { c: number }).c);
  const newCount = Number((db.prepare("SELECT COUNT(*) AS c FROM words WHERE status = 'new'").get() as { c: number }).c);
  return { total, known, problem, new: newCount };
}

export function getRiskWords(): RiskWord[] {
  const words = getAllWords();
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;

  return words
    .filter((w) => w.status === 'known')
    .map((w) => {
      const correct = w.correctCount || 0;
      const wrong = w.wrongCount || 0;
      const totalReviews = correct + wrong;
      const learningRate = totalReviews > 0 ? correct / totalReviews : 0;
      const lastReviewedAt = w.lastReviewedAt ? new Date(w.lastReviewedAt).getTime() : null;
      const daysSinceReview = lastReviewedAt != null ? Math.floor((now - lastReviewedAt) / oneDayMs) : 365;
      return { ...w, daysSinceReview, learningRate, totalReviews };
    })
    .filter((w) => w.totalReviews > 0)
    .filter((w) => w.learningRate < 1)
    .filter((w) => w.daysSinceReview >= RISK_DAYS_THRESHOLD)
    .sort((a, b) => {
      if (b.daysSinceReview !== a.daysSinceReview) return b.daysSinceReview - a.daysSinceReview;
      if (a.learningRate !== b.learningRate) return a.learningRate - b.learningRate;
      if ((b.wrongCount || 0) !== (a.wrongCount || 0)) return (b.wrongCount || 0) - (a.wrongCount || 0);
      return (a.correctCount || 0) - (b.correctCount || 0);
    })
    .map(({ learningRate: _, totalReviews: __, ...rest }) => rest);
}

function getDatesInRange(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T12:00:00`);
  const endD = new Date(`${end}T12:00:00`);
  while (d <= endD) {
    out.push(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export function getReviewCountsByDateRange(startDate: string, endDate: string): DailyReviewCount[] {
  const dates = getDatesInRange(startDate, endDate);
  const stmt = db.prepare('SELECT count FROM daily_review_counts WHERE date = ?');
  return dates.map((date) => {
    const row = stmt.get(date) as { count: number } | undefined;
    return { date, count: row?.count ?? 0 };
  });
}

export function getEarliestReviewDate(): string | null {
  const row = db.prepare('SELECT date FROM daily_review_counts ORDER BY date ASC LIMIT 1').get() as
    | { date: string }
    | undefined;
  return row?.date ?? null;
}

export function getAllGrammarProgress(): GrammarProgress[] {
  const rows = db.prepare('SELECT * FROM grammar_progress ORDER BY level_id ASC, skill_id ASC').all() as Record<
    string,
    unknown
  >[];

  return rows.map((row) => ({
    skillId: String(row.skill_id),
    levelId: String(row.level_id) as GrammarProgress['levelId'],
    attempts: Number(row.attempts ?? 0),
    correct: Number(row.correct ?? 0),
    masteryPercent: Number(row.mastery_percent ?? 0),
    status: String(row.status) as GrammarSkillStatus,
    lastResult: row.last_result ? (String(row.last_result) as 'correct' | 'incorrect') : undefined,
    lastUpdated: row.last_updated ? String(row.last_updated) : undefined,
  }));
}

export function saveGrammarProgress(progress: GrammarProgress): void {
  const safe: GrammarProgress = {
    ...progress,
    attempts: Math.max(0, Math.floor(progress.attempts ?? 0)),
    correct: Math.max(0, Math.floor(progress.correct ?? 0)),
    masteryPercent: Math.max(0, Math.min(100, Math.floor(progress.masteryPercent ?? 0))),
    lastUpdated: progress.lastUpdated ?? nowIso(),
  };

  db.prepare(
    `INSERT INTO grammar_progress (
      skill_id, level_id, attempts, correct, mastery_percent, status, last_result, last_updated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(skill_id) DO UPDATE SET
      level_id = excluded.level_id,
      attempts = excluded.attempts,
      correct = excluded.correct,
      mastery_percent = excluded.mastery_percent,
      status = excluded.status,
      last_result = excluded.last_result,
      last_updated = excluded.last_updated`
  ).run(
    safe.skillId,
    safe.levelId,
    safe.attempts,
    safe.correct,
    safe.masteryPercent,
    safe.status,
    safe.lastResult ?? null,
    safe.lastUpdated
  );
}

export function resetGrammarProgressForSkill(skillId: string): void {
  db.prepare('DELETE FROM grammar_progress WHERE skill_id = ?').run(skillId);
}

export function exportFullBackup(): BackupPayloadV1 {
  const words = getAllWords();
  const wordReviewEvents = (db
    .prepare('SELECT * FROM word_review_events ORDER BY created_at ASC, id ASC')
    .all() as Record<string, unknown>[]).map(toReviewEvent);

  const streakDataRows = db.prepare('SELECT * FROM streak_data').all() as Record<string, unknown>[];
  const streakData = streakDataRows.map((row) => toStreakData(row));

  const dailyReviewCounts = (db
    .prepare('SELECT * FROM daily_review_counts ORDER BY date ASC')
    .all() as Record<string, unknown>[]).map((row) => ({
    date: String(row.date),
    count: Number(row.count ?? 0),
  }));

  const grammarProgress = getAllGrammarProgress();

  return {
    schemaVersion: 1,
    exportedAt: nowIso(),
    words,
    wordReviewEvents,
    streakData,
    dailyReviewCounts,
    grammarProgress,
  };
}

export function importFullBackup(payload: BackupPayloadV1): {
  words: number;
  wordReviewEvents: number;
  streakData: number;
  dailyReviewCounts: number;
  grammarProgress: number;
} {
  const insertWord = db.prepare(`
    INSERT INTO words (
      id, english, arabic_meanings, example_sentences, topic, status,
      wrong_count, correct_count, streak, created_at, last_reviewed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertEvent = db.prepare(
    'INSERT INTO word_review_events (id, word_id, result, delta, created_at) VALUES (?, ?, ?, ?, ?)'
  );

  const insertStreak = db.prepare(
    'INSERT INTO streak_data (id, current_streak, longest_streak, last_activity_date, reviews_today, reviews_date) VALUES (?, ?, ?, ?, ?, ?)'
  );

  const insertDaily = db.prepare('INSERT INTO daily_review_counts (date, count) VALUES (?, ?)');

  const insertGrammar = db.prepare(
    `INSERT INTO grammar_progress (skill_id, level_id, attempts, correct, mastery_percent, status, last_result, last_updated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM word_review_events').run();
    db.prepare('DELETE FROM words').run();
    db.prepare('DELETE FROM streak_data').run();
    db.prepare('DELETE FROM daily_review_counts').run();
    db.prepare('DELETE FROM grammar_progress').run();

    for (const word of payload.words) {
      insertWord.run(
        word.id,
        word.english,
        JSON.stringify(word.arabicMeanings ?? []),
        JSON.stringify(normalizeSentences(word.exampleSentences ?? [])),
        word.topic ?? null,
        word.status,
        word.wrongCount ?? 0,
        word.correctCount ?? 0,
        word.streak ?? 0,
        word.createdAt,
        word.lastReviewedAt ?? null
      );
    }

    for (const event of payload.wordReviewEvents) {
      insertEvent.run(event.id, event.wordId, event.result, event.delta, event.createdAt);
    }

    for (const streak of payload.streakData) {
      insertStreak.run(
        streak.id,
        streak.currentStreak ?? 0,
        streak.longestStreak ?? 0,
        streak.lastActivityDate ?? '',
        streak.reviewsToday ?? 0,
        streak.reviewsDate ?? ''
      );
    }

    for (const row of payload.dailyReviewCounts) {
      insertDaily.run(row.date, row.count ?? 0);
    }

    for (const progress of payload.grammarProgress) {
      insertGrammar.run(
        progress.skillId,
        progress.levelId,
        progress.attempts ?? 0,
        progress.correct ?? 0,
        progress.masteryPercent ?? 0,
        progress.status,
        progress.lastResult ?? null,
        progress.lastUpdated ?? null
      );
    }
  });

  tx();

  return {
    words: payload.words.length,
    wordReviewEvents: payload.wordReviewEvents.length,
    streakData: payload.streakData.length,
    dailyReviewCounts: payload.dailyReviewCounts.length,
    grammarProgress: payload.grammarProgress.length,
  };
}
