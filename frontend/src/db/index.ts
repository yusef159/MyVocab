import Dexie, { type EntityTable } from 'dexie';
import type { Word, StreakData } from '../types';

const db = new Dexie('MyVocabDB') as Dexie & {
  words: EntityTable<Word, 'id'>;
  streakData: EntityTable<StreakData, 'id'>;
};

db.version(1).stores({
  words: 'id, english, status, createdAt',
  streakData: 'id',
});

// Word operations
export async function wordExists(english: string): Promise<boolean> {
  const existing = await db.words.where('english').equalsIgnoreCase(english).first();
  return !!existing;
}

export async function addWord(word: Omit<Word, 'id' | 'createdAt' | 'wrongCount' | 'correctCount' | 'status'>): Promise<{ id: string | null; isDuplicate: boolean }> {
  // Check if word already exists (case-insensitive)
  const exists = await wordExists(word.english);
  if (exists) {
    return { id: null, isDuplicate: true };
  }

  const id = crypto.randomUUID();
  await db.words.add({
    ...word,
    id,
    status: 'new',
    wrongCount: 0,
    correctCount: 0,
    createdAt: new Date(),
  });
  return { id, isDuplicate: false };
}

export async function getAllWords(): Promise<Word[]> {
  return db.words.toArray();
}

export async function getWordsByStatus(status: Word['status']): Promise<Word[]> {
  return db.words.where('status').equals(status).toArray();
}

const KNOWN_PROGRESS_THRESHOLD = 0.8; // 80%

function statusFromProgress(correctCount: number, wrongCount: number): Word['status'] {
  const total = correctCount + wrongCount;
  if (total === 0) return 'new';
  const progress = correctCount / total;
  return progress > KNOWN_PROGRESS_THRESHOLD ? 'known' : 'problem';
}

export async function updateWordStatus(id: string, status: Word['status']): Promise<void> {
  await db.words.update(id, { status, lastReviewedAt: new Date() });
}

export async function incrementWrongCount(id: string): Promise<void> {
  const word = await db.words.get(id);
  if (word) {
    const newWrong = word.wrongCount + 1;
    const newCorrect = word.correctCount;
    const status = statusFromProgress(newCorrect, newWrong);
    await db.words.update(id, {
      wrongCount: newWrong,
      status,
      lastReviewedAt: new Date(),
    });
  }
}

export async function incrementCorrectCount(id: string): Promise<void> {
  const word = await db.words.get(id);
  if (word) {
    const newCorrect = word.correctCount + 1;
    const newWrong = word.wrongCount;
    const status = statusFromProgress(newCorrect, newWrong);
    await db.words.update(id, {
      correctCount: newCorrect,
      status,
      lastReviewedAt: new Date(),
    });
  }
}

export async function deleteWord(id: string): Promise<void> {
  await db.words.delete(id);
}

export async function bulkAddWords(words: Array<{
  english: string;
  arabicMeanings: string[];
  exampleSentence: string;
}>): Promise<{ added: number; skipped: number; skippedWords: string[] }> {
  // Get all existing words for duplicate checking
  const existingWords = await db.words.toArray();
  const existingSet = new Set(existingWords.map(w => w.english.toLowerCase()));

  // Also check for duplicates within the import itself
  const seenInImport = new Set<string>();
  const skippedWords: string[] = [];

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
    ...word,
    id: crypto.randomUUID(),
    status: 'new' as const,
    wrongCount: 0,
    correctCount: 0,
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
    };
    await db.streakData.add(streak);
  }
  return streak;
}

export async function updateStreak(): Promise<StreakData> {
  const today = new Date().toISOString().split('T')[0];
  const streak = await getStreakData();

  if (streak.lastActivityDate === today) {
    return streak; // Already logged today
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  let newCurrentStreak: number;
  if (streak.lastActivityDate === yesterdayStr) {
    // Consecutive day - increment streak
    newCurrentStreak = streak.currentStreak + 1;
  } else {
    // Streak broken - reset to 1
    newCurrentStreak = 1;
  }

  const newLongestStreak = Math.max(streak.longestStreak, newCurrentStreak);

  const updatedStreak = {
    ...streak,
    currentStreak: newCurrentStreak,
    longestStreak: newLongestStreak,
    lastActivityDate: today,
  };

  await db.streakData.put(updatedStreak);
  return updatedStreak;
}

export { db };
