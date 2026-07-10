import { useEffect, useState } from 'react';
import { useVocabStore } from '../stores/vocabStore';
import { MIN_STREAK_DAILY_GOAL, MIN_PROBLEM_STREAK_GOAL, MAX_PROBLEM_STREAK_GOAL, DEFAULT_PROBLEM_STREAK_GOAL } from '../db';

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

export default function Settings() {
  const {
    backupSchedule,
    backupDefaultDestinationPath,
    backupRunStatus,
    error,
    loadBackupSchedule,
    loadStreakDailyGoal,
    loadProblemStreakGoal,
    runBackupNow,
    saveBackupSchedule,
    saveStreakDailyGoal,
    saveProblemStreakGoal,
    setBackupScheduleActive,
    streakDailyGoal,
    problemStreakGoal,
  } = useVocabStore();

  const [enabled, setEnabled] = useState(false);
  const [cadence, setCadence] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [timeOfDay, setTimeOfDay] = useState('03:00');
  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [destinationPath, setDestinationPath] = useState('');
  const [expandedPanel, setExpandedPanel] = useState<'backup' | null>('backup');
  const [isSaving, setIsSaving] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isSavingStreakGoal, setIsSavingStreakGoal] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [streakGoalMessage, setStreakGoalMessage] = useState<string | null>(null);
  const [streakGoal, setStreakGoal] = useState(MIN_STREAK_DAILY_GOAL);
  const [isSavingProblemStreakGoal, setIsSavingProblemStreakGoal] = useState(false);
  const [problemStreakGoalMessage, setProblemStreakGoalMessage] = useState<string | null>(null);
  const [problemStreakGoalInput, setProblemStreakGoalInput] = useState(DEFAULT_PROBLEM_STREAK_GOAL);

  useEffect(() => {
    void loadBackupSchedule();
    void loadStreakDailyGoal();
    void loadProblemStreakGoal();
  }, [loadBackupSchedule, loadStreakDailyGoal, loadProblemStreakGoal]);

  useEffect(() => {
    if (backupSchedule) {
      setEnabled(backupSchedule.active);
      setCadence(backupSchedule.cadence);
      setTimeOfDay(backupSchedule.timeOfDay);
      setDayOfWeek(backupSchedule.dayOfWeek ?? 0);
      setDayOfMonth(backupSchedule.dayOfMonth ?? 1);
      setTimezone(backupSchedule.timezone);
      setDestinationPath(backupSchedule.destinationPath);
      return;
    }
    if (backupDefaultDestinationPath) {
      setDestinationPath(backupDefaultDestinationPath);
    }
  }, [backupSchedule, backupDefaultDestinationPath]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    setStreakGoal(streakDailyGoal);
  }, [streakDailyGoal]);

  useEffect(() => {
    setProblemStreakGoalInput(problemStreakGoal);
  }, [problemStreakGoal]);

  useEffect(() => {
    if (!streakGoalMessage) return;
    const timer = setTimeout(() => setStreakGoalMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [streakGoalMessage]);

  useEffect(() => {
    if (!problemStreakGoalMessage) return;
    const timer = setTimeout(() => setProblemStreakGoalMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [problemStreakGoalMessage]);

  const handleToggle = async (nextActive: boolean) => {
    setEnabled(nextActive);
    setIsSaving(true);
    try {
      if (backupSchedule) {
        await setBackupScheduleActive(nextActive);
      } else {
        const ok = await saveBackupSchedule({
          cadence,
          timezone,
          timeOfDay,
          dayOfWeek: cadence === 'weekly' ? dayOfWeek : undefined,
          dayOfMonth: cadence === 'monthly' ? dayOfMonth : undefined,
          destinationPath,
          active: nextActive,
        });
        if (!ok) {
          setEnabled(false);
        }
      }
      await loadBackupSchedule();
      setMessage(nextActive ? 'Automatic backup turned on.' : 'Automatic backup turned off.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    const ok = await saveBackupSchedule({
      cadence,
      timezone,
      timeOfDay,
      dayOfWeek: cadence === 'weekly' ? dayOfWeek : undefined,
      dayOfMonth: cadence === 'monthly' ? dayOfMonth : undefined,
      destinationPath,
      active: enabled,
    });
    await loadBackupSchedule();
    setMessage(ok ? 'Backup schedule saved.' : 'Failed to save backup schedule.');
    setIsSaving(false);
  };

  const handleBackupNow = async () => {
    setIsBackingUp(true);
    setMessage(null);
    try {
      const result = await runBackupNow(destinationPath.trim() || undefined);
      if (result.ok) {
        setMessage('Backup completed and uploaded to Google Drive.');
      } else {
        setMessage(result.message ?? 'Backup failed.');
      }
      await loadBackupSchedule();
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleSaveStreakGoal = async () => {
    const normalizedGoal = Math.max(MIN_STREAK_DAILY_GOAL, Math.floor(streakGoal || MIN_STREAK_DAILY_GOAL));
    setIsSavingStreakGoal(true);
    const ok = await saveStreakDailyGoal(normalizedGoal);
    if (ok) {
      await loadStreakDailyGoal();
      setStreakGoalMessage('Daily streak goal saved.');
    } else {
      setStreakGoalMessage('Failed to save daily streak goal.');
    }
    setIsSavingStreakGoal(false);
  };

  const handleSaveProblemStreakGoal = async () => {
    const normalizedGoal = Math.min(
      MAX_PROBLEM_STREAK_GOAL,
      Math.max(MIN_PROBLEM_STREAK_GOAL, Math.floor(problemStreakGoalInput ?? DEFAULT_PROBLEM_STREAK_GOAL))
    );
    setIsSavingProblemStreakGoal(true);
    const ok = await saveProblemStreakGoal(normalizedGoal);
    if (ok) {
      await loadProblemStreakGoal();
      setProblemStreakGoalMessage('Problem word streak goal saved.');
    } else {
      setProblemStreakGoalMessage('Failed to save problem word streak goal.');
    }
    setIsSavingProblemStreakGoal(false);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl sm:text-3xl font-bold text-white">Settings</h2>

      <div className="bg-gray-800 rounded-xl border border-gray-700 divide-y divide-gray-700">
        <button
          type="button"
          onClick={() => setExpandedPanel((prev) => (prev === 'backup' ? null : 'backup'))}
          className="w-full px-4 sm:px-6 py-4 text-left flex items-center justify-between hover:bg-gray-700/40 transition-colors"
        >
          <div className="min-w-0">
            <p className="text-base font-semibold text-white">Google Drive Backup</p>
            <p className="text-sm text-gray-400 truncate">
              {enabled ? `On • Next: ${formatRunDate(backupSchedule?.nextRunAt)}` : 'Off'}
            </p>
          </div>
          <svg
            className={`h-5 w-5 text-gray-400 transition-transform ${expandedPanel === 'backup' ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {expandedPanel === 'backup' && (
          <div className="px-4 sm:px-6 py-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-400">Enable automatic backup</p>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                onClick={() => void handleToggle(!enabled)}
                disabled={isSaving}
                className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${
                  enabled ? 'bg-emerald-500' : 'bg-gray-600'
                } ${isSaving ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                    enabled ? 'translate-x-8' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {(message || error) && (
              <div
                className={`p-3 rounded-lg border text-sm ${
                  error && !message
                    ? 'border-red-500/40 bg-red-500/10 text-red-300'
                    : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                }`}
              >
                {message ?? error}
              </div>
            )}

            {(backupRunStatus.lastSuccess || backupRunStatus.lastRun?.status === 'failed') && (
              <div className="space-y-2 rounded-lg border border-gray-700 bg-gray-900/40 p-3">
                {backupRunStatus.lastSuccess && (
                  <p className="text-sm text-emerald-300">
                    Last successful backup: {formatRunDate(backupRunStatus.lastSuccess.completedAt)}
                    {' → '}
                    <span className="font-mono text-emerald-400/90 break-all">
                      {backupRunStatus.lastSuccess.destination}
                    </span>
                  </p>
                )}
                {backupRunStatus.lastRun?.status === 'failed' && (
                  <p className="text-sm text-red-300 break-words">
                    Last backup failed: {formatRunDate(backupRunStatus.lastRun.completedAt)}
                    {backupRunStatus.lastRun.error ? ` — ${backupRunStatus.lastRun.error}` : ''}
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-gray-400 text-sm uppercase tracking-wide mb-2">Google Drive backup path</label>
              <input
                type="text"
                value={destinationPath}
                onChange={(e) => setDestinationPath(e.target.value)}
                placeholder="gdrive:MyVocab backup/myvocab-backup.json"
                className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-gray-400 text-sm uppercase tracking-wide mb-2">Backup every</label>
                <select
                  value={cadence}
                  onChange={(e) => setCadence(e.target.value as 'daily' | 'weekly' | 'monthly')}
                  className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-400 text-sm uppercase tracking-wide mb-2">Time (24h)</label>
                <input
                  type="time"
                  value={timeOfDay}
                  onChange={(e) => setTimeOfDay(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {cadence === 'weekly' && (
              <div>
                <label className="block text-gray-400 text-sm uppercase tracking-wide mb-2">Weekday</label>
                <select
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(parseInt(e.target.value, 10))}
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

            {cadence === 'monthly' && (
              <div>
                <label className="block text-gray-400 text-sm uppercase tracking-wide mb-2">Day of month</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(Math.min(31, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                  className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}

            <div>
              <label className="block text-gray-400 text-sm uppercase tracking-wide mb-2">Timezone</label>
              <input
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={isSaving || isBackingUp || !destinationPath.trim()}
                className={`px-5 py-3 rounded-lg font-medium transition-colors ${
                  isSaving || isBackingUp || !destinationPath.trim()
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-emerald-600 text-white hover:bg-emerald-500'
                }`}
              >
                {isSaving ? 'Saving...' : 'Save Backup Settings'}
              </button>

              <button
                type="button"
                onClick={() => void handleBackupNow()}
                disabled={isBackingUp || isSaving || !destinationPath.trim()}
                className={`px-5 py-3 rounded-lg font-medium transition-colors ${
                  isBackingUp || isSaving || !destinationPath.trim()
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-500'
                }`}
              >
                {isBackingUp ? 'Backing up...' : 'Backup Now'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 sm:p-6 space-y-4">
        <div>
          <p className="text-base font-semibold text-white">Daily Streak Goal</p>
          <p className="text-sm text-gray-400">
            Number of reviews needed per day to count toward your streak (minimum {MIN_STREAK_DAILY_GOAL}).
          </p>
        </div>

        {streakGoalMessage && (
          <div
            className={`p-3 rounded-lg border text-sm ${
              streakGoalMessage.startsWith('Failed')
                ? 'border-red-500/40 bg-red-500/10 text-red-300'
                : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
            }`}
          >
            {streakGoalMessage}
          </div>
        )}

        <div className="max-w-xs">
          <label className="block text-gray-400 text-sm uppercase tracking-wide mb-2">Reviews per day</label>
          <input
            type="number"
            min={MIN_STREAK_DAILY_GOAL}
            value={streakGoal}
            onChange={(e) => setStreakGoal(Math.max(MIN_STREAK_DAILY_GOAL, parseInt(e.target.value, 10) || MIN_STREAK_DAILY_GOAL))}
            className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        <button
          type="button"
          onClick={() => void handleSaveStreakGoal()}
          disabled={isSavingStreakGoal}
          className={`px-5 py-3 rounded-lg font-medium transition-colors ${
            isSavingStreakGoal
              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
              : 'bg-emerald-600 text-white hover:bg-emerald-500'
          }`}
        >
          {isSavingStreakGoal ? 'Saving...' : 'Save Streak Goal'}
        </button>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 sm:p-6 space-y-4">
        <div>
          <p className="text-base font-semibold text-white">Problem Word Streak</p>
          <p className="text-sm text-gray-400">
            How many times in a row you must answer a problem word correctly before it becomes known. Set to 0 for no streak (becomes known on the first correct answer). Max {MAX_PROBLEM_STREAK_GOAL}.
          </p>
        </div>

        {problemStreakGoalMessage && (
          <div
            className={`p-3 rounded-lg border text-sm ${
              problemStreakGoalMessage.startsWith('Failed')
                ? 'border-red-500/40 bg-red-500/10 text-red-300'
                : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
            }`}
          >
            {problemStreakGoalMessage}
          </div>
        )}

        <div className="max-w-md space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-gray-400 text-sm uppercase tracking-wide">Correct answers needed</label>
              <span className="text-white font-semibold tabular-nums">
                {problemStreakGoalInput === 0 ? '0 (no streak)' : problemStreakGoalInput}
              </span>
            </div>
            <input
              type="range"
              min={MIN_PROBLEM_STREAK_GOAL}
              max={MAX_PROBLEM_STREAK_GOAL}
              step={1}
              value={problemStreakGoalInput}
              onChange={(e) => setProblemStreakGoalInput(parseInt(e.target.value, 10))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-600 accent-amber-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0</span>
              <span>{MAX_PROBLEM_STREAK_GOAL}</span>
            </div>
          </div>

          <div>
            <label className="block text-gray-400 text-sm uppercase tracking-wide mb-2">Or type a value</label>
            <input
              type="number"
              min={MIN_PROBLEM_STREAK_GOAL}
              max={MAX_PROBLEM_STREAK_GOAL}
              value={problemStreakGoalInput}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') {
                  setProblemStreakGoalInput(MIN_PROBLEM_STREAK_GOAL);
                  return;
                }
                const parsed = parseInt(raw, 10);
                if (Number.isNaN(parsed)) return;
                setProblemStreakGoalInput(
                  Math.min(MAX_PROBLEM_STREAK_GOAL, Math.max(MIN_PROBLEM_STREAK_GOAL, parsed))
                );
              }}
              className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleSaveProblemStreakGoal()}
          disabled={isSavingProblemStreakGoal}
          className={`px-5 py-3 rounded-lg font-medium transition-colors ${
            isSavingProblemStreakGoal
              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
              : 'bg-emerald-600 text-white hover:bg-emerald-500'
          }`}
        >
          {isSavingProblemStreakGoal ? 'Saving...' : 'Save Problem Streak Goal'}
        </button>
      </div>
    </div>
  );
}
