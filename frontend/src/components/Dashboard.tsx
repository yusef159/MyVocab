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
import { useVocabStore } from '../stores/vocabStore';

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
    stats,
    streak,
    loadStats,
    loadStreak,
    reviewCounts,
    loadReviewCounts,
    getEarliestReviewDate,
  } = useVocabStore();

  const [reviewRange, setReviewRange] = useState<ReviewRangeKey>('lastWeek');

  useEffect(() => {
    loadStats();
    loadStreak();
  }, [loadStats, loadStreak]);

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
      <h2 className="text-3xl font-bold text-white">Dashboard</h2>

      {/* Streak Section */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-orange-100 text-sm uppercase tracking-wide">Current Streak</p>
            <p className="text-5xl font-bold mt-1">
              {streak?.currentStreak || 0}
              <span className="text-2xl ml-2">days</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-orange-100 text-sm uppercase tracking-wide">Longest Streak</p>
            <p className="text-3xl font-bold mt-1">
              {streak?.longestStreak || 0}
              <span className="text-lg ml-2">days</span>
            </p>
          </div>
        </div>
        {streak?.lastActivityDate && (
          <p className="text-orange-100 text-sm mt-4">
            Last activity: {new Date(streak.lastActivityDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </p>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <p className="text-gray-400 text-sm uppercase tracking-wide">Total Words</p>
          <p className="text-4xl font-bold text-white mt-2">{stats.total}</p>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-emerald-500/30">
          <p className="text-emerald-400 text-sm uppercase tracking-wide">Known</p>
          <p className="text-4xl font-bold text-emerald-400 mt-2">{stats.known}</p>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-red-500/30">
          <p className="text-red-400 text-sm uppercase tracking-wide">Problem</p>
          <p className="text-4xl font-bold text-red-400 mt-2">{stats.problem}</p>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-blue-500/30">
          <p className="text-blue-400 text-sm uppercase tracking-wide">New</p>
          <p className="text-4xl font-bold text-blue-400 mt-2">{stats.new}</p>
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
          <div className="flex justify-between mt-2 text-sm text-gray-400">
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
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 transition-opacity duration-300">
        <h3 className="text-lg font-semibold text-white mb-4">Words reviewed</h3>
        <div className="flex flex-wrap gap-2 mb-4">
          {REVIEW_RANGE_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setReviewRange(key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
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
