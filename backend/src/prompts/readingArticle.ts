export interface ReadingArticleRequest {
  words: Array<{
    id: string;
    english: string;
    arabicMeanings: string[];
    exampleSentence: string;
  }>;
  maxWords?: number;
}

export const readingArticlePrompt = (request: ReadingArticleRequest): string => {
  const maxWords = request.maxWords ?? 200;
  const lengthGuide =
    maxWords <= 90
      ? 'Target around 60-90 words.'
      : maxWords <= 150
      ? 'Target around 110-150 words.'
      : 'Target around 160-200 words.';

  const wordsList = request.words
    .map(
      (w) =>
        `- id: "${w.id}", word: "${w.english}", meanings: [${w.arabicMeanings
          .map((m) => `"${m}"`)
          .join(', ')}]`
    )
    .join('\n');

  return `You are an English reading coach for language learners.

Create a short article that helps the learner practice reading fluency and pronunciation.

KNOWN WORDS TO USE:
${wordsList}

STRICT RULES:
1. The article body must be in clear, natural English.
2. Maximum length: ${maxWords} words for the article body. ${lengthGuide}
3. Use as many known words above as naturally possible. Prioritize including all of them if possible.
4. Keep grammar simple to intermediate (roughly B1-B2 readability).
5. Avoid slang and uncommon idioms.
6. Provide a short title (3-8 words).
7. Return JSON only (no markdown, no code block).

Output format:
{
  "title": "Short title",
  "article": "Article text...",
  "wordCount": 123
}

Do not include any extra keys beyond title, article, and wordCount.`;
};
