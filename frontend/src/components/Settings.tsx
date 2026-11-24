import { useEffect, useState } from 'react';
import TelegramSettings from './TelegramSettings';
import SettingsSection, { SettingsSwitch } from './SettingsSection';
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

  const enabled = backupSchedule?.active ?? false;
  const {
    cadence: savedCadence,
    timeOfDay: savedTime,
    dayOfWeek: savedWeekday,
    dayOfMonth: savedMonthDay,
    timezone: savedTimezone,
    destinationPath: savedDestination,
  } = backupSchedule ?? {};
  const [cadence, setCadence] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [timeOfDay, setTimeOfDay] = useState('03:00');
  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [destinationPath, setDestinationPath] = useState('');
  const [isLoadingBackup, setIsLoadingBackup] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isSavingStreakGoal, setIsSavingStreakGoal] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [streakGoalMessage, setStreakGoalMessage] = useState<string | null>(null);
  const [streakGoal, setStreakGoal] = useState(MIN_STREAK_DAILY_GOAL);
  const [isSavingProblemStreakGoal, setIsSavingProblemStreakGoal] = useState(false);
  const [problemStreakGoalMessage, setProblemStreakGoalMessage] = useState<string | null>(null);
  const [problemStreakGoalInput, setProblemStreakGoalInput] = useState(DEFAULT_PROBLEM_STREAK_GOAL);

  useEffect(() => {
    void loadBackupSchedule().finally(() => setIsLoadingBackup(false));
    void loadStreakDailyGoal();
    void loadProblemStreakGoal();
  }, [loadBackupSchedule, loadStreakDailyGoal, loadProblemStreakGoal]);

  useEffect(() => {
    if (savedCadence) setCadence(savedCadence);
    if (savedTime) setTimeOfDay(savedTime);
    setDayOfWeek(savedWeekday ?? 0);
    setDayOfMonth(savedMonthDay ?? 1);
    if (savedTimezone) setTimezone(savedTimezone);
    const destination = savedDestination ?? backupDefaultDestinationPath;
    if (destination) setDestinationPath(destination);
  }, [savedCadence, savedTime, savedWeekday, savedMonthDay, savedTimezone, savedDestination, backupDefaultDestinationPath]);

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
    setIsSaving(true);
    setMessage(null);
    try {
      const ok = backupSchedule
        ? await setBackupScheduleActive(nextActive)
        : await saveBackupSchedule({
          cadence,
          timezone,
          timeOfDay,
          dayOfWeek: cadence === 'weekly' ? dayOfWeek : undefined,
          dayOfMonth: cadence === 'monthly' ? dayOfMonth : undefined,
          destinationPath,
          active: nextActive,
        });
      if (ok) {
        setMessage({ ok, text: nextActive ? 'Automatic backup turned on.' : 'Automatic backup turned off.' });
      } else {
        setMessage({ ok, text: 'Failed to update automatic backup. Try again.' });
      }
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
    setMessage({ ok, text: ok ? 'Backup schedule saved.' : 'Failed to save backup schedule.' });
    setIsSaving(false);
  };

  const handleBackupNow = async () => {
    setIsBackingUp(true);
    setMessage(null);
    try {
      const result = await runBackupNow(destinationPath.trim() || undefined);
      setMessage({
        ok: result.ok,
        text: result.ok ? 'Backup completed and uploaded to Google Drive.' : result.message ?? 'Backup failed.',
      });
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

  const backupSummary = [
    enabled ? 'Automatic backup on' : 'Automatic backup off',
    enabled && backupSchedule?.nextRunAt && `Next: ${formatRunDate(backupSchedule.nextRunAt)}`,
    backupRunStatus.lastRun?.status === 'failed' ? 'Last backup failed'
      : !enabled && backupRunStatus.lastSuccess && `Last backup: ${formatRunDate(backupRunStatus.lastSuccess.completedAt)}`,
  ].filter(Boolean).join(' · ');

  return (
    <div className="space-y-6">
      <TelegramSettings />

      <SettingsSection
        id="backup"
        title="Google Drive Backup"
        summary={isLoadingBackup ? 'Loading backup schedule…' : backupSummary}
        action={
          <SettingsSwitch
            label="Automatic Google Drive backup"
            checked={enabled}
            onChange={active => void handleToggle(active)}
            disabled={isLoadingBackup || isSaving || isBackingUp || (!backupSchedule && !destinationPath.trim())}
          />
        }
        feedback={
          message && (
            <p role={message.ok ? 'status' : 'alert'} className={message.ok ? 'text-emerald-300' : 'text-red-300'}>
              {message.text}
            </p>
          )
        }
      >
        {error && !message && <p role="alert" className="text-sm text-red-300">{error}</p>}

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
            disabled={isLoadingBackup || isSaving || isBackingUp || !destinationPath.trim()}
            className={`px-5 py-3 rounded-lg font-medium transition-colors ${
              isLoadingBackup || isSaving || isBackingUp || !destinationPath.trim()
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-emerald-600 text-white hover:bg-emerald-500'
            }`}
          >
            {isSaving ? 'Saving...' : 'Save Backup Settings'}
          </button>

          <button
            type="button"
            onClick={() => void handleBackupNow()}
            disabled={isLoadingBackup || isBackingUp || isSaving || !destinationPath.trim()}
            className={`px-5 py-3 rounded-lg font-medium transition-colors ${
              isLoadingBackup || isBackingUp || isSaving || !destinationPath.trim()
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-500'
            }`}
          >
            {isBackingUp ? 'Backing up...' : 'Backup Now'}
          </button>
        </div>
      </SettingsSection>

      <SettingsSection
        id="daily-streak"
        title="Daily Streak Goal"
        summary={`${streakDailyGoal} reviews per day to keep your streak`}
      >
        <p className="text-sm text-gray-400">
          Number of reviews needed per day to count toward your streak (minimum {MIN_STREAK_DAILY_GOAL}).
        </p>

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
      </SettingsSection>

      <SettingsSection
        id="problem-streak"
        title="Problem Word Streak"
        summary={problemStreakGoal <= 1
          ? 'First correct answer clears a problem word'
          : `${problemStreakGoal} correct answers in a row to clear a problem word`}
      >
        <p className="text-sm text-gray-400">
          How many times in a row you must answer a problem word correctly before it becomes known. Set to 0 for no streak (becomes known on the first correct answer). Max {MAX_PROBLEM_STREAK_GOAL}.
        </p>

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
      </SettingsSection>
    </div>
  );
}
