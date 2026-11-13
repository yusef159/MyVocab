import test from 'node:test';
import assert from 'node:assert/strict';
const helperUrl = new URL('../../../frontend/src/lib/wordMastery.ts', import.meta.url);
const { getMasteryLevel, summarizeWordMastery } = await import(helperUrl.href);

test('mastery levels use the stored interval at every boundary, with 10+ mastered', () => {
  for (const [count, expected] of [
    [0, 'new'], [1, 'learning'], [2, 'learning'], [3, 'familiar'], [5, 'familiar'],
    [6, 'strong'], [9, 'strong'], [10, 'mastered'], [50, 'mastered'],
  ] as const) assert.equal(getMasteryLevel(count).id, expected);
});

test('distribution counts every word exactly once using interval', () => {
  const words = [0, 1, 2, 3, 5, 6, 9, 10, 25, 100].map(interval => ({ interval }));
  const summary = summarizeWordMastery(words);
  assert.deepEqual(summary.map((level: { count: number }) => level.count), [1, 2, 2, 2, 3]);
  assert.equal(summary.reduce((total: number, level: { count: number }) => total + level.count, 0), words.length);
  assert.equal(summary.reduce((total: number, level: { percent: number }) => total + level.percent, 0), 100);
});

test('historical correct counts do not affect mastery, and a shortened interval lowers the level', () => {
  const word = { correctCount: 100, interval: 8 };
  assert.equal(getMasteryLevel(word.interval).id, 'strong');
  word.interval = 4;
  assert.equal(getMasteryLevel(word.interval).id, 'familiar');
  const summary = summarizeWordMastery([word, { correctCount: 1, interval: 10 }]);
  assert.equal(summary.find((level: { id: string }) => level.id === 'familiar').count, 1);
  assert.equal(summary.find((level: { id: string }) => level.id === 'mastered').count, 1);
});

test('an empty vocabulary produces zero counts and valid percentages', () => {
  for (const level of summarizeWordMastery([])) {
    assert.equal(level.count, 0);
    assert.equal(level.percent, 0);
  }
});
