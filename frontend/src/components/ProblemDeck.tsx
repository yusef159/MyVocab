import { useState, useEffect, useCallback } from 'react';
import { useVocabStore } from '../stores/vocabStore';
import type { Word } from '../types';

// Fisher-Yates shuffle algorithm
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function ProblemDeck() {
  const {
    problemWords,
    isLoading,
    loadProblemWords,
    markProblemAsKnown,
    markProblemAsStillProblem,
  } = useVocabStore();
  
  const [shuffledWords, setShuffledWords] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);

  useEffect(() => {
    loadProblemWords();
  }, [loadProblemWords]);

  useEffect(() => {
    if (problemWords.length > 0) {
      setShuffledWords(shuffleArray(problemWords));
      setCurrentIndex(0);
      setIsFlipped(false);
      setSessionComplete(false);
    }
  }, [problemWords]);

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
      await markProblemAsKnown(currentWord.id);
      moveToNext();
    }
  };

  const handleStillDontKnow = async () => {
    if (currentWord) {
      await markProblemAsStillProblem(currentWord.id);
      moveToNext();
    }
  };

  const restartSession = () => {
    loadProblemWords();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <svg className="animate-spin h-8 w-8 text-red-500" viewBox="0 0 24 24">
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

  if (problemWords.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-white">Problem Words</h2>
        <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 text-center">
          <div className="text-6xl mb-4">✨</div>
          <p className="text-2xl font-bold text-white mb-2">No Problem Words!</p>
          <p className="text-gray-400">
            Great job! You don't have any problem words to review.
          </p>
        </div>
      </div>
    );
  }

  if (sessionComplete) {
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-white">Problem Words</h2>
        <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 text-center">
          <div className="text-6xl mb-4">💪</div>
          <p className="text-2xl font-bold text-white mb-2">Session Complete!</p>
          <p className="text-gray-400 mb-6">
            You've reviewed all {shuffledWords.length} problem words.
          </p>
          <button
            onClick={restartSession}
            className="px-8 py-4 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-500 transition-colors"
          >
            Review Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-white">Problem Words</h2>

      {/* Progress */}
      <div className="flex items-center justify-between text-gray-400 mb-2">
        <span>
          Card {currentIndex + 1} of {shuffledWords.length}
        </span>
        <span className="text-sm text-red-400">
          Wrong: {currentWord?.wrongCount} | Correct: {currentWord?.correctCount}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-red-500 transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / shuffledWords.length) * 100}%` }}
        />
      </div>

      {/* Flashcard */}
      <div
        onClick={handleFlip}
        className="relative h-80 cursor-pointer perspective-1000"
      >
        <div
          className={`absolute inset-0 transition-transform duration-500 transform-style-preserve-3d`}
          style={{
            transformStyle: 'preserve-3d',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl border border-red-500/30 flex items-center justify-center"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="text-center p-8">
              <div className="absolute top-4 right-4 px-3 py-1 bg-red-500/20 rounded-full text-red-400 text-sm">
                Problem Word
              </div>
              <p className="text-4xl font-bold text-white mb-4">
                {currentWord?.english}
              </p>
              <p className="text-gray-500 text-sm">Click to reveal</p>
            </div>
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 bg-gradient-to-br from-red-900/50 to-gray-900 rounded-2xl border border-red-500/30 flex items-center justify-center"
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
          onClick={handleStillDontKnow}
          className="flex-1 px-6 py-4 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-500 transition-colors"
        >
          Still Don't Know
        </button>
        <button
          onClick={handleKnow}
          className="flex-1 px-6 py-4 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-500 transition-colors"
        >
          I Know Now
        </button>
      </div>
    </div>
  );
}
