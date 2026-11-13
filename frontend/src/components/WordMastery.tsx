import { useMemo, useState } from 'react';
import type { Word } from '../types';
import { getMasteryLevel, summarizeWordMastery, type MasteryLevel } from '../lib/wordMastery';

const COLORS = {
  new: { bar: 'bg-slate-400', text: 'text-slate-300', selected: 'border-slate-400 bg-slate-400/10' },
  learning: { bar: 'bg-sky-400', text: 'text-sky-300', selected: 'border-sky-400 bg-sky-400/10' },
  familiar: { bar: 'bg-violet-400', text: 'text-violet-300', selected: 'border-violet-400 bg-violet-400/10' },
  strong: { bar: 'bg-amber-400', text: 'text-amber-300', selected: 'border-amber-400 bg-amber-400/10' },
  mastered: { bar: 'bg-emerald-400', text: 'text-emerald-300', selected: 'border-emerald-400 bg-emerald-400/10' },
};
const PAGE_SIZE = 8;

export default function WordMastery({ words }: { words: Word[] }) {
  const [selected, setSelected] = useState<MasteryLevel['id'] | 'all'>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const levels = useMemo(() => summarizeWordMastery(words), [words]);
  const mastered = levels[levels.length - 1];
  const filtered = useMemo(() => words
    .filter(word => (selected === 'all' || getMasteryLevel(word.interval).id === selected) &&
      word.english.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
    .sort((a, b) => b.interval - a.interval || a.english.localeCompare(b.english)), [words, selected, search]);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1));
  const visible = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  return (
    <section aria-labelledby="word-mastery-heading" className="rounded-2xl border border-gray-700 bg-gradient-to-br from-gray-800 to-gray-900 p-4 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 id="word-mastery-heading" className="text-xl font-semibold text-white">Word mastery</h3>
          <p className="text-sm text-gray-400 mt-1">Your words, leveled by review interval.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-16 h-16 shrink-0">
            <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90" aria-hidden="true">
              <circle cx="32" cy="32" r="26" fill="none" stroke="#374151" strokeWidth="5" />
              <circle cx="32" cy="32" r="26" fill="none" stroke="#34d399" strokeWidth="5" strokeLinecap={mastered.count ? 'round' : 'butt'} strokeDasharray={`${mastered.percent / 100 * 163.36} 163.36`} />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-emerald-300">{Math.round(mastered.percent)}%</span>
          </div>
          <div><p className="font-semibold text-emerald-300">{mastered.count} mastered</p><p className="text-xs text-gray-400">of {words.length} words</p></div>
        </div>
      </div>

      <div className="flex h-3 overflow-hidden rounded-full bg-gray-700" aria-label="Word mastery distribution">
        {levels.map(level => <div key={level.id} className={`${COLORS[level.id].bar} transition-[width] duration-500`} style={{ width: `${level.percent}%` }} title={`${level.label}: ${level.count} words`} />)}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        {levels.map(level => (
          <button key={level.id} type="button" aria-pressed={selected === level.id} onClick={() => { setSelected(level.id); setPage(0); }} className={`rounded-xl border p-3 sm:p-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 ${selected === level.id ? COLORS[level.id].selected : 'border-gray-700 bg-gray-800/60 hover:border-gray-500'}`}>
            <div className={`flex items-center gap-2 text-sm font-medium ${COLORS[level.id].text}`}><span className={`h-2 w-2 rounded-full ${COLORS[level.id].bar}`} aria-hidden="true" />{level.label}</div>
            <p className="text-2xl font-bold text-white mt-2">{level.count}<span className="text-xs text-gray-400 font-normal ml-2">{Math.round(level.percent)}%</span></p>
            <p className="text-xs text-gray-400 mt-1">{level.range}</p>
          </button>
        ))}
      </div>

      <div className="border-t border-gray-700 pt-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h4 className="font-medium text-white">{selected === 'all' ? 'All words' : levels.find(level => level.id === selected)?.label} <span className="text-sm text-gray-400">({filtered.length})</span></h4>
            {selected !== 'all' && <button type="button" onClick={() => { setSelected('all'); setPage(0); }} className="text-xs text-gray-400 hover:text-white underline">Show all</button>}
          </div>
          <input type="search" aria-label="Search mastery words" placeholder="Find a word…" value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} className="w-full sm:w-48 rounded-lg border border-gray-600 bg-gray-900/60 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-emerald-400 focus:outline-none" />
        </div>
        {visible.length ? <div className="grid sm:grid-cols-2 gap-2">
          {visible.map(word => {
            const level = getMasteryLevel(word.interval);
            return (
              <div key={word.id} className="flex items-center justify-between gap-3 rounded-lg bg-gray-800/70 border border-gray-700/60 px-3 py-2.5">
                <div className="min-w-0"><p className="text-sm font-medium text-white break-words">{word.english}</p><p className={`text-xs mt-0.5 ${COLORS[level.id].text}`}>{level.label}{word.status === 'problem' && <span className="text-red-300"> · Needs practice</span>}</p></div>
                <span title="Review interval" className="shrink-0 text-sm text-gray-300 tabular-nums">{word.interval} <span className="text-xs text-gray-500">{word.interval === 1 ? 'day' : 'days'}</span></span>
              </div>
            );
          })}
        </div> : <p className="text-sm text-gray-400 py-4 text-center">{words.length ? 'No words in this selection yet.' : 'Review your first words to start building mastery.'}</p>}
        {filtered.length > PAGE_SIZE && <div className="flex items-center justify-between gap-3 text-xs text-gray-400">
          <span>{currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
          <div className="flex gap-2">
            <button type="button" aria-label="Previous mastery words" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className="rounded-lg border border-gray-600 px-3 py-2 text-gray-300 hover:bg-gray-700 disabled:opacity-30">Previous</button>
            <button type="button" aria-label="Next mastery words" disabled={(currentPage + 1) * PAGE_SIZE >= filtered.length} onClick={() => setPage(currentPage + 1)} className="rounded-lg border border-gray-600 px-3 py-2 text-gray-300 hover:bg-gray-700 disabled:opacity-30">Next</button>
          </div>
        </div>}
      </div>
    </section>
  );
}
