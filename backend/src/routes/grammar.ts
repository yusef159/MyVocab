import { Router } from 'express';
import { z } from 'zod';
import {
  getGrammarCatalog,
  getGrammarLesson,
  getGrammarExercises,
  gradeGrammarAnswer,
} from '../services/grammar.js';
import type { GrammarLevelId } from '../prompts/grammar.js';

const router = Router();

const levelEnum = z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);

const lessonSchema = z.object({
  skillId: z.string().min(1),
  levelId: levelEnum,
  skillTitle: z.string().min(1).optional(),
  skillDescription: z.string().optional(),
});

const exercisesSchema = z.object({
  skillId: z.string().min(1),
  levelId: levelEnum,
  skillTitle: z.string().min(1).optional(),
  count: z.number().int().min(1).max(15).default(5),
});

const gradeSchema = z.object({
  exercise: z.any(),
  userAnswer: z.union([z.string(), z.array(z.string())]),
});

router.post('/catalog', async (_req, res) => {
  try {
    const catalog = await getGrammarCatalog();
    res.json(catalog);
  } catch (error) {
    console.error('Error generating grammar catalog:', error);
    res.status(500).json({ error: 'Failed to generate grammar catalog' });
  }
});

router.post('/lesson', async (req, res) => {
  try {
    const validation = lessonSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: validation.error.errors,
      });
    }

    const { skillId, levelId, skillTitle, skillDescription } = validation.data;
    const lesson = await getGrammarLesson({
      skillId,
      levelId: levelId as GrammarLevelId,
      skillTitle,
      skillDescription,
    });

    res.json({ lesson });
  } catch (error) {
    console.error('Error generating grammar lesson:', error);
    res.status(500).json({ error: 'Failed to generate grammar lesson' });
  }
});

router.post('/exercises', async (req, res) => {
  try {
    const validation = exercisesSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: validation.error.errors,
      });
    }

    const { skillId, levelId, skillTitle, count } = validation.data;
    const exercises = await getGrammarExercises({
      skillId,
      levelId: levelId as GrammarLevelId,
      skillTitle,
      count,
    });

    res.json({ exercises });
  } catch (error) {
    console.error('Error generating grammar exercises:', error);
    res.status(500).json({ error: 'Failed to generate grammar exercises' });
  }
});

router.post('/grade', async (req, res) => {
  try {
    const validation = gradeSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: validation.error.errors,
      });
    }

    const { exercise, userAnswer } = validation.data;
    const evaluation = await gradeGrammarAnswer({ exercise, userAnswer });

    res.json({ evaluation });
  } catch (error) {
    console.error('Error grading grammar answer:', error);
    res.status(500).json({ error: 'Failed to grade answer' });
  }
});

// Placeholder: frontend persists progress locally; this endpoint is kept for future server-side storage.
router.get('/progress', async (_req, res) => {
  try {
    res.json({ items: [] });
  } catch (error) {
    console.error('Error returning grammar progress:', error);
    res.status(500).json({ error: 'Failed to load grammar progress' });
  }
});

export default router;

