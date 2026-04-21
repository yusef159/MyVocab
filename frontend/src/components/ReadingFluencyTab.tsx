import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVocabStore } from '../stores/vocabStore';
import { getReadingFluencyState, saveReadingFluencyState } from '../db';
import type {
  ReadingArticle,
  ReadingArticleLength,
  ReadingFluencyEvaluation,
} from '../types';
import { ReadingFluencyArticleBody } from './ReadingFluencyArticleBody';

interface PersistedReadingFluencyState {
  article: ReadingArticle | null;
  expectedWords: string[];
  evaluation: ReadingFluencyEvaluation | null;
  recordingSeconds: number | null;
  articleLength: ReadingArticleLength;
}

export default function ReadingFluencyTab() {
  const { generateReadingArticleFromKnownWords, evaluateReadingFluency } = useVocabStore();

  const [article, setArticle] = useState<ReadingArticle | null>(null);
  const [expectedWords, setExpectedWords] = useState<string[]>([]);
  const [evaluation, setEvaluation] = useState<ReadingFluencyEvaluation | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState<number | null>(null);
  const [articleLength, setArticleLength] = useState<ReadingArticleLength>('medium');
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef<number | null>(null);

  const supportsRecording = useMemo(
    () =>
      typeof window !== 'undefined' &&
      typeof MediaRecorder !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia,
    []
  );

  const resetRecording = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setRecordedAudio(null);
    setAudioUrl(null);
    setRecordingSeconds(null);
    setEvaluation(null);
  }, [audioUrl]);

  const stopMediaTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    getReadingFluencyState<PersistedReadingFluencyState>()
      .then((parsed) => {
        if (!parsed || cancelled) return;
        if (parsed.article) setArticle(parsed.article);
        if (Array.isArray(parsed.expectedWords)) setExpectedWords(parsed.expectedWords);
        if (parsed.evaluation) setEvaluation(parsed.evaluation);
        if (
          parsed.articleLength === 'short' ||
          parsed.articleLength === 'medium' ||
          parsed.articleLength === 'large'
        ) {
          setArticleLength(parsed.articleLength);
        }
        if (typeof parsed.recordingSeconds === 'number') {
          setRecordingSeconds(parsed.recordingSeconds);
        }
      })
      .catch(() => {
        // ignore fetch issues
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const payload: PersistedReadingFluencyState = {
      article,
      expectedWords,
      evaluation,
      recordingSeconds,
      articleLength,
    };
    void saveReadingFluencyState(payload).catch(() => {
      // ignore network issues
    });
  }, [article, expectedWords, evaluation, recordingSeconds, articleLength, hydrated]);

  const handleGenerateArticle = async () => {
    setError(null);
    setIsGenerating(true);
    resetRecording();
    try {
      const data = await generateReadingArticleFromKnownWords(articleLength);
      setArticle(data.article);
      setExpectedWords(data.expectedWords);
      setEvaluation(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to generate article';
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStartRecording = async () => {
    if (!supportsRecording) {
      setError('Audio recording is not supported in this browser.');
      return;
    }

    if (!article) {
      setError('Generate an article first.');
      return;
    }

    setError(null);
    setEvaluation(null);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recordingStartRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        setIsRecording(false);
        const elapsedSeconds =
          recordingStartRef.current !== null
            ? Math.max((Date.now() - recordingStartRef.current) / 1000, 0)
            : 0;
        setRecordingSeconds(Number(elapsedSeconds.toFixed(1)));

        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        setRecordedAudio(blob);
        const nextUrl = URL.createObjectURL(blob);
        setAudioUrl(nextUrl);
        stopMediaTracks();
      };

      recorder.onerror = () => {
        setIsRecording(false);
        stopMediaTracks();
        setError('Recording failed. Please try again.');
      };

      recorder.start();
      setIsRecording(true);
    } catch {
      setError('Microphone access denied or unavailable.');
      setIsRecording(false);
      stopMediaTracks();
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleEvaluate = async () => {
    if (!article || !recordedAudio) {
      setError('Generate an article and record your reading first.');
      return;
    }

    setError(null);
    setIsEvaluating(true);
    try {
      const result = await evaluateReadingFluency(
        recordedAudio,
        article.article,
        expectedWords,
        recordingSeconds ?? undefined
      );
      setEvaluation(result);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to evaluate reading';
      setError(message);
    } finally {
      setIsEvaluating(false);
    }
  };

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      stopMediaTracks();
    };
  }, [audioUrl, stopMediaTracks]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Reading Fluency</h2>
          <p className="text-gray-400 mt-1">
            Generate an article from your known words, read it aloud, and get fluency feedback.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex flex-wrap rounded-lg border border-gray-600 overflow-hidden">
            {[
              { value: 'short' as const, label: 'Short (~80)' },
              { value: 'medium' as const, label: 'Medium (~140)' },
              { value: 'large' as const, label: 'Large (max 200)' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setArticleLength(opt.value)}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  articleLength === opt.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleGenerateArticle}
            disabled={isGenerating}
            className="px-5 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? 'Generating article...' : 'Generate from known words'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/15 border border-rose-400/60 rounded-lg p-4">
          <p className="text-rose-200">{error}</p>
        </div>
      )}

      {article && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xl sm:text-2xl font-bold text-white break-words">{article.title}</h3>
            <span className="text-sm px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/40">
              {article.wordCount} words
            </span>
          </div>
          <p className="text-gray-100 leading-7 whitespace-pre-line">{article.article}</p>
          <div>
            <p className="text-gray-400 text-sm mb-2">Expected words to pronounce clearly:</p>
            <div className="flex flex-wrap gap-2">
              {expectedWords.map((word) => (
                <span
                  key={word}
                  className="px-2.5 py-1 rounded-md bg-slate-700 text-slate-200 text-sm border border-slate-500"
                >
                  {word}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {article && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 sm:p-6 space-y-4">
          <h3 className="text-xl font-semibold text-white">Record your reading</h3>
          {!supportsRecording && (
            <p className="text-amber-300">
              Your browser does not support audio recording. Please try a modern browser.
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleStartRecording}
              disabled={!supportsRecording || isRecording || isEvaluating}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start recording
            </button>
            <button
              type="button"
              onClick={handleStopRecording}
              disabled={!isRecording}
              className="px-4 py-2 rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Stop recording
            </button>
            <button
              type="button"
              onClick={resetRecording}
              disabled={isRecording || (!recordedAudio && !evaluation)}
              className="px-4 py-2 rounded-lg bg-gray-700 text-white font-semibold hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Retry recording
            </button>
          </div>

          {isRecording && (
            <p className="text-amber-300 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-300 animate-pulse" />
              Recording in progress...
            </p>
          )}

          {recordedAudio && audioUrl && (
            <div className="space-y-3">
              <audio controls src={audioUrl} className="w-full" />
              <p className="text-gray-400 text-sm">
                Recorded length: {recordingSeconds ? `${recordingSeconds}s` : 'unknown'}
              </p>
              <button
                type="button"
                onClick={handleEvaluate}
                disabled={isEvaluating || isRecording}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isEvaluating ? 'Analyzing fluency...' : 'Get fluency feedback'}
              </button>
            </div>
          )}
        </div>
      )}

      {evaluation && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xl sm:text-2xl font-bold text-white">Fluency Feedback</h3>
            <span
              className={`px-4 py-2 rounded-lg font-bold ${
                evaluation.score >= 80
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/50'
                  : evaluation.score >= 60
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-400/50'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-400/50'
              }`}
            >
              {evaluation.score}/100
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-4">
              <p className="text-gray-400 text-sm">Fillers</p>
              <p className="text-white text-xl font-semibold">{evaluation.metrics.fillerCount}</p>
              <p className="text-gray-300 text-sm mt-1">
                {evaluation.metrics.fillerTerms.length > 0
                  ? evaluation.metrics.fillerTerms.join(', ')
                  : 'None detected'}
              </p>
            </div>
            <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-4">
              <p className="text-gray-400 text-sm">Long pauses</p>
              <p className="text-white text-xl font-semibold">
                {evaluation.metrics.longPauseCount}
              </p>
              <p className="text-gray-300 text-sm mt-1">
                Very long: {evaluation.metrics.veryLongPauseCount}
              </p>
            </div>
            <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-4">
              <p className="text-gray-400 text-sm">Estimated pace</p>
              <p className="text-white text-xl font-semibold">
                {evaluation.metrics.estimatedWpm ?? 'N/A'} WPM
              </p>
              <p className="text-gray-300 text-sm mt-1">
                Max pause: {evaluation.metrics.maxPauseSeconds ?? 'N/A'}s
              </p>
            </div>
          </div>

          {article && (
            <ReadingFluencyArticleBody
              articleText={article.article}
              highlights={evaluation.highlights}
            />
          )}
        </div>
      )}
    </div>
  );
}
