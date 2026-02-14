export interface SentenceFeedbackRequest {
  words: Array<{
    id: string;
    english: string;
    arabicMeanings: string[];
    exampleSentence: string;
  }>;
  sentence: string;
  targetWordId?: string;
  scenarioDescription?: string;
}

export const sentenceFeedbackPrompt = (request: SentenceFeedbackRequest): string => {
  const { words, sentence, targetWordId, scenarioDescription } = request;
  
  const targetWord = targetWordId 
    ? words.find(w => w.id === targetWordId)
    : null;

  const wordsList = words.map(w => {
    const isTarget = w.id === targetWordId;
    return `- "${w.english}" (${w.arabicMeanings.join(', ')})${isTarget ? ' [TARGET WORD]' : ''}
  Example: "${w.exampleSentence}"`;
  }).join('\n');

  const hasScenario = Boolean(scenarioDescription?.trim());

  const criteriaSection = hasScenario
    ? `SCENARIO FOR THIS SENTENCE: "${scenarioDescription}"

Evaluate the sentence on three criteria and provide a score 0-100:

1. GRAMMAR: correctness of grammar and syntax. Ignore capitalization (do not count missing or incorrect capital letters as grammar errors).
2. USAGE OF THE WORDS PROVIDED: whether the target word(s) are used correctly and with the right meaning.
3. FIT WITH THE SCENARIO: how well the sentence and the use of the words fit the scenario given above.`
    : `Evaluate the sentence on three criteria and provide a score 0-100:

1. GRAMMAR: correctness of grammar and syntax. Ignore capitalization (do not count missing or incorrect capital letters as grammar errors).
2. USAGE OF THE WORDS PROVIDED: whether the target word(s) are used correctly and with the right meaning.
3. NATURALNESS: whether the sentence sounds natural and idiomatic in English.`;

  const scenarioFitBlock = hasScenario
    ? `,
  "scenarioFitFeedback": {
    "fitsScenario": true/false,
    "comment": "Brief explanation of how well the sentence and word usage fit the scenario"
  }`
    : '';

  const scoreInstruction = hasScenario
    ? 'Score 0-100 must reflect grammar, usage of the provided words, and how well the sentence fits the scenario. Be constructive and educational.'
    : 'Score 0-100 must reflect grammar, word usage, and naturalness combined. Be constructive and educational.';

  return `You are an English language tutor helping an Arabic speaker learn vocabulary. Analyze the following sentence written by the student.

STUDENT'S SENTENCE: "${sentence}"

WORDS THE STUDENT SHOULD USE (they must use all of these in one sentence):
${wordsList}

${targetWord ? `NOTE: The student should be using the word "${targetWord.english}" in their sentence.` : 'The student should use one or more of the words above in their sentence.'}

${criteriaSection}

Provide feedback in the following JSON format:
{
  "detectedWords": ["word1", "word2"],
  "grammarFeedback": {
    "isCorrect": true/false,
    "issues": ["issue1", "issue2"],
    "corrections": "corrected sentence if needed (fix grammar only; do not change capitalization)"
  },
  "contextFeedback": {
    "isAppropriate": true/false,
    "issues": ["issue1", "issue2"],
    "explanation": "Brief explanation of correct meaning usage and context"
  },
  "naturalnessFeedback": {
    "isNatural": true/false,
    "comment": "Brief comment (or scenario fit when scenario is provided)"
  }${scenarioFitBlock},
  "score": 0-100,
  "overallFeedback": "Encouraging overall feedback message"
}

${scoreInstruction}`;

};
