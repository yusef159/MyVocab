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
      <div className={`grid gap-4 ${cards.length > 1 ? 'md:grid-cols-2' : ''}`}>
        {cards.map(card => (
          <div key={card.filter} className={`rounded-xl border p-4 sm:p-5 ${card.style}`}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <h4 className="text-lg font-semibold text-white">{card.title}</h4>
              <span className={`text-sm ${card.accent}`}>{card.filter === 'risk' && loading ? 'Loading…' : `${card.words.length} words`}</span>
            </div>
            {card.filter === 'risk' && error && <p role="alert" className="text-red-300 text-sm mb-3">Could not load words. Refresh to retry.</p>}
            <button type="button" disabled={card.disabled} onClick={() => navigate('/flashcards', {
              state: { quickQuiz: { wordIds: card.words.map(word => word.id), filterType: card.filter } },
            })} className={`w-full rounded-lg px-4 py-2.5 font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${card.button}`}>Start quiz <span aria-hidden="true">→</span></button>
          </div>
        ))}
      </div>
    </section>
  );
}
