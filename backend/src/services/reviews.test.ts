import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { initDatabase, addWord, recordReview, exportFullBackup, getAllWords, getWordReviewHistory, getStreakData } from '../db/index.js';
initDatabase();
const add = () => addWord({ english: randomUUID(), arabicMeanings: ['test'], exampleSentences: ['test'] }).id!;

test('a miss halves the interval only on a known-to-problem transition', () => {
 const connection = new Database(process.env.DB_PATH!);
 try {
  for (const [status, interval, expected] of [
   ['known', 8, 4], ['known', 7, 3], ['known', 1, 1],
   ['problem', 8, 8], ['new', 8, 8],
  ] as const) {
   const id = add();
   connection.prepare('UPDATE words SET status = ?, interval = ?, correct_count = 12, wrong_count = 2, streak = 2 WHERE id = ?').run(status, interval, id);
   recordReview(id, 'problem', randomUUID());
   let word = getAllWords().find(w => w.id === id)!;
   assert.equal(word.status, 'problem');
   assert.equal(word.interval, expected);
   assert.equal(word.correctCount, 12);
   assert.equal(word.wrongCount, 3);
   assert.equal(word.streak, 0);
   recordReview(id, 'problem', randomUUID());
   word = getAllWords().find(w => w.id === id)!;
   assert.equal(word.interval, expected, 'another miss while in problem status keeps the interval');
   assert.equal(word.correctCount, 12);
   assert.equal(word.wrongCount, 4);
  }
 } finally { connection.close(); }
});

test('review commits word, history and daily activity, and retry counts once', () => {
 const id = add(); const key = randomUUID(); const before = getStreakData().reviewsToday;
 recordReview(id, 'known', key);
 recordReview(id, 'known', key);
 assert.equal(getAllWords().find(w => w.id === id)?.correctCount, 1);
 assert.equal(getWordReviewHistory(id).length, 1);
 assert.equal(getStreakData().reviewsToday, before + 1);
 assert.throws(() => recordReview(id, 'problem', key), /conflict/);
});

test('failed activity write rolls back word and history too', () => {
 const id = add(); const before = exportFullBackup();
 const connection = new Database(process.env.DB_PATH!);
 connection.exec("CREATE TRIGGER fail_activity BEFORE INSERT ON daily_review_counts BEGIN SELECT RAISE(ABORT, 'test failure'); END");
 try {
  assert.throws(() => recordReview(id, 'problem', randomUUID()), /test failure/);
  const after = exportFullBackup();
  assert.deepEqual(after.words, before.words);
  assert.deepEqual(after.wordReviewEvents, before.wordReviewEvents);
  assert.deepEqual(after.streakData, before.streakData);
  assert.deepEqual(after.dailyReviewCounts, before.dailyReviewCounts);
 } finally { connection.exec('DROP TRIGGER fail_activity'); connection.close(); }
});

test('missing words never count as reviews', () => {
 const before = getStreakData();
 assert.throws(() => recordReview(randomUUID(), 'known', randomUUID()), /not found/);
 assert.deepEqual(getStreakData(), before);
});

test('UTC day rollover and goal preserve existing streak rules and backup shape', () => {
 const connection = new Database(process.env.DB_PATH!);
 const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
 connection.prepare('UPDATE streak_data SET reviews_date = ?, reviews_today = 50, last_activity_date = ?, current_streak = 2, longest_streak = 2').run(yesterday, yesterday);
 connection.close();
 for (let n = 0; n < 20; n++) recordReview(add(), 'known', randomUUID());
 assert.equal(getStreakData().reviewsToday, 20);
 assert.equal(getStreakData().currentStreak, 3);
 recordReview(add(), 'known', randomUUID());
 assert.equal(getStreakData().currentStreak, 3);
 assert.deepEqual(Object.keys(exportFullBackup()).sort(), ['schemaVersion','exportedAt','words','wordReviewEvents','streakData','dailyReviewCounts','grammarProgress'].sort());
});

test('opening on a new day shows zero progress before any review, then counts from one', () => {
 const connection = new Database(process.env.DB_PATH!);
 const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
 const today = new Date().toISOString().slice(0, 10);
 try {
  // Both a completed goal and an incomplete goal must reset on read.
  for (const previousTotal of [40, 7]) {
   connection.prepare('UPDATE streak_data SET reviews_date = ?, reviews_today = ?, current_streak = 2, longest_streak = 5, last_activity_date = ?').run(yesterday, previousTotal, yesterday);
   const fresh = getStreakData();
   assert.equal(fresh.reviewsToday, 0);
   assert.equal(fresh.reviewsDate, today);
   assert.equal(fresh.currentStreak, 2);
   assert.equal(fresh.longestStreak, 5);
   assert.equal(fresh.lastActivityDate, yesterday);
   // Reading progress preserves stored history.
   assert.equal((connection.prepare('SELECT reviews_today FROM streak_data').get() as { reviews_today: number }).reviews_today, previousTotal);
   recordReview(add(), 'known', randomUUID());
   assert.equal(getStreakData().reviewsToday, 1);
   recordReview(add(), 'problem', randomUUID());
   assert.equal(getStreakData().reviewsToday, 2);
  }
 } finally { connection.close(); }
});
