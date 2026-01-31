import { useState, useEffect, useCallback, useMemo } from 'react';
import { useVocabStore } from '../stores/vocabStore';
import type { Word } from '../types';

// Text-to-speech function
function speakWord(word: string) {
  if ('speechSynthesis' in window) {
    // Cancel any ongoing speech
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    speechSynthesis.speak(utterance);
  }
}

// Fisher-Yates shuffle algorithm
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

type FilterType = 'all' | 'new' | 'problem' | 'date';

const DATE_OPTIONS = [
  { label: 'Last Week', days: 7 },
  { label: 'Last Month', days: 30 },
  { label: 'Last 2 Months', days: 60 },
  { label: 'Last 3 Months', days: 90 },
  { label: 'Last 6 Months', days: 180 },
];

// Filter words based on selection
function filterWords(words: Word[], filterType: FilterType, dateRange: number): Word[] {
  const now = new Date();
  switch (filterType) {
    case 'new':
      return words.filter(w => w.status === 'new');
    case 'problem':
      return words.filter(w => w.status === 'problem');
    case 'date':
      const cutoff = new Date(now.getTime() - dateRange * 24 * 60 * 60 * 1000);
      return words.filter(w => new Date(w.createdAt) >= cutoff);
    default:
      return words;
  }
}

export default function Flashcards() {
  const { words, isLoading, loadWords, markAsKnown, markAsProblem } = useVocabStore();
  
  // Session options state
  const [sessionStarted, setSessionStarted] = useState(false);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [dateRange, setDateRange] = useState(30);
  
  // Flashcard session state
  const [shuffledWords, setShuffledWords] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  
  // Audio state
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    loadWords();
  }, [loadWords]);

  // Auto-speak word when card changes (if not muted)
  useEffect(() => {
    if (currentWord && sessionStarted && !sessionComplete && !isMuted) {
      speakWord(currentWord.english);
    }
  }, [currentIndex, sessionStarted, sessionComplete, isMuted]);

  // Calculate word counts for each filter option
  const filterCounts = useMemo(() => {
    const now = new Date();
    return {
      all: words.length,
      new: words.filter(w => w.status === 'new').length,
      problem: words.filter(w => w.status === 'problem').length,
      date: DATE_OPTIONS.map(opt => ({
        days: opt.days,
        count: words.filter(w => {
          const cutoff = new Date(now.getTime() - opt.days * 24 * 60 * 60 * 1000);
          return new Date(w.createdAt) >= cutoff;
        }).length,
      })),
    };
  }, [words]);

  const currentWord = shuffledWords[currentIndex];

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const moveToNext = useCallback(() => {
    if (currentIndex < shuffledWords.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
    } else {
      setSessionComplete(true);
    }
  }, [currentIndex, shuffledWords.length]);

  const handleKnow = async () => {
    if (currentWord) {
      await markAsKnown(currentWord.id);
      moveToNext();
    }
  };

  const handleDontKnow = async () => {
    if (currentWord) {
      await markAsProblem(currentWord.id);
      moveToNext();
    }
  };

  const startSession = () => {
    const filtered = filterWords(words, filterType, dateRange);
    if (filtered.length > 0) {
      setShuffledWords(shuffleArray(filtered));
      setCurrentIndex(0);
      setIsFlipped(false);
      setSessionComplete(false);
      setSessionStarted(true);
    }
  };

  const backToOptions = () => {
    setSessionStarted(false);
    setSessionComplete(false);
  };

  const restartSession = () => {
    const filtered = filterWords(words, filterType, dateRange);
    setShuffledWords(shuffleArray(filtered));
    setCurrentIndex(0);
    setIsFlipped(false);
    setSessionComplete(false);
  };

  // Get the current count for the selected date range
  const getDateRangeCount = () => {
    const found = filterCounts.date.find(d => d.days === dateRange);
    return found ? found.count : 0;
  };

  // Get count for current filter selection
  const getSelectedFilterCount = () => {
    switch (filterType) {
      case 'new':
        return filterCounts.new;
      case 'problem':
        return filterCounts.problem;
      case 'date':
        return getDateRangeCount();
      default:
        return filterCounts.all;
    }
  };

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

  if (words.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-white">Flashcards</h2>
        <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 text-center">
          <p className="text-gray-400 text-lg">No words to review!</p>
          <p className="text-gray-500 mt-2">
            Add some words first by generating or entering them manually.
          </p>
        </div>
      </div>
    );
  }

  // Session Options Screen
  if (!sessionStarted) {
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-white">Flashcards</h2>
        
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-xl font-semibold text-white mb-4">Choose Your Session</h3>
          <p className="text-gray-400 mb-6">Select which words you want to practice</p>
          
          <div className="space-y-3">
            {/* All Words Option */}
            <label
              className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors ${
                filterType === 'all'
                  ? 'bg-emerald-600/20 border-emerald-500'
                  : 'bg-gray-700/50 border-gray-600 hover:bg-gray-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="filterType"
                  value="all"
                  checked={filterType === 'all'}
                  onChange={() => setFilterType('all')}
                  className="w-4 h-4 text-emerald-500 bg-gray-700 border-gray-600 focus:ring-emerald-500"
                />
                <div>
                  <span className="text-white font-medium">All Words</span>
                  <p className="text-gray-400 text-sm">Review all your vocabulary</p>
                </div>
              </div>
              <span className="text-gray-400 bg-gray-700 px-3 py-1 rounded-full text-sm">
                {filterCounts.all} words
              </span>
            </label>

            {/* New Words Option */}
            <label
              className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors ${
                filterType === 'new'
                  ? 'bg-blue-600/20 border-blue-500'
                  : 'bg-gray-700/50 border-gray-600 hover:bg-gray-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="filterType"
                  value="new"
                  checked={filterType === 'new'}
                  onChange={() => setFilterType('new')}
                  className="w-4 h-4 text-blue-500 bg-gray-700 border-gray-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-white font-medium">New Words Only</span>
                  <p className="text-gray-400 text-sm">Words you haven't reviewed yet</p>
                </div>
              </div>
              <span className="text-blue-400 bg-blue-500/20 px-3 py-1 rounded-full text-sm">
                {filterCounts.new} words
              </span>
            </label>

            {/* Problem Words Option */}
            <label
              className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors ${
                filterType === 'problem'
                  ? 'bg-red-600/20 border-red-500'
                  : 'bg-gray-700/50 border-gray-600 hover:bg-gray-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="filterType"
                  value="problem"
                  checked={filterType === 'problem'}
                  onChange={() => setFilterType('problem')}
                  className="w-4 h-4 text-red-500 bg-gray-700 border-gray-600 focus:ring-red-500"
                />
                <div>
                  <span className="text-white font-medium">Problem Words Only</span>
                  <p className="text-gray-400 text-sm">Focus on words you struggle with</p>
                </div>
              </div>
              <span className="text-red-400 bg-red-500/20 px-3 py-1 rounded-full text-sm">
                {filterCounts.problem} words
              </span>
            </label>

            {/* By Date Option */}
            <label
              className={`flex flex-col p-4 rounded-lg border cursor-pointer transition-colors ${
                filterType === 'date'
                  ? 'bg-purple-600/20 border-purple-500'
                  : 'bg-gray-700/50 border-gray-600 hover:bg-gray-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="filterType"
                    value="date"
                    checked={filterType === 'date'}
                    onChange={() => setFilterType('date')}
                    className="w-4 h-4 text-purple-500 bg-gray-700 border-gray-600 focus:ring-purple-500"
                  />
                  <div>
                    <span className="text-white font-medium">By Date Added</span>
                    <p className="text-gray-400 text-sm">Review recently added words</p>
                  </div>
                </div>
                <span className="text-purple-400 bg-purple-500/20 px-3 py-1 rounded-full text-sm">
                  {getDateRangeCount()} words
                </span>
              </div>
              
              {filterType === 'date' && (
                <div className="mt-4 ml-7">
                  <select
                    value={dateRange}
                    onChange={(e) => setDateRange(Number(e.target.value))}
                    className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {DATE_OPTIONS.map((opt) => {
                      const count = filterCounts.date.find(d => d.days === opt.days)?.count || 0;
                      return (
                        <option key={opt.days} value={opt.days}>
                          {opt.label} ({count} words)
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </label>
          </div>

          {/* Start Button */}
          <button
            onClick={startSession}
            disabled={getSelectedFilterCount() === 0}
            className={`w-full mt-6 px-8 py-4 rounded-lg font-semibold transition-colors ${
              getSelectedFilterCount() > 0
                ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            {getSelectedFilterCount() > 0
              ? `Start Session (${getSelectedFilterCount()} words)`
              : 'No words match this filter'}
          </button>
        </div>
      </div>
    );
  }

  if (sessionComplete) {
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-white">Flashcards</h2>
        <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <p className="text-2xl font-bold text-white mb-2">Session Complete!</p>
          <p className="text-gray-400 mb-6">
            You've reviewed all {shuffledWords.length} words.
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={backToOptions}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-500 transition-colors"
            >
              Change Options
            </button>
            <button
              onClick={restartSession}
              className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-500 transition-colors"
            >
              Restart Session
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSpeak = () => {
    if (currentWord) {
      speakWord(currentWord.english);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    // Cancel any ongoing speech when muting
    if (!isMuted) {
      speechSynthesis.cancel();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-white">Flashcards</h2>
        <div className="flex items-center gap-2">
          {/* Mute/Unmute Button */}
          <button
            onClick={toggleMute}
            className={`p-2 rounded-lg transition-colors ${
              isMuted 
                ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30' 
                : 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30'
            }`}
            title={isMuted ? 'Unmute auto-speak' : 'Mute auto-speak'}
          >
            {isMuted ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            )}
          </button>
          <button
            onClick={backToOptions}
            className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            Change Options
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center justify-between text-gray-400 mb-2">
        <span>
          Card {currentIndex + 1} of {shuffledWords.length}
        </span>
        <span className="text-sm">
          {currentWord?.status === 'known' && (
            <span className="text-emerald-400">Known</span>
          )}
          {currentWord?.status === 'problem' && (
            <span className="text-red-400">Problem</span>
          )}
          {currentWord?.status === 'new' && (
            <span className="text-blue-400">New</span>
          )}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / shuffledWords.length) * 100}%` }}
        />
      </div>

      {/* Flashcard */}
      <div
        onClick={handleFlip}
        className="relative h-80 cursor-pointer perspective-1000"
      >
        <div
          className={`absolute inset-0 transition-transform duration-500 transform-style-preserve-3d ${
            isFlipped ? 'rotate-y-180' : ''
          }`}
          style={{
            transformStyle: 'preserve-3d',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl border border-gray-700 flex items-center justify-center backface-hidden"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="text-center p-8">
              <div className="flex items-center justify-center gap-3 mb-4">
                <p className="text-4xl font-bold text-white">
                  {currentWord?.english}
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSpeak();
                  }}
                  className="p-2 rounded-full bg-gray-700 hover:bg-emerald-600 text-gray-300 hover:text-white transition-colors"
                  title="Listen to pronunciation"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                </button>
              </div>
              <p className="text-gray-500 text-sm">Click to reveal</p>
            </div>
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 bg-gradient-to-br from-emerald-900/50 to-gray-900 rounded-2xl border border-emerald-500/30 flex items-center justify-center backface-hidden"
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            <div className="text-center p-8">
              <div className="mb-6" dir="rtl">
                {currentWord?.arabicMeanings.map((meaning, i) => (
                  <p key={i} className="text-2xl font-bold text-white mb-2">
                    {meaning}
                  </p>
                ))}
              </div>
              <p className="text-gray-300 text-lg italic">
                "{currentWord?.exampleSentence}"
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={handleDontKnow}
          className="flex-1 px-6 py-4 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-500 transition-colors"
        >
          I Don't Know
        </button>
        <button
          onClick={handleKnow}
          className="flex-1 px-6 py-4 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-500 transition-colors"
        >
          I Know
        </button>
      </div>
    </div>
  );
}
