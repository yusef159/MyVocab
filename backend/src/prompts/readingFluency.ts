export interface ReadingFluencyPromptRequest {
  articleText: string;
  expectedWords: string[];
  transcript: string;
  audioDurationSeconds?: number;
  metrics: {
    fillerCount: number;
    fillerTerms: string[];
    estimatedWpm?: number;
    longPauseCount: number;
    veryLongPauseCount: number;
    maxPauseSeconds?: number;
    missingExpectedWords: string[];
  };
}

export const readingFluencyEvaluationPrompt = (
  request: ReadingFluencyPromptRequest
): string => {
  const expectedWordsText = request.expectedWords.map((w) => `- ${w}`).join('\n');
  const fillers = request.metrics.fillerTerms.length > 0 ? request.metrics.fillerTerms.join(', ') : 'none';
  const transcript = request.transcript.trim() || '[no transcript available]';

  return `You are an English pronunciation and reading fluency assessor.

TASK:
Evaluate a learner who read an article aloud. Focus on fluency and pronunciation signals:
- Pauses and hesitation
- Fillers like "um/uh"
- Reading pace
- Missing or incorrect pronunciation of expected vocabulary words

ARTICLE (expected reading text):
${request.articleText}

EXPECTED VOCABULARY WORDS:
${expectedWordsText || '- none provided'}

TRANSCRIPT FROM AUDIO:
${transcript}

PRECOMPUTED METRICS:
- fillerCount: ${request.metrics.fillerCount}
- fillerTerms: ${fillers}
- estimatedWpm: ${request.metrics.estimatedWpm ?? 'unknown'}
- longPauseCount(>0.8s): ${request.metrics.longPauseCount}
- veryLongPauseCount(>1.5s): ${request.metrics.veryLongPauseCount}
- maxPauseSeconds: ${request.metrics.maxPauseSeconds ?? 'unknown'}
- missingExpectedWords: ${request.metrics.missingExpectedWords.join(', ') || 'none'}
- audioDurationSeconds: ${request.audioDurationSeconds ?? 'unknown'}

SCORING GUIDANCE (0-100):
- 90-100: smooth reading, natural pacing, no significant fillers or long pauses, clear pronunciation.
- 70-89: mostly fluent with occasional hesitation/fillers/minor pronunciation issues.
- 50-69: frequent pauses/fillers, uneven pace, several pronunciation misses.
- <50: major fluency breakdowns and many missed/mispronounced target words.

IMPORTANT:
- Penalize repeated fillers ("um", "uh"), frequent hesitation, and very slow stop-start reading.
- If expected words are missing or likely mispronounced, list them explicitly.
- Keep feedback constructive and practical.
- Return strict JSON only (no markdown).

Output schema:
{
  "score": 0,
  "fluencySummary": "short summary",
  "feedback": [
    "bullet point 1",
    "bullet point 2"
  ],
  "mispronouncedWords": [
    { "word": "example", "reason": "missed or unclear pronunciation" }
  ],
  "pauseFeedback": {
    "assessment": "text",
    "longPauses": 0,
    "veryLongPauses": 0
  },
  "fillerFeedback": {
    "assessment": "text",
    "fillerCount": 0,
    "examples": ["um"]
  },
  "paceFeedback": {
    "assessment": "text",
    "estimatedWpm": 0
  }
}`;
};
