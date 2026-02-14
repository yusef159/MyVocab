export interface ContextPromptRequest {
  words: Array<{
    english: string;
    arabicMeanings: string[];
    exampleSentence: string;
  }>;
}

export const contextPromptGenerationPrompt = (request: ContextPromptRequest): string => {
  const { words } = request;
  
  const wordsList = words.map(w => 
    `- "${w.english}" (${w.arabicMeanings.join(', ')})`
  ).join('\n');

  return `You are an English language tutor creating engaging writing prompts for vocabulary practice.

WORDS TO PRACTICE:
${wordsList}

Generate a creative, engaging writing prompt/scenario that naturally encourages the use of these words. The prompt should be:
- Clear and specific
- Engaging and interesting
- Suitable for an intermediate English learner
- Naturally incorporate the vocabulary words

Return ONLY a JSON object in this format:
{
  "prompt": "Write a short paragraph about [engaging scenario] using these words...",
  "suggestedFocus": ["word1", "word2"], // Optional: suggest 2-3 words to focus on
  "context": "Brief explanation of why this prompt works well with these words"
}

Example prompts:
- "Write about planning a weekend trip"
- "Describe your morning routine"
- "Tell a story about meeting someone new"
- "Explain how you prepare for an important event"

Make it creative and engaging!`;

};
