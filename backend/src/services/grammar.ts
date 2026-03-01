import OpenAI from 'openai';
import {
  grammarCatalogPrompt,
  grammarLessonPrompt,
  grammarExercisesPrompt,
  grammarGradePrompt,
  type GrammarCatalog,
  type GrammarLesson,
  type GrammarExercise,
  type GrammarAnswerEvaluation,
  type GrammarLevelId,
} from '../prompts/grammar.js';

let openaiClient: OpenAI | null = null;
let cachedCatalog: GrammarCatalog | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        'OPENAI_API_KEY environment variable is not set. Please add it to your .env file.',
      );
    }
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

const PRIMARY_MODEL = 'gpt-5-nano';
const FALLBACK_MODEL = 'gpt-4.1-nano';
let activeModel: string = PRIMARY_MODEL;

async function callWithModel(client: OpenAI, model: string, prompt: string, maxTokens: number): Promise<unknown> {
  const response = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: maxTokens,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('No response from OpenAI');

  const raw = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(raw);
}

async function callJSONModel(prompt: string, maxTokens = 3000): Promise<unknown> {
  const client = getOpenAIClient();

  if (activeModel === FALLBACK_MODEL) {
    return await callWithModel(client, FALLBACK_MODEL, prompt, maxTokens);
  }

  try {
    const result = await callWithModel(client, PRIMARY_MODEL, prompt, maxTokens);
    console.log(`[Grammar] Using model: ${PRIMARY_MODEL}`);
    return result;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[Grammar] ${PRIMARY_MODEL} failed: ${msg}`);
    console.warn(`[Grammar] Falling back to ${FALLBACK_MODEL}`);
    activeModel = FALLBACK_MODEL;
    return await callWithModel(client, FALLBACK_MODEL, prompt, maxTokens);
  }
}

export async function getGrammarCatalog(): Promise<GrammarCatalog> {
  // Catalog is now hardcoded on the frontend; this endpoint is kept for backward compatibility
  if (cachedCatalog) return cachedCatalog;

  try {
    const prompt = grammarCatalogPrompt();
    const parsed = await callJSONModel(prompt, 4000);
    const catalog = (parsed ?? {}) as GrammarCatalog;

    if (!Array.isArray(catalog.levels)) {
      throw new Error('Invalid grammar catalog format from AI');
    }

    cachedCatalog = catalog;
    return catalog;
  } catch (error) {
    console.error('AI catalog generation failed, returning empty catalog:', error);
    return { levels: [] };
  }
}

export async function getGrammarLesson(args: {
  levelId: GrammarLevelId;
  skillId: string;
  skillTitle?: string;
  skillDescription?: string;
}): Promise<GrammarLesson> {
  const prompt = grammarLessonPrompt(args);
  const parsed = (await callJSONModel(prompt)) as { lesson?: GrammarLesson };
  if (!parsed.lesson) {
    throw new Error('Invalid grammar lesson format from AI');
  }
  return parsed.lesson;
}

export async function getGrammarExercises(args: {
  levelId: GrammarLevelId;
  skillId: string;
  skillTitle?: string;
  count: number;
}): Promise<GrammarExercise[]> {
  const prompt = grammarExercisesPrompt(args);
  const parsed = (await callJSONModel(prompt)) as { exercises?: GrammarExercise[] };
  const exercises = Array.isArray(parsed.exercises) ? parsed.exercises : [];

  // Basic sanitisation: ensure ids and types exist
  return exercises
    .filter(
      (ex) =>
        ex &&
        typeof ex.id === 'string' &&
        typeof ex.prompt === 'string' &&
        typeof ex.type === 'string',
    )
    .slice(0, Math.max(1, Math.min(args.count, 15)));
}

export async function gradeGrammarAnswer(args: {
  exercise: GrammarExercise;
  userAnswer: string | string[];
}): Promise<GrammarAnswerEvaluation> {
  const prompt = grammarGradePrompt(args);
  const parsed = (await callJSONModel(prompt)) as { evaluation?: GrammarAnswerEvaluation };
  const evaluation = parsed.evaluation;

  if (!evaluation) {
    throw new Error('Invalid grammar evaluation format from AI');
  }

  const score =
    typeof evaluation.score === 'number'
      ? Math.max(0, Math.min(1, evaluation.score))
      : evaluation.isCorrect
        ? 1
        : 0;

  return {
    isCorrect: !!evaluation.isCorrect,
    score,
    feedback: evaluation.feedback || (evaluation.isCorrect ? 'Great job!' : 'Keep practicing.'),
    correctedAnswer: evaluation.correctedAnswer,
  };
}

