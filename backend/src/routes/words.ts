import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { generateWords, suggestMeanings } from '../services/openai.js';
import { analyzeSentence } from '../services/sentenceFeedback.js';
import { generateContextPrompt } from '../services/contextPrompt.js';
import { generateScenarios } from '../services/scenarioGeneration.js';
import { generateReadingArticle } from '../services/readingArticle.js';
import { evaluateReadingFluency } from '../services/readingFluency.js';

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
  wordsPerScenario: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional().default(2),
});

const readingArticleSchema = z.object({
  words: z.array(
    z.object({
      id: z.string(),
      english: z.string(),
      arabicMeanings: z.array(z.string()),
      exampleSentence: z.string(),
    })
  ).min(1).max(150),
  maxWords: z.union([z.literal(80), z.literal(140), z.literal(200)]).optional().default(200),
});

const readingEvaluateSchema = z.object({
  articleText: z.string().min(1).max(3000),
  expectedWords: z.array(z.string().min(1)).min(1),
  audioDurationSeconds: z.number().positive().max(3600).optional(),
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
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

    const { words, wordsPerScenario } = validation.data;
    const scenarios = await generateScenarios({ words, wordsPerScenario });

    res.json({ scenarios });
  } catch (error) {
    console.error('Error generating scenarios:', error);
    res.status(500).json({ error: 'Failed to generate scenarios' });
  }
});

router.post('/reading/article', async (req, res) => {
  try {
    const validation = readingArticleSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: validation.error.errors
      });
    }

    const { words, maxWords } = validation.data;
    const article = await generateReadingArticle({ words, maxWords });

    res.json({ article });
  } catch (error) {
    console.error('Error generating reading article:', error);
    res.status(500).json({ error: 'Failed to generate reading article' });
  }
});

router.post('/reading/evaluate', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Missing audio file' });
    }

    const contentType = req.file.mimetype || '';
    if (!contentType.startsWith('audio/')) {
      return res.status(400).json({ error: 'Invalid audio type' });
    }

    const expectedWordsRaw = req.body.expectedWords;
    let expectedWords: string[] = [];
    if (Array.isArray(expectedWordsRaw)) {
      expectedWords = expectedWordsRaw.filter((w): w is string => typeof w === 'string');
    } else if (typeof expectedWordsRaw === 'string') {
      try {
        const parsed = JSON.parse(expectedWordsRaw);
        if (Array.isArray(parsed)) {
          expectedWords = parsed.filter((w): w is string => typeof w === 'string');
        }
      } catch {
        expectedWords = expectedWordsRaw
          .split(',')
          .map((w) => w.trim())
          .filter(Boolean);
      }
    }

    const audioDurationRaw = req.body.audioDurationSeconds;
    const audioDurationSeconds =
      typeof audioDurationRaw === 'string' && audioDurationRaw.trim()
        ? Number(audioDurationRaw)
        : undefined;

    const parsedBody = readingEvaluateSchema.safeParse({
      articleText: req.body.articleText,
      expectedWords,
      audioDurationSeconds:
        typeof audioDurationSeconds === 'number' && !Number.isNaN(audioDurationSeconds)
          ? audioDurationSeconds
          : undefined,
    });

    if (!parsedBody.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: parsedBody.error.errors
      });
    }

    const evaluation = await evaluateReadingFluency({
      audioBuffer: req.file.buffer,
      mimeType: req.file.mimetype || 'audio/webm',
      fileName: req.file.originalname || 'reading-audio.webm',
      articleText: parsedBody.data.articleText,
      expectedWords: parsedBody.data.expectedWords,
      audioDurationSeconds: parsedBody.data.audioDurationSeconds,
    });

    res.json({ evaluation });
  } catch (error) {
    console.error('Error evaluating reading fluency:', error);
    res.status(500).json({ error: 'Failed to evaluate reading fluency' });
  }
});

export default router;
