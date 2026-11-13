import test from 'node:test';
import assert from 'node:assert/strict';

const helperUrl = new URL('../../../frontend/src/lib/wordListOptions.ts', import.meta.url);
const { sortWords, matchesWordTags, normalizeWordSort, WORD_SORT_OPTIONS } = await import(helperUrl.href);

const words = [
  { id: 'a', english: 'alpha', createdAt: new Date('2026-01-01'), lastReviewedAt: new Date('2026-01-06'), status: 'known', interval: 1, wrongCount: 3, correctCount: 7, tags: ['Travel', 'Work'] },
  { id: 'b', english: 'beta', createdAt: new Date('2026-01-03'), lastReviewedAt: new Date('2026-01-09'), status: 'problem', interval: 3, wrongCount: 9, correctCount: 1, tags: ['Work'] },
  { id: 'c', english: 'charlie', createdAt: new Date('2026-01-02'), status: 'new', interval: 0, wrongCount: 0, correctCount: 0 },
  { id: 'd', english: 'delta', createdAt: new Date('2026-01-04'), lastReviewedAt: new Date('2026-01-01'), status: 'known', interval: 2, wrongCount: 2, correctCount: 8, tags: ['Study'] },
];

test('every word sorting option produces the intended order without mutating the vocabulary', () => {
  const expected: Record<string, string[]> = {
    newest: ['d', 'b', 'c', 'a'], oldest: ['a', 'c', 'b', 'd'],
    az: ['a', 'b', 'c', 'd'], za: ['d', 'c', 'b', 'a'],
    mistakes: ['b', 'a', 'd', 'c'], progress: ['c', 'b', 'a', 'd'],
    reviewed: ['c', 'd', 'a', 'b'], risk: ['d', 'a', 'b', 'c'],
  };
  for (const option of WORD_SORT_OPTIONS) {
    assert.deepEqual(sortWords(words, option.value, Date.parse('2026-01-10')).map((word: { id: string }) => word.id), expected[option.value]);
  }
  assert.deepEqual(words.map(word => word.id), ['a', 'b', 'c', 'd']);
});

test('tag filtering combines any selected tag with untagged words, then sorting orders the results', () => {
  const matching = (tags: string[], untagged = false) => words.filter(word => matchesWordTags(word, tags, untagged));
  assert.equal(matching([]).length, 4);
  assert.deepEqual(matching(['Travel', 'Work']).map(word => word.id), ['a', 'b']);
  assert.deepEqual(matching([], true).map(word => word.id), ['c']);
  assert.deepEqual(matching(['Work'], true).map(word => word.id), ['a', 'b', 'c']);
  assert.deepEqual(sortWords(matching(['Work'], true), 'newest').map((word: { id: string }) => word.id), ['b', 'c', 'a']);
  assert.deepEqual(matching(['Missing']), []);
});

test('stored sort choices restore valid options and fall back safely for absent or invalid preferences', () => {
  for (const option of WORD_SORT_OPTIONS) assert.equal(normalizeWordSort(option.value), option.value);
  for (const value of [null, undefined, '', 'removed-option']) assert.equal(normalizeWordSort(value), 'newest');
});

test('at-risk sorting excludes future reviews and resolves ties consistently', () => {
  const sorted = sortWords(words, 'risk', Date.parse('2026-01-02'));
  assert.deepEqual(sorted.map((word: { id: string }) => word.id), ['a', 'b', 'c', 'd']);
  const tied = [{ ...words[0], id: 'z' }, { ...words[0], id: 'a' }];
  assert.deepEqual(sortWords(tied, 'newest').map((word: { id: string }) => word.id), ['a', 'z']);
});
