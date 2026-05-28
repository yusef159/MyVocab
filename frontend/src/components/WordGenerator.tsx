import { useState, useEffect } from 'react';
import { useVocabStore } from '../stores/vocabStore';
import WordSelector from './WordSelector';

const WORD_LEVELS: readonly { value: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'; label: string }[] = [
  { value: 'A1', label: 'A1' },
  { value: 'A2', label: 'A2' },
  { value: 'B1', label: 'B1' },
  { value: 'B2', label: 'B2' },
  { value: 'C1', label: 'C1' },
  { value: 'C2', label: 'C2' },
];

const WEEKDAY_OPTIONS: readonly { value: number; label: string }[] = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

function formatRunDate(value?: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

export default function WordGenerator() {
  const [count, setCount] = useState(5);
  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState<'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'>('B2');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoPrompt, setAutoPrompt] = useState('Provide common words that people use every day.');
  const [autoCount, setAutoCount] = useState(3);
  const [autoCadence, setAutoCadence] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [autoTimeOfDay, setAutoTimeOfDay] = useState('09:00');
  const [autoDayOfWeek, setAutoDayOfWeek] = useState(1);
  const [autoDayOfMonth, setAutoDayOfMonth] = useState(1);
  const [autoTimezone, setAutoTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  );
  const [autoSaveMessage, setAutoSaveMessage] = useState<string | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  const {
    suggestions,
    isSuggestingLoading,
    error,
    autoSchedule,
    autoScheduleRuns,
    generateWords,
    saveWord,
    clearSuggestions,
    loadAutoSchedule,
    saveAutoSchedule,
    setAutoScheduleActive,
    loadAutoScheduleRuns,
  } = useVocabStore();

  const handleGenerate = () => {
    setCurrentIndex(0);
    generateWords(count, topic || undefined, level);
  };

  useEffect(() => {
    if (!saveMessage) return;
    const t = setTimeout(() => setSaveMessage(null), 3000);
    return () => clearTimeout(t);
  }, [saveMessage]);

  useEffect(() => {
    if (!autoSaveMessage) return;
    const t = setTimeout(() => setAutoSaveMessage(null), 3000);
    return () => clearTimeout(t);
  }, [autoSaveMessage]);

  useEffect(() => {
    void loadAutoSchedule();
    void loadAutoScheduleRuns(10);
  }, [loadAutoSchedule, loadAutoScheduleRuns]);

  useEffect(() => {
    if (!autoSchedule) return;
    setAutoEnabled(autoSchedule.active);
    setAutoPrompt(autoSchedule.prompt);
    setAutoCount(autoSchedule.count);
    setAutoCadence(autoSchedule.cadence);
    setAutoTimezone(autoSchedule.timezone);
    setAutoTimeOfDay(autoSchedule.timeOfDay);
    setAutoDayOfWeek(autoSchedule.dayOfWeek ?? 1);
    setAutoDayOfMonth(autoSchedule.dayOfMonth ?? 1);
  }, [autoSchedule]);

  const handleSave = async (
    english: string,
    arabicMeanings: string[],
    exampleSentences: string[],
    wordTopic?: string
  ) => {
    const result = await saveWord(english, arabicMeanings, exampleSentences, wordTopic);
    if (result.success) {
      setSaveMessage('Word saved successfully!');
      moveToNext();
    }
    // On failure, store error is set (e.g. duplicate or "Failed to save word") and shown below
  };

  const moveToNext = () => {
    if (currentIndex < suggestions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      clearSuggestions();
      setCurrentIndex(0);
    }
  };

  const handleAutoToggle = async (checked: boolean) => {
    setAutoEnabled(checked);
    if (!autoSchedule) return;

    setIsAutoSaving(true);
    await setAutoScheduleActive(checked);
    await loadAutoSchedule();
    await loadAutoScheduleRuns(10);
    setAutoSaveMessage(checked ? 'Auto schedule turned on.' : 'Auto schedule turned off.');
    setIsAutoSaving(false);
  };

  const handleSaveAutoSchedule = async () => {
    setIsAutoSaving(true);
    const ok = await saveAutoSchedule({
      prompt: autoPrompt,
      count: autoCount,
      cadence: autoCadence,
      timezone: autoTimezone,
      timeOfDay: autoTimeOfDay,
      dayOfWeek: autoCadence === 'weekly' ? autoDayOfWeek : undefined,
      dayOfMonth: autoCadence === 'monthly' ? autoDayOfMonth : undefined,
      active: autoEnabled,
    });
    await loadAutoSchedule();
    await loadAutoScheduleRuns(10);
    setAutoSaveMessage(ok ? 'Auto schedule changes applied.' : 'Failed to apply auto schedule changes.');
    setIsAutoSaving(false);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl sm:text-3xl font-bold text-white">Generate Words</h2>

      <div className="bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-700 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white">Auto Generate</h3>
            <p className="text-sm text-gray-400">
              Automatically generate and save unique words on a schedule.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={autoEnabled}
            onClick={() => void handleAutoToggle(!autoEnabled)}
            className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${
              autoEnabled ? 'bg-emerald-500' : 'bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                autoEnabled ? 'translate-x-8' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {autoSchedule?.active && (
          <p className="text-sm text-emerald-300">
            Next run: {formatRunDate(autoSchedule.nextRunAt)}
          </p>
        )}

        {autoSaveMessage && (
          <div className="p-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-sm">
            {autoSaveMessage}
          </div>
        )}

        {autoEnabled && (
          <div className="space-y-4 pt-2 border-t border-gray-700">
            <div>
              <label className="block text-gray-400 text-sm uppercase tracking-wide mb-2">
                Prompt
              </label>
              <textarea
                value={autoPrompt}
                onChange={(e) => setAutoPrompt(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                placeholder="Describe what words to generate automatically..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-gray-400 text-sm uppercase tracking-wide mb-2">
                  Words per run (max 3 auto, app max 20)
                </label>
                <input
                  type="number"
                  min={1}
                  max={3}
                  value={autoCount}
                  onChange={(e) => setAutoCount(Math.min(3, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                  className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm uppercase tracking-wide mb-2">
                  Timezone
                </label>
                <input
                  type="text"
                  value={autoTimezone}
                  onChange={(e) => setAutoTimezone(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-gray-400 text-sm uppercase tracking-wide mb-2">
                  Cadence
                </label>
                <select
                  value={autoCadence}
                  onChange={(e) => setAutoCadence(e.target.value as 'daily' | 'weekly' | 'monthly')}
                  className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-400 text-sm uppercase tracking-wide mb-2">
                  Time (24h)
                </label>
                <input
                  type="time"
                  value={autoTimeOfDay}
                  onChange={(e) => setAutoTimeOfDay(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {autoCadence === 'weekly' && (
              <div>
                <label className="block text-gray-400 text-sm uppercase tracking-wide mb-2">
                  Weekday
                </label>
                <select
                  value={autoDayOfWeek}
                  onChange={(e) => setAutoDayOfWeek(parseInt(e.target.value, 10))}
                  className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:border-emerald-500"
                >
                  {WEEKDAY_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {autoCadence === 'monthly' && (
              <div>
                <label className="block text-gray-400 text-sm uppercase tracking-wide mb-2">
                  Day of month
                </label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={autoDayOfMonth}
                  onChange={(e) => setAutoDayOfMonth(Math.min(31, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                  className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}

            <button
              type="button"
              onClick={() => void handleSaveAutoSchedule()}
            disabled={isAutoSaving}
            className={`px-5 py-3 rounded-lg font-medium transition-colors ${
              isAutoSaving
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-emerald-600 text-white hover:bg-emerald-500'
            }`}
            >
            {isAutoSaving ? 'Saving...' : 'Save Auto Schedule'}
            </button>

            {autoScheduleRuns.length > 0 && (
              <div className="pt-2">
                <p className="text-sm text-gray-400 mb-2">Recent auto runs</p>
                <div className="space-y-2">
                  {autoScheduleRuns.slice(0, 3).map((run) => (
                    <div
                      key={run.id}
                      className="text-sm bg-gray-700/60 border border-gray-600 rounded-lg px-3 py-2 text-gray-200"
                    >
                      {formatRunDate(run.startedAt)} - {run.status} - saved {run.savedCount} / generated{' '}
                      {run.generatedCount}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {suggestions.length === 0 ? (
        <div className="bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-700">
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
              Topic
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. technology, travel, food (optional)"
              className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Word Level */}
          <div className="mb-6">
            <span className="block text-gray-400 text-sm uppercase tracking-wide mb-3">
              Word level
            </span>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              {WORD_LEVELS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                    level === opt.value
                      ? 'border-emerald-500 bg-emerald-500/20 text-white'
                      : 'border-gray-600 bg-gray-700/50 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  <input
                    type="radio"
                    name="wordLevel"
                    value={opt.value}
                    checked={level === opt.value}
                    onChange={() => setLevel(opt.value)}
                    className="sr-only"
                  />
                  <span className="font-medium">{opt.label}</span>
                </label>
              ))}
            </div>
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
          {saveMessage && (
            <div className="mb-4 p-4 bg-emerald-500/20 border border-emerald-500/50 rounded-lg text-emerald-400 flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {saveMessage}
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
          {/* Progress Indicator */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-gray-400">
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
