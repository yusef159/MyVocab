import { Router } from 'express';
import { z } from 'zod';
import { generateWords, suggestMeanings } from '../services/openai.js';

const router = Router();

const generateSchema = z.object({
  count: z.number().min(1).max(20),
  topic: z.string().optional(),
});

const suggestSchema = z.object({
  word: z.string().min(1).max(100),
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

    const { count, topic } = validation.data;
    const words = await generateWords(count, topic);
    
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

export default router;
