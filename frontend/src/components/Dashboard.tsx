import { useEffect } from 'react';
import { useVocabStore } from '../stores/vocabStore';

export default function Dashboard() {
  const { stats, streak, loadStats, loadStreak } = useVocabStore();

  useEffect(() => {
    loadStats();
    loadStreak();
  }, [loadStats, loadStreak]);

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
            Last activity: {new Date(streak.lastActivityDate).toLocaleDateString()}
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
    </div>
  );
}
