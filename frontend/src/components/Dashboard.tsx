import { useEffect, useState, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { getRiskWords } from '../db';
import { useVocabStore } from '../stores/vocabStore';
import QuickQuizzes from './QuickQuizzes';
import WordMastery from './WordMastery';

type ReviewRangeKey =
  | 'today'
  | 'yesterday'
  | 'lastWeek'
  | 'lastMonth'
  | 'last6Months'
  | 'lastYear'
  | 'last2Years'
  | 'allTime';

const REVIEW_RANGE_OPTIONS: { key: ReviewRangeKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'lastWeek', label: 'Last week' },
  { key: 'lastMonth', label: 'Last month' },
  { key: 'last6Months', label: 'Last 6 months' },
  { key: 'lastYear', label: 'Last year' },
  { key: 'last2Years', label: 'Last 2 years' },
  { key: 'allTime', label: 'All time' },
];

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function getRangeDates(key: ReviewRangeKey): { start: string; end: string } | null {
  const now = new Date();
  const today = toDateStr(now);
  const end = today;

  switch (key) {
    case 'today':
      return { start: today, end };
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const start = toDateStr(y);
      return { start, end: start };
    }
    case 'lastWeek': {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      return { start: toDateStr(start), end };
    }
    case 'lastMonth': {
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      return { start: toDateStr(start), end };
    }
    case 'last6Months': {
      const start = new Date(now);
      start.setMonth(start.getMonth() - 6);
      return { start: toDateStr(start), end };
    }
    case 'lastYear': {
      const start = new Date(now);
      start.setFullYear(start.getFullYear() - 1);
      return { start: toDateStr(start), end };
    }
    case 'last2Years': {
      const start = new Date(now);
      start.setFullYear(start.getFullYear() - 2);
      return { start: toDateStr(start), end };
    }
    case 'allTime':
      return null; // handled separately with getEarliestReviewDate
    default:
      return { start: today, end };
  }
}

function formatChartDate(dateStr: string, rangeKey: ReviewRangeKey): string {
  const d = new Date(dateStr + 'T12:00:00');
  if (rangeKey === 'today' || rangeKey === 'yesterday') return dateStr;
  if (rangeKey === 'lastWeek' || rangeKey === 'lastMonth') {
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  }
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
}

function formatDateToDDMMYYYY(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function CustomTooltip(props: any) {
  const { active, payload } = props;
  if (!active || !payload || payload.length === 0) return null;
  
  const data = payload[0].payload as { date: string; count: number };
  const dateStr = formatDateToDDMMYYYY(data.date);
  const count = data.count;
  
  return (
    <div
      style={{
        backgroundColor: '#374151',
        border: '1px solid #4b5563',
        borderRadius: '8px',
        padding: '8px 12px',
      }}
    >
      <p style={{ color: '#e5e7eb', margin: 0, marginBottom: '4px' }}>
        {dateStr}
      </p>
      <p style={{ color: '#e5e7eb', margin: 0 }}>
        {count} reviews
      </p>
    </div>
  );
}

export default function Dashboard() {
  const {
    words,
    loadWords,
    stats,
    streak,
    streakDailyGoal,
    loadStats,
    loadStreak,
    loadStreakDailyGoal,
    reviewCounts,
    loadReviewCounts,
    getEarliestReviewDate,
  } = useVocabStore();
  const [riskCount, setRiskCount] = useState(0);

  const [reviewRange, setReviewRange] = useState<ReviewRangeKey>('lastMonth');
  const [today, setToday] = useState(() => toDateStr(new Date()));

  const reviewsToday = streak?.reviewsDate === today ? streak.reviewsToday : 0;
  const dailyGoal = Math.max(1, streakDailyGoal || 20);
  const dailyProgress = Math.min(1, reviewsToday / dailyGoal);
  const dailyProgressPercent = Math.round(dailyProgress * 100);

  useEffect(() => {
    // Match the UTC review dates used by the API, including tabs left open overnight.
    const updateDay = () => setToday(toDateStr(new Date()));
    const midnight = new Date();
    midnight.setUTCHours(24, 0, 0, 0);
    const timer = window.setTimeout(updateDay, midnight.getTime() - Date.now() + 50);
    window.addEventListener('focus', updateDay);
    document.addEventListener('visibilitychange', updateDay);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', updateDay);
      document.removeEventListener('visibilitychange', updateDay);
    };
  }, [today]);

  useEffect(() => {
    loadWords();
    loadStats();
    loadStreak();
    loadStreakDailyGoal();
    getRiskWords()
      .then((items) => setRiskCount(items.length))
      .catch(() => setRiskCount(0));
  }, [loadWords, loadStats, loadStreak, loadStreakDailyGoal]);

  const loadReviewData = useCallback(async () => {
    if (reviewRange === 'allTime') {
      const earliest = await getEarliestReviewDate();
      const today = toDateStr(new Date());
      if (earliest) {
        await loadReviewCounts(earliest, today);
      } else {
        await loadReviewCounts(today, today);
      }
    } else {
      const range = getRangeDates(reviewRange);
      if (range) await loadReviewCounts(range.start, range.end);
    }
  }, [reviewRange, loadReviewCounts, getEarliestReviewDate]);

  useEffect(() => {
    loadReviewData();
  }, [loadReviewData]);

  return (
    <div className="space-y-8">
      <h2 className="text-2xl sm:text-3xl font-bold text-white">Dashboard</h2>

      <QuickQuizzes />

      {/* Compact streak summary with daily review progress */}
      <section
        aria-label="Learning streak"
        className="rounded-2xl border border-gray-700/80 bg-gray-800/80 p-4 text-white sm:px-5"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2c.4 2.2-.3 3.8-1.5 5.2C9.2 8.6 8 10.2 8 12.2c0 2.4 1.7 4.3 4 4.3s4-1.9 4-4.3c0-1.3-.4-2.4-1-3.4.9 1.1 1.5 2.4 1.5 4 0 3.3-2.5 5.8-5.5 5.8S5.5 15.8 5.5 12.5C5.5 8.8 8.2 6.2 12 2z" />
              </svg>
            </span>
            <p className="text-base font-semibold tracking-tight sm:text-lg">
              <span className="tabular-nums">{streak?.currentStreak || 0}</span>-day streak
            </p>
          </div>
          <p className="shrink-0 text-xs text-gray-400 sm:text-sm">
            Best: <span className="font-medium tabular-nums text-gray-300">{streak?.longestStreak || 0}</span> days
          </p>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 text-xs sm:text-sm">
          <div aria-live="polite" className="min-w-0">
            {dailyProgress >= 1 ? (
              <p className="flex items-center gap-1.5 text-orange-400">
                <span className="rounded-full motion-safe:animate-[streakGoalPulse_1s_ease-out]">
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </span>
                Daily goal reached
              </p>
            ) : (
              <p className="text-gray-400">Today's reviews</p>
            )}
          </div>
          <p className="shrink-0 tabular-nums text-gray-400">
            <span className={dailyProgress >= 1 ? 'text-orange-400' : 'text-sky-400'}>
              {Math.min(reviewsToday, dailyGoal)}
            </span>
            <span className="mx-0.5 text-gray-500">/</span>{dailyGoal}
          </p>
        </div>
        <div
          role="progressbar"
          aria-label="Daily review goal"
          aria-valuemin={0}
          aria-valuemax={dailyGoal}
          aria-valuenow={Math.min(reviewsToday, dailyGoal)}
          aria-valuetext={`${Math.min(reviewsToday, dailyGoal)} of ${dailyGoal} reviews${dailyProgress >= 1 ? ', daily goal reached' : ''}`}
          className="mt-2.5 h-1 overflow-hidden rounded-full bg-gray-700/70"
        >
          <div
            className={`h-full rounded-full transition-[width,background-color] duration-500 ease-out motion-reduce:transition-none ${
              dailyProgress >= 1 ? 'bg-orange-400' : 'bg-sky-400'
            }`}
            style={{ width: `${dailyProgressPercent}%` }}
          />
        </div>
      </section>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <div className="min-w-0 bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-700">
          <p className="text-gray-400 text-xs sm:text-sm uppercase tracking-wide">Total Words</p>
          <p className="text-3xl sm:text-4xl font-bold tabular-nums text-white mt-2">{stats.total}</p>
        </div>

        <div className="min-w-0 bg-gray-800 rounded-xl p-4 sm:p-6 border border-emerald-500/30">
          <p className="text-emerald-400 text-xs sm:text-sm uppercase tracking-wide">Known</p>
          <p className="text-3xl sm:text-4xl font-bold tabular-nums text-emerald-400 mt-2">{stats.known}</p>
        </div>

        <div className="min-w-0 bg-gray-800 rounded-xl p-4 sm:p-6 border border-red-500/30">
          <p className="text-red-400 text-xs sm:text-sm uppercase tracking-wide">Problem</p>
          <p className="text-3xl sm:text-4xl font-bold tabular-nums text-red-400 mt-2">{stats.problem}</p>
        </div>

        <div className="min-w-0 bg-gray-800 rounded-xl p-4 sm:p-6 border border-blue-500/30">
          <p className="text-blue-400 text-xs sm:text-sm uppercase tracking-wide">New</p>
          <p className="text-3xl sm:text-4xl font-bold tabular-nums text-blue-400 mt-2">{stats.new}</p>
        </div>

        <div className="min-w-0 bg-gray-800 rounded-xl p-4 sm:p-6 border border-amber-500/30">
          <p className="text-amber-400 text-xs sm:text-sm uppercase tracking-wide">In Risk</p>
          <p className="text-3xl sm:text-4xl font-bold tabular-nums text-amber-400 mt-2">{riskCount}</p>
        </div>

      </div>

      {/* Progress Bar */}
      {stats.total > 0 && (
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Learning Progress</h3>
          <div className="h-4 bg-gray-700 rounded-full overflow-hidden flex">
            <div
              className="bg-emerald-500 h-full transition-all duration-500"
              style={{ width: `${(stats.known / stats.total) * 100}%` }}
            />
            <div
              className="bg-red-500 h-full transition-all duration-500"
              style={{ width: `${(stats.problem / stats.total) * 100}%` }}
            />
            <div
              className="bg-blue-500 h-full transition-all duration-500"
              style={{ width: `${(stats.new / stats.total) * 100}%` }}
            />
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between gap-2 mt-2 text-sm text-gray-400">
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
              Known ({Math.round((stats.known / stats.total) * 100)}%)
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500"></span>
              Problem ({Math.round((stats.problem / stats.total) * 100)}%)
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500"></span>
              New ({Math.round((stats.new / stats.total) * 100)}%)
            </span>
          </div>
        </div>
      )}

      {/* Empty State */}
      {stats.total === 0 && (
        <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 text-center">
          <p className="text-gray-400 text-lg">No words yet!</p>
          <p className="text-gray-500 mt-2">
            Start by generating words or adding them manually.
          </p>
        </div>
      )}

      {/* Review activity graph */}
      <WordMastery words={words} />

      <div className="bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-700 transition-opacity duration-300">
        <h3 className="text-lg font-semibold text-white mb-4">Words reviewed</h3>
        <div
          role="group"
          aria-label="Review date range"
          className="mb-4 flex max-w-full gap-2 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {REVIEW_RANGE_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-pressed={reviewRange === key}
              onClick={() => setReviewRange(key)}
              className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                reviewRange === key
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="h-64 min-h-[200px]">
          {reviewCounts.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-500">
              No review data for this period.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                key={reviewRange}
                data={reviewCounts.map(({ date, count }) => ({
                  date,
                  count,
                  label: formatChartDate(date, reviewRange),
                }))}
                margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
              >
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  axisLine={{ stroke: '#4b5563' }}
                  tickLine={{ stroke: '#4b5563' }}
                />
                <YAxis
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  axisLine={{ stroke: '#4b5563' }}
                  tickLine={{ stroke: '#4b5563' }}
                  allowDecimals={false}
                  width={28}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="count"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive
                  animationDuration={450}
                >
                  {reviewCounts.map((_, index) => (
                    <Cell key={index} fill="#10b981" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
