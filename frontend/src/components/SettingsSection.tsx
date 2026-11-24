import { useState, type ReactNode } from 'react';

interface SettingsSectionProps {
  id: string;
  title: string;
  summary?: ReactNode;
  action?: ReactNode;
  feedback?: ReactNode;
  defaultExpanded?: boolean;
  children: ReactNode;
}

export default function SettingsSection({ id, title, summary, action, feedback, defaultExpanded = true, children }: SettingsSectionProps) {
  const storageKey = `myvocab:settings:${id}:expanded`;
  const [expanded, setExpanded] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved === 'true' || (saved !== 'false' && defaultExpanded);
    } catch {
      return defaultExpanded;
    }
  });

  function toggleExpanded() {
    const next = !expanded;
    setExpanded(next);
    try {
      localStorage.setItem(storageKey, String(next));
    } catch {
      // The section still works when the browser blocks storage.
    }
  }

  return (
    <section aria-labelledby={`${id}-heading`} className="rounded-xl border border-gray-700 bg-gray-800">
      <div className="flex items-center">
        <h2 id={`${id}-heading`} className="min-w-0 flex-1">
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={`${id}-details`}
            onClick={toggleExpanded}
            className="flex w-full items-center justify-between gap-3 rounded-tl-xl px-4 py-4 text-left transition-colors hover:bg-gray-700/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400 sm:px-6"
          >
            <span className="min-w-0">
              <span className="block text-base font-semibold text-white">{title}</span>
              {summary && <span className="block text-sm font-normal text-gray-400">{summary}</span>}
            </span>
            <svg className={`h-5 w-5 shrink-0 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </h2>
        {action && <div className="shrink-0 pr-4 sm:pr-6">{action}</div>}
      </div>
      {feedback && <div className="px-4 pb-3 text-sm sm:px-6">{feedback}</div>}
      <div id={`${id}-details`} hidden={!expanded} className="space-y-4 border-t border-gray-700 px-4 py-5 sm:px-6">
        {children}
      </div>
    </section>
  );
}

export function SettingsSwitch({ label, checked, disabled, onChange }: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800 disabled:cursor-not-allowed disabled:opacity-60 ${checked ? 'bg-emerald-500' : 'bg-gray-600'}`}
    >
      <span aria-hidden="true" className={`inline-block h-5 w-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-8' : 'translate-x-1'}`} />
    </button>
  );
}
