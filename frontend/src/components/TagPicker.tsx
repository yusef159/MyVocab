import { useEffect, useState } from 'react';
import { useVocabStore } from '../stores/vocabStore';

const pillClass = 'inline-flex min-h-9 max-w-full items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800 disabled:cursor-wait';
const idleClass = 'border-gray-600/70 bg-gray-700/30 text-gray-300 hover:border-emerald-500/70 hover:bg-emerald-500/10 hover:text-emerald-200';
const selectedClass = 'border-emerald-400/70 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30';

function SearchIcon() {
  return <svg aria-hidden="true" className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><circle cx="10.5" cy="10.5" r="6.5" /><path strokeLinecap="round" d="m16 16 4 4" /></svg>;
}

function PlusIcon() {
  return <svg aria-hidden="true" className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" d="M12 5v14M5 12h14" /></svg>;
}

function CloseIcon() {
  return <svg aria-hidden="true" className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" d="m6 6 12 12M6 18 18 6" /></svg>;
}

export default function TagPicker({ value, onChange, disabled = false, label = 'Tags', allowCreate = true, emptyLabel, multiple = true, untaggedSelected = false, onUntaggedChange }: {
  value: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
  label?: string;
  allowCreate?: boolean;
  emptyLabel?: string;
  multiple?: boolean;
  untaggedSelected?: boolean;
  onUntaggedChange?: (selected: boolean) => void;
}) {
  const tags = useVocabStore(s => s.tags);
  const loadTags = useVocabStore(s => s.loadTags);
  const [mode, setMode] = useState<'idle' | 'search' | 'create'>('idle');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [visibleCount, setVisibleCount] = useState(6);
  const [error, setError] = useState('');

  useEffect(() => {
    void loadTags().catch(() => setError('Could not load tags.'));
  }, [loadTags]);

  const matching = tags.filter(tag => tag.name.toLowerCase().includes(query.trim().toLowerCase()));
  // Keep selected tags visible, even when they are older than the recent suggestions.
  const suggestions = matching.filter(tag => !value.includes(tag.name));
  const visible = suggestions.slice(0, visibleCount);
  const existing = tags.find(tag => tag.name.toLowerCase() === draft.trim().toLowerCase());
  const resetControls = () => { setMode('idle'); setQuery(''); setDraft(''); setVisibleCount(6); };
  const choose = (tag: string) => {
    const next = value.includes(tag) ? value.filter(name => name !== tag) : multiple ? [...value, tag] : [tag];
    onChange(next);
    resetControls();
  };
  const create = () => {
    const name = existing?.name ?? draft.trim();
    if (!name) return;
    if (value.includes(name)) resetControls();
    else choose(name);
  };

  return (
    <fieldset disabled={disabled} className="mb-3 min-w-0 disabled:opacity-60">
      <legend className="mb-2 text-sm font-medium text-gray-300">
        {label} <span className="ml-1 text-xs font-normal text-gray-500">optional</span>
      </legend>
      <div className="flex flex-wrap items-center gap-2">
        {emptyLabel && (
          <button type="button" aria-pressed={value.length === 0 && !untaggedSelected} onClick={() => { onChange([]); onUntaggedChange?.(false); resetControls(); }} className={`${pillClass} ${value.length === 0 && !untaggedSelected ? selectedClass : idleClass}`}>{emptyLabel}</button>
        )}
        {onUntaggedChange && <button type="button" aria-pressed={untaggedSelected} onClick={() => onUntaggedChange(!untaggedSelected)} className={`${pillClass} ${untaggedSelected ? selectedClass : idleClass}`}>Untagged</button>}
        {value.map(name => (
          <button type="button" key={name} aria-pressed="true" title="Click to remove tag" onClick={() => choose(name)} className={`${pillClass} ${selectedClass}`}>
            <span className="break-all">{name}</span><CloseIcon />
          </button>
        ))}
        {visible.map(tag => (
          <button type="button" key={tag.name} aria-pressed="false" onClick={() => choose(tag.name)} className={`${pillClass} ${idleClass}`}>
            <span className="break-all">{tag.name}</span>
          </button>
        ))}
        {suggestions.length > visibleCount && (
          <button type="button" onClick={() => setVisibleCount(count => count + 12)} className={`${pillClass} ${idleClass}`} aria-label="Show more tags">+{suggestions.length - visibleCount} more</button>
        )}
        {allowCreate && mode !== 'create' && (
          <button type="button" aria-label="Create a tag" title="Create a tag" onClick={() => { setMode('create'); setQuery(''); }} className={`${pillClass} border-dashed border-gray-500 text-gray-400 hover:border-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300`}>
            <PlusIcon /><span>New tag</span>
          </button>
        )}
        {mode === 'create' && allowCreate && (
          <div className="inline-flex min-h-9 max-w-full items-center gap-1 rounded-full border border-emerald-500/70 bg-gray-900/40 pl-3 pr-1 focus-within:ring-2 focus-within:ring-emerald-500/20">
            <span className="text-emerald-400"><PlusIcon /></span>
            <input
              key="create"
              autoFocus
              aria-label="New tag name"
              value={draft}
              maxLength={80}
              placeholder="Tag name"
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); create(); }
                if (e.key === 'Escape') { e.preventDefault(); resetControls(); }
              }}
              className="w-28 min-w-0 bg-transparent py-1.5 text-sm text-white placeholder-gray-500 outline-none"
            />
            <button type="button" disabled={!draft.trim()} onClick={create} aria-label={existing ? 'Use existing tag' : 'Add new tag'} title={existing ? 'Use existing tag' : 'Add tag'} className="rounded-full bg-emerald-500/20 p-1.5 text-emerald-300 hover:bg-emerald-500/40 disabled:opacity-30">
              <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m5 12 4 4L19 6" /></svg>
            </button>
            <button type="button" onClick={resetControls} aria-label="Cancel new tag" className="rounded-full p-1.5 text-gray-400 hover:text-white"><CloseIcon /></button>
          </div>
        )}
        {mode !== 'search' ? (
          <button type="button" aria-label="Search tags" title="Search tags" aria-expanded="false" onClick={() => { setMode('search'); setDraft(''); }} className={`${pillClass} ${idleClass}`}>
            <SearchIcon />
          </button>
        ) : (
          <div className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border border-gray-500 bg-gray-900/40 pl-3 pr-1 text-gray-400 focus-within:border-emerald-500/70 focus-within:ring-2 focus-within:ring-emerald-500/20">
            <SearchIcon />
            <input
              key="search"
              autoFocus
              aria-label="Search tags"
              value={query}
              placeholder="Find tag…"
              maxLength={80}
              onChange={e => { setQuery(e.target.value); setVisibleCount(12); }}
              onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); resetControls(); } }}
              className="w-28 min-w-0 bg-transparent py-1.5 text-sm text-white placeholder-gray-500 outline-none"
            />
            <button type="button" onClick={resetControls} aria-label="Close tag search" className="rounded-full p-1.5 hover:text-white"><CloseIcon /></button>
          </div>
        )}
      </div>
      {query.trim() && matching.length === 0 && <p role="status" className="mt-2 text-xs text-gray-400">No tags found.</p>}
      {error && <p role="alert" className="mt-2 text-xs text-red-400">{error} <button type="button" onClick={() => { void loadTags().then(() => setError('')).catch(() => setError('Could not load tags.')); }} className="underline hover:text-red-300">Retry</button></p>}
    </fieldset>
  );
}
