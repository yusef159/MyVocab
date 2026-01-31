import { useState } from 'react';
import { useVocabStore } from '../stores/vocabStore';
import WordSelector from './WordSelector';

export default function WordGenerator() {
  const [count, setCount] = useState(5);
  const [topic, setTopic] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  const {
    suggestions,
    isSuggestingLoading,
    error,
    generateWords,
    saveWord,
    clearSuggestions,
  } = useVocabStore();

  const handleGenerate = () => {
    setCurrentIndex(0);
    generateWords(count, topic || undefined);
  };

  const handleSave = async (
    english: string,
    arabicMeanings: string[],
    exampleSentence: string,
    wordTopic?: string
  ) => {
    await saveWord(english, arabicMeanings, exampleSentence, wordTopic);
    // Always move to next word, whether saved or duplicate
    // Error message will show if duplicate
    moveToNext();
  };

  const moveToNext = () => {
    if (currentIndex < suggestions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      clearSuggestions();
      setCurrentIndex(0);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-white">Generate Words</h2>

      {suggestions.length === 0 ? (
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          {/* Count Input */}
          <div className="mb-6">
            <label className="block text-gray-400 text-sm uppercase tracking-wide mb-3">
              Number of Words (1-20)
            </label>
            <input
              type="number"
              min={1}
              max={20}
              value={count}
              onChange={(e) => setCount(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
              className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Topic Input */}
          <div className="mb-6">
            <label className="block text-gray-400 text-sm uppercase tracking-wide mb-3">
              Topic (Optional)
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., technology, travel, food..."
              className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">
              {error}
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isSuggestingLoading}
            className={`w-full px-6 py-4 rounded-lg font-semibold text-lg transition-colors ${
              isSuggestingLoading
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
                Generating...
              </span>
            ) : (
              `Generate ${count} Word${count > 1 ? 's' : ''}`
            )}
          </button>
        </div>
      ) : (
        <div>
          {/* Progress Indicator */}
          <div className="mb-4 flex items-center justify-between text-gray-400">
            <span>
              Word {currentIndex + 1} of {suggestions.length}
            </span>
            <button
              onClick={() => {
                clearSuggestions();
                setCurrentIndex(0);
              }}
              className="text-gray-500 hover:text-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>

          {/* Progress Bar */}
          <div className="h-2 bg-gray-700 rounded-full mb-6 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / suggestions.length) * 100}%` }}
            />
          </div>

          {/* Word Selector */}
          <WordSelector
            suggestion={suggestions[currentIndex]}
            topic={topic || undefined}
            onSave={handleSave}
            onSkip={moveToNext}
          />
        </div>
      )}
    </div>
  );
}
