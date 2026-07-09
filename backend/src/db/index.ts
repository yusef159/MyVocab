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
  /** Spaced-repetition interval in days: a known word becomes at-risk once daysSinceReview >= interval */
  interval: number;
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
export type AutoScheduleCadence = 'daily' | 'weekly' | 'monthly';
export type AutoScheduleRunStatus = 'running' | 'success' | 'failed';

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

export interface AutoScheduleConfig {
  id: string;
  prompt: string;
  count: number;
  cadence: AutoScheduleCadence;
  timezone: string;
  timeOfDay: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  nextRunAt: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BackupScheduleConfig {
  id: string;
  cadence: AutoScheduleCadence;
  timezone: string;
  timeOfDay: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  destinationPath: string;
  nextRunAt: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AutoScheduleRun {
  id: string;
  scheduleId: string;
  startedAt: string;
  finishedAt?: string;
  generatedCount: number;
  savedCount: number;
  skippedExistingCount: number;
  status: AutoScheduleRunStatus;
  error?: string;
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
  | 'reading_fluency:state'
  | 'streak:daily_goal';

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
const STREAK_DAILY_GOAL_KEY = 'streak:daily_goal';
const MIN_STREAK_DAILY_GOAL = 20;
const DEFAULT_STREAK_DAILY_GOAL = 20;
/** Interval (in days) assigned to a word the moment it first becomes "known" */
const INITIAL_KNOWN_INTERVAL = 1;
const FLASHCARD_LAST_COMPLETED_SESSION_KEY = 'flashcards:last_completed_session';
const AUTO_SCHEDULE_DEFAULT_ID = 'main-auto-schedule';
const BACKUP_SCHEDULE_DEFAULT_ID = 'main-backup-schedule';

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

function isAutoScheduleCadence(value: unknown): value is AutoScheduleCadence {
  return value === 'daily' || value === 'weekly' || value === 'monthly';
}

function isAutoScheduleRunStatus(value: unknown): value is AutoScheduleRunStatus {
  return value === 'running' || value === 'success' || value === 'failed';
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
    interval: Number(row.interval ?? 0),
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

function toAutoScheduleConfig(row: Record<string, unknown>): AutoScheduleConfig {
  const cadence = String(row.cadence);
  return {
    id: String(row.id),
    prompt: String(row.prompt),
    count: Number(row.count ?? 1),
    cadence: isAutoScheduleCadence(cadence) ? cadence : 'daily',
    timezone: String(row.timezone ?? 'UTC'),
    timeOfDay: String(row.time_of_day ?? '09:00'),
    dayOfWeek: row.day_of_week == null ? undefined : Number(row.day_of_week),
    dayOfMonth: row.day_of_month == null ? undefined : Number(row.day_of_month),
    nextRunAt: String(row.next_run_at),
    active: Number(row.active ?? 0) === 1,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function toAutoScheduleRun(row: Record<string, unknown>): AutoScheduleRun {
  const status = String(row.status);
  return {
    id: String(row.id),
    scheduleId: String(row.schedule_id),
    startedAt: String(row.started_at),
    finishedAt: row.finished_at ? String(row.finished_at) : undefined,
    generatedCount: Number(row.generated_count ?? 0),
    savedCount: Number(row.saved_count ?? 0),
    skippedExistingCount: Number(row.skipped_existing_count ?? 0),
    status: isAutoScheduleRunStatus(status) ? status : 'failed',
    error: row.error == null ? undefined : String(row.error),
  };
}

function toBackupScheduleConfig(row: Record<string, unknown>): BackupScheduleConfig {
  const cadence = String(row.cadence);
  return {
    id: String(row.id),
    cadence: isAutoScheduleCadence(cadence) ? cadence : 'weekly',
    timezone: String(row.timezone ?? 'UTC'),
    timeOfDay: String(row.time_of_day ?? '03:00'),
    dayOfWeek: row.day_of_week == null ? undefined : Number(row.day_of_week),
    dayOfMonth: row.day_of_month == null ? undefined : Number(row.day_of_month),
    destinationPath: String(row.destination_path ?? 'gdrive:MyVocab backup/myvocab-backup.json'),
    nextRunAt: String(row.next_run_at),
    active: Number(row.active ?? 0) === 1,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
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

function getStreakDailyGoal(): number {
  const value = getAppStateJson<number>(STREAK_DAILY_GOAL_KEY);
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_STREAK_DAILY_GOAL;
  }
  return Math.max(MIN_STREAK_DAILY_GOAL, Math.floor(value));
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
      interval INTEGER NOT NULL DEFAULT 0,
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

    CREATE TABLE IF NOT EXISTS schedule_config (
      id TEXT PRIMARY KEY,
      prompt TEXT NOT NULL,
      count INTEGER NOT NULL,
      cadence TEXT NOT NULL,
      timezone TEXT NOT NULL,
      time_of_day TEXT NOT NULL,
      day_of_week INTEGER,
      day_of_month INTEGER,
      next_run_at TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schedule_runs (
      id TEXT PRIMARY KEY,
      schedule_id TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      generated_count INTEGER NOT NULL DEFAULT 0,
      saved_count INTEGER NOT NULL DEFAULT 0,
      skipped_existing_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      error TEXT,
      FOREIGN KEY (schedule_id) REFERENCES schedule_config(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS backup_schedule_config (
      id TEXT PRIMARY KEY,
      cadence TEXT NOT NULL,
      timezone TEXT NOT NULL,
      time_of_day TEXT NOT NULL,
      day_of_week INTEGER,
      day_of_month INTEGER,
      destination_path TEXT NOT NULL DEFAULT 'gdrive:Raspberry Pi/MyVocab/myvocab-backup.json',
      next_run_at TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_words_status ON words(status);
    CREATE INDEX IF NOT EXISTS idx_word_review_events_word_id ON word_review_events(word_id);
    CREATE INDEX IF NOT EXISTS idx_word_review_events_created_at ON word_review_events(created_at);
    CREATE INDEX IF NOT EXISTS idx_schedule_config_active_next_run ON schedule_config(active, next_run_at);
    CREATE INDEX IF NOT EXISTS idx_schedule_runs_schedule_started ON schedule_runs(schedule_id, started_at DESC);
    CREATE INDEX IF NOT EXISTS idx_backup_schedule_active_next_run ON backup_schedule_config(active, next_run_at);
  `);

  const backupColumns = db.prepare('PRAGMA table_info(backup_schedule_config)').all() as Array<{ name: string }>;
  const hasDestinationPath = backupColumns.some((column) => column.name === 'destination_path');
  if (!hasDestinationPath) {
    db.exec(
      "ALTER TABLE backup_schedule_config ADD COLUMN destination_path TEXT NOT NULL DEFAULT 'gdrive:Raspberry Pi/MyVocab/myvocab-backup.json'"
    );
  }

  const wordColumns = db.prepare('PRAGMA table_info(words)').all() as Array<{ name: string }>;
  const hasInterval = wordColumns.some((column) => column.name === 'interval');
  if (!hasInterval) {
    db.exec('ALTER TABLE words ADD COLUMN interval INTEGER NOT NULL DEFAULT 0');
    // Backfill existing known words so they follow the new interval-based schedule
    db.prepare('UPDATE words SET interval = ? WHERE status = ? AND interval = 0').run(
      INITIAL_KNOWN_INTERVAL,
      'known'
    );
  }
}

export function getAutoScheduleConfig(): AutoScheduleConfig | null {
  const row = db.prepare('SELECT * FROM schedule_config WHERE id = ?').get(AUTO_SCHEDULE_DEFAULT_ID) as
    | Record<string, unknown>
    | undefined;
  return row ? toAutoScheduleConfig(row) : null;
}

export function saveAutoScheduleConfig(input: {
  prompt: string;
  count: number;
  cadence: AutoScheduleCadence;
  timezone: string;
  timeOfDay: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  nextRunAt: string;
  active: boolean;
}): AutoScheduleConfig {
  const now = nowIso();
  db.prepare(
    `INSERT INTO schedule_config (
      id, prompt, count, cadence, timezone, time_of_day, day_of_week, day_of_month, next_run_at, active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      prompt = excluded.prompt,
      count = excluded.count,
      cadence = excluded.cadence,
      timezone = excluded.timezone,
      time_of_day = excluded.time_of_day,
      day_of_week = excluded.day_of_week,
      day_of_month = excluded.day_of_month,
      next_run_at = excluded.next_run_at,
      active = excluded.active,
      updated_at = excluded.updated_at`
  ).run(
    AUTO_SCHEDULE_DEFAULT_ID,
    input.prompt,
    input.count,
    input.cadence,
    input.timezone,
    input.timeOfDay,
    input.dayOfWeek ?? null,
    input.dayOfMonth ?? null,
    input.nextRunAt,
    input.active ? 1 : 0,
    now,
    now
  );

  return getAutoScheduleConfig() as AutoScheduleConfig;
}

export function setAutoScheduleActive(active: boolean): AutoScheduleConfig | null {
  const config = getAutoScheduleConfig();
  if (!config) return null;

  db.prepare('UPDATE schedule_config SET active = ?, updated_at = ? WHERE id = ?').run(
    active ? 1 : 0,
    nowIso(),
    AUTO_SCHEDULE_DEFAULT_ID
  );
  return getAutoScheduleConfig();
}

export function updateAutoScheduleNextRun(nextRunAt: string): AutoScheduleConfig | null {
  const config = getAutoScheduleConfig();
  if (!config) return null;

  db.prepare('UPDATE schedule_config SET next_run_at = ?, updated_at = ? WHERE id = ?').run(
    nextRunAt,
    nowIso(),
    AUTO_SCHEDULE_DEFAULT_ID
  );
  return getAutoScheduleConfig();
}

export function getDueAutoScheduleConfigs(now = nowIso()): AutoScheduleConfig[] {
  const rows = db
    .prepare(
      'SELECT * FROM schedule_config WHERE active = 1 AND datetime(next_run_at) <= datetime(?) ORDER BY next_run_at ASC'
    )
    .all(now) as Record<string, unknown>[];
  return rows.map(toAutoScheduleConfig);
}

export function createAutoScheduleRun(scheduleId: string): AutoScheduleRun {
  const id = randomUUID();
  const startedAt = nowIso();
  db.prepare(
    `INSERT INTO schedule_runs (
      id, schedule_id, started_at, finished_at, generated_count, saved_count, skipped_existing_count, status, error
    ) VALUES (?, ?, ?, NULL, 0, 0, 0, 'running', NULL)`
  ).run(id, scheduleId, startedAt);

  const row = db.prepare('SELECT * FROM schedule_runs WHERE id = ?').get(id) as Record<string, unknown>;
  return toAutoScheduleRun(row);
}

export function finishAutoScheduleRun(input: {
  runId: string;
  generatedCount: number;
  savedCount: number;
  skippedExistingCount: number;
  status: Exclude<AutoScheduleRunStatus, 'running'>;
  error?: string;
}): void {
  db.prepare(
    `UPDATE schedule_runs SET
      finished_at = ?,
      generated_count = ?,
      saved_count = ?,
      skipped_existing_count = ?,
      status = ?,
      error = ?
    WHERE id = ?`
  ).run(
    nowIso(),
    Math.max(0, Math.floor(input.generatedCount)),
    Math.max(0, Math.floor(input.savedCount)),
    Math.max(0, Math.floor(input.skippedExistingCount)),
    input.status,
    input.error ?? null,
    input.runId
  );
}

export function getRecentAutoScheduleRuns(limit = 20): AutoScheduleRun[] {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const rows = db
    .prepare('SELECT * FROM schedule_runs ORDER BY started_at DESC LIMIT ?')
    .all(safeLimit) as Record<string, unknown>[];
  return rows.map(toAutoScheduleRun);
}

export function getBackupScheduleConfig(): BackupScheduleConfig | null {
  const row = db.prepare('SELECT * FROM backup_schedule_config WHERE id = ?').get(BACKUP_SCHEDULE_DEFAULT_ID) as
    | Record<string, unknown>
    | undefined;
  return row ? toBackupScheduleConfig(row) : null;
}

export function saveBackupScheduleConfig(input: {
  cadence: AutoScheduleCadence;
  timezone: string;
  timeOfDay: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  destinationPath: string;
  nextRunAt: string;
  active: boolean;
}): BackupScheduleConfig {
  const now = nowIso();
  db.prepare(
    `INSERT INTO backup_schedule_config (
      id, cadence, timezone, time_of_day, day_of_week, day_of_month, destination_path, next_run_at, active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      cadence = excluded.cadence,
      timezone = excluded.timezone,
      time_of_day = excluded.time_of_day,
      day_of_week = excluded.day_of_week,
      day_of_month = excluded.day_of_month,
      destination_path = excluded.destination_path,
      next_run_at = excluded.next_run_at,
      active = excluded.active,
      updated_at = excluded.updated_at`
  ).run(
    BACKUP_SCHEDULE_DEFAULT_ID,
    input.cadence,
    input.timezone,
    input.timeOfDay,
    input.dayOfWeek ?? null,
    input.dayOfMonth ?? null,
    input.destinationPath,
    input.nextRunAt,
    input.active ? 1 : 0,
    now,
    now
  );

  return getBackupScheduleConfig() as BackupScheduleConfig;
}

export function setBackupScheduleActive(active: boolean): BackupScheduleConfig | null {
  const config = getBackupScheduleConfig();
  if (!config) return null;

  db.prepare('UPDATE backup_schedule_config SET active = ?, updated_at = ? WHERE id = ?').run(
    active ? 1 : 0,
    nowIso(),
    BACKUP_SCHEDULE_DEFAULT_ID
  );
  return getBackupScheduleConfig();
}

export function updateBackupScheduleNextRun(nextRunAt: string): BackupScheduleConfig | null {
  const config = getBackupScheduleConfig();
  if (!config) return null;

  db.prepare('UPDATE backup_schedule_config SET next_run_at = ?, updated_at = ? WHERE id = ?').run(
    nextRunAt,
    nowIso(),
    BACKUP_SCHEDULE_DEFAULT_ID
  );
  return getBackupScheduleConfig();
}

export function getDueBackupScheduleConfigs(now = nowIso()): BackupScheduleConfig[] {
  const rows = db
    .prepare(
      'SELECT * FROM backup_schedule_config WHERE active = 1 AND datetime(next_run_at) <= datetime(?) ORDER BY next_run_at ASC'
    )
    .all(now) as Record<string, unknown>[];
  return rows.map(toBackupScheduleConfig);
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
      wrong_count, correct_count, streak, interval, created_at, last_reviewed_at
    ) VALUES (?, ?, ?, ?, ?, 'new', 0, 0, 0, 0, ?, NULL)
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
  const streakDailyGoal = getStreakDailyGoal();

  let reviewsToday = streak.reviewsToday || 0;
  let reviewsDate = streak.reviewsDate || '';

  if (reviewsDate !== today) {
    reviewsToday = 0;
    reviewsDate = today;
  }

  reviewsToday += 1;
  incrementDailyReviewCount(today);

  let updated: StreakData;
  if (reviewsToday === streakDailyGoal) {
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
    // Halve the spaced-repetition interval on a miss so the word resurfaces sooner
    // (e.g. 8 -> 4), keeping a floor of the initial interval instead of resetting to it.
    interval: Math.max(INITIAL_KNOWN_INTERVAL, Math.floor(word.interval / 2)),
    lastReviewedAt: nowIso(),
  };

  db.prepare(
    'UPDATE words SET wrong_count = ?, correct_count = ?, status = ?, streak = ?, interval = ?, last_reviewed_at = ? WHERE id = ?'
  ).run(
    updates.wrongCount,
    updates.correctCount,
    updates.status,
    updates.streak,
    updates.interval,
    updates.lastReviewedAt,
    id
  );

  logWordReviewEvent(id, 'problem', updates.lastReviewedAt);
}

export function incrementCorrectCount(id: string): void {
  const row = db.prepare('SELECT * FROM words WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return;

  const word = toWord(row);
  const newCorrect = word.correctCount + 1;

  let newStatus: WordStatus;
  let newStreak: number;
  let newInterval: number;

  if (word.status === 'new') {
    // First time learned: becomes known and starts the interval schedule
    newStatus = 'known';
    newStreak = 0;
    newInterval = INITIAL_KNOWN_INTERVAL;
  } else if (word.status === 'problem') {
    newStreak = word.streak + 1;
    if (newStreak >= 3) {
      // Cleared the 3-streak requirement: promote back to known while keeping the
      // (already halved) interval so it resurfaces on the shortened schedule.
      newStatus = 'known';
      newStreak = 0;
      newInterval = Math.max(INITIAL_KNOWN_INTERVAL, word.interval);
    } else {
      // Still a problem word: interval does not grow while not known
      newStatus = 'problem';
      newInterval = word.interval;
    }
  } else {
    // Already known and answered correctly: extend the interval by one day
    newStatus = 'known';
    newStreak = 0;
    newInterval = word.interval + 1;
  }

  const reviewedAt = nowIso();
  db.prepare(
    'UPDATE words SET correct_count = ?, wrong_count = ?, status = ?, streak = ?, interval = ?, last_reviewed_at = ? WHERE id = ?'
  ).run(newCorrect, word.wrongCount, newStatus, newStreak, newInterval, reviewedAt, id);

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
      wrong_count, correct_count, streak, interval, created_at, last_reviewed_at
    ) VALUES (?, ?, ?, ?, NULL, 'new', 0, 0, 0, 0, ?, NULL)
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

function computeIntervalFromEvents(events: ReviewResult[], status: WordStatus): number {
  if (events.length === 0) {
    return status === 'new' ? 0 : INITIAL_KNOWN_INTERVAL;
  }
  if (events[events.length - 1] === 'problem') {
    return INITIAL_KNOWN_INTERVAL;
  }
  let run = 0;
  for (let i = events.length - 1; i >= 0 && events[i] === 'known'; i--) {
    run += 1;
  }
  return run;
}

export function refreshWordIntervals(): { updated: number; distribution: Record<number, number> } {
  const eventRows = db
    .prepare('SELECT word_id, result FROM word_review_events ORDER BY created_at ASC, id ASC')
    .all() as Array<{ word_id: string; result: string }>;

  const eventsByWord = new Map<string, ReviewResult[]>();
  for (const row of eventRows) {
    const wordId = String(row.word_id);
    const list = eventsByWord.get(wordId) ?? [];
    list.push(row.result === 'problem' ? 'problem' : 'known');
    eventsByWord.set(wordId, list);
  }

  const words = db.prepare('SELECT id, status FROM words').all() as Array<{ id: string; status: string }>;
  const updateStmt = db.prepare('UPDATE words SET interval = ? WHERE id = ?');
  const distribution: Record<number, number> = {};

  const tx = db.transaction(() => {
    for (const word of words) {
      const status = String(word.status) as WordStatus;
      const events = eventsByWord.get(String(word.id)) ?? [];
      const interval = computeIntervalFromEvents(events, status);
      updateStmt.run(interval, word.id);
      distribution[interval] = (distribution[interval] ?? 0) + 1;
    }
  });

  tx();
  return { updated: words.length, distribution };
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
    // Spaced-repetition gate: a known word is only at risk once it has gone
    // unreviewed for at least its current interval (in days).
    .filter((w) => w.interval > 0 && w.daysSinceReview >= w.interval)
    .sort((a, b) => {
      // Most overdue relative to its own interval comes first
      const overdueA = a.daysSinceReview - a.interval;
      const overdueB = b.daysSinceReview - b.interval;
      if (overdueB !== overdueA) return overdueB - overdueA;
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
      wrong_count, correct_count, streak, interval, created_at, last_reviewed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        word.interval ?? 0,
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
