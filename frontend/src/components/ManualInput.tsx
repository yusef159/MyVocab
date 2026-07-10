import { useState, useEffect } from 'react';
import { useVocabStore } from '../stores/vocabStore';
import WordSelector from './WordSelector';
import { MAX_EXAMPLE_SENTENCES } from '../types';
import { wordExists } from '../db';
import { useSearchParams } from 'react-router-dom';

type InputMode = 'manual' | 'ai';
const INPUT_MODE_STORAGE_KEY = 'manual-input-mode';

const getStoredInputMode = (): InputMode => {
  if (typeof window === 'undefined') return 'manual';

  const stored = window.localStorage.getItem(INPUT_MODE_STORAGE_KEY);
  return stored === 'ai' ? 'ai' : 'manual';
};

export default function ManualInput() {
  const [searchParams] = useSearchParams();
  const [word, setWord] = useState('');
  const [inputMode, setInputMode] = useState<InputMode>(getStoredInputMode);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Manual input fields
  const [manualMeaning, setManualMeaning] = useState('');
  const [manualEnglishMeaning, setManualEnglishMeaning] = useState('');
  const [manualSentences, setManualSentences] = useState<string[]>(['', '', '']);
  const [showManualExplainOptions, setShowManualExplainOptions] = useState(false);
  const [selectedManualExplainIndex, setSelectedManualExplainIndex] = useState<number | null>(null);

  const {
    suggestions,
    isSuggestingLoading,
    error,
    suggestMeanings,
    explainWord,
    clearEnglishExplanation,
    englishExplanationOptions,
    isExplainingLoading,
    saveWord,
    clearSuggestions,
  } = useVocabStore();

  const setDuplicateError = (english: string) => {
    useVocabStore.setState({
      error: `Word "${english}" already exists in your vocabulary`,
    });
  };

  const clearError = () => {
    useVocabStore.setState({ error: null });
  };

  const handleEnglishWordBlur = async () => {
    if (inputMode !== 'manual') return;
    const trimmed = word.trim();
    if (!trimmed) return;
    if (await wordExists(trimmed)) {
      setDuplicateError(trimmed);
    }
  };

  const handleGetSuggestions = async () => {
    const trimmed = word.trim();
    if (!trimmed) return;
    if (await wordExists(trimmed)) {
      setDuplicateError(trimmed);
      return;
    }
    suggestMeanings(trimmed);
  };

  // Clear success message after 3 seconds
  useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => setSuccessMessage(null), 3000);
    return () => clearTimeout(t);
  }, [successMessage]);

  useEffect(() => {
    const prefWord = (searchParams.get('word') ?? '').trim();
    const prefMode = searchParams.get('mode');

    if (prefWord) {
      setWord(prefWord);
      clearSuggestions();
      clearError();
    }

    if (prefMode === 'ai' || prefMode === 'manual') {
      setInputMode(prefMode);
    }
  }, [searchParams, clearSuggestions]);

  useEffect(() => {
    window.localStorage.setItem(INPUT_MODE_STORAGE_KEY, inputMode);
  }, [inputMode]);

  useEffect(() => {
    const prefWord = (searchParams.get('word') ?? '').trim();
    const prefMode = searchParams.get('mode');
    if (!prefWord || prefMode !== 'ai') return;

    let cancelled = false;
    const runAutoSuggestion = async () => {
      if (await wordExists(prefWord)) {
        if (!cancelled) {
          setDuplicateError(prefWord);
        }
        return;
      }
      if (!cancelled) {
        void suggestMeanings(prefWord);
      }
    };

    void runAutoSuggestion();
    return () => {
      cancelled = true;
    };
  }, [searchParams, suggestMeanings]);

  const handleSave = async (
    english: string,
    arabicMeanings: string[],
    exampleSentences: string[],
    topic?: string,
    englishMeaning?: string
  ) => {
    const result = await saveWord(english, arabicMeanings, exampleSentences, topic, englishMeaning);
    if (result.success) {
      setSuccessMessage('Word saved successfully!');
      clearSuggestions();
      setWord('');
      setManualEnglishMeaning('');
    }
  };

  const handleManualExplainWithAi = async () => {
    const trimmed = word.trim();
    if (!trimmed) return;
    setShowManualExplainOptions(true);
    setSelectedManualExplainIndex(null);
    await explainWord(trimmed);
  };

  const handleApplyManualExplanation = () => {
    if (selectedManualExplainIndex === null) return;
    const option = englishExplanationOptions[selectedManualExplainIndex];
    if (!option) return;
    setManualEnglishMeaning(option);
    setShowManualExplainOptions(false);
    clearEnglishExplanation();
    setSelectedManualExplainIndex(null);
  };

  useEffect(() => {
    if (showManualExplainOptions && englishExplanationOptions.length === 1 && selectedManualExplainIndex === null) {
      setSelectedManualExplainIndex(0);
    }
  }, [showManualExplainOptions, englishExplanationOptions, selectedManualExplainIndex]);

  useEffect(() => {
    if (inputMode !== 'manual') {
      setShowManualExplainOptions(false);
      clearEnglishExplanation();
    }
  }, [inputMode, clearEnglishExplanation]);

  const handleManualSave = async () => {
    const meanings = manualMeaning
      .split(/[,،\n]/)
      .map(m => m.trim())
      .filter(m => m.length > 0);
    if (!word.trim() || meanings.length === 0) return;

    const sentences = manualSentences.map(s => s.trim()).filter(Boolean).slice(0, MAX_EXAMPLE_SENTENCES);
    const englishMeaning = manualEnglishMeaning.trim() || undefined;
    const result = await saveWord(word.trim(), meanings, sentences.length > 0 ? sentences : [''], undefined, englishMeaning);
    if (result.success) {
      setSuccessMessage('Word saved successfully!');
      setWord('');
      setManualMeaning('');
      setManualEnglishMeaning('');
      setManualSentences(['', '', '']);
      setShowManualExplainOptions(false);
    }
  };

  const handleCancel = () => {
    clearSuggestions();
    clearEnglishExplanation();
    setShowManualExplainOptions(false);
  };

  const hasAtLeastOneMeaning = manualMeaning
    .split(/[,،\n]/)
    .map(m => m.trim())
    .some(m => m.length > 0);
  const canSaveManual = Boolean(word.trim() && hasAtLeastOneMeaning);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl sm:text-3xl font-bold text-white">Manual Word Input</h2>

      {error && (
        <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 flex items-center gap-2">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {suggestions.length === 0 ? (
        <div className="bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-700">
          {/* Word Input */}
          <div className="mb-6">
            <label className="block text-gray-400 text-sm uppercase tracking-wide mb-3">
              English Word
            </label>
            <input
              type="text"
              value={word}
              onChange={(e) => {
                setWord(e.target.value);
                clearError();
              }}
              onBlur={handleEnglishWordBlur}
              placeholder="Enter an English word..."
              className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && inputMode === 'ai') {
                  handleGetSuggestions();
                }
              }}
            />
          </div>

          {/* Input Mode Toggle */}
          <div className="mb-6">
            <label className="block text-gray-400 text-sm uppercase tracking-wide mb-3">
              Input Mode
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => setInputMode('manual')}
                className={`flex-1 px-4 sm:px-6 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
                  inputMode === 'manual'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Manual Input
              </button>
              <button
                onClick={() => setInputMode('ai')}
                className={`flex-1 px-4 sm:px-6 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
                  inputMode === 'ai'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                AI Generated
              </button>
            </div>
          </div>

          {/* Manual Input Fields */}
          {inputMode === 'manual' && (
            <>
              {/* Arabic Meaning Input */}
              <div className="mb-6">
                <label className="block text-gray-400 text-sm uppercase tracking-wide mb-3">
                  Arabic Meaning(s) <span className="text-emerald-400 normal-case">• Separate multiple meanings with commas</span>
                </label>
                <textarea
                  value={manualMeaning}
                  onChange={(e) => setManualMeaning(e.target.value)}
                  placeholder="أدخل المعنى بالعربية..."
                  className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 text-right"
                  dir="rtl"
                  rows={2}
                />
              </div>

              {/* Example Sentences (up to 3) */}
              <div className="mb-6">
                <label className="block text-gray-400 text-sm uppercase tracking-wide mb-3">
                  Example Sentence(s) <span className="text-emerald-400 normal-case">• Up to {MAX_EXAMPLE_SENTENCES}</span>
                </label>
                <div className="space-y-3">
                  {manualSentences.map((sent, i) => (
                    <textarea
                      key={i}
                      value={sent}
                      onChange={(e) => setManualSentences(prev => prev.map((s, j) => j === i ? e.target.value : s))}
                      placeholder={i === 0 ? 'Enter an example sentence using the word...' : `Optional sentence ${i + 2}...`}
                      className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                      rows={2}
                    />
                  ))}
                </div>
              </div>

              {/* English Meaning (optional) */}
              <div className="mb-6">
                <label className="block text-gray-400 text-sm uppercase tracking-wide mb-3">
                  English Meaning <span className="text-gray-500 normal-case">• Optional — short explanation in English</span>
                </label>
                <textarea
                  value={manualEnglishMeaning}
                  onChange={(e) => setManualEnglishMeaning(e.target.value)}
                  placeholder="A short explanation of what the word means in English..."
                  className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 mb-3"
                  rows={2}
                />
                {!showManualExplainOptions ? (
                  <button
                    type="button"
                    onClick={() => void handleManualExplainWithAi()}
                    disabled={isExplainingLoading || !word.trim()}
                    className="w-full sm:w-auto px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-500 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isExplainingLoading ? 'Getting explanations...' : 'Explain with AI'}
                  </button>
                ) : (
                  <div className="rounded-lg border border-gray-600 bg-gray-900/40 p-3 space-y-3">
                    <p className="text-gray-400 text-xs uppercase tracking-wide">
                      Choose the explanation you understand best
                    </p>
                    {isExplainingLoading ? (
                      <div className="flex justify-center py-4">
                        <svg className="animate-spin h-6 w-6 text-amber-500" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      </div>
                    ) : englishExplanationOptions.length > 0 ? (
                      <>
                        <div className="space-y-2">
                          {englishExplanationOptions.map((option, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setSelectedManualExplainIndex(i)}
                              className={`w-full text-left p-3 rounded-lg border transition-all flex items-center justify-between ${
                                selectedManualExplainIndex === i
                                  ? 'border-amber-500 bg-amber-500/20 text-white'
                                  : 'border-gray-600 bg-gray-700/50 text-gray-300 hover:border-gray-500'
                              }`}
                            >
                              <span className="text-sm">{option}</span>
                              {selectedManualExplainIndex === i && <span className="text-amber-400">✓</span>}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setShowManualExplainOptions(false);
                              clearEnglishExplanation();
                              setSelectedManualExplainIndex(null);
                            }}
                            className="flex-1 px-3 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 text-sm"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleApplyManualExplanation}
                            disabled={selectedManualExplainIndex === null}
                            className="flex-1 px-3 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                          >
                            Use this
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="text-gray-400 text-sm py-2">No explanations. Try again.</p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="mb-6 p-4 bg-emerald-500/20 border border-emerald-500/50 rounded-lg text-emerald-400 flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {successMessage}
            </div>
          )}

          {/* Action Button */}
          {inputMode === 'manual' ? (
            <button
              onClick={handleManualSave}
              disabled={!canSaveManual}
              className={`w-full px-6 py-4 rounded-lg font-semibold text-lg transition-colors ${
                !canSaveManual
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-emerald-600 text-white hover:bg-emerald-500'
              }`}
            >
              Save Word
            </button>
          ) : (
            <button
              onClick={handleGetSuggestions}
              disabled={isSuggestingLoading || !word.trim()}
              className={`w-full px-6 py-4 rounded-lg font-semibold text-lg transition-colors ${
                isSuggestingLoading || !word.trim()
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-emerald-600 text-white hover:bg-emerald-500'
              }`}
            >
              {isSuggestingLoading ? (
                <span className="flex items-center justify-center gap-3">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Getting AI Suggestions...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Get AI Suggestions
                </span>
              )}
            </button>
          )}
        </div>
      ) : (
        <div>
          {successMessage && (
            <div className="mb-4 p-4 bg-emerald-500/20 border border-emerald-500/50 rounded-lg text-emerald-400 flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {successMessage}
            </div>
          )}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-gray-400">
            <span className="text-sm sm:text-base">Select meaning and sentence for "{suggestions[0].english}"</span>
            <button
              onClick={handleCancel}
              className="text-gray-500 hover:text-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>

          <WordSelector
            suggestion={suggestions[0]}
            onSave={handleSave}
            onSkip={handleCancel}
          />
        </div>
      )}
    </div>
  );
}
