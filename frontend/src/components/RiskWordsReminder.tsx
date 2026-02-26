import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRiskWords } from '../db';
import type { RiskWord } from '../types';

const MIN_SESSION = 3;
const MAX_SESSION = 8;
const DISPLAY_COUNT = 5;

const RISK_SESSION_COMPLETED_KEY = 'riskSessionCompletedDate';

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function setRiskSessionCompletedToday(): void {
  try {
    localStorage.setItem(RISK_SESSION_COMPLETED_KEY, todayKey());
  } catch {
    // ignore
  }
}

export function didCompleteRiskSessionToday(): boolean {
  try {
    return localStorage.getItem(RISK_SESSION_COMPLETED_KEY) === todayKey();
  } catch {
    return false;
  }
}

function formatDaysAgo(days: number): string {
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week(s) ago`;
  if (days < 365) return `${Math.floor(days / 30)} month(s) ago`;
  return `${Math.floor(days / 365)} year(s) ago`;
}

export default function RiskWordsReminder() {
  const [riskWords, setRiskWords] = useState<RiskWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    getRiskWords()
      .then((words) => {
        if (!cancelled) setRiskWords(words);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sessionCount = Math.min(MAX_SESSION, Math.max(MIN_SESSION, riskWords.length));
  const sessionWordIds = riskWords.slice(0, sessionCount).map((w) => w.id);

  const handleReviewNow = () => {
    navigate('/flashcards', { state: { riskWordIds: sessionWordIds } });
  };

  if (loading || riskWords.length < MIN_SESSION || dismissed || didCompleteRiskSessionToday())
    return null;

  const toShow = riskWords.slice(0, DISPLAY_COUNT);
  const message =
    sessionCount === 1
      ? "I noticed one word you haven't seen in a while. Want a quick refresh?"
      : `I'm noticing ${sessionCount} words you haven't seen in a while. Want a quick refresh?`;

  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6">
      <p className="text-amber-100 text-sm font-medium mb-3">{message}</p>
      <div className="flex flex-wrap gap-2 mb-3">
        {toShow.map((w) => (
          <span
            key={w.id}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800/80 text-white text-sm border border-gray-600"
          >
            <span className="font-medium">{w.english}</span>
            <span className="text-gray-400 text-xs">
              Last seen {formatDaysAgo(w.daysSinceReview)}
            </span>
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleReviewNow}
          className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-gray-900 font-semibold text-sm transition-colors"
        >
          Review these now
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm transition-colors"
        >
          Remind me later
        </button>
      </div>
    </div>
  );
}
