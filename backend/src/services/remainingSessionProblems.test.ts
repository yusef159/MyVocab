import test from 'node:test';
import assert from 'node:assert/strict';

const helperUrl = new URL('../../../frontend/src/lib/flashcardFilters.ts', import.meta.url);
const { getAllProblemWords, getRemainingSessionProblems } = await import(helperUrl.href);

function word(id: string, status: 'new' | 'known' | 'problem') {
  return {
    id, english: id, status, arabicMeanings: [], exampleSentences: [],
    correctCount: 0, wrongCount: 0, streak: 0, interval: 1, createdAt: new Date(),
  };
}

test('follow-up uses latest statuses and excludes unrelated and deleted words', () => {
  const session = [word('mastered', 'problem'), word('missed', 'known'), word('deleted', 'problem')];
  const missed = word('missed', 'problem');
  const latest = [word('mastered', 'known'), missed, word('unrelated', 'problem')];
  assert.deepEqual(getRemainingSessionProblems(session, latest), [missed]);
});

test('repeated follow-ups shrink as words become known, retaining words still in Problem', () => {
  const session = [word('one', 'problem'), word('two', 'problem')];
  const stillProblem = { ...word('two', 'problem'), correctCount: 2, streak: 2 };
  const nextRound = getRemainingSessionProblems(session, [word('one', 'known'), stillProblem]);
  assert.deepEqual(nextRound, [stillProblem]);
  assert.deepEqual(getRemainingSessionProblems(nextRound, [word('one', 'known'), word('two', 'known')]), []);
});

test('empty sessions and sessions with no remaining problems cannot start a follow-up', () => {
  assert.deepEqual(getRemainingSessionProblems([], [word('outside', 'problem')]), []);
  assert.deepEqual(getRemainingSessionProblems([word('one', 'known')], [word('one', 'known')]), []);
  assert.deepEqual(getRemainingSessionProblems([word('one', 'problem')], []), []);
});

test('Complete Problem includes the entire vocabulary without session, tag, or size limits', () => {
  const problems = Array.from({ length: 65 }, (_, i) => ({
    ...word(String(i), 'problem'),
    tags: [i % 2 ? 'travel' : 'work'],
    createdAt: new Date('2020-01-01'),
  }));
  const vocabulary = [word('known', 'known'), ...problems, word('new', 'new')];
  // A finished session with no remaining problems must not prevent practicing others.
  assert.deepEqual(getRemainingSessionProblems([vocabulary[0]], vocabulary), []);
  assert.deepEqual(getAllProblemWords(vocabulary), problems);
  assert.deepEqual(getAllProblemWords(vocabulary.map(item => ({ ...item, status: 'known' as const }))), []);
  assert.deepEqual(getAllProblemWords([]), []);
});
