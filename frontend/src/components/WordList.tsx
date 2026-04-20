import { useState, useEffect, useRef } from 'react';
import { useVocabStore } from '../stores/vocabStore';
import * as XLSX from 'xlsx';
import type { Word, WordReviewEvent } from '../types';
import { MAX_EXAMPLE_SENTENCES } from '../types';
import { exportFullBackup, exportLegacyIndexedDbBackup, importFullBackup } from '../db';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

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

function WordHistoryTooltip(props: any) {
  const { active, payload } = props;
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload as {
    index: number;
    score: number;
    result: 'known' | 'problem';
    knownCount: number;
    wrongCount: number;
    totalReviews: number;
    createdAt: Date;
  };
  const date =
    point.createdAt instanceof Date
      ? point.createdAt
      : new Date(point.createdAt);
  const dateLabel = isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
  const timeLabel = dateLabel;
  const resultColor = point.result === 'known' ? '#6ee7b7' : '#fca5a5';

  return (
    <div
      style={{
        backgroundColor: '#111827',
        border: '1px solid #4b5563',
        borderRadius: '8px',
        padding: '8px 12px',
      }}
    >
      <p style={{ color: '#e5e7eb', margin: 0, marginBottom: 4 }}>
        Review #{point.index}
        {timeLabel && ` • ${timeLabel}`}
      </p>
      <p style={{ color: resultColor, margin: 0, fontSize: 12 }}>
        Result: {point.result === 'known' ? 'Known' : "Didn't know"}
      </p>
      <p style={{ color: '#d1d5db', margin: 0, fontSize: 12 }}>
        Known: {point.knownCount} · Didn&apos;t know: {point.wrongCount}
      </p>
      <p style={{ color: '#d1d5db', margin: 0, fontSize: 12 }}>
        Total reviews: {point.totalReviews}
      </p>
      <p style={{ color: '#6ee7b7', margin: 0, fontSize: 12 }}>
        Learning: {point.score}%
      </p>
    </div>
  );
}

function WordInfoModal({ wordId, onClose }: WordInfoModalProps) {
  const word = useVocabStore((s) => (wordId ? s.words.find((w) => w.id === wordId) ?? null : null));
  const {
    updateWordContent,
    suggestMeanings,
    clearSuggestions,
    updateWordReviewCounts,
    getWordReviewHistory,
  } = useVocabStore();
  const suggestions = useVocabStore((s) => s.suggestions);
  const isSuggestingLoading = useVocabStore((s) => s.isSuggestingLoading);

  const [mode, setMode] = useState<WordInfoModalMode>('view');
  const [editMeanings, setEditMeanings] = useState<string[]>([]);
  const [editSentences, setEditSentences] = useState<string[]>(['', '', '']);
  const [selectedMeaningIndices, setSelectedMeaningIndices] = useState<number[]>([]);
  const [selectedSentenceIndices, setSelectedSentenceIndices] = useState<Set<number>>(new Set());
  const [isEditingCounts, setIsEditingCounts] = useState(false);
  const [editCorrectCount, setEditCorrectCount] = useState(0);
  const [editWrongCount, setEditWrongCount] = useState(0);
  const [reviewHistory, setReviewHistory] = useState<WordReviewEvent[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const wordSentences = word?.exampleSentences?.filter(Boolean) ?? [];

  useEffect(() => {
    if (!wordId) return;
    if (word) {
      setEditMeanings([...word.arabicMeanings]);
      const s = (word.exampleSentences ?? []).filter(Boolean);
      setEditSentences([s[0] ?? '', s[1] ?? '', s[2] ?? '']);
      setEditCorrectCount(word.correctCount);
      setEditWrongCount(word.wrongCount);
      setIsEditingCounts(false);
    }
  }, [wordId, word?.id, word?.arabicMeanings, word?.exampleSentences]);

  useEffect(() => {
    let cancelled = false;
    const loadHistory = async () => {
      if (!word) {
        setReviewHistory([]);
        return;
      }
      setIsHistoryLoading(true);
      try {
        const history = await getWordReviewHistory(word.id);
        if (!cancelled) {
          setReviewHistory(history);
        }
      } finally {
        if (!cancelled) {
          setIsHistoryLoading(false);
        }
      }
    };
    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, [word?.id, word?.correctCount, word?.wrongCount, getWordReviewHistory, word]);

  useEffect(() => {
    if (mode !== 'suggest') clearSuggestions();
  }, [mode, clearSuggestions]);

  const handleGetSuggestions = async () => {
    if (!word) return;
    setMode('suggest');
    setSelectedMeaningIndices([]);
    setSelectedSentenceIndices(new Set());
    await suggestMeanings(word.english);
  };

  useEffect(() => {
    if (mode === 'suggest' && suggestions[0]) {
      setSelectedMeaningIndices((prev) => (prev.length === 0 ? [0] : prev));
      setSelectedSentenceIndices((prev) => (prev.size === 0 ? new Set([0]) : prev));
    }
  }, [mode, suggestions]);

  const handleSaveEdit = async () => {
    if (!word) return;
    const meanings = editMeanings.filter((m) => m.trim());
    const sentences = editSentences.map((s) => s.trim()).filter(Boolean).slice(0, MAX_EXAMPLE_SENTENCES);
    if (meanings.length === 0 || sentences.length === 0) return;
    await updateWordContent(word.id, meanings, sentences);
    setMode('view');
  };

  const toggleSentenceIndex = (index: number) => {
    setSelectedSentenceIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else if (next.size < MAX_EXAMPLE_SENTENCES) next.add(index);
      return next;
    });
  };

  const handleApplySuggestions = async () => {
    if (!word) return;
    const s = suggestions[0];
    if (!s || selectedMeaningIndices.length === 0 || selectedSentenceIndices.size === 0) return;
    const meanings = selectedMeaningIndices.map((i) => s.arabicMeanings[i]).filter(Boolean);
    const sentences = Array.from(selectedSentenceIndices)
      .sort((a, b) => a - b)
      .slice(0, MAX_EXAMPLE_SENTENCES)
      .map((i) => s.exampleSentences[i])
      .filter(Boolean);
    await updateWordContent(word.id, meanings, sentences);
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

  const effectiveCorrect = isEditingCounts ? editCorrectCount : word.correctCount;
  const effectiveWrong = isEditingCounts ? editWrongCount : word.wrongCount;
  const learningPercentage = calculateLearningPercentage(effectiveCorrect, effectiveWrong);
  const totalReviews = effectiveCorrect + effectiveWrong;
  const suggestion = suggestions[0];

  const chartData = (() => {
    const history = reviewHistory ?? [];
    const correctInEvents = history.filter((e) => e.result === 'known').length;
    const wrongInEvents = history.filter((e) => e.result === 'problem').length;
    const syntheticWrong = Math.max(0, word.wrongCount - wrongInEvents);
    const syntheticCorrect = Math.max(0, word.correctCount - correctInEvents);

    const points: Array<{
      index: number;
      score: number;
      result: 'known' | 'problem';
      knownCount: number;
      wrongCount: number;
      totalReviews: number;
      createdAt: Date;
    }> = [];
    let known = 0;
    let wrong = 0;

    // 1. Synthetic: didn't know first (older problem reviews before tracking)
    for (let i = 0; i < syntheticWrong; i++) {
      wrong += 1;
      const total = known + wrong;
      const score = total === 0 ? 0 : Math.round((known / total) * 100);
      points.push({
        index: points.length + 1,
        score,
        result: 'problem',
        knownCount: known,
        wrongCount: wrong,
        totalReviews: total,
        createdAt: word.createdAt instanceof Date ? word.createdAt : new Date(word.createdAt),
      });
    }
    // 2. Synthetic: known next (older correct reviews before tracking)
    for (let i = 0; i < syntheticCorrect; i++) {
      known += 1;
      const total = known + wrong;
      const score = Math.round((known / total) * 100);
      points.push({
        index: points.length + 1,
        score,
        result: 'known',
        knownCount: known,
        wrongCount: wrong,
        totalReviews: total,
        createdAt: word.createdAt instanceof Date ? word.createdAt : new Date(word.createdAt),
      });
    }
    // 3. Real events (tracked reviews with actual dates)
    for (const event of history) {
      if (event.result === 'known') known += 1;
      else wrong += 1;
      const total = known + wrong;
      const score = Math.round((known / total) * 100);
      points.push({
        index: points.length + 1,
        score,
        result: event.result,
        knownCount: known,
        wrongCount: wrong,
        totalReviews: total,
        createdAt: event.createdAt instanceof Date ? event.createdAt : new Date(event.createdAt),
      });
    }
    return points;
  })();

  const handleSaveCounts = async () => {
    if (!word) return;
    const safeCorrect = Math.max(0, Math.floor(editCorrectCount));
    const safeWrong = Math.max(0, Math.floor(editWrongCount));
    await updateWordReviewCounts(word.id, safeCorrect, safeWrong);
    setIsEditingCounts(false);
  };

  const handleCancelCounts = () => {
    setEditCorrectCount(word.correctCount);
    setEditWrongCount(word.wrongCount);
    setIsEditingCounts(false);
  };

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
              <p className="text-gray-400 text-xs uppercase tracking-wide mt-2 mb-1">Example sentence(s)</p>
              <div className="space-y-1">
                {wordSentences.map((sent, i) => (
                  <p key={i} className="text-gray-400 italic">"{sent}"</p>
                ))}
                {wordSentences.length === 0 && <p className="text-gray-500 italic">—</p>}
              </div>
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
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">Example sentence(s) (up to {MAX_EXAMPLE_SENTENCES})</p>
            <div className="space-y-2 mb-4">
              {editSentences.map((sent, i) => (
                <textarea
                  key={i}
                  value={sent}
                  onChange={(e) => setEditSentences((prev) => prev.map((s, j) => (j === i ? e.target.value : s)))}
                  className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-2 min-h-[60px]"
                  placeholder={i === 0 ? 'Example sentence' : `Optional sentence ${i + 1}`}
                />
              ))}
            </div>
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
                disabled={editMeanings.every((m) => !m.trim()) || !editSentences.some((s) => s.trim())}
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
                <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">Select Example Sentence(s) (up to {MAX_EXAMPLE_SENTENCES})</p>
                <div className="space-y-2 mb-4">
                  {suggestion.exampleSentences.map((sent, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleSentenceIndex(i)}
                      className={`w-full text-left p-3 rounded-lg border transition-all flex items-center justify-between ${
                        selectedSentenceIndices.has(i)
                          ? 'border-amber-500 bg-amber-500/20 text-white'
                          : 'border-gray-600 bg-gray-700/50 text-gray-300 hover:border-gray-500'
                      }`}
                    >
                      <span className="text-sm">"{sent}"</span>
                      {selectedSentenceIndices.has(i) && <span className="text-amber-400">✓</span>}
                    </button>
                  ))}
                </div>
                {selectedSentenceIndices.size > 0 && (
                  <p className="text-amber-400 text-sm mb-2">{selectedSentenceIndices.size} sentence(s) selected</p>
                )}
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
                    disabled={selectedMeaningIndices.length === 0 || selectedSentenceIndices.size === 0}
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

        {/* Learning Progress & review stats - show in view mode only */}
        {mode === 'view' && (
          <>
            <div className="mb-6">
              <div className="flex items-center justify-end mb-2">
                <span className={`font-bold ${learningPercentage >= 70 ? 'text-emerald-400' : learningPercentage >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {learningPercentage}%
                </span>
              </div>
              <div 
                className="h-3 bg-gray-700 rounded-full overflow-hidden cursor-pointer"
                title="LEARNING PROGRESS"
              >
                <div
                  className={`h-full transition-all duration-500 ${learningPercentage >= 70 ? 'bg-emerald-500' : learningPercentage >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${learningPercentage}%` }}
                />
              </div>
            </div>

            <div className="mt-4 mb-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-gray-400 text-xs uppercase tracking-wide">
                  Performance history
                </p>
                {chartData.length > 0 && (
                  <span className="text-[10px] text-gray-500">
                    Higher line = more known reviews over time
                  </span>
                )}
              </div>
              <div className="bg-gray-900/40 border border-gray-700 rounded-lg p-3 h-48 flex items-center justify-center">
                {isHistoryLoading ? (
                  <p className="text-gray-500 text-sm">Loading history...</p>
                ) : chartData.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center">
                    No tracked reviews yet. Practice this word in flashcards to build your performance chart with dates.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData}
                      margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                    >
                      <CartesianGrid
                        stroke="rgba(55,65,81,0.6)"
                        strokeDasharray="3 3"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="index"
                        tick={{ fill: '#9ca3af', fontSize: 10 }}
                        axisLine={{ stroke: '#4b5563' }}
                        tickLine={{ stroke: '#4b5563' }}
                      />
                      <YAxis
                        tick={{ fill: '#9ca3af', fontSize: 10 }}
                        axisLine={{ stroke: '#4b5563' }}
                        tickLine={{ stroke: '#4b5563' }}
                        allowDecimals={false}
                        domain={[0, 100]}
                        width={36}
                        tickMargin={4}
                      />
                      <RechartsTooltip content={<WordHistoryTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={(props: any) => {
                          const { cx, cy, payload } = props;
                          const isProblem = payload?.result === 'problem';
                          const stroke = isProblem ? '#f87171' : '#10b981'; // red for \"didn't know\", green for known
                          const fill = isProblem ? '#7f1d1d' : '#020617';
                          return (
                            <circle
                              cx={cx}
                              cy={cy}
                              r={3}
                              stroke={stroke}
                              strokeWidth={1}
                              fill={fill}
                            />
                          );
                        }}
                        activeDot={(props: any) => {
                          const { cx, cy, payload } = props;
                          const isProblem = payload?.result === 'problem';
                          const stroke = isProblem ? '#f87171' : '#10b981';
                          const fill = isProblem ? '#7f1d1d' : '#022c22';
                          return (
                            <circle
                              cx={cx}
                              cy={cy}
                              r={5}
                              stroke={stroke}
                              strokeWidth={2}
                              fill={fill}
                            />
                          );
                        }}
                        isAnimationActive
                        animationDuration={400}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-400 text-xs uppercase tracking-wide">Review Counters</p>
              {!isEditingCounts && (
                <button
                  type="button"
                  onClick={() => setIsEditingCounts(true)}
                  className="text-xs text-emerald-400 hover:text-emerald-300 hover:underline"
                >
                  Edit counts
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-gray-700/50 rounded-lg p-4">
                <p className="text-gray-400 text-xs uppercase tracking-wide">Known Count</p>
                {isEditingCounts ? (
                  <input
                    type="number"
                    min={0}
                    value={editCorrectCount}
                    onChange={(e) => setEditCorrectCount(Math.max(0, Number(e.target.value) || 0))}
                    className="mt-2 w-full bg-gray-800 text-emerald-300 border border-gray-600 rounded-lg px-3 py-1.5 text-lg"
                  />
                ) : (
                  <p className="text-2xl font-bold text-emerald-400">{word.correctCount}</p>
                )}
              </div>
              <div className="bg-gray-700/50 rounded-lg p-4">
                <p className="text-gray-400 text-xs uppercase tracking-wide">Didn't Know</p>
                {isEditingCounts ? (
                  <input
                    type="number"
                    min={0}
                    value={editWrongCount}
                    onChange={(e) => setEditWrongCount(Math.max(0, Number(e.target.value) || 0))}
                    className="mt-2 w-full bg-gray-800 text-red-300 border border-gray-600 rounded-lg px-3 py-1.5 text-lg"
                  />
                ) : (
                  <p className="text-2xl font-bold text-red-400">{word.wrongCount}</p>
                )}
              </div>
            </div>

            {isEditingCounts && (
              <div className="flex justify-between items-center mb-3 text-sm">
                <span className="text-gray-400">Total Reviews (auto)</span>
                <span className="text-white font-semibold">{totalReviews}</span>
              </div>
            )}

            {isEditingCounts && (
              <div className="flex justify-end gap-2 mb-6 text-sm">
                <button
                  type="button"
                  onClick={handleCancelCounts}
                  className="px-3 py-1.5 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCounts}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500"
                >
                  Save counts
                </button>
              </div>
            )}

            {!isEditingCounts && (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <p className="text-gray-400 text-xs uppercase tracking-wide">Total Reviews</p>
                  <p className="mt-2 text-2xl font-bold text-white">{totalReviews}</p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <p className="text-gray-400 text-xs uppercase tracking-wide">Status</p>
                  <p className={`mt-2 text-lg font-bold ${word.status === 'known' ? 'text-emerald-400' : word.status === 'problem' ? 'text-red-400' : 'text-blue-400'}`}>
                    {word.status.charAt(0).toUpperCase() + word.status.slice(1)}
                  </p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <p className="text-gray-400 text-xs uppercase tracking-wide">Date Added</p>
                  <p className="mt-2 text-xl font-bold text-white">{formatDate(word.createdAt)}</p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <p className="text-gray-400 text-xs uppercase tracking-wide">Recent Review</p>
                  <p className={`mt-2 text-xl font-bold ${word.lastReviewedAt ? 'text-white' : 'text-gray-500'}`}>
                    {word.lastReviewedAt ? formatDate(word.lastReviewedAt) : 'Not reviewed yet'}
                  </p>
                </div>
                {word.status === 'problem' && (word.streak || 0) > 0 && (
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <p className="text-gray-400 text-xs uppercase tracking-wide">Streak</p>
                    <p className="mt-2 text-2xl font-bold text-white flex items-center gap-1">
                      <span>🔥</span>
                      <span>{word.streak}/3</span>
                    </p>
                  </div>
                )}
                {word.topic && (
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <p className="text-gray-400 text-xs uppercase tracking-wide">Topic</p>
                    <p className="mt-2 text-xl font-bold text-white">{word.topic}</p>
                  </div>
                )}
              </div>
            )}
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
  const [showLearningFilter, setShowLearningFilter] = useState(false);
  const [learningMin, setLearningMin] = useState(0);
  const [learningMax, setLearningMax] = useState(100);
  const [wordToDelete, setWordToDelete] = useState<Word | null>(null);
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupFileInputRef = useRef<HTMLInputElement>(null);

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
          const s1 = String(r[2] ?? '').trim();
          const s2 = String(r[3] ?? '').trim();
          const s3 = String(r[4] ?? '').trim();
          const exampleSentences = [s1, s2, s3].filter(Boolean).slice(0, MAX_EXAMPLE_SENTENCES);
          return {
            english: String(r[0]).trim(),
            arabicMeanings: [String(r[1]).trim()],
            exampleSentences: exampleSentences.length ? exampleSentences : [''],
          };
        });

      if (wordsToImport.length === 0) {
        setImportMessage({ type: 'error', text: 'No valid words found in the Excel file. Columns: Word, Meaning, Sentence 1 (optional: Sentence 2, Sentence 3).' });
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
      'Example Sentence 1': (word.exampleSentences && word.exampleSentences[0]) || '',
      'Example Sentence 2': (word.exampleSentences && word.exampleSentences[1]) || '',
      'Example Sentence 3': (word.exampleSentences && word.exampleSentences[2]) || '',
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

  const handleBackupExport = async () => {
    try {
      const backup = await exportFullBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const date = new Date().toISOString().split('T')[0];
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `MyVocab_FullBackup_${date}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      setImportMessage({ type: 'success', text: 'Full backup exported successfully.' });
      setTimeout(() => setImportMessage(null), 3000);
    } catch (error) {
      setImportMessage({ type: 'error', text: 'Failed to export full backup.' });
      setTimeout(() => setImportMessage(null), 3000);
    }
  };

  const handleBackupImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const result = await importFullBackup(payload);
      await loadWords();
      setImportMessage({
        type: 'success',
        text: `Backup imported. Words: ${result.imported.words}, reviews: ${result.imported.wordReviewEvents}, grammar skills: ${result.imported.grammarProgress}.`,
      });
      setTimeout(() => setImportMessage(null), 7000);
    } catch (error) {
      setImportMessage({ type: 'error', text: 'Failed to import backup JSON file.' });
      setTimeout(() => setImportMessage(null), 5000);
    }

    if (backupFileInputRef.current) {
      backupFileInputRef.current.value = '';
    }
  };

  const handleMigrateLegacyData = async () => {
    try {
      const legacyBackup = await exportLegacyIndexedDbBackup();
      if (!legacyBackup) {
        setImportMessage({ type: 'error', text: 'No legacy browser IndexedDB data found to migrate.' });
        setTimeout(() => setImportMessage(null), 5000);
        return;
      }

      const result = await importFullBackup(legacyBackup);
      await loadWords();
      setImportMessage({
        type: 'success',
        text: `Legacy browser data migrated to server. Words: ${result.imported.words}, reviews: ${result.imported.wordReviewEvents}.`,
      });
      setTimeout(() => setImportMessage(null), 7000);
    } catch (error) {
      setImportMessage({ type: 'error', text: 'Failed to migrate legacy browser data to server.' });
      setTimeout(() => setImportMessage(null), 5000);
    }
  };

  useEffect(() => {
    loadWords();
  }, [loadWords]);

  const filteredWords = words.filter((word) => {
    const matchesSearch = 
      word.english.toLowerCase().includes(searchQuery.toLowerCase()) ||
      word.arabicMeanings.some(m => m.includes(searchQuery));
    const matchesFilter = filterStatus === 'all' || word.status === filterStatus;
    const pct = calculateLearningPercentage(word.correctCount, word.wrongCount);
    const matchesLearning = pct >= learningMin && pct <= learningMax;
    return matchesSearch && matchesFilter && matchesLearning;
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
        <div className="flex gap-2 flex-wrap justify-end">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImport}
            accept=".xlsx,.xls"
            className="hidden"
          />
          <input
            type="file"
            ref={backupFileInputRef}
            onChange={handleBackupImport}
            accept=".json"
            className="hidden"
          />
          <button
            onClick={handleMigrateLegacyData}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-500 transition-colors"
            title="Migrate legacy browser IndexedDB data to server"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h8m0 0v8m0-8L8 15m-4 4h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Migrate Local Data
          </button>
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
          <button
            onClick={handleBackupExport}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-500 transition-colors"
            title="Export complete backup JSON (words, reviews, streak, grammar)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M5 7l1 13h12l1-13M10 11v6m4-6v6M9 7V4h6v3" />
            </svg>
            Backup JSON
          </button>
          <button
            onClick={() => backupFileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-500 transition-colors"
            title="Import complete backup JSON"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Restore JSON
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

      {/* Learning progress filter (collapsed by default) */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/50">
        <button
          type="button"
          onClick={() => setShowLearningFilter((prev) => !prev)}
          aria-expanded={showLearningFilter}
          aria-controls="learning-progress-filter-panel"
          className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-gray-700/40"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-200">Learning progress filter</span>
          </div>
          <svg
            className={`h-5 w-5 text-gray-400 transition-transform duration-300 ${showLearningFilter ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <div
          id="learning-progress-filter-panel"
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            showLearningFilter ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="flex flex-col gap-3 border-t border-gray-700 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-2">
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-400">
                <span className="w-8 text-gray-500">Min</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={learningMin}
                  onChange={(e) => {
                    const v = Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0)));
                    setLearningMin(v);
                    if (v > learningMax) setLearningMax(v);
                  }}
                  className="w-16 rounded-md border border-gray-600 bg-gray-800 px-2 py-2 text-center text-sm tabular-nums text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                  aria-label="Minimum learning progress percent"
                />
                <span className="text-gray-500">%</span>
              </label>
              <span className="hidden text-gray-600 sm:inline" aria-hidden>
                -
              </span>
              <label className="flex items-center gap-2 text-sm text-gray-400">
                <span className="w-8 text-gray-500">Max</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={learningMax}
                  onChange={(e) => {
                    const v = Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0)));
                    setLearningMax(v);
                    if (v < learningMin) setLearningMin(v);
                  }}
                  className="w-16 rounded-md border border-gray-600 bg-gray-800 px-2 py-2 text-center text-sm tabular-nums text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                  aria-label="Maximum learning progress percent"
                />
                <span className="text-gray-500">%</span>
              </label>
              {(learningMin > 0 || learningMax < 100) && (
                <button
                  type="button"
                  onClick={() => {
                    setLearningMin(0);
                    setLearningMax(100);
                  }}
                  className="text-sm text-gray-400 transition hover:text-emerald-400"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
              {[
                { label: '0', min: 0, max: 0 },
                { label: '0-25', min: 0, max: 25 },
                { label: '25-50', min: 25, max: 50 },
                { label: '50-75', min: 50, max: 75 },
                { label: '75-100', min: 75, max: 100 },
                { label: '100', min: 100, max: 100 },
              ].map((shortcut) => {
                const isActive = learningMin === shortcut.min && learningMax === shortcut.max;
                return (
                  <button
                    key={shortcut.label}
                    type="button"
                    onClick={() => {
                      setLearningMin(shortcut.min);
                      setLearningMax(shortcut.max);
                    }}
                    className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition ${
                      isActive
                        ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300'
                        : 'border-gray-600 bg-gray-800 text-gray-300 hover:border-gray-500 hover:text-white'
                    }`}
                  >
                    {shortcut.label}
                  </button>
                );
              })}
            </div>
          </div>
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

                  {/* Example Sentence(s) */}
                  <div className="text-gray-400 italic text-sm mb-3 space-y-1">
                    {(word.exampleSentences ?? []).filter(Boolean).slice(0, MAX_EXAMPLE_SENTENCES).map((sent, i) => (
                      <p key={i}>"{highlightWord(sent, word.english)}"</p>
                    ))}
                    {(!word.exampleSentences || word.exampleSentences.every(s => !s?.trim())) && <p>—</p>}
                  </div>

                  {/* Learning Progress */}
                  <div className="flex items-center gap-3">
                    <div 
                      className="flex-1 max-w-[120px] h-2 bg-gray-700 rounded-full overflow-hidden cursor-pointer"
                      title="LEARNING PROGRESS"
                    >
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
