import { useState, useEffect, useMemo } from 'react';
import { useVocabStore } from '../stores/vocabStore';
import type { Word } from '../types';
import TestSession from './TestSession';

type ProgressFilter = 'all' | 'moderate' | 'hard' | 'very hard';
type TestType = 'scenario' | 'multipleChoice' | 'synonymMatch' | 'typeWhatYouHear';

// Calculate learning progress percentage
function calculateLearningPercentage(correctCount: number, wrongCount: number): number {
  const total = correctCount + wrongCount;
  if (total === 0) return 0;
  return Math.round((correctCount / total) * 100);
}

// Filter words based on learning progress
function filterByProgress(words: Word[], progressFilter: ProgressFilter): Word[] {
  if (progressFilter === 'all') return words;
  
  return words.filter(w => {
    const progress = calculateLearningPercentage(w.correctCount, w.wrongCount);
    switch (progressFilter) {
      case 'moderate':
        return progress >= 66 && progress < 90;
      case 'hard':
        return progress >= 33 && progress < 66;
      case 'very hard':
        return progress < 33;
      default:
        return true;
    }
  });
}

export default function TestTab() {
  const { words, isLoading, loadWords } = useVocabStore();
  const [progressFilter, setProgressFilter] = useState<ProgressFilter>('all');
  const [selectedTestType, setSelectedTestType] = useState<TestType | null>(null);
  const [wordCount, setWordCount] = useState<number>(20);
  const [testSessionWords, setTestSessionWords] = useState<Word[] | null>(null);

  useEffect(() => {
    loadWords();
  }, [loadWords]);

  // Filter to only known words
  const knownWords = useMemo(() => {
    return words.filter(w => w.status === 'known');
  }, [words]);

  // Apply progress filter to known words
  const filteredWords = useMemo(() => {
    return filterByProgress(knownWords, progressFilter);
  }, [knownWords, progressFilter]);

  // Reset word count when filter changes
  useEffect(() => {
    if (filteredWords.length > 0) {
      setWordCount(Math.min(wordCount, filteredWords.length));
    } else {
      setWordCount(20);
    }
  }, [progressFilter, filteredWords.length]);

  // Shuffle and limit words based on wordCount
  const wordsToTest = useMemo(() => {
    if (filteredWords.length === 0) return [];
    const shuffled = [...filteredWords].sort(() => Math.random() - 0.5);
    const count = Math.min(wordCount, filteredWords.length);
    return shuffled.slice(0, count);
  }, [filteredWords, wordCount]);

  // Calculate word counts for each progress filter
  const filterCounts = useMemo(() => {
    return {
      all: knownWords.length,
      moderate: knownWords.filter(w => {
        const progress = calculateLearningPercentage(w.correctCount, w.wrongCount);
        return progress >= 66 && progress < 90;
      }).length,
      hard: knownWords.filter(w => {
        const progress = calculateLearningPercentage(w.correctCount, w.wrongCount);
        return progress >= 33 && progress < 66;
      }).length,
      'very hard': knownWords.filter(w => {
        const progress = calculateLearningPercentage(w.correctCount, w.wrongCount);
        return progress < 33;
      }).length,
    };
  }, [knownWords]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <svg className="animate-spin h-8 w-8 text-emerald-500" viewBox="0 0 24 24">
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
      </div>
    );
  }

  if (knownWords.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-white">Test</h2>
        <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 text-center">
          <p className="text-gray-400 text-lg">No known words to test!</p>
          <p className="text-gray-500 mt-2">
            Mark some words as known in flashcards first.
          </p>
        </div>
      </div>
    );
  }

  // Show test session when words are selected
  if (testSessionWords && testSessionWords.length > 0) {
    return (
      <TestSession
        words={testSessionWords}
        onBack={() => {
          setTestSessionWords(null);
          setSelectedTestType(null);
        }}
        initialTestType={selectedTestType || undefined}
      />
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-white">Test</h2>
      
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h3 className="text-xl font-semibold text-white mb-4">Select Known Words</h3>
        <p className="text-gray-400 mb-6">Choose which known words you want to test</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <button
            type="button"
            onClick={() => setProgressFilter('all')}
            className={`rounded-xl p-4 text-left bg-gradient-to-br transition-all hover:scale-[1.02] active:scale-[0.98] flex flex-col gap-2 relative ${
              progressFilter === 'all'
                ? 'border-4 border-emerald-400 shadow-lg shadow-emerald-500/50 from-emerald-500/40 to-emerald-600/30 ring-4 ring-emerald-500/30'
                : 'border-2 border-emerald-500/40 hover:border-emerald-400/60 from-emerald-500/20 to-emerald-600/10 opacity-70 hover:opacity-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl">📚</span>
              {progressFilter === 'all' && (
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-400 text-emerald-900 font-bold text-lg shadow-lg">
                  ✓
                </div>
              )}
            </div>
            <h4 className={`text-lg font-bold ${progressFilter === 'all' ? 'text-white' : 'text-gray-300'}`}>All Known Words</h4>
            <p className={`text-sm flex-1 ${progressFilter === 'all' ? 'text-gray-200' : 'text-gray-400'}`}>Test all words marked as known</p>
            <span className={`text-xs font-medium px-2 py-1 rounded w-fit ${
              progressFilter === 'all'
                ? 'text-emerald-900 bg-emerald-300'
                : 'text-emerald-300 bg-emerald-500/20'
            }`}>
              {filterCounts.all} words
            </span>
          </button>

          <button
            type="button"
            onClick={() => setProgressFilter('moderate')}
            className={`rounded-xl p-4 text-left bg-gradient-to-br transition-all hover:scale-[1.02] active:scale-[0.98] flex flex-col gap-2 relative ${
              progressFilter === 'moderate'
                ? 'border-4 border-emerald-400 shadow-lg shadow-emerald-500/50 from-emerald-500/40 to-emerald-600/30 ring-4 ring-emerald-500/30'
                : 'border-2 border-emerald-500/40 hover:border-emerald-400/60 from-emerald-500/20 to-emerald-600/10 opacity-70 hover:opacity-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl">📊</span>
              {progressFilter === 'moderate' && (
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-400 text-emerald-900 font-bold text-lg shadow-lg">
                  ✓
                </div>
              )}
            </div>
            <h4 className={`text-lg font-bold ${progressFilter === 'moderate' ? 'text-white' : 'text-gray-300'}`}>Moderate Level</h4>
            <p className={`text-sm flex-1 ${progressFilter === 'moderate' ? 'text-gray-200' : 'text-gray-400'}`}>66-89% correct rate</p>
            <span className={`text-xs font-medium px-2 py-1 rounded w-fit ${
              progressFilter === 'moderate'
                ? 'text-emerald-900 bg-emerald-300'
                : 'text-emerald-300 bg-emerald-500/20'
            }`}>
              {filterCounts.moderate} words
            </span>
          </button>

          <button
            type="button"
            onClick={() => setProgressFilter('hard')}
            className={`rounded-xl p-4 text-left bg-gradient-to-br transition-all hover:scale-[1.02] active:scale-[0.98] flex flex-col gap-2 relative ${
              progressFilter === 'hard'
                ? 'border-4 border-emerald-400 shadow-lg shadow-emerald-500/50 from-emerald-500/40 to-emerald-600/30 ring-4 ring-emerald-500/30'
                : 'border-2 border-emerald-500/40 hover:border-emerald-400/60 from-emerald-500/20 to-emerald-600/10 opacity-70 hover:opacity-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl">⚡</span>
              {progressFilter === 'hard' && (
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-400 text-emerald-900 font-bold text-lg shadow-lg">
                  ✓
                </div>
              )}
            </div>
            <h4 className={`text-lg font-bold ${progressFilter === 'hard' ? 'text-white' : 'text-gray-300'}`}>Hard Level</h4>
            <p className={`text-sm flex-1 ${progressFilter === 'hard' ? 'text-gray-200' : 'text-gray-400'}`}>33-65% correct rate</p>
            <span className={`text-xs font-medium px-2 py-1 rounded w-fit ${
              progressFilter === 'hard'
                ? 'text-emerald-900 bg-emerald-300'
                : 'text-emerald-300 bg-emerald-500/20'
            }`}>
              {filterCounts.hard} words
            </span>
          </button>

          <button
            type="button"
            onClick={() => setProgressFilter('very hard')}
            className={`rounded-xl p-4 text-left bg-gradient-to-br transition-all hover:scale-[1.02] active:scale-[0.98] flex flex-col gap-2 relative ${
              progressFilter === 'very hard'
                ? 'border-4 border-emerald-400 shadow-lg shadow-emerald-500/50 from-emerald-500/40 to-emerald-600/30 ring-4 ring-emerald-500/30'
                : 'border-2 border-emerald-500/40 hover:border-emerald-400/60 from-emerald-500/20 to-emerald-600/10 opacity-70 hover:opacity-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl">🔥</span>
              {progressFilter === 'very hard' && (
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-400 text-emerald-900 font-bold text-lg shadow-lg">
                  ✓
                </div>
              )}
            </div>
            <h4 className={`text-lg font-bold ${progressFilter === 'very hard' ? 'text-white' : 'text-gray-300'}`}>Very Hard Level</h4>
            <p className={`text-sm flex-1 ${progressFilter === 'very hard' ? 'text-gray-200' : 'text-gray-400'}`}>Less than 33% correct rate</p>
            <span className={`text-xs font-medium px-2 py-1 rounded w-fit ${
              progressFilter === 'very hard'
                ? 'text-emerald-900 bg-emerald-300'
                : 'text-emerald-300 bg-emerald-500/20'
            }`}>
              {filterCounts['very hard']} words
            </span>
          </button>
        </div>

        {/* Test Type Options */}
        <div className="mt-6 pt-6 border-t border-gray-700">
          <h3 className="text-xl font-semibold text-white mb-4">Select Test Type</h3>
          <p className="text-gray-400 mb-4">Choose a test type to practice your vocabulary</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              type="button"
              onClick={() => setSelectedTestType('scenario')}
              className={`rounded-xl p-4 text-left bg-gradient-to-br transition-all hover:scale-[1.02] active:scale-[0.98] flex flex-col gap-2 relative ${
                selectedTestType === 'scenario'
                  ? 'border-4 border-blue-400 shadow-lg shadow-blue-500/50 from-blue-500/40 to-blue-600/30 ring-4 ring-blue-500/30'
                  : 'border-2 border-blue-500/40 hover:border-blue-400/60 from-blue-500/20 to-blue-600/10 opacity-70 hover:opacity-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl">✍️</span>
                {selectedTestType === 'scenario' && (
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-400 text-blue-900 font-bold text-lg shadow-lg">
                    ✓
                  </div>
                )}
              </div>
              <h4 className={`text-lg font-bold ${selectedTestType === 'scenario' ? 'text-white' : 'text-gray-300'}`}>Scenario Writing</h4>
              <p className={`text-sm flex-1 ${selectedTestType === 'scenario' ? 'text-gray-200' : 'text-gray-400'}`}>Write sentences for 4-6 scenarios using 2-4 words each. Get AI feedback.</p>
            </button>
            
            <button
              type="button"
              onClick={() => setSelectedTestType('multipleChoice')}
              className={`rounded-xl p-4 text-left bg-gradient-to-br transition-all hover:scale-[1.02] active:scale-[0.98] flex flex-col gap-2 relative ${
                selectedTestType === 'multipleChoice'
                  ? 'border-4 border-emerald-400 shadow-lg shadow-emerald-500/50 from-emerald-500/40 to-emerald-600/30 ring-4 ring-emerald-500/30'
                  : 'border-2 border-emerald-500/40 hover:border-emerald-400/60 from-emerald-500/20 to-emerald-600/10 opacity-70 hover:opacity-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl">☑️</span>
                {selectedTestType === 'multipleChoice' && (
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-400 text-emerald-900 font-bold text-lg shadow-lg">
                    ✓
                  </div>
                )}
              </div>
              <h4 className={`text-lg font-bold ${selectedTestType === 'multipleChoice' ? 'text-white' : 'text-gray-300'}`}>Multiple Choice Meaning</h4>
              <p className={`text-sm flex-1 ${selectedTestType === 'multipleChoice' ? 'text-gray-200' : 'text-gray-400'}`}>Pick the correct meaning from 5 options for each word.</p>
            </button>
            
            <button
              type="button"
              onClick={() => setSelectedTestType('synonymMatch')}
              className={`rounded-xl p-4 text-left bg-gradient-to-br transition-all hover:scale-[1.02] active:scale-[0.98] flex flex-col gap-2 relative ${
                selectedTestType === 'synonymMatch'
                  ? 'border-4 border-purple-400 shadow-lg shadow-purple-500/50 from-purple-500/40 to-purple-600/30 ring-4 ring-purple-500/30'
                  : 'border-2 border-purple-500/40 hover:border-purple-400/60 from-purple-500/20 to-purple-600/10 opacity-70 hover:opacity-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl">🔄</span>
                {selectedTestType === 'synonymMatch' && (
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-400 text-purple-900 font-bold text-lg shadow-lg">
                    ✓
                  </div>
                )}
              </div>
              <h4 className={`text-lg font-bold ${selectedTestType === 'synonymMatch' ? 'text-white' : 'text-gray-300'}`}>Word Synonym Match</h4>
              <p className={`text-sm flex-1 ${selectedTestType === 'synonymMatch' ? 'text-gray-200' : 'text-gray-400'}`}>Match each word to its synonym from 5 options.</p>
            </button>
            
            <button
              type="button"
              onClick={() => setSelectedTestType('typeWhatYouHear')}
              className={`rounded-xl p-4 text-left bg-gradient-to-br transition-all hover:scale-[1.02] active:scale-[0.98] flex flex-col gap-2 relative ${
                selectedTestType === 'typeWhatYouHear'
                  ? 'border-4 border-rose-400 shadow-lg shadow-rose-500/50 from-rose-500/40 to-rose-600/30 ring-4 ring-rose-500/30'
                  : 'border-2 border-rose-500/40 hover:border-rose-400/60 from-rose-500/20 to-rose-600/10 opacity-70 hover:opacity-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl">🎧</span>
                {selectedTestType === 'typeWhatYouHear' && (
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-rose-400 text-rose-900 font-bold text-lg shadow-lg">
                    ✓
                  </div>
                )}
              </div>
              <h4 className={`text-lg font-bold ${selectedTestType === 'typeWhatYouHear' ? 'text-white' : 'text-gray-300'}`}>Type What You Hear</h4>
              <p className={`text-sm flex-1 ${selectedTestType === 'typeWhatYouHear' ? 'text-gray-200' : 'text-gray-400'}`}>Listen to the word and type it. Builds listening and spelling.</p>
            </button>
          </div>
        </div>

        {/* Number of Words Input */}
        <div className="mt-6 pt-6 border-t border-gray-700">
          <h3 className="text-xl font-semibold text-white mb-4">Number of Words</h3>
          <p className="text-gray-400 mb-6">Select how many words you want to be tested on</p>
          
          {filteredWords.length > 0 ? (
            <div className="space-y-6">
              {/* Slider */}
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">1</span>
                  <span className="text-gray-400 text-sm">{filteredWords.length}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={filteredWords.length}
                  value={wordCount}
                  onChange={(e) => {
                    setWordCount(parseInt(e.target.value, 10));
                  }}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  style={{
                    background: `linear-gradient(to right, rgb(16, 185, 129) 0%, rgb(16, 185, 129) ${((wordCount - 1) / (filteredWords.length - 1)) * 100}%, rgb(55, 65, 81) ${((wordCount - 1) / (filteredWords.length - 1)) * 100}%, rgb(55, 65, 81) 100%)`
                  }}
                />
              </div>

              {/* Number Display with Controls */}
              <div className="flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => {
                    if (wordCount > 1) {
                      setWordCount(wordCount - 1);
                    }
                  }}
                  disabled={wordCount <= 1}
                  className="w-12 h-12 rounded-xl bg-gray-700 hover:bg-gray-600 border-2 border-gray-600 hover:border-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                >
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button>

                <div className="relative">
                  <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border-2 border-emerald-500/50 rounded-xl px-8 py-4 min-w-[120px] text-center">
                    <input
                      type="number"
                      min={1}
                      max={filteredWords.length}
                      value={wordCount}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!Number.isNaN(v) && v >= 1) {
                          setWordCount(Math.min(v, filteredWords.length));
                        }
                      }}
                      onBlur={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (Number.isNaN(v) || v < 1) {
                          setWordCount(Math.min(20, filteredWords.length));
                        } else {
                          setWordCount(Math.min(v, filteredWords.length));
                        }
                      }}
                      className="w-full bg-transparent text-3xl font-bold text-white text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <p className="text-emerald-300 text-xs mt-1 font-medium">
                      {wordCount === 1 ? 'word' : 'words'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (wordCount < filteredWords.length) {
                      setWordCount(wordCount + 1);
                    }
                  }}
                  disabled={wordCount >= filteredWords.length}
                  className="w-12 h-12 rounded-xl bg-gray-700 hover:bg-gray-600 border-2 border-gray-600 hover:border-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                >
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>

              {/* Quick Select Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="text-gray-400 text-sm mr-2">Quick select:</span>
                {[5, 10, 15, 20, 30, 40, 50].filter(n => n <= filteredWords.length).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setWordCount(n)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      wordCount === n
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/50'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                    }`}
                  >
                    {n}
                  </button>
                ))}
                {filteredWords.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setWordCount(filteredWords.length)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      wordCount === filteredWords.length
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/50'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                    }`}
                  >
                    All ({filteredWords.length})
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No words available</p>
            </div>
          )}
        </div>

        {/* Start Test Button */}
        <button
          onClick={() => {
            if (wordsToTest.length > 0 && selectedTestType) {
              setTestSessionWords(wordsToTest);
            }
          }}
          disabled={wordsToTest.length === 0 || !selectedTestType}
          className={`w-full mt-6 px-8 py-4 rounded-lg font-semibold transition-colors ${
            wordsToTest.length > 0 && selectedTestType
              ? 'bg-emerald-600 text-white hover:bg-emerald-500'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          {wordsToTest.length === 0
            ? 'No words match this filter'
            : !selectedTestType
            ? 'Please select a test type'
            : `Start Test (${wordsToTest.length} ${wordsToTest.length === 1 ? 'word' : 'words'})`}
        </button>
      </div>
    </div>
  );
}
