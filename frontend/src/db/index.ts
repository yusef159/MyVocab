import Dexie, { type EntityTable } from 'dexie';
import type { Word, StreakData } from '../types';

export interface DailyReviewCount {
  date: string; // YYYY-MM-DD
  count: number;
}

const db = new Dexie('MyVocabDB') as Dexie & {
  words: EntityTable<Word, 'id'>;
  streakData: EntityTable<StreakData, 'id'>;
  dailyReviewCounts: EntityTable<DailyReviewCount, 'date'>;
};

db.version(1).stores({
  words: 'id, english, status, createdAt',
  streakData: 'id',
});

// Migration: Add streak property to existing words
db.version(2).stores({
  words: 'id, english, status, createdAt',
  streakData: 'id',
}).upgrade(async (tx) => {
  const words = await tx.table('words').toArray();
  await Promise.all(words.map(word => {
    if (!('streak' in word) || typeof word.streak !== 'number') {
      return tx.table('words').update(word.id, { streak: 0 });
    }
  }));
});

// Migration: exampleSentence -> exampleSentences (array, up to 3)
db.version(3).stores({
  words: 'id, english, status, createdAt',
  streakData: 'id',
}).upgrade(async (tx) => {
  const words = await tx.table('words').toArray();
  await Promise.all(words.map((word: Record<string, unknown>) => {
    const hasNew = Array.isArray(word.exampleSentences) && word.exampleSentences.length > 0;
    if (hasNew) return;
    const legacy = typeof word.exampleSentence === 'string' && word.exampleSentence.trim();
    const exampleSentences = legacy ? [word.exampleSentence as string] : [''];
    return tx.table('words').update(word.id as string, { exampleSentences });
  }));
});

// Migration: add dailyReviewCounts for review activity graph
db.version(4).stores({
  words: 'id, english, status, createdAt',
  streakData: 'id',
  dailyReviewCounts: 'date',
}).upgrade(async (tx) => {
  const streak = await tx.table('streakData').get('main-streak') as { reviewsToday?: number; reviewsDate?: string } | undefined;
  if (streak?.reviewsToday && streak.reviewsDate) {
    await tx.table('dailyReviewCounts').put({ date: streak.reviewsDate, count: streak.reviewsToday });
  }
});

/** Normalize raw word from DB to Word (handle legacy exampleSentence) */
function normalizeWord(raw: Record<string, unknown>): Word {
  const exampleSentences = Array.isArray(raw.exampleSentences) && raw.exampleSentences.length > 0
    ? (raw.exampleSentences as string[]).filter(Boolean).slice(0, 3)
    : typeof raw.exampleSentence === 'string' && raw.exampleSentence.trim()
      ? [raw.exampleSentence]
      : [''];
  return { ...raw, exampleSentences } as Word;
}

// Word operations
export async function wordExists(english: string): Promise<boolean> {
  const existing = await db.words.where('english').equalsIgnoreCase(english).first();
  return !!existing;
}

export async function addWord(word: Omit<Word, 'id' | 'createdAt' | 'wrongCount' | 'correctCount' | 'status' | 'streak'>): Promise<{ id: string | null; isDuplicate: boolean }> {
  // Check if word already exists (case-insensitive)
  const exists = await wordExists(word.english);
  if (exists) {
    return { id: null, isDuplicate: true };
  }

  const sentences = (word.exampleSentences ?? []).filter(Boolean).slice(0, 3);
  const id = crypto.randomUUID();
  await db.words.add({
    ...word,
    exampleSentences: sentences.length ? sentences : [''],
    id,
    status: 'new',
    wrongCount: 0,
    correctCount: 0,
    streak: 0,
    createdAt: new Date(),
  });
  return { id, isDuplicate: false };
}

export async function getAllWords(): Promise<Word[]> {
  const rows = await db.words.toArray();
  return rows.map((r) => normalizeWord(r as unknown as Record<string, unknown>));
}

export async function getWordsByStatus(status: Word['status']): Promise<Word[]> {
  const rows = await db.words.where('status').equals(status).toArray();
  return rows.map((r) => normalizeWord(r as unknown as Record<string, unknown>));
}

export async function updateWordStatus(id: string, status: Word['status']): Promise<void> {
  await db.words.update(id, { status, lastReviewedAt: new Date() });
}

export async function incrementWrongCount(id: string): Promise<void> {
  const word = await db.words.get(id);
  if (word) {
    const newWrong = word.wrongCount + 1;
    const newCorrect = word.correctCount;
    
    let newStatus: Word['status'];
    let newStreak: number;
    
    if (word.status === 'new') {
      // New word: if wrong → status becomes "problem"
      newStatus = 'problem';
      newStreak = 0;
    } else if (word.status === 'problem') {
      // Problem word: reset streak to 0, keep status as "problem"
      newStatus = 'problem';
      newStreak = 0;
    } else {
      // Known word: if wrong again, change back to problem and reset streak
      newStatus = 'problem';
      newStreak = 0;
    }
    
    await db.words.update(id, {
      wrongCount: newWrong,
      correctCount: newCorrect,
      status: newStatus,
      streak: newStreak,
      lastReviewedAt: new Date(),
    });
  }
}

export async function incrementCorrectCount(id: string): Promise<void> {
  const word = await db.words.get(id);
  if (word) {
    const newCorrect = word.correctCount + 1;
    const newWrong = word.wrongCount;
    
    let newStatus: Word['status'];
    let newStreak: number;
    
    if (word.status === 'new') {
      // New word: if correct → status becomes "known"
      newStatus = 'known';
      newStreak = 0; // Known words don't need streak
    } else if (word.status === 'problem') {
      // Problem word: increment streak
      const currentStreak = word.streak || 0;
      newStreak = currentStreak + 1;
      
      // If streak reaches 3, change status to "known"
      if (newStreak >= 3) {
        newStatus = 'known';
        newStreak = 0; // Reset streak when becoming known
      } else {
        newStatus = 'problem';
      }
    } else {
      // Known word: keep as known, no streak needed
      newStatus = 'known';
      newStreak = 0;
    }
    
    await db.words.update(id, {
      correctCount: newCorrect,
      wrongCount: newWrong,
      status: newStatus,
      streak: newStreak,
      lastReviewedAt: new Date(),
    });
  }
}

export async function updateWordContent(
  id: string,
  updates: { arabicMeanings?: string[]; exampleSentences?: string[] }
): Promise<void> {
  const payload: { arabicMeanings?: string[]; exampleSentences?: string[] } = { ...updates };
  if (Array.isArray(payload.exampleSentences)) {
    payload.exampleSentences = payload.exampleSentences.filter((s) => s && String(s).trim()).slice(0, 3);
    if (payload.exampleSentences.length === 0) payload.exampleSentences = [''];
  }
  await db.words.update(id, payload);
}

export async function deleteWord(id: string): Promise<void> {
  await db.words.delete(id);
}

export async function bulkAddWords(words: Array<{
  english: string;
  arabicMeanings: string[];
  exampleSentences: string[];
}>): Promise<{ added: number; skipped: number; skippedWords: string[] }> {
  // Get all existing words for duplicate checking
  const existingWords = await db.words.toArray();
  const existingSet = new Set(existingWords.map((w: { english: string }) => w.english.toLowerCase()));

  // Also check for duplicates within the import itself
  const seenInImport = new Set<string>();
  const skippedWords: string[] = [];

  const normalizeSentences = (ss: string[]) => {
    const out = (ss ?? []).filter(Boolean).map(s => String(s).trim()).slice(0, 3);
    return out.length ? out : [''];
  };

  const wordsToAdd = words.filter(word => {
    const lowerWord = word.english.toLowerCase();
    
    // Check if already exists in database
    if (existingSet.has(lowerWord)) {
      skippedWords.push(word.english);
      return false;
    }
    
    // Check if duplicate within the import
    if (seenInImport.has(lowerWord)) {
      skippedWords.push(word.english);
      return false;
    }
    
    seenInImport.add(lowerWord);
    return true;
  }).map(word => ({
    english: word.english,
    arabicMeanings: word.arabicMeanings,
    exampleSentences: normalizeSentences(word.exampleSentences),
    id: crypto.randomUUID(),
    status: 'new' as const,
    wrongCount: 0,
    correctCount: 0,
    streak: 0,
    createdAt: new Date(),
  }));

  if (wordsToAdd.length > 0) {
    await db.words.bulkAdd(wordsToAdd);
  }
  
  return { 
    added: wordsToAdd.length, 
    skipped: skippedWords.length,
    skippedWords 
  };
}

export async function getWordStats(): Promise<{
  total: number;
  known: number;
  problem: number;
  new: number;
}> {
  const [total, known, problem, newCount] = await Promise.all([
    db.words.count(),
    db.words.where('status').equals('known').count(),
    db.words.where('status').equals('problem').count(),
    db.words.where('status').equals('new').count(),
  ]);
  return { total, known, problem, new: newCount };
}

// Streak operations
const STREAK_ID = 'main-streak';

export async function getStreakData(): Promise<StreakData> {
  let streak = await db.streakData.get(STREAK_ID);
  if (!streak) {
    streak = {
      id: STREAK_ID,
      currentStreak: 0,
      longestStreak: 0,
      lastActivityDate: '',
      reviewsToday: 0,
      reviewsDate: '',
    };
    await db.streakData.add(streak);
  }
  // Migration: add reviewsToday and reviewsDate if they don't exist
  let needsUpdate = false;
  if (typeof streak.reviewsToday !== 'number') {
    streak.reviewsToday = 0;
    needsUpdate = true;
  }
  if (!streak.reviewsDate) {
    streak.reviewsDate = '';
    needsUpdate = true;
  }
  if (needsUpdate) {
    await db.streakData.put(streak);
  }
  return streak;
}

export async function updateStreak(): Promise<StreakData> {
  const today = new Date().toISOString().split('T')[0];
  const streak = await getStreakData();

  let reviewsToday = streak.reviewsToday || 0;
  let reviewsDate = streak.reviewsDate || '';
  
  // If it's a new day, reset reviewsToday
  if (reviewsDate !== today) {
    reviewsToday = 0;
    reviewsDate = today;
  }

  // Increment reviews today
  reviewsToday += 1;

  await incrementDailyReviewCount(today);

  // If reviews reach 20 today, increment the streak
  if (reviewsToday === 20) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    let newCurrentStreak: number;
    // lastActivityDate tracks the last day the streak was incremented (i.e., last day with 20+ reviews)
    if (streak.lastActivityDate === yesterdayStr) {
      // Consecutive day - increment streak
      newCurrentStreak = streak.currentStreak + 1;
    } else {
      // Streak broken or first day - start/reset to 1
      newCurrentStreak = 1;
    }
    
    const newLongestStreak = Math.max(streak.longestStreak, newCurrentStreak);
    
    const updatedStreak = {
      ...streak,
      currentStreak: newCurrentStreak,
      longestStreak: newLongestStreak,
      lastActivityDate: today, // Update to today since we completed 20 reviews
      reviewsToday,
      reviewsDate,
    };
    
    await db.streakData.put(updatedStreak);
    return updatedStreak;
  }

  // Update reviewsToday but don't increment streak yet
  const updatedStreak = {
    ...streak,
    reviewsToday,
    reviewsDate,
  };

  await db.streakData.put(updatedStreak);
  return updatedStreak;
}

// Daily review counts for activity graph
export async function incrementDailyReviewCount(date: string): Promise<void> {
  const row = await db.dailyReviewCounts.get(date);
  if (row) {
    await db.dailyReviewCounts.update(date, { count: row.count + 1 });
  } else {
    await db.dailyReviewCounts.add({ date, count: 1 });
  }
}

function getDatesInRange(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(start + 'T12:00:00');
  const endD = new Date(end + 'T12:00:00');
  while (d <= endD) {
    out.push(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export async function getReviewCountsByDateRange(
  startDate: string,
  endDate: string
): Promise<{ date: string; count: number }[]> {
  const dates = getDatesInRange(startDate, endDate);
  const counts = await db.dailyReviewCounts.bulkGet(dates);
  return dates.map((date, i) => ({ date, count: counts[i]?.count ?? 0 }));
}

export async function getEarliestReviewDate(): Promise<string | null> {
  const first = await db.dailyReviewCounts.orderBy('date').first();
  return first?.date ?? null;
}

export { db };
