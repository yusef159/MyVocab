import { useState, useEffect, useCallback, useMemo } from 'react';
import { useVocabStore } from '../stores/vocabStore';
import type { Word } from '../types';
import { getSavedSession, saveSession, clearSavedSession, getSavedSessionSize, saveSessionSize, saveLastCompletedSession, getLastCompletedSession } from '../lib/flashcardSessionStorage';
import TestSession from './TestSession';

// Text-to-speech: speak a word or phrase in English
function speakText(text: string) {
  if ('speechSynthesis' in window && text?.trim()) {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.trim());
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

// Highlight word in sentence
function highlightWordInSentence(sentence: string, word: string): JSX.Element {
  if (!sentence || !word) {
    return <>{sentence}</>;
  }

  // Create a regex that matches the word as a whole word (case-insensitive)
  // This handles punctuation and word boundaries
  const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
  const parts: Array<{ text: string; isHighlight: boolean }> = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(sentence)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push({ text: sentence.substring(lastIndex, match.index), isHighlight: false });
    }
    // Add the highlighted match
    parts.push({ text: match[0], isHighlight: true });
    lastIndex = regex.lastIndex;
  }

  // Add remaining text after the last match
  if (lastIndex < sentence.length) {
    parts.push({ text: sentence.substring(lastIndex), isHighlight: false });
  }

  // If no matches found, return the sentence as-is
  if (parts.length === 0) {
    return <>{sentence}</>;
  }

  return (
    <>
      {parts.map((part, index) =>
        part.isHighlight ? (
          <span key={index} className="text-emerald-400">
            {part.text}
          </span>
        ) : (
          <span key={index}>{part.text}</span>
        )
      )}
    </>
  );
}

type FilterType = 'all' | 'new' | 'problem' | 'date';
type ProgressFilter = 'all' | 'moderate' | 'hard' | 'very hard';

const DATE_OPTIONS = [
  { label: 'Today', days: 0 },
  { label: 'Today And Yesterday', days: 2 },
  { label: 'Last Week', days: 7 },
  { label: 'Last Month', days: 30 },
  { label: 'Last 2 Months', days: 60 },
  { label: 'Last 3 Months', days: 90 },
  { label: 'Last 6 Months', days: 180 },
];

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

// Filter words based on selection
function filterWords(
  words: Word[],
  filterType: FilterType,
  dateRange: number,
  progressFilter?: ProgressFilter
): Word[] {
  const now = new Date();
  switch (filterType) {
    case 'new':
      return words.filter(w => w.status === 'new');
    case 'problem': {
      // Only show words with status "problem" (not known)
      let problemWords = words.filter(w => w.status === 'problem');
      
      // Apply learning progress filter if specified
      if (progressFilter) {
        problemWords = filterByProgress(problemWords, progressFilter);
      }
      
      return problemWords;
    }
    case 'all': {
      // Apply learning progress filter if specified
      if (progressFilter) {
        return filterByProgress(words, progressFilter);
      }
      return words;
    }
    case 'date': {
      const cutoff =
        dateRange === 0
          ? (() => {
              const startOfToday = new Date(now);
              startOfToday.setHours(0, 0, 0, 0);
              return startOfToday;
            })()
          : new Date(now.getTime() - dateRange * 24 * 60 * 60 * 1000);
      return words.filter(w => new Date(w.createdAt) >= cutoff);
    }
    default:
      return words;
  }
}

export default function Flashcards() {
  const { words, isLoading, loadWords, markAsKnown, markAsProblem, streak, loadStreak } = useVocabStore();
  
  // Session options state
  const [sessionStarted, setSessionStarted] = useState(false);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [dateRange, setDateRange] = useState(30);
  const [sessionSize, setSessionSize] = useState(getSavedSessionSize);
  const [problemProgressFilter, setProblemProgressFilter] = useState<ProgressFilter>('all');
  const [allWordsProgressFilter, setAllWordsProgressFilter] = useState<ProgressFilter>('all');

  // Flashcard session state
  const [shuffledWords, setShuffledWords] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [sessionKnownCount, setSessionKnownCount] = useState(0);
  const [sessionProblemCount, setSessionProblemCount] = useState(0);
  const [testSessionWords, setTestSessionWords] = useState<Word[] | null>(null);

  // Streak notification state
  const [showStreakMessage, setShowStreakMessage] = useState(false);
  const [previousReviewsToday, setPreviousReviewsToday] = useState<number | null>(null);

  // Audio state: word auto-speak, and sentence speak (separate, default muted)
  const [isMuted, setIsMuted] = useState(false);
  const [isSentenceMuted, setIsSentenceMuted] = useState(true);

  useEffect(() => {
    loadWords();
    loadStreak();
  }, [loadWords, loadStreak]);

  // Initialize previousReviewsToday when streak loads
  useEffect(() => {
    if (streak && previousReviewsToday === null) {
      setPreviousReviewsToday(streak.reviewsToday || 0);
    }
  }, [streak, previousReviewsToday]);

  // Track streak progress and show message when 20 reviews reached
  useEffect(() => {
    if (streak && previousReviewsToday !== null) {
      const currentReviews = streak.reviewsToday || 0;
      
      // If we just hit 20 reviews (went from less than 20 to exactly 20)
      if (previousReviewsToday < 20 && currentReviews === 20) {
        setShowStreakMessage(true);
        // Auto-hide after 5 seconds
        const timer = setTimeout(() => {
          setShowStreakMessage(false);
        }, 5000);
        return () => clearTimeout(timer);
      }
      
      // Update previous reviews count
      if (currentReviews !== previousReviewsToday) {
        setPreviousReviewsToday(currentReviews);
      }
    }
  }, [streak, previousReviewsToday]);

  useEffect(() => {
    saveSessionSize(sessionSize);
  }, [sessionSize]);

  // Reset progress filters when switching away from their respective filters
  useEffect(() => {
    if (filterType !== 'problem') {
      setProblemProgressFilter('all');
    }
    if (filterType !== 'all') {
      setAllWordsProgressFilter('all');
    }
  }, [filterType]);

  // Auto-speak word when card changes (if not muted)
  useEffect(() => {
    const word = shuffledWords[currentIndex];
    if (word && sessionStarted && !sessionComplete && !isMuted) {
      speakText(word.english);
    }
  }, [currentIndex, sessionStarted, sessionComplete, isMuted, shuffledWords]);

  // Auto-speak first sentence when card is flipped (if sentence speak not muted)
  useEffect(() => {
    const word = shuffledWords[currentIndex];
    const firstSentence = word?.exampleSentences?.filter(Boolean)[0];
    if (isFlipped && firstSentence && sessionStarted && !sessionComplete && !isSentenceMuted) {
      speakText(firstSentence);
    }
  }, [isFlipped, currentIndex, shuffledWords, sessionStarted, sessionComplete, isSentenceMuted]);

  // Calculate word counts for each filter option
  const filterCounts = useMemo(() => {
    const now = new Date();
    const problemWords = words.filter(w => w.status === 'problem');
    return {
      all: words.length,
      new: words.filter(w => w.status === 'new').length,
      problem: problemWords.length,
      allByProgress: {
        all: words.length,
        moderate: words.filter(w => {
          const progress = calculateLearningPercentage(w.correctCount, w.wrongCount);
          return progress >= 66 && progress < 90;
        }).length,
        hard: words.filter(w => {
          const progress = calculateLearningPercentage(w.correctCount, w.wrongCount);
          return progress >= 33 && progress < 66;
        }).length,
        'very hard': words.filter(w => {
          const progress = calculateLearningPercentage(w.correctCount, w.wrongCount);
          return progress < 33;
        }).length,
      },
      problemByProgress: {
        all: problemWords.length,
        moderate: problemWords.filter(w => {
          const progress = calculateLearningPercentage(w.correctCount, w.wrongCount);
          return progress >= 66 && progress < 90;
        }).length,
        hard: problemWords.filter(w => {
          const progress = calculateLearningPercentage(w.correctCount, w.wrongCount);
          return progress >= 33 && progress < 66;
        }).length,
        'very hard': problemWords.filter(w => {
          const progress = calculateLearningPercentage(w.correctCount, w.wrongCount);
          return progress < 33;
        }).length,
      },
      date: DATE_OPTIONS.map(opt => {
        const cutoff =
          opt.days === 0
            ? (() => {
                const startOfToday = new Date(now);
                startOfToday.setHours(0, 0, 0, 0);
                return startOfToday;
              })()
            : new Date(now.getTime() - opt.days * 24 * 60 * 60 * 1000);
        return {
          days: opt.days,
          count: words.filter(w => new Date(w.createdAt) >= cutoff).length,
        };
      }),
    };
  }, [words]);

  const currentWord = shuffledWords[currentIndex];

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const moveToNext = useCallback(
    (counts?: { knownCount: number; problemCount: number }) => {
      if (currentIndex < shuffledWords.length - 1) {
        const nextIndex = currentIndex + 1;
        setCurrentIndex(nextIndex);
        setIsFlipped(false);
        saveSession({
          wordIds: shuffledWords.map(w => w.id),
          currentIndex: nextIndex,
          filterType,
          dateRange,
          savedAt: new Date().toISOString(),
          knownCount: counts?.knownCount ?? 0,
          problemCount: counts?.problemCount ?? 0,
        });
      } else {
        // Save completed session before clearing
        const completedSession = {
          wordIds: shuffledWords.map(w => w.id),
          currentIndex: shuffledWords.length,
          filterType,
          dateRange,
          savedAt: new Date().toISOString(),
          knownCount: counts?.knownCount ?? 0,
          problemCount: counts?.problemCount ?? 0,
        };
        saveLastCompletedSession(completedSession);
        setSessionComplete(true);
        clearSavedSession();
      }
    },
    [currentIndex, shuffledWords, filterType, dateRange]
  );

  const handleKnow = async () => {
    if (currentWord) {
      const nextKnown = sessionKnownCount + 1;
      setSessionKnownCount(nextKnown);
      await markAsKnown(currentWord.id);
      await loadStreak(); // Reload streak to check if we hit 20 reviews
      moveToNext({ knownCount: nextKnown, problemCount: sessionProblemCount });
    }
  };

  const handleDontKnow = async () => {
    if (currentWord) {
      const nextProblem = sessionProblemCount + 1;
      setSessionProblemCount(nextProblem);
      await markAsProblem(currentWord.id);
      await loadStreak(); // Reload streak to check if we hit 20 reviews
      moveToNext({ knownCount: sessionKnownCount, problemCount: nextProblem });
    }
  };

  // Keyboard shortcuts during session (always active)
  useEffect(() => {
    if (!sessionStarted || sessionComplete) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          handleKnow();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handleDontKnow();
          break;
        case 'ArrowDown':
          e.preventDefault();
          handleFlip();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sessionStarted, sessionComplete, handleKnow, handleDontKnow, handleFlip]);

  const startSession = () => {
    const progressFilter = filterType === 'problem' 
      ? problemProgressFilter 
      : filterType === 'all' 
        ? allWordsProgressFilter 
        : undefined;
    
    const filtered = filterWords(
      words,
      filterType,
      dateRange,
      progressFilter
    );
    if (filtered.length > 0) {
      const requested = Math.max(1, Number(sessionSize) || 20);
      const takeCount = Math.min(requested, filtered.length);
      const shuffled = shuffleArray(filtered).slice(0, takeCount);
      setShuffledWords(shuffled);
      setCurrentIndex(0);
      setIsFlipped(false);
      setSessionComplete(false);
      setSessionKnownCount(0);
      setSessionProblemCount(0);
      setSessionStarted(true);
      saveSession({
        wordIds: shuffled.map(w => w.id),
        currentIndex: 0,
        filterType,
        dateRange,
        savedAt: new Date().toISOString(),
        knownCount: 0,
        problemCount: 0,
      });
    }
  };

  const backToOptions = () => {
    setSessionStarted(false);
    setSessionComplete(false);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSessionKnownCount(0);
    setSessionProblemCount(0);
  };

  const regenerateCurrentSession = () => {
    if (shuffledWords.length === 0) return;
    // Shuffle the current session's words to change the order
    const shuffled = shuffleArray(shuffledWords);
    setShuffledWords(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSessionComplete(false);
    setSessionKnownCount(0);
    setSessionProblemCount(0);
    setSessionStarted(true);
    // Save as new session (with shuffled order)
    saveSession({
      wordIds: shuffled.map(w => w.id),
      currentIndex: 0,
      filterType,
      dateRange,
      savedAt: new Date().toISOString(),
      knownCount: 0,
      problemCount: 0,
    });
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

  // Number of words we'll actually use: default 20, clamped to 1..available
  const getEffectiveSessionSize = () => {
    const available = getSelectedFilterCount();
    if (available === 0) return 0;
    const requested = Math.max(1, Number(sessionSize) || 20);
    return Math.min(requested, available);
  };

  // Validated saved session for "Continue last session" (only when on options screen)
  const resumableSession = useMemo(() => {
    const saved = getSavedSession();
    if (!saved || !saved.wordIds.length) return null;
    const wordMap = new Map(words.map(w => [w.id, w]));
    const ordered = saved.wordIds.map(id => wordMap.get(id)).filter(Boolean) as Word[];
    if (ordered.length === 0) return null;
    const index = Math.min(Math.max(0, saved.currentIndex), ordered.length - 1);
    const cardsLeft = ordered.length - index;
    return {
      words: ordered,
      currentIndex: index,
      cardsLeft,
      knownCount: saved.knownCount,
      problemCount: saved.problemCount,
    };
  }, [words]);

  // Get last completed session for display and regeneration
  const lastCompletedSession = useMemo(() => {
    const saved = getLastCompletedSession();
    if (!saved || !saved.wordIds.length) return null;
    const wordMap = new Map(words.map(w => [w.id, w]));
    const ordered = saved.wordIds.map(id => wordMap.get(id)).filter(Boolean) as Word[];
    if (ordered.length === 0) return null;
    return {
      words: ordered,
      filterType: saved.filterType,
      dateRange: saved.dateRange,
      savedAt: saved.savedAt,
      knownCount: saved.knownCount,
      problemCount: saved.problemCount,
      totalWords: ordered.length,
    };
  }, [words]);

  const continueLastSession = () => {
    if (!resumableSession) return;
    setShuffledWords(resumableSession.words);
    setCurrentIndex(resumableSession.currentIndex);
    setIsFlipped(false);
    setSessionComplete(false);
    setSessionKnownCount(resumableSession.knownCount);
    setSessionProblemCount(resumableSession.problemCount);
    setSessionStarted(true);
  };

  const regenerateLastSession = () => {
    if (!lastCompletedSession) return;
    // Set filter options to match the last session
    setFilterType(lastCompletedSession.filterType);
    setDateRange(lastCompletedSession.dateRange);
    // Shuffle the words so the order is different each time
    const shuffled = shuffleArray(lastCompletedSession.words);
    setShuffledWords(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSessionComplete(false);
    setSessionKnownCount(0);
    setSessionProblemCount(0);
    setSessionStarted(true);
    // Save as new session (with shuffled order)
    saveSession({
      wordIds: shuffled.map(w => w.id),
      currentIndex: 0,
      filterType: lastCompletedSession.filterType,
      dateRange: lastCompletedSession.dateRange,
      savedAt: new Date().toISOString(),
      knownCount: 0,
      problemCount: 0,
    });
  };

  const getFilterTypeLabel = (type: FilterType): string => {
    switch (type) {
      case 'all': return 'All Words';
      case 'new': return 'New Words';
      case 'problem': return 'Problem Words';
      case 'date': return 'By Date Added';
      default: return 'Unknown';
    }
  };

  const getDateRangeLabel = (days: number): string => {
    const found = DATE_OPTIONS.find(opt => opt.days === days);
    return found ? found.label : `${days} days`;
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

  // Show test session when we have words to test (from just-completed session or from Last Completed Session card)
  // This check must come before !sessionStarted so that "Test Session" from the options screen works.
  if (testSessionWords && testSessionWords.length > 0) {
    return (
      <TestSession
        words={testSessionWords}
        onBack={() => setTestSessionWords(null)}
      />
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

          {resumableSession && (
            <button
              type="button"
              onClick={continueLastSession}
              className="w-full mb-6 p-4 rounded-lg border-2 border-amber-500/50 bg-amber-500/10 text-left hover:bg-amber-500/20 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">▶</span>
                <div>
                  <span className="text-white font-semibold block">Continue last session</span>
                  <span className="text-amber-200/90 text-sm">{resumableSession.cardsLeft} cards left</span>
                </div>
              </div>
            </button>
          )}

          {lastCompletedSession && (
            <div className="mb-6 p-4 rounded-lg border-2 border-blue-500/50 bg-blue-500/10">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📋</span>
                  <div>
                    <span className="text-white font-semibold block">Last Completed Session</span>
                    <span className="text-blue-200/90 text-sm">
                      {(() => {
                        const d = new Date(lastCompletedSession.savedAt);
                        const day = String(d.getDate()).padStart(2, '0');
                        const month = String(d.getMonth() + 1).padStart(2, '0');
                        const year = d.getFullYear();
                        return `${day}/${month}/${year}`;
                      })()}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="ml-11 mb-4 space-y-3 text-sm text-gray-300">
                <p>
                  <span className="text-gray-400">Filter:</span> {getFilterTypeLabel(lastCompletedSession.filterType)}
                  {lastCompletedSession.filterType === 'date' && ` (${getDateRangeLabel(lastCompletedSession.dateRange)})`}
                </p>
                <p>
                  <span className="text-gray-400">Words:</span> {lastCompletedSession.totalWords}
                </p>
                {/* Performance Bar */}
                {(() => {
                  const total = lastCompletedSession.totalWords;
                  const knownPct = total > 0 ? Math.round((lastCompletedSession.knownCount / total) * 100) : 0;
                  const problemPct = total > 0 ? Math.round((lastCompletedSession.problemCount / total) * 100) : 0;
                  return (
                    <div className="max-w-xs">
                      <div className="h-6 rounded-full overflow-hidden flex bg-gray-700">
                        {knownPct > 0 && (
                          <div
                            className="h-full bg-emerald-500 transition-all duration-500"
                            style={{ width: `${knownPct}%` }}
                          />
                        )}
                        {problemPct > 0 && (
                          <div
                            className="h-full bg-red-500 transition-all duration-500"
                            style={{ width: `${problemPct}%` }}
                          />
                        )}
                      </div>
                      <div className="flex justify-between mt-2 text-xs">
                        <span className="text-emerald-400">
                          Known: {lastCompletedSession.knownCount} ({knownPct}%)
                        </span>
                        <span className="text-red-400">
                          Problems: {lastCompletedSession.problemCount} ({problemPct}%)
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={regenerateLastSession}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-500 transition-colors"
                >
                  Regenerate This Session
                </button>
                {(() => {
                  const total = lastCompletedSession.totalWords;
                  const knownPct = total > 0 ? Math.round((lastCompletedSession.knownCount / total) * 100) : 0;
                  const allWordsKnown = lastCompletedSession.words.every(word => word.status === 'known');
                  const isUnlocked = knownPct === 100 && allWordsKnown;
                  
                  return (
                    <button
                      type="button"
                      onClick={() => setTestSessionWords(lastCompletedSession!.words)}
                      disabled={!isUnlocked}
                      className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                        isUnlocked
                          ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                          : 'bg-gray-600 text-gray-400 cursor-not-allowed opacity-50'
                      }`}
                      title={!isUnlocked ? 'Achieve 100% score and mark all words as known to unlock Test Session' : 'Test your knowledge by writing sentences'}
                    >
                      <span className="inline-flex items-center gap-2">
                        {!isUnlocked && (
                          <img src="/lock.svg" alt="" className="w-4 h-4 opacity-90 shrink-0" aria-hidden />
                        )}
                        Test Session
                      </span>
                    </button>
                  );
                })()}
              </div>
            </div>
          )}

          <div className="space-y-3">
            {/* All Words Option */}
            <label
              className={`flex flex-col p-4 rounded-lg border cursor-pointer transition-colors ${
                filterType === 'all'
                  ? 'bg-emerald-600/20 border-emerald-500'
                  : 'bg-gray-700/50 border-gray-600 hover:bg-gray-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="filterType"
                    value="all"
                    checked={filterType === 'all'}
                    onChange={() => {
                      setFilterType('all');
                      setAllWordsProgressFilter('all');
                    }}
                    className="w-4 h-4 text-emerald-500 bg-gray-700 border-gray-600 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="text-white font-medium">All Words</span>
                    <p className="text-gray-400 text-sm">Review all your vocabulary</p>
                  </div>
                </div>
                <span className="text-emerald-400 bg-emerald-500/20 px-3 py-1 rounded-full text-sm">
                  {filterType === 'all' && allWordsProgressFilter !== 'all'
                    ? filterCounts.allByProgress[allWordsProgressFilter]
                    : filterCounts.all}
                </span>
              </div>
              
              {filterType === 'all' && (
                <div className="mt-4 ml-7 flex items-center gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAllWordsProgressFilter('all');
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-white ${
                      allWordsProgressFilter === 'all'
                        ? 'border-emerald-500 bg-emerald-500/20 hover:bg-emerald-500/30'
                        : 'border-gray-600 bg-gray-800/50 hover:bg-gray-800'
                    }`}
                  >
                    <span className="text-sm">All</span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      allWordsProgressFilter === 'all'
                        ? 'bg-emerald-500/30 text-white'
                        : 'bg-gray-700 text-white'
                    }`}>
                      {filterCounts.allByProgress.all}
                    </span>
                  </button>
                  
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAllWordsProgressFilter('moderate');
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-white ${
                      allWordsProgressFilter === 'moderate'
                        ? 'border-emerald-500 bg-emerald-500/20 hover:bg-emerald-500/30'
                        : 'border-gray-600 bg-gray-800/50 hover:bg-gray-800'
                    }`}
                  >
                    <span className="text-sm">Moderate</span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      allWordsProgressFilter === 'moderate'
                        ? 'bg-emerald-500/30 text-white'
                        : 'bg-gray-700 text-white'
                    }`}>
                      {filterCounts.allByProgress.moderate}
                    </span>
                  </button>
                  
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAllWordsProgressFilter('hard');
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-white ${
                      allWordsProgressFilter === 'hard'
                        ? 'border-emerald-500 bg-emerald-500/20 hover:bg-emerald-500/30'
                        : 'border-gray-600 bg-gray-800/50 hover:bg-gray-800'
                    }`}
                  >
                    <span className="text-sm">Hard</span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      allWordsProgressFilter === 'hard'
                        ? 'bg-emerald-500/30 text-white'
                        : 'bg-gray-700 text-white'
                    }`}>
                      {filterCounts.allByProgress.hard}
                    </span>
                  </button>
                  
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAllWordsProgressFilter('very hard');
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-white ${
                      allWordsProgressFilter === 'very hard'
                        ? 'border-emerald-500 bg-emerald-500/20 hover:bg-emerald-500/30'
                        : 'border-gray-600 bg-gray-800/50 hover:bg-gray-800'
                    }`}
                  >
                    <span className="text-sm">Very Hard</span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      allWordsProgressFilter === 'very hard'
                        ? 'bg-emerald-500/30 text-white'
                        : 'bg-gray-700 text-white'
                    }`}>
                      {filterCounts.allByProgress['very hard']}
                    </span>
                  </button>
                </div>
              )}
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
                {filterCounts.new}
              </span>
            </label>

            {/* Problem Words Option */}
            <label
              className={`flex flex-col p-4 rounded-lg border cursor-pointer transition-colors ${
                filterType === 'problem'
                  ? 'bg-red-600/20 border-red-500'
                  : 'bg-gray-700/50 border-gray-600 hover:bg-gray-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="filterType"
                    value="problem"
                    checked={filterType === 'problem'}
                    onChange={() => {
                      setFilterType('problem');
                      setProblemProgressFilter('all');
                    }}
                    className="w-4 h-4 text-red-500 bg-gray-700 border-gray-600 focus:ring-red-500"
                  />
                  <div>
                    <span className="text-white font-medium">Problem Words Only</span>
                    <p className="text-gray-400 text-sm">Focus on words you struggle with</p>
                  </div>
                </div>
                <span className="text-red-400 bg-red-500/20 px-3 py-1 rounded-full text-sm">
                  {filterType === 'problem' && problemProgressFilter !== 'all'
                    ? filterCounts.problemByProgress[problemProgressFilter]
                    : filterCounts.problem}
                </span>
              </div>
              
              {filterType === 'problem' && (
                <div className="mt-4 ml-7 flex items-center gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setProblemProgressFilter('all');
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-white ${
                      problemProgressFilter === 'all'
                        ? 'border-red-500 bg-red-500/20 hover:bg-red-500/30'
                        : 'border-gray-600 bg-gray-800/50 hover:bg-gray-800'
                    }`}
                  >
                    <span className="text-sm">All</span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      problemProgressFilter === 'all'
                        ? 'bg-red-500/30 text-white'
                        : 'bg-gray-700 text-white'
                    }`}>
                      {filterCounts.problemByProgress.all}
                    </span>
                  </button>
                  
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setProblemProgressFilter('moderate');
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-white ${
                      problemProgressFilter === 'moderate'
                        ? 'border-red-500 bg-red-500/20 hover:bg-red-500/30'
                        : 'border-gray-600 bg-gray-800/50 hover:bg-gray-800'
                    }`}
                  >
                    <span className="text-sm">Moderate</span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      problemProgressFilter === 'moderate'
                        ? 'bg-red-500/30 text-white'
                        : 'bg-gray-700 text-white'
                    }`}>
                      {filterCounts.problemByProgress.moderate}
                    </span>
                  </button>
                  
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setProblemProgressFilter('hard');
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-white ${
                      problemProgressFilter === 'hard'
                        ? 'border-red-500 bg-red-500/20 hover:bg-red-500/30'
                        : 'border-gray-600 bg-gray-800/50 hover:bg-gray-800'
                    }`}
                  >
                    <span className="text-sm">Hard</span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      problemProgressFilter === 'hard'
                        ? 'bg-red-500/30 text-white'
                        : 'bg-gray-700 text-white'
                    }`}>
                      {filterCounts.problemByProgress.hard}
                    </span>
                  </button>
                  
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setProblemProgressFilter('very hard');
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-white ${
                      problemProgressFilter === 'very hard'
                        ? 'border-red-500 bg-red-500/20 hover:bg-red-500/30'
                        : 'border-gray-600 bg-gray-800/50 hover:bg-gray-800'
                    }`}
                  >
                    <span className="text-sm">Very Hard</span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      problemProgressFilter === 'very hard'
                        ? 'bg-red-500/30 text-white'
                        : 'bg-gray-700 text-white'
                    }`}>
                      {filterCounts.problemByProgress['very hard']}
                    </span>
                  </button>
                </div>
              )}
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
                  {getDateRangeCount()}
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
                          {opt.label} ({count})
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </label>
          </div>

          {/* Number of words */}
          <div className="mt-4 p-4 rounded-lg border border-gray-600 bg-gray-700/30">
            <label className="block text-white font-medium mb-2">Number of words</label>
            <p className="text-gray-400 text-sm mb-3">
              Random words per session (applies to All, New, Problem, and By Date). Default 20.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <input
                type="number"
                min={1}
                value={sessionSize}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  setSessionSize(Number.isNaN(v) || v < 1 ? 20 : v);
                }}
                onBlur={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (Number.isNaN(v) || v < 1) setSessionSize(20);
                }}
                className="w-24 bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="text-gray-400 text-sm">
                {getSelectedFilterCount() > 0
                  ? `Session will use ${getEffectiveSessionSize()} of ${getSelectedFilterCount()} available`
                  : 'Select a filter above'}
              </span>
            </div>
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
              ? `Start Session (${getEffectiveSessionSize()} ${getEffectiveSessionSize() === 1 ? 'word' : 'words'})`
              : 'No words match this filter'}
          </button>
        </div>
      </div>
    );
  }

  if (sessionComplete) {
    const total = shuffledWords.length;
    const knownPct = total > 0 ? Math.round((sessionKnownCount / total) * 100) : 0;
    const problemPct = total > 0 ? Math.round((sessionProblemCount / total) * 100) : 0;

    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-white">Flashcards</h2>
        <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <p className="text-2xl font-bold text-white mb-2">Session Complete!</p>
          <p className="text-gray-400 mb-6">
            You've reviewed all {total}.
          </p>

          {/* Summary: counts + percentages */}
          <div className="mb-6 text-left max-w-sm mx-auto space-y-2">
            <p className="text-emerald-400 font-medium">
              {sessionKnownCount} known ({knownPct}%)
            </p>
            <p className="text-red-400 font-medium">
              {sessionProblemCount} need more practice ({problemPct}%)
            </p>
          </div>

          {/* Cool graph: stacked bar (known % | need-practice %) */}
          <div className="mb-8 max-w-md mx-auto">
            <div className="h-8 rounded-full overflow-hidden flex bg-gray-700">
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${knownPct}%` }}
              />
              <div
                className="h-full bg-red-500 transition-all duration-500"
                style={{ width: `${problemPct}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-sm text-gray-400">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                Known
              </span>
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500" />
                Need practice
              </span>
            </div>
          </div>

          <div className="flex gap-4 justify-center">
              {(() => {
                const allWordsKnown = shuffledWords.every(word => word.status === 'known');
                const isUnlocked = knownPct === 100 && allWordsKnown;
                
                return (
                  <button
                    onClick={() => setTestSessionWords(shuffledWords)}
                    disabled={!isUnlocked}
                    className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                      isUnlocked
                        ? 'bg-blue-600 text-white hover:bg-blue-500'
                        : 'bg-gray-600 text-gray-400 cursor-not-allowed opacity-50'
                    }`}
                    title={!isUnlocked ? 'Achieve 100% score and mark all words as known to unlock Test Session' : 'Test your knowledge by writing sentences'}
                  >
                    <span className="inline-flex items-center gap-2">
                      {!isUnlocked && (
                        <img src="/lock.svg" alt="" className="w-5 h-5 opacity-90 shrink-0" aria-hidden />
                      )}
                      Test Session
                    </span>
                  </button>
                );
              })()}
            <button
              onClick={regenerateCurrentSession}
              className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-500 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSpeakWord = () => {
    if (currentWord) speakText(currentWord.english);
  };

  const handleSpeakSentence = () => {
    const firstSentence = currentWord?.exampleSentences?.filter(Boolean)[0];
    if (firstSentence && !isSentenceMuted) {
      speakText(firstSentence);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (!isMuted) speechSynthesis.cancel();
  };

  const toggleSentenceMute = () => {
    setIsSentenceMuted(prev => !prev);
    if (!isSentenceMuted) speechSynthesis.cancel();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-white">Flashcards</h2>
        <div className="flex items-center gap-2">
          {/* Word auto-speak: Mute/Unmute */}
          <button
            onClick={toggleMute}
            className={`p-2 rounded-lg transition-colors ${
              isMuted 
                ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30' 
                : 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30'
            }`}
            title={isMuted ? 'Unmute word auto-speak' : 'Mute word auto-speak'}
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

      {/* Streak Achievement Message */}
      {showStreakMessage && (
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl p-6 border border-orange-400/50 shadow-lg animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-4xl">🔥</div>
              <div>
                <p className="text-white font-bold text-xl">Streak Achieved!</p>
                <p className="text-orange-100 text-sm mt-1">
                  You've completed 20 reviews today! Your streak is now {streak?.currentStreak || 1} day{streak?.currentStreak !== 1 ? 's' : ''}.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowStreakMessage(false)}
              className="text-white hover:text-orange-100 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

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

      {/* Flashcard: key so next word appears immediately (no flip animation on advance); flip animation only when revealing this card */}
      <div
        onClick={handleFlip}
        className="relative h-80 cursor-pointer perspective-1000"
      >
        <div
          key={currentIndex}
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
                    handleSpeakWord();
                  }}
                  className="p-2 rounded-full bg-gray-700 hover:bg-emerald-600 text-gray-300 hover:text-white transition-colors"
                  title="Listen to word"
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
              <div className="text-gray-300 text-lg italic mb-4 space-y-2">
                {(currentWord?.exampleSentences ?? []).filter(Boolean).map((sent, i) => (
                  <p key={i}>
                    &quot;{currentWord?.english
                      ? highlightWordInSentence(sent, currentWord.english)
                      : sent}&quot;
                  </p>
                ))}
                {(!currentWord?.exampleSentences || currentWord.exampleSentences.every(s => !s?.trim())) && <p className="text-gray-500">—</p>}
              </div>
              {/* Sentence speak: mute/unmute and play (inside card) */}
              <div className="flex items-center justify-center gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
                <button
                  onClick={toggleSentenceMute}
                  className={`p-2 rounded-full transition-colors ${
                    isSentenceMuted
                      ? 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                      : 'bg-amber-600/20 text-amber-400 hover:bg-amber-600/30'
                  }`}
                  title={isSentenceMuted ? 'Enable sentence auto-speak' : 'Mute sentence auto-speak'}
                >
                  {isSentenceMuted ? (
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
                <span className="text-gray-500 text-sm">{isSentenceMuted ? 'Sentence speak off' : 'Sentence speak on'}</span>
                {!isSentenceMuted && (
                  <button
                    onClick={handleSpeakSentence}
                    className="p-2 rounded-full bg-gray-700 hover:bg-amber-600 text-gray-300 hover:text-white transition-colors"
                    title="Play sentence again"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Keyboard shortcut hint (always available) */}
      <p className="text-center text-gray-500 text-sm">
        Shortcuts: ← I don't know · → I know · ↓ Flip card
      </p>

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
