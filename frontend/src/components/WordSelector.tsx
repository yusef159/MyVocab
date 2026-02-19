import { useState } from 'react';
import { MAX_EXAMPLE_SENTENCES, type WordSuggestion } from '../types';

// Highlight the target word in a sentence
function highlightWord(sentence: string, word: string): React.ReactNode {
  const regex = new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = sentence.split(regex);
  
  return parts.map((part, index) => {
    if (part.toLowerCase() === word.toLowerCase()) {
      return (
        <span key={index} className="text-emerald-400 font-semibold">
          {part}
        </span>
      );
    }
    return part;
  });
}

interface WordSelectorProps {
  suggestion: WordSuggestion;
  topic?: string;
  onSave: (
    english: string,
    arabicMeanings: string[],
    exampleSentences: string[],
    topic?: string
  ) => void;
  onSkip: () => void;
}

export default function WordSelector({
  suggestion,
  topic,
  onSave,
  onSkip,
}: WordSelectorProps) {
  const [selectedMeanings, setSelectedMeanings] = useState<Set<number>>(new Set());
  const [selectedSentenceIndices, setSelectedSentenceIndices] = useState<Set<number>>(new Set());

  const toggleSentence = (index: number) => {
    setSelectedSentenceIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else if (next.size < MAX_EXAMPLE_SENTENCES) next.add(index);
      return next;
    });
  };

  const canSave = selectedMeanings.size > 0 && selectedSentenceIndices.size > 0;

  const toggleMeaning = (index: number) => {
    const newSelected = new Set(selectedMeanings);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedMeanings(newSelected);
  };

  const handleSave = () => {
    if (selectedMeanings.size > 0 && selectedSentenceIndices.size > 0) {
      const meanings = Array.from(selectedMeanings)
        .sort((a, b) => a - b)
        .map(i => suggestion.arabicMeanings[i]);
      const sentences = Array.from(selectedSentenceIndices)
        .sort((a, b) => a - b)
        .slice(0, MAX_EXAMPLE_SENTENCES)
        .map(i => suggestion.exampleSentences[i])
        .filter(Boolean);
      onSave(suggestion.english, meanings, sentences, topic);
    }
  };

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
      <h3 className="text-2xl font-bold text-white mb-6">{suggestion.english}</h3>

      {/* Arabic Meanings */}
      <div className="mb-6">
        <p className="text-gray-400 text-sm uppercase tracking-wide mb-3">
          Select Arabic Meaning(s) <span className="text-emerald-400">• Select one or more</span>
        </p>
        <div className="space-y-2">
          {suggestion.arabicMeanings.map((meaning, index) => (
            <button
              key={index}
              onClick={() => toggleMeaning(index)}
              className={`w-full text-right p-4 rounded-lg border transition-all flex items-center justify-between ${
                selectedMeanings.has(index)
                  ? 'border-emerald-500 bg-emerald-500/20 text-white'
                  : 'border-gray-600 bg-gray-700/50 text-gray-300 hover:border-gray-500'
              }`}
              dir="rtl"
            >
              <span className="text-lg">{meaning}</span>
              {selectedMeanings.has(index) && (
                <span className="text-emerald-400 ml-2">✓</span>
              )}
            </button>
          ))}
        </div>
        {selectedMeanings.size > 0 && (
          <p className="text-emerald-400 text-sm mt-2">
            {selectedMeanings.size} meaning{selectedMeanings.size > 1 ? 's' : ''} selected
          </p>
        )}
      </div>

      {/* Example Sentences (select up to 3) */}
      <div className="mb-6">
        <p className="text-gray-400 text-sm uppercase tracking-wide mb-3">
          Select Example Sentence(s) <span className="text-emerald-400">• Up to {MAX_EXAMPLE_SENTENCES}</span>
        </p>
        <div className="space-y-2">
          {suggestion.exampleSentences.map((sentence, index) => (
            <button
              key={index}
              type="button"
              onClick={() => toggleSentence(index)}
              className={`w-full text-left p-4 rounded-lg border transition-all flex items-center justify-between ${
                selectedSentenceIndices.has(index)
                  ? 'border-emerald-500 bg-emerald-500/20 text-white'
                  : 'border-gray-600 bg-gray-700/50 text-gray-300 hover:border-gray-500'
              }`}
            >
              <span className="text-base">{highlightWord(sentence, suggestion.english)}</span>
              {selectedSentenceIndices.has(index) && (
                <span className="text-emerald-400 ml-2">✓</span>
              )}
            </button>
          ))}
        </div>
        {selectedSentenceIndices.size > 0 && (
          <p className="text-emerald-400 text-sm mt-2">
            {selectedSentenceIndices.size} sentence{selectedSentenceIndices.size > 1 ? 's' : ''} selected
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={onSkip}
          className="flex-1 px-6 py-3 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 transition-colors"
        >
          Skip
        </button>
        <button
          onClick={handleSave}
          disabled={!canSave}
          className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-colors ${
            canSave
              ? 'bg-emerald-600 text-white hover:bg-emerald-500'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          Save Word
        </button>
      </div>
    </div>
  );
}
