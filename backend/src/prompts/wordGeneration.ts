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
