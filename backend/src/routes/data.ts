import { Router } from 'express';
import { z } from 'zod';
import {
  addWord,
  bulkAddWords,
  deleteWord,
  exportFullBackup,
  getAllGrammarProgress,
  getAllWords,
  getEarliestReviewDate,
  getReviewCountsByDateRange,
  getRiskWords,
  getStreakData,
  getWordReviewHistory,
  getWordStats,
  getWordsByStatus,
  importFullBackup,
  incrementCorrectCount,
  incrementWrongCount,
  resetGrammarProgressForSkill,
  saveGrammarProgress,
  updateStreak,
  updateWordContent,
  updateWordReviewCounts,
  wordExists,
  type BackupPayloadV1,
} from '../db/index.js';

const router = Router();

const wordStatusSchema = z.enum(['new', 'known', 'problem']);

const addWordSchema = z.object({
  english: z.string().min(1),
  arabicMeanings: z.array(z.string()).default([]),
  exampleSentences: z.array(z.string()).default(['']),
  topic: z.string().optional(),
});

const updateWordContentSchema = z.object({
  arabicMeanings: z.array(z.string()).optional(),
  exampleSentences: z.array(z.string()).optional(),
});

const updateWordReviewCountsSchema = z.object({
  correctCount: z.number(),
  wrongCount: z.number(),
});

const importWordsSchema = z.array(
  z.object({
    english: z.string().min(1),
    arabicMeanings: z.array(z.string()).default([]),
    exampleSentences: z.array(z.string()).default(['']),
  })
);

const grammarProgressSchema = z.object({
  skillId: z.string().min(1),
  levelId: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']),
  attempts: z.number().int().min(0),
  correct: z.number().int().min(0),
  masteryPercent: z.number().int().min(0).max(100),
  status: z.enum(['not_started', 'in_progress', 'mastered']),
  lastResult: z.enum(['correct', 'incorrect']).optional(),
  lastUpdated: z.string().optional(),
});

const backupSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: z.string(),
  words: z.array(
    z.object({
      id: z.string(),
      english: z.string(),
      arabicMeanings: z.array(z.string()),
      exampleSentences: z.array(z.string()),
      topic: z.string().optional(),
      status: wordStatusSchema,
      wrongCount: z.number().int().min(0),
      correctCount: z.number().int().min(0),
      streak: z.number().int().min(0),
      createdAt: z.string(),
      lastReviewedAt: z.string().optional(),
    })
  ),
  wordReviewEvents: z.array(
    z.object({
      id: z.string(),
      wordId: z.string(),
      result: z.enum(['known', 'problem']),
      delta: z.union([z.literal(1), z.literal(-1)]),
      createdAt: z.string(),
    })
  ),
  streakData: z.array(
    z.object({
      id: z.string(),
      currentStreak: z.number().int().min(0),
      longestStreak: z.number().int().min(0),
      lastActivityDate: z.string(),
      reviewsToday: z.number().int().min(0),
      reviewsDate: z.string(),
    })
  ),
  dailyReviewCounts: z.array(
    z.object({
      date: z.string(),
      count: z.number().int().min(0),
    })
  ),
  grammarProgress: z.array(grammarProgressSchema),
});

router.get('/words', (_req, res) => {
  res.json({ words: getAllWords() });
});

router.get('/words/exists', (req, res) => {
  const english = String(req.query.english ?? '').trim();
  if (!english) {
    return res.status(400).json({ error: 'english is required' });
  }
  res.json({ exists: wordExists(english) });
});

router.get('/words/status/:status', (req, res) => {
  const parsed = wordStatusSchema.safeParse(req.params.status);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  res.json({ words: getWordsByStatus(parsed.data) });
});

router.post('/words', (req, res) => {
  const parsed = addWordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', details: parsed.error.errors });
  }
  const result = addWord(parsed.data);
  res.json(result);
});

router.patch('/words/:id/content', (req, res) => {
  const parsed = updateWordContentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', details: parsed.error.errors });
  }
  updateWordContent(req.params.id, parsed.data);
  res.json({ ok: true });
});

router.patch('/words/:id/review-counts', (req, res) => {
  const parsed = updateWordReviewCountsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', details: parsed.error.errors });
  }
  updateWordReviewCounts(req.params.id, parsed.data.correctCount, parsed.data.wrongCount);
  res.json({ ok: true });
});

router.post('/words/:id/review', (req, res) => {
  const parsed = z.object({ result: z.enum(['known', 'problem']) }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', details: parsed.error.errors });
  }

  if (parsed.data.result === 'known') {
    incrementCorrectCount(req.params.id);
  } else {
    incrementWrongCount(req.params.id);
  }

  res.json({ ok: true });
});

router.delete('/words/:id', (req, res) => {
  deleteWord(req.params.id);
  res.json({ ok: true });
});

router.post('/words/import', (req, res) => {
  const parsed = importWordsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', details: parsed.error.errors });
  }
  const result = bulkAddWords(parsed.data);
  res.json(result);
});

router.get('/words/:id/reviews', (req, res) => {
  res.json({ events: getWordReviewHistory(req.params.id) });
});

router.get('/words/stats', (_req, res) => {
  res.json(getWordStats());
});

router.get('/words/risk', (_req, res) => {
  res.json({ words: getRiskWords() });
});

router.get('/streak', (_req, res) => {
  res.json(getStreakData());
});

router.post('/streak/increment', (_req, res) => {
  res.json(updateStreak());
});

router.get('/reviews/counts', (req, res) => {
  const startDate = String(req.query.startDate ?? '');
  const endDate = String(req.query.endDate ?? '');
  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'startDate and endDate are required' });
  }
  res.json({ counts: getReviewCountsByDateRange(startDate, endDate) });
});

router.get('/reviews/earliest', (_req, res) => {
  res.json({ date: getEarliestReviewDate() });
});

router.get('/grammar/progress', (_req, res) => {
  res.json({ items: getAllGrammarProgress() });
});

router.put('/grammar/progress/:skillId', (req, res) => {
  const parsed = grammarProgressSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', details: parsed.error.errors });
  }
  if (parsed.data.skillId !== req.params.skillId) {
    return res.status(400).json({ error: 'skillId mismatch between path and body' });
  }
  saveGrammarProgress(parsed.data);
  res.json({ ok: true });
});

router.delete('/grammar/progress/:skillId', (req, res) => {
  resetGrammarProgressForSkill(req.params.skillId);
  res.json({ ok: true });
});

router.get('/backup/export', (_req, res) => {
  res.json(exportFullBackup());
});

router.post('/backup/import', (req, res) => {
  const parsed = backupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid backup payload', details: parsed.error.errors });
  }

  const counts = importFullBackup(parsed.data as BackupPayloadV1);
  res.json({ imported: counts });
});

export default router;
