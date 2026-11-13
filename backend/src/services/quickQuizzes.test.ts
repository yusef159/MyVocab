import test from 'node:test';
import assert from 'node:assert/strict';
const helperUrl = new URL('../../../frontend/src/lib/quickQuiz.ts', import.meta.url);
const { selectQuickQuizWords } = await import(helperUrl.href);

function word(id: number, status: 'new' | 'known' | 'problem' = 'known', meanings = [`meaning ${id}`]) {
  return { id: String(id), english: `word ${id}`, status, arabicMeanings: meanings,
    exampleSentences: [], wrongCount: 0, correctCount: 0, streak: 0, interval: 1, createdAt: new Date() };
}

test('at-risk quiz follows the daily goal and includes fewer words when availability is lower', () => {
  const risk = Array.from({ length: 60 }, (_, i) => word(i));
  assert.equal(selectQuickQuizWords([], risk, 30).risk.length, 30);
  assert.equal(selectQuickQuizWords([], risk, 40).risk.length, 40);
  assert.deepEqual(selectQuickQuizWords([], risk.slice(0, 8), 40).risk, risk.slice(0, 8));
  assert.equal(selectQuickQuizWords([], [], 40).risk.length, 0);
});

test('problem quiz includes every problem word regardless of daily goal', () => {
  const problems = Array.from({ length: 65 }, (_, i) => word(i, 'problem'));
  assert.deepEqual(selectQuickQuizWords([...problems, word(100), word(101, 'new')], [], 30).problem, problems);
  assert.deepEqual(selectQuickQuizWords([word(1)], [], 30).problem, []);
});

