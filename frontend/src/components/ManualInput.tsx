import { useState, useEffect } from 'react';
import { useVocabStore } from '../stores/vocabStore';
import WordSelector from './WordSelector';

type InputMode = 'manual' | 'ai';

export default function ManualInput() {
  const [word, setWord] = useState('');
  const [inputMode, setInputMode] = useState<InputMode>('manual');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Manual input fields
  const [manualMeaning, setManualMeaning] = useState('');
  const [manualSentence, setManualSentence] = useState('');

  const {
    suggestions,
    isSuggestingLoading,
    error,
    suggestMeanings,
    saveWord,
    clearSuggestions,
  } = useVocabStore();

  const handleGetSuggestions = () => {
    if (word.trim()) {
      suggestMeanings(word.trim());
    }
  };

  // Clear success message after 3 seconds
  useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => setSuccessMessage(null), 3000);
    return () => clearTimeout(t);
  }, [successMessage]);

  const handleSave = async (
    english: string,
    arabicMeanings: string[],
    exampleSentence: string
  ) => {
    const result = await saveWord(english, arabicMeanings, exampleSentence);
    if (result.success) {
      setSuccessMessage('Word saved successfully!');
      clearSuggestions();
      setWord('');
    }
  };

  const handleManualSave = async () => {
    if (word.trim() && manualMeaning.trim() && manualSentence.trim()) {
      const meanings = manualMeaning
        .split(/[,،\n]/)
        .map(m => m.trim())
        .filter(m => m.length > 0);

      const result = await saveWord(word.trim(), meanings, manualSentence.trim());
      if (result.success) {
        setSuccessMessage('Word saved successfully!');
        setWord('');
        setManualMeaning('');
        setManualSentence('');
      }
    }
  };

  const handleCancel = () => {
    clearSuggestions();
  };

  const canSaveManual = word.trim() && manualMeaning.trim() && manualSentence.trim();

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-white">Manual Word Input</h2>

      {suggestions.length === 0 ? (
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          {/* Word Input */}
          <div className="mb-6">
            <label className="block text-gray-400 text-sm uppercase tracking-wide mb-3">
              English Word
            </label>
            <input
              type="text"
              value={word}
              onChange={(e) => setWord(e.target.value)}
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
            <div className="flex gap-2">
              <button
                onClick={() => setInputMode('manual')}
                className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
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
                className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
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

              {/* Example Sentence Input */}
              <div className="mb-6">
                <label className="block text-gray-400 text-sm uppercase tracking-wide mb-3">
                  Example Sentence
                </label>
                <textarea
                  value={manualSentence}
                  onChange={(e) => setManualSentence(e.target.value)}
                  placeholder="Enter an example sentence using the word..."
                  className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                  rows={2}
                />
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

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
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
          {error && (
            <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}
          <div className="mb-4 flex items-center justify-between text-gray-400">
            <span>Select meaning and sentence for "{suggestions[0].english}"</span>
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
