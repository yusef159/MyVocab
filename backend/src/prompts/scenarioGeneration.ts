export interface ScenarioGenerationRequest {
  words: Array<{
    id: string;
    english: string;
    arabicMeanings: string[];
    exampleSentence: string;
  }>;
}

export interface GeneratedScenario {
  scenarioId: string;
  description: string; // 2–4 words, short real-life scenario
  wordIds: string[];   // 2–4 word IDs to use in this scenario
}

export const scenarioGenerationPrompt = (request: ScenarioGenerationRequest): string => {
  const { words } = request;
  const wordsList = words.map(w =>
    `- id: "${w.id}", "${w.english}" (${w.arabicMeanings.join(', ')})`
  ).join('\n');

  return `You are an English language tutor creating a scenario-based vocabulary test.

WORDS IN THIS SESSION (use their "id" in wordIds):
${wordsList}

RULES:
1. Create exactly 4–6 short real-life scenarios.
2. Each scenario has a "description": use ONLY 2–4 words (e.g. "At the airport", "Planning a weekend trip", "Job interview"). No full sentences.
3. Assign 2–4 words to each scenario via "wordIds". The learner will write ONE sentence that uses all of these words together. Do NOT use all session words in one scenario.
4. Distribute the words across scenarios so each word appears in at least one scenario; words may repeat in different scenarios if needed.
5. Scenarios should be varied (e.g. travel, work, daily life, shopping, health).

Return ONLY a JSON object in this format (no markdown, no code block):
{
  "scenarios": [
    {
      "scenarioId": "scenario-1",
      "description": "At the airport",
      "wordIds": ["<id of word 1>", "<id of word 2>"]
    },
    {
      "scenarioId": "scenario-2",
      "description": "Morning routine",
      "wordIds": ["<id>", "<id>", "<id>"]
    }
  ]
}

Use the exact "id" values from the word list above in each "wordIds" array. Create 4–6 scenarios.`;
};
