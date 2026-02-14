import { Router } from 'express';
import { z } from 'zod';
import { generateWords, suggestMeanings } from '../services/openai.js';
import { analyzeSentence } from '../services/sentenceFeedback.js';
import { generateContextPrompt } from '../services/contextPrompt.js';
import { generateScenarios } from '../services/scenarioGeneration.js';

const router = Router();

const generateSchema = z.object({
  count: z.number().min(1).max(20),
  topic: z.string().optional(),
  level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).optional(),
});

const suggestSchema = z.object({
  word: z.string().min(1).max(100),
});

const feedbackSchema = z.object({
  words: z.array(z.object({
    id: z.string(),
    english: z.string(),
    arabicMeanings: z.array(z.string()),
    exampleSentence: z.string(),
  })),
  sentence: z.string().min(1).max(2000),
  targetWordId: z.string().optional(),
  scenarioDescription: z.string().max(200).optional(),
});

const promptSchema = z.object({
  words: z.array(z.object({
    english: z.string(),
    arabicMeanings: z.array(z.string()),
    exampleSentence: z.string(),
  })),
});

const scenariosSchema = z.object({
  words: z.array(z.object({
    id: z.string(),
    english: z.string(),
    arabicMeanings: z.array(z.string()),
    exampleSentence: z.string(),
  })),
});

router.post('/generate', async (req, res) => {
  try {
    const validation = generateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid request', 
        details: validation.error.errors 
      });
    }

    const { count, topic, level } = validation.data;
    const words = await generateWords(count, topic, level);
    
    res.json({ words });
  } catch (error) {
    console.error('Error generating words:', error);
    res.status(500).json({ error: 'Failed to generate words' });
  }
});

router.post('/suggest', async (req, res) => {
  try {
    const validation = suggestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid request', 
        details: validation.error.errors 
      });
    }

    const { word } = validation.data;
    const suggestion = await suggestMeanings(word);
    
    res.json({ suggestion });
  } catch (error) {
    console.error('Error suggesting meanings:', error);
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
});

router.post('/test/feedback', async (req, res) => {
  try {
    const validation = feedbackSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid request', 
        details: validation.error.errors 
      });
    }

    const { words, sentence, targetWordId, scenarioDescription } = validation.data;
    const feedback = await analyzeSentence({ words, sentence, targetWordId, scenarioDescription });
    
    res.json({ feedback });
  } catch (error) {
    console.error('Error analyzing sentence:', error);
    res.status(500).json({ error: 'Failed to analyze sentence' });
  }
});

router.post('/test/prompt', async (req, res) => {
  try {
    const validation = promptSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: validation.error.errors
      });
    }

    const { words } = validation.data;
    const prompt = await generateContextPrompt({ words });

    res.json({ prompt });
  } catch (error) {
    console.error('Error generating context prompt:', error);
    res.status(500).json({ error: 'Failed to generate context prompt' });
  }
});

router.post('/test/scenarios', async (req, res) => {
  try {
    const validation = scenariosSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: validation.error.errors
      });
    }

    const { words } = validation.data;
    const scenarios = await generateScenarios({ words });

    res.json({ scenarios });
  } catch (error) {
    console.error('Error generating scenarios:', error);
    res.status(500).json({ error: 'Failed to generate scenarios' });
  }
});

export default router;
