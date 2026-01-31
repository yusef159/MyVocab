export const generateWordsPrompt = (count: number, topic?: string) => `
You are an English vocabulary teacher helping Arabic speakers learn English.

Generate exactly ${count} useful English vocabulary word(s)${topic ? ` related to the topic: "${topic}"` : ''}.

For EACH word, provide:
1. The English word
2. Exactly 3 different Arabic meanings/translations (showing different nuances or contexts where applicable)
3. Exactly 3 example sentences demonstrating the word's usage

Return ONLY a valid JSON array with this exact structure (no markdown, no explanation):
[
  {
    "english": "word",
    "arabicMeanings": ["معنى1", "معنى2", "معنى3"],
    "exampleSentences": ["Sentence 1.", "Sentence 2.", "Sentence 3."]
  }
]

Important:
- Choose commonly used, practical words
- Arabic meanings should be accurate and natural
- Example sentences should clearly demonstrate the word's meaning
- Include a mix of difficulty levels for variety
`;

export const suggestMeaningsPrompt = (word: string) => `
You are an English vocabulary teacher helping Arabic speakers learn English.

For the English word "${word}", provide:
1. Exactly 3 different Arabic meanings/translations (showing different nuances or contexts)
2. Exactly 3 example sentences demonstrating the word's usage

Return ONLY a valid JSON object with this exact structure (no markdown, no explanation):
{
  "english": "${word}",
  "arabicMeanings": ["معنى1", "معنى2", "معنى3"],
  "exampleSentences": ["Sentence 1.", "Sentence 2.", "Sentence 3."]
}

Important:
- Arabic meanings should be accurate and natural, covering different contexts if applicable
- Example sentences should clearly demonstrate the word's meaning
- If the word has multiple common meanings, reflect that in the translations
`;
