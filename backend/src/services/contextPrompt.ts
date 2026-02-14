import OpenAI from 'openai';
import { contextPromptGenerationPrompt, type ContextPromptRequest } from '../prompts/contextPrompt.js';

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

export interface ContextPromptResponse {
  prompt: string;
  suggestedFocus?: string[];
  context?: string;
}

export async function generateContextPrompt(
  request: ContextPromptRequest
): Promise<ContextPromptResponse> {
  const prompt = contextPromptGenerationPrompt(request);
  const openai = getOpenAIClient();

  const response = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.8, // Higher temperature for more creative prompts
    max_tokens: 500,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  try {
    const raw = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(raw);
    
    return {
      prompt: parsed.prompt || 'Write sentences using the words from your session.',
      suggestedFocus: Array.isArray(parsed.suggestedFocus) ? parsed.suggestedFocus : undefined,
      context: parsed.context || undefined,
    };
  } catch (error) {
    console.error('Failed to parse OpenAI response:', content);
    throw new Error('Failed to parse AI response');
  }
}
