import { useMemo, type ReactNode } from 'react';
import type { FluencyHighlight } from '../types';

type WordPos = { word: string; start: number; end: number };

function parseWordPositions(text: string): WordPos[] {
  const out: WordPos[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ word: m[0], start: m.index, end: m.index + m[0].length });
  }
  return out;
}

function gapSlice(afterIndex: number, words: WordPos[], text: string): string {
  if (words.length === 0) return '';
  if (afterIndex === -1) {
    return text.slice(0, words[0].start);
  }
  const end = words[afterIndex].end;
  if (afterIndex >= words.length - 1) {
    return text.slice(end);
  }
  return text.slice(end, words[afterIndex + 1].start);
}

function FluencyChip({ highlight }: { highlight: FluencyHighlight }) {
  const { kind, detail, spoken, gapSeconds } = highlight;

  const label =
    kind === 'filler'
      ? (spoken ?? 'filler').toLowerCase()
      : `${gapSeconds ?? '?'}s`;

  const style =
    kind === 'filler'
      ? 'bg-amber-500/25 text-amber-100 border-amber-500/50'
      : kind === 'long_pause'
        ? 'bg-sky-500/25 text-sky-100 border-sky-500/50'
        : 'bg-violet-500/25 text-violet-100 border-violet-500/50';

  const shortKind =
    kind === 'filler' ? 'Filler' : kind === 'long_pause' ? 'Long pause' : 'Very long pause';

  return (
    <span className="relative inline-flex align-baseline group mx-0.5">
      <span
        className={`inline-flex items-center rounded-md border px-1.5 py-px text-xs font-medium cursor-default ${style}`}
        tabIndex={0}
      >
        {shortKind}: {label}
      </span>
      <span
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-xs -translate-x-1/2 rounded-lg border border-gray-600 bg-gray-950 px-3 py-2 text-left text-xs leading-snug text-gray-100 opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
        role="tooltip"
      >
        {detail}
      </span>
    </span>
  );
}

export function ReadingFluencyArticleBody({
  articleText,
  highlights,
}: {
  articleText: string;
  highlights: FluencyHighlight[] | undefined;
}) {
  const words = useMemo(() => parseWordPositions(articleText), [articleText]);

  const byGap = useMemo(() => {
    const map = new Map<number, FluencyHighlight[]>();
    for (const h of highlights ?? []) {
      const list = map.get(h.insertAfterWordIndex);
      if (list) list.push(h);
      else map.set(h.insertAfterWordIndex, [h]);
    }
    return map;
  }, [highlights]);

  if (words.length === 0) {
    return (
      <p className="text-gray-100 leading-8 whitespace-pre-wrap">{articleText}</p>
    );
  }

  const segments: ReactNode[] = [];

  for (let w = 0; w < words.length; w += 1) {
    const gapIdx = w - 1;
    const gapText = gapSlice(gapIdx, words, articleText);
    const gapHs = byGap.get(gapIdx) ?? [];
    segments.push(
      <span key={`g-${gapIdx}`} className="whitespace-pre-wrap">
        {gapText}
        {gapHs.map((h, i) => (
          <FluencyChip key={`${gapIdx}-${i}-${h.kind}`} highlight={h} />
        ))}
      </span>
    );
    segments.push(
      <span key={`w-${w}`} className="text-gray-100">
        {words[w].word}
      </span>
    );
  }

  const lastGap = words.length - 1;
  const gapText = gapSlice(lastGap, words, articleText);
  const gapHs = byGap.get(lastGap) ?? [];
  segments.push(
    <span key={`g-${lastGap}`} className="whitespace-pre-wrap">
      {gapText}
      {gapHs.map((h, i) => (
        <FluencyChip key={`${lastGap}-${i}-${h.kind}`} highlight={h} />
      ))}
    </span>
  );

  return (
    <div className="text-gray-100 leading-8">
      <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4 text-base whitespace-pre-wrap">
        {segments}
      </div>
    </div>
  );
}
