import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRiskWords } from '../db';
import { useVocabStore } from '../stores/vocabStore';
import type { Word } from '../types';
import { selectQuickQuizWords } from '../lib/quickQuiz';

export default function QuickQuizzes() {
  const { words, streakDailyGoal } = useVocabStore();
  const navigate = useNavigate();
  const [riskWords, setRiskWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    getRiskWords().then(items => {
      if (!cancelled) { setRiskWords(items); setError(false); }
    }).catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [words]);

  const { risk, problem } = selectQuickQuizWords(words, riskWords, streakDailyGoal);
  const cards = [{
    title: 'At-risk words', filter: 'risk' as const, words: risk,
    style: 'border-amber-500/30 bg-amber-500/10', accent: 'text-amber-300',
    button: 'bg-amber-400 hover:bg-amber-300 text-gray-950', disabled: loading || error || !risk.length,
  }, ...(problem.length ? [{
    title: 'Problem words', filter: 'problem' as const, words: problem,
    style: 'border-red-400/30 bg-red-400/10', accent: 'text-red-300',
    button: 'bg-red-300 hover:bg-red-200 text-gray-950', disabled: false,
  }] : [])];

  return (
    <section aria-labelledby="quick-quizzes" className="space-y-3">
      <h3 id="quick-quizzes" className="text-xl font-bold text-white">Quick quizzes</h3>
      <div className={`grid gap-3 sm:gap-4 ${cards.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {cards.map(card => (
          <div key={card.filter} className={`flex min-w-0 flex-col rounded-xl border p-3 sm:p-5 ${card.style}`}>
            <div className="mb-3 flex flex-col items-start gap-1 sm:mb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <h4 className="text-sm font-semibold text-white sm:text-lg">{card.title}</h4>
              <span className={`text-xs sm:text-sm ${card.accent}`}>{card.filter === 'risk' && loading ? 'Loading…' : `${card.words.length} words`}</span>
            </div>
            {card.filter === 'risk' && error && <p role="alert" className="text-red-300 text-sm mb-3">Could not load words. Refresh to retry.</p>}
            <button type="button" disabled={card.disabled} onClick={() => navigate('/flashcards', {
              state: { quickQuiz: { wordIds: card.words.map(word => word.id), filterType: card.filter } },
            })} className={`mt-auto min-h-11 w-full rounded-lg px-2 py-2 text-sm font-semibold transition-colors sm:px-4 sm:py-2.5 sm:text-base disabled:opacity-40 disabled:cursor-not-allowed ${card.button}`}>Start quiz <span aria-hidden="true">→</span></button>
          </div>
        ))}
      </div>
    </section>
  );
}
