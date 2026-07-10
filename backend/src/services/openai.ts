import OpenAI from 'openai';
import {
  autoScheduleWordsPrompt,
  explainWordPrompt,
  generateWordsPrompt,
  suggestMeaningsPrompt,
  type WordLevel,
} from '../prompts/wordGeneration.js';

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

export interface WordSuggestion {
  english: string;
  arabicMeanings: string[];
  exampleSentences: string[];
}

export interface EnglishExplanationResult {
  options: string[];
}

function parseWordSuggestions(content: string): WordSuggestion[] {
  const raw = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const parsed = JSON.parse(raw);
  const arr = Array.isArray(parsed) ? parsed : [parsed];
  return arr as WordSuggestion[];
}

export async function generateWords(
  count: number,
  topic?: string,
  level?: WordLevel
): Promise<WordSuggestion[]> {
  const prompt = generateWordsPrompt(count, topic, level ?? 'B2');
  return generateWordsByPrompt(prompt, 2000);
}

export async function generateAutoScheduledWords(
  count: number,
  userPrompt: string,
  excludedWords: string[] = []
): Promise<WordSuggestion[]> {
  const prompt = autoScheduleWordsPrompt(count, userPrompt, excludedWords);
  return generateWordsByPrompt(prompt, 2500);
}

async function generateWordsByPrompt(prompt: string, maxTokens: number): Promise<WordSuggestion[]> {
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
    max_tokens: maxTokens,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  try {
    return parseWordSuggestions(content);
  } catch (error) {
    console.error('Failed to parse OpenAI response:', content);
    throw new Error('Failed to parse AI response');
  }
}

export async function suggestMeanings(word: string): Promise<WordSuggestion> {
  const prompt = suggestMeaningsPrompt(word);
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
    max_tokens: 500,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  try {
    const suggestions = parseWordSuggestions(content);
    if (!suggestions[0]) {
      throw new Error('No suggestion found');
    }
    return suggestions[0];
  } catch (error) {
    console.error('Failed to parse OpenAI response:', content);
    throw new Error('Failed to parse AI response');
  }
}

export async function suggestEnglishExplanation(word: string): Promise<EnglishExplanationResult> {
  const prompt = explainWordPrompt(word);
  const openai = getOpenAIClient();

  const response = await openai.chat.completions.create({
    model: 'gpt-4.1-nano',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.5,
    max_tokens: 300,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  try {
    const raw = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(raw) as { options?: unknown };
    const options = (Array.isArray(parsed.options) ? parsed.options : [])
      .map((value) => String(value).trim())
      .filter(Boolean)
      .slice(0, 3);

    if (options.length === 0) {
      throw new Error('No explanation options found');
    }

    return { options };
  } catch (error) {
    console.error('Failed to parse OpenAI explanation response:', content);
    throw new Error('Failed to parse AI response');
  }
}
