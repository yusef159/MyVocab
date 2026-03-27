import OpenAI from 'openai';
import {
  readingArticlePrompt,
  type ReadingArticleRequest,
} from '../prompts/readingArticle.js';

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        'OPENAI_API_KEY environment variable is not set. Please add it to your .env file.'
      );
    }
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

export interface ReadingArticleResponse {
  title: string;
  article: string;
  usedWordIds: string[];
  wordCount: number;
}

function countWords(text: string): number {
  const normalized = text.trim();
  if (!normalized) return 0;
  return normalized.split(/\s+/).length;
}

function trimToWordLimit(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text.trim();
  return words.slice(0, maxWords).join(' ').trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function detectUsedWordIds(
  articleText: string,
  words: ReadingArticleRequest['words']
): string[] {
  const normalizedText = articleText.toLowerCase();
  return words
    .filter((w) => {
      const token = w.english.trim().toLowerCase();
      if (!token) return false;
      const pattern = new RegExp(`\\b${escapeRegExp(token)}\\b`, 'i');
      return pattern.test(normalizedText);
    })
    .map((w) => w.id);
}

export async function generateReadingArticle(
  request: ReadingArticleRequest
): Promise<ReadingArticleResponse> {
  const maxWords = Math.max(60, Math.min(200, request.maxWords ?? 200));
  const prompt = readingArticlePrompt(request);
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
    max_tokens: 900,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  try {
    const raw = content
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    const jsonCandidate = raw.includes('{') && raw.includes('}')
      ? raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)
      : raw;
    const parsed = JSON.parse(jsonCandidate);

    const title =
      typeof parsed.title === 'string' && parsed.title.trim()
        ? parsed.title.trim()
        : 'Reading Practice';
    const rawArticle =
      typeof parsed.article === 'string' ? parsed.article.trim() : '';
    const cappedArticle = trimToWordLimit(rawArticle, maxWords);
    const usedWordIds = detectUsedWordIds(cappedArticle, request.words);
    const wordCount = countWords(cappedArticle);

    if (!cappedArticle) {
      throw new Error('Generated article was empty');
    }

    return {
      title,
      article: cappedArticle,
      usedWordIds,
      wordCount,
    };
  } catch (error) {
    console.error('Failed to parse OpenAI response:', content);
    throw new Error('Failed to parse AI response');
  }
}
