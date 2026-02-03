const STORAGE_KEY = 'myvocab-flashcard-session';
const SESSION_SIZE_KEY = 'myvocab-flashcard-session-size';
const DEFAULT_SESSION_SIZE = 20;

export type SavedFlashcardSessionFilterType = 'all' | 'new' | 'problem' | 'date';

export interface SavedFlashcardSession {
  wordIds: string[];
  currentIndex: number;
  filterType: SavedFlashcardSessionFilterType;
  dateRange: number;
  savedAt: string;
  /** Cumulative known count for this session (so results include all words when resuming) */
  knownCount: number;
  /** Cumulative problem count for this session */
  problemCount: number;
}

export function getSavedSession(): SavedFlashcardSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedFlashcardSession;
    if (!Array.isArray(parsed.wordIds) || typeof parsed.currentIndex !== 'number') return null;
    return {
      wordIds: parsed.wordIds,
      currentIndex: parsed.currentIndex,
      filterType: parsed.filterType ?? 'all',
      dateRange: typeof parsed.dateRange === 'number' ? parsed.dateRange : 30,
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date().toISOString(),
      knownCount: typeof parsed.knownCount === 'number' ? parsed.knownCount : 0,
      problemCount: typeof parsed.problemCount === 'number' ? parsed.problemCount : 0,
    };
  } catch {
    return null;
  }
}

export function saveSession(session: SavedFlashcardSession): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // ignore
  }
}

export function clearSavedSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function getSavedSessionSize(): number {
  try {
    const raw = localStorage.getItem(SESSION_SIZE_KEY);
    if (raw == null) return DEFAULT_SESSION_SIZE;
    const n = parseInt(raw, 10);
    return Number.isNaN(n) || n < 1 ? DEFAULT_SESSION_SIZE : n;
  } catch {
    return DEFAULT_SESSION_SIZE;
  }
}

export function saveSessionSize(size: number): void {
  try {
    if (size >= 1) localStorage.setItem(SESSION_SIZE_KEY, String(size));
  } catch {
    // ignore
  }
}
