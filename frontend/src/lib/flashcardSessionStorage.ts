const STORAGE_KEY = 'myvocab-flashcard-session';

export type SavedFlashcardSessionFilterType = 'all' | 'new' | 'problem' | 'date';

export interface SavedFlashcardSession {
  wordIds: string[];
  currentIndex: number;
  filterType: SavedFlashcardSessionFilterType;
  dateRange: number;
  savedAt: string;
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
