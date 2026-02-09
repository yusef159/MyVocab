import { useState, useEffect, useRef } from 'react';
import { useVocabStore } from '../stores/vocabStore';
import * as XLSX from 'xlsx';
import type { Word } from '../types';

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

function speakWord(word: string) {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    speechSynthesis.speak(utterance);
  }
}

function formatDate(date: Date): string {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function calculateLearningPercentage(correctCount: number, wrongCount: number): number {
  const total = correctCount + wrongCount;
  if (total === 0) return 0;
  return Math.round((correctCount / total) * 100);
}

type WordInfoModalMode = 'view' | 'edit' | 'suggest';

interface WordInfoModalProps {
  wordId: string | null;
  onClose: () => void;
}

function WordInfoModal({ wordId, onClose }: WordInfoModalProps) {
  const word = useVocabStore((s) => (wordId ? s.words.find((w) => w.id === wordId) ?? null : null));
  const { updateWordContent, suggestMeanings, clearSuggestions } = useVocabStore();
  const suggestions = useVocabStore((s) => s.suggestions);
  const isSuggestingLoading = useVocabStore((s) => s.isSuggestingLoading);

  const [mode, setMode] = useState<WordInfoModalMode>('view');
  const [editMeanings, setEditMeanings] = useState<string[]>([]);
  const [editSentence, setEditSentence] = useState('');
  const [selectedMeaningIndices, setSelectedMeaningIndices] = useState<number[]>([]);
  const [selectedSentenceIndex, setSelectedSentenceIndex] = useState<number>(0);

  useEffect(() => {
    if (!wordId) return;
    if (word) {
      setEditMeanings([...word.arabicMeanings]);
      setEditSentence(word.exampleSentence);
    }
  }, [wordId, word?.id, word?.arabicMeanings, word?.exampleSentence]);

  useEffect(() => {
    if (mode !== 'suggest') clearSuggestions();
  }, [mode, clearSuggestions]);

  const handleGetSuggestions = async () => {
    if (!word) return;
    setMode('suggest');
    setSelectedMeaningIndices([]);
    setSelectedSentenceIndex(0);
    await suggestMeanings(word.english);
  };

  useEffect(() => {
    if (mode === 'suggest' && suggestions[0]) {
      setSelectedMeaningIndices((prev) => (prev.length === 0 ? [0] : prev));
      setSelectedSentenceIndex((prev) => (suggestions[0].exampleSentences[prev] === undefined ? 0 : prev));
    }
  }, [mode, suggestions]);

  const handleSaveEdit = async () => {
    if (!word) return;
    const meanings = editMeanings.filter((m) => m.trim());
    if (meanings.length === 0 || !editSentence.trim()) return;
    await updateWordContent(word.id, meanings, editSentence.trim());
    setMode('view');
  };

  const handleApplySuggestions = async () => {
    if (!word) return;
    const s = suggestions[0];
    if (!s || selectedMeaningIndices.length === 0 || !s.exampleSentences[selectedSentenceIndex]) return;
    const meanings = selectedMeaningIndices.map((i) => s.arabicMeanings[i]).filter(Boolean);
    const sentence = s.exampleSentences[selectedSentenceIndex];
    await updateWordContent(word.id, meanings, sentence);
    setMode('view');
    clearSuggestions();
  };

  const addMeaningField = () => setEditMeanings((prev) => [...prev, '']);
  const removeMeaningField = (index: number) => setEditMeanings((prev) => prev.filter((_, i) => i !== index));
  const setMeaningAt = (index: number, value: string) =>
    setEditMeanings((prev) => prev.map((m, i) => (i === index ? value : m)));

  const toggleMeaningIndex = (index: number) => {
    setSelectedMeaningIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index].sort((a, b) => a - b)
    );
  };

  if (!wordId || !word) return null;

  const learningPercentage = calculateLearningPercentage(word.correctCount, word.wrongCount);
  const totalReviews = word.correctCount + word.wrongCount;
  const suggestion = suggestions[0];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-gray-800 rounded-xl p-6 max-w-md w-full border border-gray-700 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white">{word.english}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {mode === 'view' && (
          <>
            {/* Meanings & sentence in view */}
            <div className="mb-4">
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Arabic meanings</p>
              <div className="bg-gray-700/50 rounded-lg p-3" dir="rtl">
                {word.arabicMeanings.map((m, i) => (
                  <p key={i} className="text-white text-lg">
                    {m}
                  </p>
                ))}
              </div>
              <p className="text-gray-400 text-xs uppercase tracking-wide mt-2 mb-1">Example sentence</p>
              <p className="text-gray-200 italic">"{word.exampleSentence}"</p>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mb-6">
              <button
                type="button"
                onClick={() => setMode('edit')}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-600 text-gray-200 hover:bg-gray-700 transition-colors text-sm font-medium"
              >
                Edit manually
              </button>
              <button
                type="button"
                onClick={handleGetSuggestions}
                className="flex-1 px-3 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-500 transition-colors text-sm font-medium"
              >
                Get AI suggestions
              </button>
            </div>
          </>
        )}

        {mode === 'edit' && (
          <div className="mb-6">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">Arabic meanings</p>
            <div className="space-y-2 mb-4">
              {editMeanings.map((m, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={m}
                    onChange={(e) => setMeaningAt(i, e.target.value)}
                    className="flex-1 bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-2"
                    dir="rtl"
                    placeholder="Meaning"
                  />
                  <button
                    type="button"
                    onClick={() => removeMeaningField(i)}
                    className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg"
                    title="Remove"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addMeaningField}
                className="text-sm text-emerald-400 hover:underline"
              >
                + Add meaning
              </button>
            </div>
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">Example sentence</p>
            <textarea
              value={editSentence}
              onChange={(e) => setEditSentence(e.target.value)}
              className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-2 min-h-[80px]"
              placeholder="Example sentence"
            />
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => setMode('view')}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={editMeanings.every((m) => !m.trim()) || !editSentence.trim()}
                className="flex-1 px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save
              </button>
            </div>
          </div>
        )}

        {mode === 'suggest' && (
          <div className="mb-6">
            {isSuggestingLoading ? (
              <div className="flex items-center justify-center py-8">
                <svg className="animate-spin h-8 w-8 text-amber-500" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : suggestion ? (
              <>
                <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">
                  Select Arabic Meaning(s) <span className="text-amber-400">• Select one or more</span>
                </p>
                <div className="space-y-2 mb-4">
                  {suggestion.arabicMeanings.map((m, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleMeaningIndex(i)}
                      className={`w-full text-right p-3 rounded-lg border transition-all flex items-center justify-between ${
                        selectedMeaningIndices.includes(i)
                          ? 'border-amber-500 bg-amber-500/20 text-white'
                          : 'border-gray-600 bg-gray-700/50 text-gray-300 hover:border-gray-500'
                      }`}
                      dir="rtl"
                    >
                      <span className="text-base">{m}</span>
                      {selectedMeaningIndices.includes(i) && (
                        <span className="text-amber-400 ml-2">✓</span>
                      )}
                    </button>
                  ))}
                </div>
                {selectedMeaningIndices.length > 0 && (
                  <p className="text-amber-400 text-sm mb-4">
                    {selectedMeaningIndices.length} meaning{selectedMeaningIndices.length > 1 ? 's' : ''} selected
                  </p>
                )}
                <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">Select Example Sentence</p>
                <div className="space-y-2 mb-4">
                  {suggestion.exampleSentences.map((sent, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedSentenceIndex(i)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        selectedSentenceIndex === i
                          ? 'border-amber-500 bg-amber-500/20 text-white'
                          : 'border-gray-600 bg-gray-700/50 text-gray-300 hover:border-gray-500'
                      }`}
                    >
                      <span className="text-sm">"{sent}"</span>
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setMode('view'); clearSuggestions(); }}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleApplySuggestions}
                    disabled={selectedMeaningIndices.length === 0}
                    className="flex-1 px-3 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Apply
                  </button>
                </div>
              </>
            ) : (
              <p className="text-gray-400 py-4">No suggestions. Try again.</p>
            )}
          </div>
        )}

        {/* Learning Progress - show in view mode only */}
        {mode === 'view' && (
          <>
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Learning Progress</span>
                <span className={`font-bold ${learningPercentage >= 70 ? 'text-emerald-400' : learningPercentage >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {learningPercentage}%
                </span>
              </div>
              <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${learningPercentage >= 70 ? 'bg-emerald-500' : learningPercentage >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${learningPercentage}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-700/50 rounded-lg p-4">
                <p className="text-gray-400 text-xs uppercase tracking-wide">Known Count</p>
                <p className="text-2xl font-bold text-emerald-400">{word.correctCount}</p>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-4">
                <p className="text-gray-400 text-xs uppercase tracking-wide">Didn't Know</p>
                <p className="text-2xl font-bold text-red-400">{word.wrongCount}</p>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Total Reviews</span>
                <span className="text-white">{totalReviews}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Status</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${word.status === 'known' ? 'bg-emerald-500/20 text-emerald-400' : word.status === 'problem' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
                  {word.status.charAt(0).toUpperCase() + word.status.slice(1)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Date Added</span>
                <span className="text-white">{formatDate(word.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Recent Review</span>
                <span className={word.lastReviewedAt ? 'text-white' : 'text-gray-500'}>
                  {word.lastReviewedAt ? formatDate(word.lastReviewedAt) : 'Not reviewed yet'}
                </span>
              </div>
              {word.status === 'problem' && (word.streak || 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Streak</span>
                  <span className="text-white flex items-center gap-1">
                    <span>🔥</span>
                    <span>{word.streak}/3</span>
                  </span>
                </div>
              )}
              {word.topic && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Topic</span>
                  <span className="text-white">{word.topic}</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function WordList() {
  const { words, isLoading, loadWords, removeWord, importWords } = useVocabStore();
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'known' | 'problem' | 'new'>('all');
  const [wordToDelete, setWordToDelete] = useState<Word | null>(null);
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDelete = async (word: Word) => {
    await removeWord(word.id);
    setWordToDelete(null);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet, { header: 1 });
      
      // Skip header row if it exists
      const startIndex = jsonData.length > 0 && 
        (String(jsonData[0][0]).toLowerCase().includes('word') || 
         String(jsonData[0][0]).toLowerCase().includes('english')) ? 1 : 0;
      
      const wordsToImport = jsonData.slice(startIndex)
        .filter((row: unknown) => Array.isArray(row) && row[0] && row[1] && row[2])
        .map((row: unknown) => {
          const r = row as string[];
          return {
            english: String(r[0]).trim(),
            arabicMeanings: [String(r[1]).trim()],
            exampleSentence: String(r[2]).trim(),
          };
        });

      if (wordsToImport.length === 0) {
        setImportMessage({ type: 'error', text: 'No valid words found in the Excel file. Make sure it has 3 columns: Word, Meaning, Sentence.' });
        return;
      }

      const result = await importWords(wordsToImport);
      
      if (result.added === 0 && result.skipped > 0) {
        setImportMessage({ 
          type: 'error', 
          text: `All ${result.skipped} words already exist in your vocabulary.` 
        });
      } else if (result.skipped > 0) {
        setImportMessage({ 
          type: 'success', 
          text: `Imported ${result.added} words. Skipped ${result.skipped} duplicate(s): ${result.skippedWords.slice(0, 5).join(', ')}${result.skippedWords.length > 5 ? '...' : ''}` 
        });
      } else {
        setImportMessage({ type: 'success', text: `Successfully imported ${result.added} words!` });
      }
      
      // Clear the message after 7 seconds (longer to read if there are skipped words)
      setTimeout(() => setImportMessage(null), 7000);
    } catch (error) {
      setImportMessage({ type: 'error', text: 'Failed to import file. Make sure it\'s a valid Excel file.' });
    }
    
    // Reset the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleExport = () => {
    if (words.length === 0) {
      setImportMessage({ type: 'error', text: 'No words to export!' });
      setTimeout(() => setImportMessage(null), 3000);
      return;
    }

    const exportData = words.map(word => ({
      'Word': word.english,
      'Meaning (Arabic)': word.arabicMeanings.join(', '),
      'Example Sentence': word.exampleSentence,
      'Status': word.status,
      'Correct Count': word.correctCount,
      'Wrong Count': word.wrongCount,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'My Words');
    
    // Generate filename with date
    const date = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `MyVocab_Words_${date}.xlsx`);
    
    setImportMessage({ type: 'success', text: `Exported ${words.length} words to Excel!` });
    setTimeout(() => setImportMessage(null), 3000);
  };

  useEffect(() => {
    loadWords();
  }, [loadWords]);

  const filteredWords = words.filter((word) => {
    const matchesSearch = 
      word.english.toLowerCase().includes(searchQuery.toLowerCase()) ||
      word.arabicMeanings.some(m => m.includes(searchQuery));
    const matchesFilter = filterStatus === 'all' || word.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <svg className="animate-spin h-8 w-8 text-emerald-500" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-white">My Words</h2>
        
        {/* Import/Export Buttons */}
        <div className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImport}
            accept=".xlsx,.xls"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
            title="Import from Excel"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors"
            title="Export to Excel"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>
        </div>
      </div>

      {/* Import/Export Message */}
      {importMessage && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${
          importMessage.type === 'success' 
            ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400'
            : 'bg-red-500/20 border border-red-500/50 text-red-400'
        }`}>
          {importMessage.type === 'success' ? (
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          {importMessage.text}
        </div>
      )}

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search words..."
            className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'known', 'problem', 'new'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterStatus === status
                  ? status === 'known' ? 'bg-emerald-600 text-white' :
                    status === 'problem' ? 'bg-red-600 text-white' :
                    status === 'new' ? 'bg-blue-600 text-white' :
                    'bg-gray-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Word Count */}
      <p className="text-gray-400">
        Showing {filteredWords.length} of {words.length} words
      </p>

      {/* Words List */}
      {filteredWords.length === 0 ? (
        <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 text-center">
          {words.length === 0 ? (
            <>
              <p className="text-gray-400 text-lg">No words saved yet!</p>
              <p className="text-gray-500 mt-2">
                Start by generating words or adding them manually.
              </p>
            </>
          ) : (
            <p className="text-gray-400 text-lg">No words match your search.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredWords.map((word) => {
            const learningPct = calculateLearningPercentage(word.correctCount, word.wrongCount);
            return (
            <div
              key={word.id}
              className="bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-gray-600 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                {/* Word Content */}
                <div className="flex-1 min-w-0">
                  {/* English Word with Speaker */}
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-white">{word.english}</h3>
                    <button
                      onClick={() => speakWord(word.english)}
                      className="p-2 rounded-full bg-gray-700 hover:bg-emerald-600 text-gray-300 hover:text-white transition-colors"
                      title="Listen to pronunciation"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      </svg>
                    </button>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      word.status === 'known' ? 'bg-emerald-500/20 text-emerald-400' :
                      word.status === 'problem' ? 'bg-red-500/20 text-red-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {word.status}
                    </span>
                  </div>

                  {/* Arabic Meanings */}
                  <div className="mb-2" dir="rtl">
                    <p className="text-lg text-gray-200">
                      {word.arabicMeanings.join(' • ')}
                    </p>
                  </div>

                  {/* Example Sentence */}
                  <p className="text-gray-400 italic text-sm mb-3">
                    "{highlightWord(word.exampleSentence, word.english)}"
                  </p>

                  {/* Learning Progress */}
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500 text-xs uppercase tracking-wide">Learning progress</span>
                    <div className="flex-1 max-w-[120px] h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          learningPct >= 80 ? 'bg-emerald-500' :
                          learningPct >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${learningPct}%` }}
                      />
                    </div>
                    <span className={`text-sm font-medium tabular-nums ${
                      learningPct >= 80 ? 'text-emerald-400' :
                      learningPct >= 40 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {learningPct}%
                    </span>
                    {/* Fire Streak Icon - only show for problem words with streak > 0 */}
                    {word.status === 'problem' && (word.streak || 0) > 0 && (
                      <div className="flex items-center gap-1" title={`Streak: ${word.streak}/3`}>
                        <span className="text-lg">🔥</span>
                        <span className="text-orange-500 font-bold text-sm">{word.streak}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => setSelectedWordId(word.id)}
                    className="p-2 rounded-full bg-gray-700 hover:bg-blue-600 text-gray-300 hover:text-white transition-colors"
                    title="View details"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setWordToDelete(word)}
                    className="p-2 rounded-full bg-gray-700 hover:bg-red-600 text-gray-300 hover:text-white transition-colors"
                    title="Delete word"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          );
          })}
        </div>
      )}

      {/* Info Modal */}
      {selectedWordId && (
        <WordInfoModal wordId={selectedWordId} onClose={() => setSelectedWordId(null)} />
      )}

      {/* Delete Confirmation Modal */}
      {wordToDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setWordToDelete(null)}>
          <div 
            className="bg-gray-800 rounded-xl p-6 max-w-sm w-full border border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Delete Word</h3>
              <p className="text-gray-400 mb-6">
                Are you sure you want to delete "<span className="text-white font-semibold">{wordToDelete.english}</span>"? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setWordToDelete(null)}
                  className="flex-1 px-4 py-3 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(wordToDelete)}
                  className="flex-1 px-4 py-3 rounded-lg bg-red-600 text-white hover:bg-red-500 transition-colors font-semibold"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
