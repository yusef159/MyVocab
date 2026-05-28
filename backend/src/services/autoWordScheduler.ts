import {
  bulkAddWords,
  createAutoScheduleRun,
  finishAutoScheduleRun,
  getAllWords,
  getDueAutoScheduleConfigs,
  saveAutoScheduleConfig,
  setAutoScheduleActive,
  updateAutoScheduleNextRun,
  type AutoScheduleCadence,
  type AutoScheduleConfig,
} from '../db/index.js';
import { generateAutoScheduledWords, type WordSuggestion } from './openai.js';

const DEFAULT_TIMEZONE = 'UTC';
const DEFAULT_TIME_OF_DAY = '09:00';
const SCHEDULER_TICK_MS = 60_000;
const MAX_ATTEMPTS = 3;
const MAX_EXCLUSION_WORDS = 500;
const MAX_AUTO_WORDS_PER_RUN = 3;

let schedulerTimer: NodeJS.Timeout | null = null;
const runningScheduleIds = new Set<string>();

const weekdayIndexByShortName: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function nowIso(): string {
  return new Date().toISOString();
}

function parseTimeOfDay(value: string): { hour: number; minute: number } {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) {
    return { hour: 9, minute: 0 };
  }
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

function getTimeZoneParts(date: Date, timeZone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'short',
  }).formatToParts(date);

  const read = (type: string): string => parts.find((part) => part.type === type)?.value ?? '';
  const weekdayShort = read('weekday');
  const weekday = weekdayIndexByShortName[weekdayShort] ?? 0;

  return {
    year: Number(read('year')),
    month: Number(read('month')),
    day: Number(read('day')),
    hour: Number(read('hour')),
    minute: Number(read('minute')),
    second: Number(read('second')),
    weekday,
  };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addDays(year: number, month: number, day: number, delta: number): { year: number; month: number; day: number } {
  const value = new Date(Date.UTC(year, month - 1, day + delta));
  return {
    year: value.getUTCFullYear(),
    month: value.getUTCMonth() + 1,
    day: value.getUTCDate(),
  };
}

function toUtcDateForTimeZoneLocal(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const zonedGuess = getTimeZoneParts(utcGuess, timeZone);
  const expectedUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  const actualUtcMs = Date.UTC(
    zonedGuess.year,
    zonedGuess.month - 1,
    zonedGuess.day,
    zonedGuess.hour,
    zonedGuess.minute,
    zonedGuess.second
  );
  return new Date(utcGuess.getTime() + (expectedUtcMs - actualUtcMs));
}

function normalizeWord(english: string): string {
  return english.trim().toLowerCase();
}

function sanitizeSuggestion(input: WordSuggestion): WordSuggestion | null {
  const english = String(input.english ?? '').trim();
  if (!english || /\s/.test(english)) {
    return null;
  }
  const arabicMeanings = (Array.isArray(input.arabicMeanings) ? input.arabicMeanings : [])
    .map((value) => String(value).trim())
    .filter(Boolean)
    .slice(0, 3);
  const exampleSentences = (Array.isArray(input.exampleSentences) ? input.exampleSentences : [])
    .map((value) => String(value).trim())
    .filter(Boolean)
    .slice(0, 3);

  // Keep only quality suggestions that include both meanings and examples.
  if (!arabicMeanings.length || !exampleSentences.length) {
    return null;
  }

  return {
    english,
    arabicMeanings,
    exampleSentences,
  };
}

export function collectUniqueSuggestions(input: {
  generated: WordSuggestion[];
  existingNormalizedWords: Set<string>;
  selectedByNormalizedWord: Map<string, WordSuggestion>;
  maxAccepted: number;
}): { acceptedCount: number; skippedCount: number } {
  let acceptedCount = 0;
  let skippedCount = 0;

  for (const suggestion of input.generated) {
    if (input.selectedByNormalizedWord.size >= input.maxAccepted) break;

    const clean = sanitizeSuggestion(suggestion);
    if (!clean) {
      skippedCount += 1;
      continue;
    }
    const normalized = normalizeWord(clean.english);
    if (!normalized || input.existingNormalizedWords.has(normalized) || input.selectedByNormalizedWord.has(normalized)) {
      skippedCount += 1;
      continue;
    }
    input.selectedByNormalizedWord.set(normalized, clean);
    acceptedCount += 1;
  }

  return { acceptedCount, skippedCount };
}

export function computeNextRunAt(
  config: Pick<AutoScheduleConfig, 'cadence' | 'timezone' | 'timeOfDay' | 'dayOfWeek' | 'dayOfMonth'>,
  fromDate = new Date()
): string {
  const timeZone = config.timezone || DEFAULT_TIMEZONE;
  const { hour, minute } = parseTimeOfDay(config.timeOfDay || DEFAULT_TIME_OF_DAY);
  const localNow = getTimeZoneParts(fromDate, timeZone);

  const resolveDaily = (): Date => {
    let { year, month, day } = localNow;
    let candidate = toUtcDateForTimeZoneLocal(year, month, day, hour, minute, timeZone);
    if (candidate.getTime() <= fromDate.getTime()) {
      ({ year, month, day } = addDays(year, month, day, 1));
      candidate = toUtcDateForTimeZoneLocal(year, month, day, hour, minute, timeZone);
    }
    return candidate;
  };

  const resolveWeekly = (): Date => {
    const targetDay = config.dayOfWeek == null ? 1 : Math.max(0, Math.min(6, Math.floor(config.dayOfWeek)));
    let deltaDays = (targetDay - localNow.weekday + 7) % 7;
    let nextDate = addDays(localNow.year, localNow.month, localNow.day, deltaDays);
    let candidate = toUtcDateForTimeZoneLocal(nextDate.year, nextDate.month, nextDate.day, hour, minute, timeZone);
    if (candidate.getTime() <= fromDate.getTime()) {
      deltaDays = deltaDays === 0 ? 7 : deltaDays + 7;
      nextDate = addDays(localNow.year, localNow.month, localNow.day, deltaDays);
      candidate = toUtcDateForTimeZoneLocal(nextDate.year, nextDate.month, nextDate.day, hour, minute, timeZone);
    }
    return candidate;
  };

  const resolveMonthly = (): Date => {
    const targetDay = config.dayOfMonth == null ? 1 : Math.max(1, Math.min(31, Math.floor(config.dayOfMonth)));

    let year = localNow.year;
    let month = localNow.month;
    let day = Math.min(targetDay, daysInMonth(year, month));
    let candidate = toUtcDateForTimeZoneLocal(year, month, day, hour, minute, timeZone);

    if (candidate.getTime() <= fromDate.getTime()) {
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
      day = Math.min(targetDay, daysInMonth(year, month));
      candidate = toUtcDateForTimeZoneLocal(year, month, day, hour, minute, timeZone);
    }

    return candidate;
  };

  const nextDate =
    config.cadence === 'weekly' ? resolveWeekly() : config.cadence === 'monthly' ? resolveMonthly() : resolveDaily();

  return nextDate.toISOString();
}

export function saveAutoSchedule(input: {
  prompt: string;
  count: number;
  cadence: AutoScheduleCadence;
  timezone: string;
  timeOfDay: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  active: boolean;
}): AutoScheduleConfig {
  const normalizedCount = Math.min(MAX_AUTO_WORDS_PER_RUN, Math.max(1, Math.floor(input.count)));
  const nextRunAt = computeNextRunAt(
    {
      cadence: input.cadence,
      timezone: input.timezone,
      timeOfDay: input.timeOfDay,
      dayOfWeek: input.dayOfWeek,
      dayOfMonth: input.dayOfMonth,
    },
    new Date()
  );
  return saveAutoScheduleConfig({ ...input, count: normalizedCount, nextRunAt });
}

export function toggleAutoSchedule(active: boolean): AutoScheduleConfig | null {
  const updated = setAutoScheduleActive(active);
  if (!updated || !active) {
    return updated;
  }

  const nextRunAt = computeNextRunAt(updated, new Date());
  return saveAutoScheduleConfig({
    prompt: updated.prompt,
    count: updated.count,
    cadence: updated.cadence,
    timezone: updated.timezone,
    timeOfDay: updated.timeOfDay,
    dayOfWeek: updated.dayOfWeek,
    dayOfMonth: updated.dayOfMonth,
    nextRunAt,
    active: true,
  });
}

async function runSchedule(config: AutoScheduleConfig): Promise<void> {
  if (runningScheduleIds.has(config.id)) {
    return;
  }
  runningScheduleIds.add(config.id);

  const run = createAutoScheduleRun(config.id);
  let generatedCount = 0;
  let savedCount = 0;
  let skippedExistingCount = 0;

  try {
    const existingWords = getAllWords();
    const existingSet = new Set(existingWords.map((word) => normalizeWord(word.english)));
    const exclusionWords = existingWords.map((word) => word.english).slice(-MAX_EXCLUSION_WORDS);
    const selected = new Map<string, WordSuggestion>();
    let attempts = 0;

    while (selected.size < config.count && attempts < MAX_ATTEMPTS) {
      attempts += 1;
      const missingCount = config.count - selected.size;
      const requestCount = Math.max(config.count, missingCount * 2);
      const generated = await generateAutoScheduledWords(requestCount, config.prompt, exclusionWords);
      generatedCount += generated.length;
      const uniqueResult = collectUniqueSuggestions({
        generated,
        existingNormalizedWords: existingSet,
        selectedByNormalizedWord: selected,
        maxAccepted: config.count,
      });
      skippedExistingCount += uniqueResult.skippedCount;
    }

    const toSave = Array.from(selected.values()).slice(0, config.count);
    if (toSave.length > 0) {
      const result = bulkAddWords(
        toSave.map((word) => ({
          english: word.english,
          arabicMeanings: word.arabicMeanings,
          exampleSentences: word.exampleSentences,
        }))
      );
      savedCount = result.added;
      skippedExistingCount += result.skipped;
    }

    finishAutoScheduleRun({
      runId: run.id,
      generatedCount,
      savedCount,
      skippedExistingCount,
      status: 'success',
    });
  } catch (error) {
    finishAutoScheduleRun({
      runId: run.id,
      generatedCount,
      savedCount,
      skippedExistingCount,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown scheduler error',
    });
  } finally {
    const nextRunAt = computeNextRunAt(config, new Date());
    updateAutoScheduleNextRun(nextRunAt);
    runningScheduleIds.delete(config.id);
  }
}

export async function runAutoWordSchedulerTick(): Promise<void> {
  const dueSchedules = getDueAutoScheduleConfigs(nowIso());
  for (const schedule of dueSchedules) {
    await runSchedule(schedule);
  }
}

export function startAutoWordScheduler(): void {
  if (schedulerTimer) return;

  void runAutoWordSchedulerTick().catch((error) => {
    console.error('Initial auto-word scheduler tick failed:', error);
  });

  schedulerTimer = setInterval(() => {
    void runAutoWordSchedulerTick().catch((error) => {
      console.error('Auto-word scheduler tick failed:', error);
    });
  }, SCHEDULER_TICK_MS);
}

export function stopAutoWordScheduler(): void {
  if (!schedulerTimer) return;
  clearInterval(schedulerTimer);
  schedulerTimer = null;
}
