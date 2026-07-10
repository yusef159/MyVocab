export type WordLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export const generateWordsPrompt = (count: number, topic?: string, level: WordLevel = 'B2') => `
Generate ${count} English words${topic ? ` about "${topic}"` : ''} for Arabic learners. CEFR level: ${level}.
Return JSON array only:
[{"english":"word","arabicMeanings":["3 Arabic meanings"],"exampleSentences":["3 English sentences"]}]
Each word: 3 accurate Arabic translations, 3 simple English example sentences (NO commas). Use ${level}-level vocabulary.`;

export const suggestMeaningsPrompt = (word: string) => `
For "${word}", return JSON only:
{"english":"${word}","arabicMeanings":["م1","م2","م3"],"exampleSentences":["English s1","English s2","English s3"]}
Provide 3 accurate Arabic meanings, 3 short English example sentences (NO commas) using the word.`;

export const autoScheduleWordsPrompt = (
  count: number,
  userPrompt: string,
  excludedWords: string[] = []
) => `
You are generating English vocabulary words for Arabic learners.
User request: "${userPrompt}"

Generate exactly ${count} candidate words and return JSON array only:
[{"english":"word","arabicMeanings":["3 Arabic meanings"],"exampleSentences":["3 English sentences"]}]

Rules:
- Use common, practical vocabulary that matches the user request.
- Keep one single word in "english" (no spaces, no punctuation around it).
- Provide 3 accurate Arabic meanings.
- Provide 3 simple English example sentences that naturally use the word.
- Do not include duplicate words.
${excludedWords.length > 0 ? `- Do NOT use these words: ${excludedWords.join(', ')}` : ''}
`;

export const explainWordPrompt = (word: string) => `
Explain the English word "${word}" for an Arabic learner who is still learning English.

Return JSON only:
{"options":["short definition 1","short definition 2"]}

Rules:
- Provide 1 to 3 concise definitions in simple, everyday English (max 25 words each).
- Use only plain English — no Arabic, no example sentences, no commas inside a definition.
- If the word has one clear meaning, return only 1 option.
- If it has multiple common meanings, return 2 or 3 options (easiest/simplest first).
- Each option should explain what the word means, not how to use it in a sentence.
`;
