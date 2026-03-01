import OpenAI from 'openai';
import { sentenceFeedbackPrompt, type SentenceFeedbackRequest } from '../prompts/sentenceFeedback.js';

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set. Please add it to your .env file.');
    }
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

export interface SentenceFeedbackResponse {
  detectedWords: string[];
  grammarFeedback: {
    isCorrect: boolean;
    issues: string[];
    corrections: string;
  };
  contextFeedback: {
    isAppropriate: boolean;
    issues: string[];
    explanation: string;
  };
  naturalnessFeedback: {
    isNatural: boolean;
    comment: string;
  };
  scenarioFitFeedback?: {
    fitsScenario: boolean;
    comment: string;
  };
  /** When scenario is provided: one sentence the AI composes using all words, fitting the scenario */
  modelSentence?: string;
  score: number;
  overallFeedback: string;
}

export async function analyzeSentence(
  request: SentenceFeedbackRequest
): Promise<SentenceFeedbackResponse> {
  const prompt = sentenceFeedbackPrompt(request);
  const openai = getOpenAIClient();

  const response = await openai.chat.completions.create({
    model: 'gpt-4.1-nano',
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.7,
    max_tokens: 1500,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  try {
    const raw = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(raw);
    
    const grammarFeedback = {
      isCorrect: parsed.grammarFeedback?.isCorrect ?? false,
      issues: Array.isArray(parsed.grammarFeedback?.issues) ? parsed.grammarFeedback.issues : [],
      corrections: parsed.grammarFeedback?.corrections ?? request.sentence,
    };
    const contextFeedback = {
      isAppropriate: parsed.contextFeedback?.isAppropriate ?? false,
      issues: Array.isArray(parsed.contextFeedback?.issues) ? parsed.contextFeedback.issues : [],
      explanation: parsed.contextFeedback?.explanation ?? '',
    };
    const naturalnessFeedback = {
      isNatural: parsed.naturalnessFeedback?.isNatural ?? true,
      comment: parsed.naturalnessFeedback?.comment ?? '',
    };
    const scenarioFitFeedback = parsed.scenarioFitFeedback && typeof parsed.scenarioFitFeedback.fitsScenario === 'boolean'
      ? {
          fitsScenario: parsed.scenarioFitFeedback.fitsScenario,
          comment: typeof parsed.scenarioFitFeedback.comment === 'string' ? parsed.scenarioFitFeedback.comment : '',
        }
      : undefined;

    // Parse score: model may return number or string (e.g. "85"); fallback from feedback if missing/invalid
    let score: number;
    const rawScore = parsed.score;
    if (typeof rawScore === 'number' && !Number.isNaN(rawScore)) {
      score = Math.max(0, Math.min(100, Math.round(rawScore)));
    } else if (typeof rawScore === 'string') {
      const n = Number(rawScore);
      score = !Number.isNaN(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
    } else {
      score = 0;
    }
    if (score === 0 && grammarFeedback.isCorrect && contextFeedback.isAppropriate && naturalnessFeedback.isNatural && (scenarioFitFeedback?.fitsScenario !== false)) {
      // All feedback positive but score was missing/invalid — use a high score so we don't show 0
      score = scenarioFitFeedback?.fitsScenario ? 90 : 85;
    }
    
    return {
      detectedWords: Array.isArray(parsed.detectedWords) ? parsed.detectedWords : [],
      grammarFeedback,
      contextFeedback,
      naturalnessFeedback,
      scenarioFitFeedback,
      modelSentence: typeof parsed.modelSentence === 'string' && parsed.modelSentence.trim() ? parsed.modelSentence.trim() : undefined,
      score,
      overallFeedback: parsed.overallFeedback || 'Good effort! Keep practicing.',
    };
  } catch (error) {
    console.error('Failed to parse OpenAI response:', content);
    throw new Error('Failed to parse AI response');
  }
}
