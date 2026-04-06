import OpenAI from 'openai';
import { toFile } from 'openai/uploads';
import { readingFluencyEvaluationPrompt } from '../prompts/readingFluency.js';

interface TranscribedWord {
  word: string;
  start?: number;
  end?: number;
}

interface TranscriptionResult {
  transcript: string;
  words: TranscribedWord[];
}

export interface ReadingFluencyRequest {
  audioBuffer: Buffer;
  mimeType: string;
  fileName: string;
  articleText: string;
  expectedWords: string[];
  audioDurationSeconds?: number;
}

export interface MispronouncedWordItem {
  word: string;
  reason: string;
}

export type FluencyHighlightKind = 'filler' | 'long_pause' | 'very_long_pause';

export interface FluencyHighlight {
  kind: FluencyHighlightKind;
  /** Position in the article: insert after this word index (-1 = before the first word). */
  insertAfterWordIndex: number;
  spoken?: string;
  gapSeconds?: number;
  detail: string;
}

export interface ReadingFluencyResponse {
  score: number;
  transcript: string;
  fluencySummary: string;
  feedback: string[];
  mispronouncedWords: MispronouncedWordItem[];
  metrics: {
    fillerCount: number;
    fillerTerms: string[];
    estimatedWpm?: number;
    longPauseCount: number;
    veryLongPauseCount: number;
    maxPauseSeconds?: number;
    missingExpectedWords: string[];
  };
  highlights: FluencyHighlight[];
}

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        'OPENAI_API_KEY environment variable is not set. Please add it to your .env file.'
      );
    }
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

function normalizeWord(value: string): string {
  return value.toLowerCase().replace(/[^a-z']/g, '').trim();
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function parseTranscriptionWords(rawWords: unknown): TranscribedWord[] {
  if (!Array.isArray(rawWords)) return [];
  return rawWords
    .map((item) => {
      const candidate = item as Record<string, unknown>;
      return {
        word: typeof candidate.word === 'string' ? candidate.word : '',
        start: typeof candidate.start === 'number' ? candidate.start : undefined,
        end: typeof candidate.end === 'number' ? candidate.end : undefined,
      };
    })
    .filter((w) => Boolean(w.word));
}

function computePauseMetrics(words: TranscribedWord[]): {
  longPauseCount: number;
  veryLongPauseCount: number;
  maxPauseSeconds?: number;
} {
  let longPauseCount = 0;
  let veryLongPauseCount = 0;
  let maxPauseSeconds = 0;

  for (let i = 1; i < words.length; i += 1) {
    const prevEnd = words[i - 1].end;
    const currentStart = words[i].start;
    if (typeof prevEnd !== 'number' || typeof currentStart !== 'number') continue;
    const gap = currentStart - prevEnd;
    if (gap > maxPauseSeconds) maxPauseSeconds = gap;
    if (gap > 0.8) longPauseCount += 1;
    if (gap > 1.5) veryLongPauseCount += 1;
  }

  return {
    longPauseCount,
    veryLongPauseCount,
    maxPauseSeconds: maxPauseSeconds > 0 ? Number(maxPauseSeconds.toFixed(2)) : undefined,
  };
}

function countFillers(transcript: string): { fillerCount: number; fillerTerms: string[] } {
  const matches = transcript.toLowerCase().match(/\b(um+|uh+|erm+|hmm+)\b/g) ?? [];
  return {
    fillerCount: matches.length,
    fillerTerms: uniqueStrings(matches),
  };
}

function computeMissingExpectedWords(expectedWords: string[], transcript: string): string[] {
  const transcriptWords = new Set(
    transcript
      .split(/\s+/)
      .map(normalizeWord)
      .filter(Boolean)
  );

  return expectedWords.filter((word) => !transcriptWords.has(normalizeWord(word)));
}

const LONG_PAUSE_SEC = 0.8;
const VERY_LONG_PAUSE_SEC = 1.5;

function isFillerToken(word: string): boolean {
  const n = normalizeWord(word);
  return /^(um+|uh+|erm+|hmm+)$/.test(n);
}

function splitArticleWords(articleText: string): string[] {
  const words: string[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(articleText)) !== null) {
    words.push(m[0]);
  }
  return words;
}

function buildTranscriptWordList(
  words: TranscribedWord[],
  transcript: string
): string[] {
  if (words.length > 0) {
    return words.map((w) => w.word);
  }
  return transcript
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function alignArticleToTranscript(
  articleWords: string[],
  transcriptWords: string[]
): {
  transcriptMatchArticle: (number | null)[];
  fillers: { afterArticleIndex: number; spoken: string }[];
} {
  const n = articleWords.length;
  const m = transcriptWords.length;
  const INF = 1e9;
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    Array(m + 1).fill(INF)
  );

  dp[0][0] = 0;
  for (let j = 1; j <= m; j += 1) {
    const skipTransCost = isFillerToken(transcriptWords[j - 1]) ? 0 : 1;
    dp[0][j] = dp[0][j - 1] + skipTransCost;
  }
  for (let i = 1; i <= n; i += 1) {
    dp[i][0] = dp[i - 1][0] + 1;
  }

  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      const a = articleWords[i - 1];
      const t = transcriptWords[j - 1];
      const matchCost =
        normalizeWord(a) === normalizeWord(t) ? 0 : 2;
      const optMatch = dp[i - 1][j - 1] + matchCost;
      const optSkipArt = dp[i - 1][j] + 1;
      const skipTransCost = isFillerToken(t) ? 0 : 1;
      const optSkipTrans = dp[i][j - 1] + skipTransCost;

      dp[i][j] = Math.min(optMatch, optSkipArt, optSkipTrans);
    }
  }

  let i = n;
  let j = m;
  const transcriptMatchArticle: (number | null)[] = Array(m).fill(null);
  const fillers: { afterArticleIndex: number; spoken: string }[] = [];

  while (i > 0 || j > 0) {
    let moved = false;

    if (i > 0 && j > 0) {
      const matchCost =
        normalizeWord(articleWords[i - 1]) === normalizeWord(transcriptWords[j - 1])
          ? 0
          : 2;
      if (dp[i][j] === dp[i - 1][j - 1] + matchCost) {
        transcriptMatchArticle[j - 1] = i - 1;
        i -= 1;
        j -= 1;
        moved = true;
      }
    }

    if (!moved && i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      i -= 1;
      moved = true;
    }

    if (!moved && j > 0) {
      const skipTransCost = isFillerToken(transcriptWords[j - 1]) ? 0 : 1;
      if (dp[i][j] === dp[i][j - 1] + skipTransCost) {
        if (isFillerToken(transcriptWords[j - 1])) {
          fillers.push({
            afterArticleIndex: i - 1,
            spoken: transcriptWords[j - 1],
          });
        }
        j -= 1;
        moved = true;
      }
    }

    if (!moved) {
      if (j > 0) {
        j -= 1;
      } else if (i > 0) {
        i -= 1;
      } else {
        break;
      }
    }
  }

  fillers.reverse();
  return { transcriptMatchArticle, fillers };
}

function lastMatchedArticleIndexBefore(
  transcriptMatchArticle: (number | null)[],
  transcriptIdx: number
): number {
  for (let k = transcriptIdx; k >= 0; k -= 1) {
    const v = transcriptMatchArticle[k];
    if (v !== null && v !== undefined) {
      return v;
    }
  }
  return -1;
}

function computeFluencyHighlights(
  articleText: string,
  words: TranscribedWord[],
  transcript: string
): FluencyHighlight[] {
  const articleWords = splitArticleWords(articleText);
  const transcriptWords = buildTranscriptWordList(words, transcript);
  if (articleWords.length === 0 || transcriptWords.length === 0) {
    return [];
  }

  const { transcriptMatchArticle, fillers } = alignArticleToTranscript(
    articleWords,
    transcriptWords
  );

  const highlights: FluencyHighlight[] = [];

  for (const f of fillers) {
    const spoken = f.spoken.trim();
    highlights.push({
      kind: 'filler',
      insertAfterWordIndex: f.afterArticleIndex,
      spoken,
      detail: `Filler sound (“${spoken}”). These breaks can interrupt flow — try a short breath instead.`,
    });
  }

  if (words.length >= 2) {
    for (let j = 1; j < words.length; j += 1) {
      const prevEnd = words[j - 1].end;
      const curStart = words[j].start;
      if (typeof prevEnd !== 'number' || typeof curStart !== 'number') {
        continue;
      }
      const gap = curStart - prevEnd;
      if (gap <= LONG_PAUSE_SEC) {
        continue;
      }
      const kind: FluencyHighlightKind =
        gap > VERY_LONG_PAUSE_SEC ? 'very_long_pause' : 'long_pause';
      const anchor = lastMatchedArticleIndexBefore(transcriptMatchArticle, j - 1);
      const gapRounded = Number(gap.toFixed(2));
      highlights.push({
        kind,
        insertAfterWordIndex: anchor,
        gapSeconds: gapRounded,
        detail:
          kind === 'very_long_pause'
            ? `Very long pause (${gapRounded}s). Try linking this phrase with a steadier rhythm.`
            : `Long pause (${gapRounded}s). Aim for shorter gaps between words while reading.`,
      });
    }
  }

  highlights.sort((a, b) => {
    if (a.insertAfterWordIndex !== b.insertAfterWordIndex) {
      return a.insertAfterWordIndex - b.insertAfterWordIndex;
    }
    const order = (k: FluencyHighlightKind) =>
      k === 'filler' ? 0 : k === 'long_pause' ? 1 : 2;
    return order(a.kind) - order(b.kind);
  });

  return highlights;
}

async function transcribeAudio(
  audioBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<TranscriptionResult> {
  const openai = getOpenAIClient();
  const audioFile = await toFile(audioBuffer, fileName, { type: mimeType });

  // Use whisper-1 here because this endpoint reliably supports verbose_json + word timestamps,
  // which we need for pause-related fluency metrics.
  try {
    const transcription = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: audioFile,
      response_format: 'verbose_json',
      timestamp_granularities: ['word'],
    });

    const transcript =
      typeof transcription.text === 'string' ? transcription.text.trim() : '';
    const words = parseTranscriptionWords(
      (transcription as unknown as Record<string, unknown>).words
    );

    return { transcript, words };
  } catch {
    // Fallback to plain JSON transcript so fluency evaluation can still continue.
    const fallback = await openai.audio.transcriptions.create({
      model: 'gpt-4o-mini-transcribe',
      file: audioFile,
      response_format: 'json',
    });
    const transcript = typeof fallback.text === 'string' ? fallback.text.trim() : '';
    return { transcript, words: [] };
  }
}

export async function evaluateReadingFluency(
  request: ReadingFluencyRequest
): Promise<ReadingFluencyResponse> {
  const { transcript, words } = await transcribeAudio(
    request.audioBuffer,
    request.fileName,
    request.mimeType
  );

  if (!transcript) {
    throw new Error('Transcription was empty');
  }

  const filler = countFillers(transcript);
  const pause = computePauseMetrics(words);
  const missingExpectedWords = computeMissingExpectedWords(
    request.expectedWords,
    transcript
  );

  const highlights = computeFluencyHighlights(
    request.articleText,
    words,
    transcript
  );

  const transcriptWordCount = transcript.split(/\s+/).filter(Boolean).length;
  const durationForWpm =
    request.audioDurationSeconds && request.audioDurationSeconds > 0
      ? request.audioDurationSeconds
      : words.length > 0 && typeof words[0].start === 'number' && typeof words[words.length - 1].end === 'number'
      ? Math.max((words[words.length - 1].end as number) - (words[0].start as number), 0)
      : undefined;

  const estimatedWpm =
    durationForWpm && durationForWpm > 0
      ? Math.round((transcriptWordCount / durationForWpm) * 60)
      : undefined;

  const metrics = {
    fillerCount: filler.fillerCount,
    fillerTerms: filler.fillerTerms,
    estimatedWpm,
    longPauseCount: pause.longPauseCount,
    veryLongPauseCount: pause.veryLongPauseCount,
    maxPauseSeconds: pause.maxPauseSeconds,
    missingExpectedWords,
  };

  const prompt = readingFluencyEvaluationPrompt({
    articleText: request.articleText,
    expectedWords: request.expectedWords,
    transcript,
    audioDurationSeconds: request.audioDurationSeconds,
    metrics,
  });

  const openai = getOpenAIClient();
  const response = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 1200,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No evaluation response from OpenAI');
  }

  try {
    const raw = content
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    const rawScore = parsed.score;
    const numericScore =
      typeof rawScore === 'number'
        ? rawScore
        : typeof rawScore === 'string'
        ? Number(rawScore)
        : 0;
    const score = Number.isNaN(numericScore)
      ? 0
      : Math.max(0, Math.min(100, Math.round(numericScore)));

    const mispronouncedWords = Array.isArray(parsed.mispronouncedWords)
      ? parsed.mispronouncedWords
          .map((entry) => entry as Record<string, unknown>)
          .filter(
            (entry) => typeof entry.word === 'string' && typeof entry.reason === 'string'
          )
          .map((entry) => ({
            word: String(entry.word),
            reason: String(entry.reason),
          }))
      : [];

    const feedback = Array.isArray(parsed.feedback)
      ? parsed.feedback.filter((item): item is string => typeof item === 'string')
      : [];

    return {
      score,
      transcript,
      fluencySummary:
        typeof parsed.fluencySummary === 'string'
          ? parsed.fluencySummary
          : 'Keep practicing with smoother pacing and fewer fillers.',
      feedback,
      mispronouncedWords,
      metrics,
      highlights,
    };
  } catch (error) {
    console.error('Failed to parse reading fluency response:', content);
    throw new Error('Failed to parse fluency evaluation response');
  }
}
