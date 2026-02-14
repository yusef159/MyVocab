import OpenAI from 'openai';
import { scenarioGenerationPrompt, type ScenarioGenerationRequest, type GeneratedScenario } from '../prompts/scenarioGeneration.js';

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

export async function generateScenarios(
  request: ScenarioGenerationRequest
): Promise<GeneratedScenario[]> {
  const prompt = scenarioGenerationPrompt(request);
  const openai = getOpenAIClient();

  const response = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 1200,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  try {
    const raw = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(raw);
    const scenarios: unknown[] = Array.isArray(parsed.scenarios) ? parsed.scenarios : [];

    const validIds = new Set(request.words.map(w => w.id));
    return scenarios
      .filter((s): s is GeneratedScenario => {
        if (!s || typeof s !== 'object') return false;
        const sc = s as Record<string, unknown>;
        if (typeof sc.description !== 'string' || !Array.isArray(sc.wordIds)) return false;
        const descWords = (sc.description as string).trim().split(/\s+/).length;
        if (descWords < 2 || descWords > 4) return false;
        if (sc.wordIds.length < 2 || sc.wordIds.length > 4) return false;
        if (!sc.wordIds.every((id: unknown) => typeof id === 'string' && validIds.has(id))) return false;
        return true;
      })
      .map((s, i) => ({
        scenarioId: (s as GeneratedScenario).scenarioId || `scenario-${i + 1}`,
        description: (s as GeneratedScenario).description.trim(),
        wordIds: (s as GeneratedScenario).wordIds,
      }))
      .slice(0, 6);
  } catch (error) {
    console.error('Failed to parse scenario response:', content);
    throw new Error('Failed to parse AI response');
  }
}
