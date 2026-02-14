import { useState, useEffect, useCallback, useRef } from 'react';
import { useVocabStore } from '../stores/vocabStore';
import type { Word } from '../types';

// Web Speech API types (not in all TS lib.dom versions)
interface SpeechRecognitionResultList {
  length: number;
  item(index: number): { transcript: string; isFinal: boolean; length: number; item(i: number): { transcript: string } };
  [index: number]: { transcript: string; isFinal: boolean; length: number; item(i: number): { transcript: string } };
}
interface SpeechRecognitionResultEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
interface WindowWithSpeech {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}
const SpeechRecognitionAPI = typeof window !== 'undefined' && ((window as unknown as WindowWithSpeech).SpeechRecognition || (window as unknown as WindowWithSpeech).webkitSpeechRecognition);

const TEST_SESSION_STORAGE_KEY = 'myvocab-test-session';

interface Scenario {
  scenarioId: string;
  description: string;
  wordIds: string[];
}

interface SentenceWithFeedback {
  sentence: string;
  feedback: {
    detectedWords: string[];
    grammarFeedback: { isCorrect: boolean; issues: string[]; corrections: string };
    contextFeedback: { isAppropriate: boolean; issues: string[]; explanation: string };
    naturalnessFeedback: { isNatural: boolean; comment: string };
    scenarioFitFeedback?: { fitsScenario: boolean; comment: string };
    score: number;
    overallFeedback: string;
  };
}

interface SavedTestState {
  wordIds: string[];
  scenarios: Scenario[];
  currentScenarioIndex: number;
  sentencesByScenario: Record<string, SentenceWithFeedback[]>;
  started: boolean;
  testComplete: boolean;
}

interface TestSessionProps {
  words: Word[];
  onBack: () => void;
}

function getWordIdSet(words: Word[]): string {
  return words.map(w => w.id).sort().join(',');
}

export default function TestSession({ words, onBack }: TestSessionProps) {
  const { analyzeSentence, generateScenarios } = useVocabStore();

  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [isLoadingScenarios, setIsLoadingScenarios] = useState(false);
  const [scenarioError, setScenarioError] = useState<string | null>(null);
  const [currentScenarioIndex, setCurrentScenarioIndex] = useState(0);
  const [sentencesByScenario, setSentencesByScenario] = useState<Record<string, SentenceWithFeedback[]>>({});
  const [currentSentenceInput, setCurrentSentenceInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [started, setStarted] = useState(false);
  const [testComplete, setTestComplete] = useState(false);
  const [showScenarioPicker, setShowScenarioPicker] = useState(false);
  const [savedTestOffer, setSavedTestOffer] = useState<SavedTestState | null>(null);
  const [hasCheckedStorage, setHasCheckedStorage] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceAccumulatedRef = useRef('');

  // Check for saved test on mount (same word set) — offer choice, don't auto-restore
  useEffect(() => {
    if (words.length < 2 || hasCheckedStorage) return;
    try {
      const raw = localStorage.getItem(TEST_SESSION_STORAGE_KEY);
      setHasCheckedStorage(true);
      if (!raw) return;
      const saved: SavedTestState = JSON.parse(raw);
      const savedIdSet = (saved.wordIds ?? []).sort().join(',');
      const currentIdSet = getWordIdSet(words);
      if (savedIdSet !== currentIdSet || !saved.started || !Array.isArray(saved.scenarios) || saved.scenarios.length === 0) return;
      setSavedTestOffer(saved);
    } catch {
      setHasCheckedStorage(true);
    }
  }, [words, hasCheckedStorage]);

  const handleContinueLastTest = useCallback(() => {
    if (!savedTestOffer) return;
    setScenarios(savedTestOffer.scenarios);
    setCurrentScenarioIndex(Math.min(savedTestOffer.currentScenarioIndex ?? 0, savedTestOffer.scenarios.length - 1));
    setSentencesByScenario(savedTestOffer.sentencesByScenario ?? {});
    setStarted(true);
    setTestComplete(!!savedTestOffer.testComplete);
    setSavedTestOffer(null);
  }, [savedTestOffer]);

  const handleStartOver = useCallback(() => {
    try {
      localStorage.removeItem(TEST_SESSION_STORAGE_KEY);
    } catch {
      // ignore
    }
    setSavedTestOffer(null);
    setScenarios([]);
    setSentencesByScenario({});
    setCurrentScenarioIndex(0);
    setStarted(false);
    setTestComplete(false);
  }, []);

  // Persist test progress when it changes
  useEffect(() => {
    if (!started || scenarios.length === 0) return;
    const state: SavedTestState = {
      wordIds: words.map(w => w.id),
      scenarios,
      currentScenarioIndex,
      sentencesByScenario,
      started,
      testComplete,
    };
    try {
      localStorage.setItem(TEST_SESSION_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [words, started, scenarios, currentScenarioIndex, sentencesByScenario, testComplete]);

  const currentScenario = scenarios[currentScenarioIndex];
  const scenarioWords: Word[] = currentScenario
    ? words.filter(w => currentScenario.wordIds.includes(w.id))
    : [];
  const sentencesForCurrent = currentScenario
    ? sentencesByScenario[currentScenario.scenarioId] ?? []
    : [];
  const hasFeedbackForCurrent = sentencesForCurrent.length >= 1;
  const SENTENCE_CHAR_LIMIT = 500;

  const handleStartTest = async () => {
    if (words.length < 2) {
      setScenarioError('Add at least 2 words to run the test.');
      return;
    }
    setIsLoadingScenarios(true);
    setScenarioError(null);
    try {
      const list = await generateScenarios(words);
      if (list.length === 0) {
        setScenarioError('Could not generate scenarios. Try again.');
        return;
      }
      setScenarios(list);
      setSentencesByScenario({});
      setCurrentScenarioIndex(0);
      setCurrentSentenceInput('');
      setStarted(true);
    } catch (e) {
      setScenarioError('Failed to generate scenarios. Please try again.');
    } finally {
      setIsLoadingScenarios(false);
    }
  };

  const handleSubmitSentence = async () => {
    if (!currentScenario || !currentSentenceInput.trim() || scenarioWords.length === 0) return;
    setIsAnalyzing(true);
    try {
      const feedback = await analyzeSentence(scenarioWords, currentSentenceInput.trim(), undefined, currentScenario.description);
      setSentencesByScenario(prev => ({
        ...prev,
        [currentScenario.scenarioId]: [
          ...(prev[currentScenario.scenarioId] ?? []),
          { sentence: currentSentenceInput.trim(), feedback },
        ],
      }));
      setCurrentSentenceInput('');
    } catch (e) {
      console.error('Failed to analyze sentence:', e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleNextScenario = () => {
    if (currentScenarioIndex < scenarios.length - 1) {
      setCurrentScenarioIndex(prev => prev + 1);
      setCurrentSentenceInput('');
    }
  };

  const handleChangeScenario = (index: number) => {
    if (index >= 0 && index < scenarios.length) {
      setCurrentScenarioIndex(index);
      setCurrentSentenceInput('');
      setShowScenarioPicker(false);
    }
  };

  const speakWord = (word: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(word);
    u.lang = 'en-US';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };

  const toggleVoiceInput = useCallback(() => {
    if (!SpeechRecognitionAPI) return;
    if (isListening) {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setIsListening(false);
      return;
    }
    voiceAccumulatedRef.current = currentSentenceInput;
    const Recognition = SpeechRecognitionAPI;
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (event: SpeechRecognitionResultEvent) => {
      let final = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results.item(i);
        const transcript = result.length > 0 ? result.item(0).transcript : '';
        if (result.isFinal) final += transcript;
        else interim += transcript;
      }
      if (final) voiceAccumulatedRef.current += final;
      const next = (voiceAccumulatedRef.current + interim).slice(0, SENTENCE_CHAR_LIMIT);
      setCurrentSentenceInput(next);
    };
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };
    recognition.onerror = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };
    try {
      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
    } catch {
      setIsListening(false);
    }
  }, [isListening, currentSentenceInput]);

  const handleFinishTest = () => {
    setTestComplete(true);
  };

  const handleStartNewTest = useCallback(() => {
    setStarted(false);
    setTestComplete(false);
    setScenarios([]);
    setSentencesByScenario({});
    setCurrentScenarioIndex(0);
    try {
      localStorage.removeItem(TEST_SESSION_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  // Offer: continue last test or start over (when we have a saved test for this word set)
  if (savedTestOffer && !started) {
    const completedCount = Object.keys(savedTestOffer.sentencesByScenario ?? {}).length;
    const totalScenarios = savedTestOffer.scenarios?.length ?? 0;
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-white">Test Session</h2>
          <button
            onClick={onBack}
            className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            Back
          </button>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <p className="text-white font-medium mb-2">
            {savedTestOffer.testComplete ? 'You have a previous test' : 'You have a test in progress'}
          </p>
          <p className="text-gray-400 text-sm mb-6">
            {savedTestOffer.testComplete
              ? `You previously completed all ${totalScenarios} scenarios. Do you want to view your results again or start a new test?`
              : `You completed ${completedCount} of ${totalScenarios} scenarios. Do you want to continue where you left off or start over?`}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleContinueLastTest}
              className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-500 transition-colors"
            >
              {savedTestOffer.testComplete ? 'View my results' : 'Continue where I left off'}
            </button>
            <button
              onClick={handleStartOver}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-500 transition-colors"
            >
              Start over
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Not started: show start screen (no saved test or user chose "Start over")
  if (!started) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-white">Test Session</h2>
          <button
            onClick={onBack}
            className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            Back
          </button>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <p className="text-gray-300 mb-4">
            Scenario-based test: you’ll get 4–6 scenarios, each with 2–4 words. Write <strong>one sentence</strong> that uses <strong>all</strong> the words for that scenario. After you submit, you’ll get feedback on grammar, meaning, and naturalness with a score out of 100. Then you can move to the next scenario or pick another from the list.
          </p>
          {scenarioError && (
            <p className="text-red-400 mb-4">{scenarioError}</p>
          )}
          <button
            onClick={handleStartTest}
            disabled={isLoadingScenarios || words.length < 2}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoadingScenarios ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Generating scenarios...
              </>
            ) : (
              'Start test'
            )}
          </button>
        </div>
      </div>
    );
  }

  // Finished all scenarios (summary screen)
  if (started && testComplete && scenarios.length > 0) {
    const totalSentences = Object.values(sentencesByScenario).flat().length;
    const allScores = Object.values(sentencesByScenario).flat().map(s => s.feedback.score);
    const avgScore = allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0;
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-white">Test complete</h2>
          <button
            onClick={onBack}
            className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            Back
          </button>
        </div>
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <p className="text-white mb-2">You completed {scenarios.length} scenarios with {totalSentences} sentences.</p>
          <p className="text-gray-300 mb-4">Average score: <span className="text-white font-semibold">{avgScore}/100</span></p>
          <button
            onClick={handleStartNewTest}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-500"
          >
            Start new test
          </button>
        </div>
      </div>
    );
  }

  // Active scenario
  if (!currentScenario) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-white">Test Session</h2>
          <button onClick={onBack} className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg">Back</button>
        </div>
        <p className="text-gray-400">No scenario loaded.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-white">Test Session</h2>
        <button
          onClick={onBack}
          className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
        >
          Back
        </button>
      </div>

      {/* Progress + change scenario */}
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Scenario</span>
            <span className="text-white font-medium">{currentScenarioIndex + 1} of {scenarios.length}</span>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowScenarioPicker(prev => !prev)}
              title="Change scenario"
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-600 rounded-lg text-xl leading-none border border-gray-600"
              aria-label="Change scenario"
            >
              🗘
            </button>
            {showScenarioPicker && (
              <div className="absolute right-0 top-full mt-1 z-10 bg-gray-700 border border-gray-600 rounded-lg shadow-xl py-1 min-w-[200px]">
                {scenarios.map((s, i) => (
                  <button
                    key={s.scenarioId}
                    type="button"
                    onClick={() => handleChangeScenario(i)}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-600 rounded-none first:rounded-t-lg last:rounded-b-lg ${i === currentScenarioIndex ? 'text-blue-400 font-medium' : 'text-white'}`}
                  >
                    {i + 1}. {s.description}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all"
            style={{ width: `${((currentScenarioIndex + 1) / scenarios.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Current scenario */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h3 className="text-xl font-bold text-white mb-1">Scenario: {currentScenario.description}</h3>
        <p className="text-gray-400 text-sm mb-4">Write one sentence that uses <strong>all</strong> of these words:</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {scenarioWords.map(w => (
            <button
              key={w.id}
              type="button"
              onClick={() => speakWord(w.english)}
              className="px-3 py-1.5 bg-blue-500/20 text-blue-300 rounded-lg text-sm border border-blue-500/40 hover:bg-blue-500/30 cursor-pointer transition-colors"
              title="Click to hear pronunciation"
            >
              {w.english}
            </button>
          ))}
        </div>

        {/* Feedback for this scenario (one sentence per scenario) */}
        {sentencesForCurrent.length > 0 && (() => {
          const item = sentencesForCurrent[0];
          const g = item.feedback.grammarFeedback;
          const c = item.feedback.contextFeedback;
          const n = item.feedback.naturalnessFeedback;
          const s = item.feedback.scenarioFitFeedback;
          const score = item.feedback.score;
          const showScenarioFit = Boolean(s);
          const showCorrection = g.corrections && g.corrections.trim() !== item.sentence.trim();
          return (
            <div className="space-y-6 mb-6">
              {/* Section: Your input */}
              <div className="rounded-2xl border border-gray-600 bg-gray-700/40 p-5 shadow-inner">
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-2">Your sentence</p>
                <p className="text-white text-lg leading-relaxed">"{item.sentence}"</p>
              </div>

              {/* Score + overall feedback row */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 text-sm font-medium">Overall score</span>
                  <span className={`inline-flex items-center justify-center min-w-[5rem] px-5 py-2.5 rounded-xl text-xl font-bold shadow-sm ${
                    score >= 80 ? 'bg-emerald-500/30 text-emerald-200 border-2 border-emerald-400/60' :
                    score >= 60 ? 'bg-amber-500/30 text-amber-200 border-2 border-amber-400/60' :
                    'bg-rose-500/30 text-rose-200 border-2 border-rose-400/60'
                  }`}>
                    {score}/100
                  </span>
                </div>
                {item.feedback.overallFeedback && (
                  <p className="text-gray-300 text-sm italic max-w-xl border-l-4 border-blue-500/70 pl-4 py-1 bg-blue-500/10 rounded-r-lg">
                    {item.feedback.overallFeedback}
                  </p>
                )}
              </div>

              {/* Three criteria — structured cards with clear hierarchy */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={`rounded-2xl border-2 p-5 shadow-sm ${g.isCorrect ? 'border-emerald-400/50 bg-emerald-500/10' : 'border-rose-400/50 bg-rose-500/10'}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`flex items-center justify-center w-10 h-10 rounded-xl text-xl font-bold ${g.isCorrect ? 'bg-emerald-500/30 text-emerald-300' : 'bg-rose-500/30 text-rose-300'}`}>
                      {g.isCorrect ? '✓' : '✗'}
                    </span>
                    <h4 className={`font-bold text-lg ${g.isCorrect ? 'text-emerald-300' : 'text-rose-300'}`}>Grammar</h4>
                  </div>
                  {g.isCorrect ? (
                    <p className="text-emerald-200/95 text-sm">Correct grammar and structure.</p>
                  ) : (
                    <ul className="text-rose-200/95 text-sm list-disc list-inside space-y-1.5">
                      {g.issues.map((issue, i) => <li key={i}>{issue}</li>)}
                    </ul>
                  )}
                </div>
                <div className={`rounded-2xl border-2 p-5 shadow-sm ${c.isAppropriate ? 'border-emerald-400/50 bg-emerald-500/10' : 'border-amber-400/50 bg-amber-500/10'}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`flex items-center justify-center w-10 h-10 rounded-xl text-xl font-bold ${c.isAppropriate ? 'bg-emerald-500/30 text-emerald-300' : 'bg-amber-500/30 text-amber-300'}`}>
                      {c.isAppropriate ? '✓' : '⚠'}
                    </span>
                    <h4 className={`font-bold text-lg ${c.isAppropriate ? 'text-emerald-300' : 'text-amber-300'}`}>Meaning</h4>
                  </div>
                  <p className={c.isAppropriate ? 'text-emerald-200/95 text-sm' : 'text-amber-200/95 text-sm'}>
                    {c.isAppropriate ? 'Words used with correct meaning.' : (c.explanation || 'Check word usage.')}
                  </p>
                  {!c.isAppropriate && c.issues.length > 0 && (
                    <ul className="text-amber-200/95 text-sm list-disc list-inside mt-2 space-y-1">{c.issues.map((issue, i) => <li key={i}>{issue}</li>)}</ul>
                  )}
                </div>
                {showScenarioFit && s ? (
                  <div className={`rounded-2xl border-2 p-5 shadow-sm ${s.fitsScenario ? 'border-emerald-400/50 bg-emerald-500/10' : 'border-amber-400/50 bg-amber-500/10'}`}>
                    <div className="flex items-center gap-3 mb-3">
                      <span className={`flex items-center justify-center w-10 h-10 rounded-xl text-xl font-bold ${s.fitsScenario ? 'bg-emerald-500/30 text-emerald-300' : 'bg-amber-500/30 text-amber-300'}`}>
                        {s.fitsScenario ? '✓' : '⚠'}
                      </span>
                      <h4 className={`font-bold text-lg ${s.fitsScenario ? 'text-emerald-300' : 'text-amber-300'}`}>Scenario fit</h4>
                    </div>
                    <p className={s.fitsScenario ? 'text-emerald-200/95 text-sm' : 'text-amber-200/95 text-sm'}>
                      {s.fitsScenario ? 'Sentence fits the scenario well.' : (s.comment || 'Sentence could fit the scenario better.')}
                    </p>
                  </div>
                ) : (
                  <div className={`rounded-2xl border-2 p-5 shadow-sm ${n.isNatural ? 'border-emerald-400/50 bg-emerald-500/10' : 'border-amber-400/50 bg-amber-500/10'}`}>
                    <div className="flex items-center gap-3 mb-3">
                      <span className={`flex items-center justify-center w-10 h-10 rounded-xl text-xl font-bold ${n.isNatural ? 'bg-emerald-500/30 text-emerald-300' : 'bg-amber-500/30 text-amber-300'}`}>
                        {n.isNatural ? '✓' : '⚠'}
                      </span>
                      <h4 className={`font-bold text-lg ${n.isNatural ? 'text-emerald-300' : 'text-amber-300'}`}>Naturalness</h4>
                    </div>
                    <p className={n.isNatural ? 'text-emerald-200/95 text-sm' : 'text-amber-200/95 text-sm'}>
                      {n.isNatural ? 'Sounds natural and idiomatic.' : (n.comment || 'Could sound more natural.')}
                    </p>
                  </div>
                )}
              </div>

              {/* Correction of your input — prominent green box with check mark */}
              {showCorrection && (
                <div className="rounded-2xl border-2 border-emerald-400 bg-emerald-500/25 p-5 shadow-md ring-2 ring-emerald-400/20">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/50 text-emerald-100 text-2xl font-bold shadow-inner">
                      ✓
                    </span>
                    <div>
                      <p className="text-emerald-300 font-bold text-sm uppercase tracking-wider">Correction of your input</p>
                      <p className="text-emerald-200/90 text-xs">Suggested correct sentence</p>
                    </div>
                  </div>
                  <div className="rounded-xl bg-emerald-500/20 border border-emerald-400/40 p-4">
                    <p className="text-emerald-50 text-lg leading-relaxed">"{g.corrections}"</p>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Sentence input: only when no feedback yet for this scenario */}
        {sentencesForCurrent.length === 0 && (
          <div>
            <label className="block text-white font-medium mb-2">Your sentence (use all the words above)</label>
            <div className="flex gap-2">
              {SpeechRecognitionAPI && (
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  disabled={isAnalyzing}
                  title={isListening ? 'Stop voice input' : 'Use voice to speak your sentence'}
                  className={`flex-shrink-0 h-24 w-14 flex items-center justify-center rounded-lg border-2 transition-colors ${
                    isListening
                      ? 'bg-red-500/30 border-red-400 text-red-300 hover:bg-red-500/40'
                      : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600 hover:text-white'
                  }`}
                >
                  {isListening ? (
                    <span className="text-xs font-semibold">Stop</span>
                  ) : (
                    <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z" />
                    </svg>
                  )}
                </button>
              )}
              <textarea
                value={currentSentenceInput}
                onChange={e => setCurrentSentenceInput(e.target.value.slice(0, SENTENCE_CHAR_LIMIT))}
                placeholder="Write one sentence that includes all the words..."
                maxLength={SENTENCE_CHAR_LIMIT}
                className="flex-1 h-24 bg-gray-700 text-white border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                disabled={isAnalyzing}
              />
            </div>
            {isListening && (
              <p className="text-amber-400 text-sm mt-1 flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                Listening... speak your sentence.
              </p>
            )}
            <p className="text-gray-500 text-sm mt-1">{currentSentenceInput.length}/{SENTENCE_CHAR_LIMIT}</p>
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={handleSubmitSentence}
                disabled={!currentSentenceInput.trim() || isAnalyzing}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Checking...
                  </>
                ) : (
                  'Get feedback'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Next scenario / Finish — show after user has received feedback */}
        <div className="mt-6 pt-4 border-t border-gray-600 flex justify-end gap-3">
          {hasFeedbackForCurrent && currentScenarioIndex < scenarios.length - 1 && (
            <button
              onClick={handleNextScenario}
              className="px-5 py-2 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-500"
            >
              Next scenario →
            </button>
          )}
          {hasFeedbackForCurrent && currentScenarioIndex === scenarios.length - 1 && (
            <button
              onClick={handleFinishTest}
              className="px-5 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-500"
            >
              Finish test
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
