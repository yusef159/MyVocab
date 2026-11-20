import { useState, useEffect } from 'react';
import { MAX_EXAMPLE_SENTENCES, type WordSuggestion } from '../types';
import { useVocabStore } from '../stores/vocabStore';

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
    topic?: string,
    englishMeaning?: string
  ) => void;
  onSkip: () => void;
}

export default function WordSelector({
  suggestion,
  topic,
  onSave,
  onSkip,
}: WordSelectorProps) {
  const explainWord = useVocabStore((s) => s.explainWord);
  const clearEnglishExplanation = useVocabStore((s) => s.clearEnglishExplanation);
  const englishExplanationOptions = useVocabStore((s) => s.englishExplanationOptions);
  const isExplainingLoading = useVocabStore((s) => s.isExplainingLoading);

  const [selectedMeanings, setSelectedMeanings] = useState<Set<number>>(new Set());
  const [selectedSentenceIndices, setSelectedSentenceIndices] = useState<Set<number>>(new Set());
  const [englishMeaning, setEnglishMeaning] = useState('');
  const [selectedEnglishMeanings, setSelectedEnglishMeanings] = useState<Set<number>>(new Set());
  const explanationOptions = suggestion.englishMeaningOptions?.length
    ? suggestion.englishMeaningOptions
    : englishExplanationOptions;

  useEffect(() => {
    return () => {
      clearEnglishExplanation();
    };
  }, [clearEnglishExplanation]);

  const handleExplainWithAi = async () => {
    setSelectedEnglishMeanings(new Set());
    await explainWord(suggestion.english);
  };

  const toggleEnglishMeaning = (index: number) => {
    setSelectedEnglishMeanings(previous => {
      const next = new Set(previous);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

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
      const explanation = [
        ...Array.from(selectedEnglishMeanings)
          .sort((a, b) => a - b)
          .map(index => explanationOptions[index]),
        englishMeaning.trim(),
      ].filter(Boolean).join('\n');
      onSave(suggestion.english, meanings, sentences, topic, explanation || undefined);
    }
  };

  return (
    <div className="bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-700">
      <h3 className="text-xl sm:text-2xl font-bold text-white mb-6 break-words">{suggestion.english}</h3>

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

      {/* English meanings are optional and none are selected automatically. */}
      <div className="mb-6">
        <p className="text-gray-400 text-sm uppercase tracking-wide mb-2">
          Select English Meaning(s) <span className="text-gray-500 normal-case">(optional)</span>
        </p>
        <p className="text-gray-400 text-sm mb-3">Choose one or more, or leave all unselected.</p>
        <div className="space-y-2 mb-3">
          {explanationOptions.map((option, index) => (
            <button
              key={index}
              type="button"
              aria-pressed={selectedEnglishMeanings.has(index)}
              onClick={() => toggleEnglishMeaning(index)}
              className={`w-full text-left p-4 rounded-lg border transition-all flex items-center justify-between ${
                selectedEnglishMeanings.has(index)
                  ? 'border-amber-500 bg-amber-500/20 text-white'
                  : 'border-gray-600 bg-gray-700/50 text-gray-300 hover:border-gray-500'
              }`}
            >
              <span className="text-base">{option}</span>
              {selectedEnglishMeanings.has(index) && <span className="text-amber-400 ml-2" aria-hidden="true">&#10003;</span>}
            </button>
          ))}
        </div>
        {selectedEnglishMeanings.size > 0 && (
          <p className="text-amber-400 text-sm mb-3">
            {selectedEnglishMeanings.size} English meaning{selectedEnglishMeanings.size > 1 ? 's' : ''} selected
          </p>
        )}
        <label htmlFor="custom-english-meaning" className="block text-gray-400 text-sm mb-2">
          Add your own explanation (optional)
        </label>
        <textarea
          id="custom-english-meaning"
          value={englishMeaning}
          onChange={(e) => setEnglishMeaning(e.target.value)}
          placeholder="A short explanation of what the word means in English..."
          className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 mb-3"
          rows={2}
        />
        {explanationOptions.length === 0 && (
          <button
            type="button"
            onClick={() => void handleExplainWithAi()}
            disabled={isExplainingLoading}
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-500 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExplainingLoading ? 'Getting explanations...' : 'Explain with AI'}
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
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
