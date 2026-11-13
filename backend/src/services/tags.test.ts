import test from 'node:test';
import Database from 'better-sqlite3';
import assert from 'node:assert/strict';
import { initDatabase, addWord, getAllWords, getTags, updateWordContent, deleteWord, exportFullBackup, importFullBackup } from '../db/index.js';

initDatabase();

test('words support multiple optional tags, deduplicate names and preserve recency when removing tags', () => {
  const first = addWord({ english: 'first', arabicMeanings: [], exampleSentences: [], tags: [' Travel ', 'travel', 'Work'] }).id!;
  const second = addWord({ english: 'second', arabicMeanings: [], exampleSentences: [], tags: ['Study'] }).id!;
  const plain = addWord({ english: 'plain', arabicMeanings: [], exampleSentences: [] }).id!;
  assert.deepEqual(getAllWords().find(w => w.id === plain)?.tags, []);
  assert.deepEqual(getAllWords().find(w => w.id === first)?.tags, ['Travel', 'Work']);
  assert.deepEqual(getTags().map(t => t.name), ['Study', 'Work', 'Travel']);
  updateWordContent(second, { tags: ['Study', 'travel'] });
  assert.deepEqual(getAllWords().find(w => w.id === second)?.tags, ['Study', 'Travel']);
  assert.deepEqual(getTags().map(t => t.name), ['Travel', 'Study', 'Work']);
  const recency = getTags();
  assert.equal(addWord({ english: 'first', arabicMeanings: [], exampleSentences: [], tags: ['Work'] }).isDuplicate, true);
  assert.deepEqual(getTags(), recency);
  updateWordContent(first, { englishMeaning: 'An explanation' });
  assert.deepEqual(getAllWords().find(w => w.id === first)?.tags, ['Travel', 'Work']);
  updateWordContent(first, { tags: ['Work'] });
  assert.deepEqual(getAllWords().find(w => w.id === first)?.tags, ['Work']);
  assert.deepEqual(getTags(), recency);
  updateWordContent(first, { tags: [] });
  assert.deepEqual(getAllWords().find(w => w.id === first)?.tags, []);
  deleteWord(second);
  assert.deepEqual(getTags(), recency, 'unused tags remain available and removals do not change recency');
});

test('backup round trip preserves multiple tags, unused tags and recent order; legacy backups still import', () => {
  addWord({ english: 'third', arabicMeanings: [], exampleSentences: [], tags: ['Work', 'Travel'] });
  const backup = exportFullBackup();
  importFullBackup(backup);
  assert.deepEqual(exportFullBackup().words, backup.words);
  assert.deepEqual(getTags(), backup.tags);
  const { tags, ...legacy } = backup;
  importFullBackup({ ...legacy, words: legacy.words.map(({ tag, tags, ...word }) => ({ ...word, tag: 'Legacy' })) });
  assert.ok(getAllWords().every(word => JSON.stringify(word.tags) === '["Legacy"]'));
  importFullBackup({ ...legacy, words: legacy.words.map(({ tag, tags, ...word }) => word) });
  assert.deepEqual(getTags(), []);
  assert.ok(getAllWords().every(word => word.tags?.length === 0));
});

test('existing single-tag database migrates without changing recency and does not restore removed tags', () => {
  const first = addWord({ english: 'migration', arabicMeanings: [], exampleSentences: [], tag: 'Legacy' }).id!;
  const recency = getTags();
  const connection = new Database(process.env.DB_PATH!);
  try {
    connection.prepare('UPDATE words SET tag = ? WHERE id = ?').run('Legacy', first);
    connection.exec('ALTER TABLE words DROP COLUMN tags');
    initDatabase();
    assert.deepEqual(getAllWords().find(w => w.id === first)?.tags, ['Legacy']);
    assert.deepEqual(getTags(), recency);
    updateWordContent(first, { tags: [] });
    initDatabase();
    assert.deepEqual(getAllWords().find(w => w.id === first)?.tags, []);
  } finally {
    connection.close();
  }
});

const helperUrl = new URL('../../../frontend/src/lib/flashcardFilters.ts', import.meta.url);
const { filterWords } = await import(helperUrl.href);

test('tag filter intersects every quiz group, defaults to all tags, and respects difficulty and dates', () => {
  const today = new Date();
  const make = (id: string, status: string, tag?: string, correctCount = 0) => ({
    id, english: id, status, tags: tag ? [tag] : [], arabicMeanings: [], exampleSentences: [],
    wrongCount: 10, correctCount, createdAt: today, streak: 0, interval: 1,
  });
  const words = [make('a', 'problem', 'Travel'), make('b', 'problem', 'Work'),
    make('c', 'new', 'Travel'), make('d', 'known', 'Travel', 30), make('e', 'known')];
  words[0].tags.push('Work');
  words[3].tags.push('Work');
  const risk = words.slice(3);
  const ids = (group: string, tag = '', progress?: string, days = 0) => filterWords(words, risk, group, days, progress, tag).map((w: { id: string }) => w.id);
  assert.deepEqual(ids('all'), ['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(ids('all', 'Travel'), ['a', 'c', 'd']);
  assert.deepEqual(ids('problem', 'Travel'), ['a']);
  assert.deepEqual(ids('problem', 'Work'), ['a', 'b']);
  assert.deepEqual(ids('risk', 'Work'), ['d']);
  assert.deepEqual(ids('all', 'Work'), ['a', 'b', 'd']);
  assert.deepEqual(ids('new', 'Travel'), ['c']);
  assert.deepEqual(ids('risk', 'Travel'), ['d']);
  assert.deepEqual(ids('date', 'Travel'), ['a', 'c', 'd']);
  assert.deepEqual(ids('all', 'Travel', 'moderate'), ['d']);
  assert.deepEqual(ids('problem', 'Travel', 'moderate'), []);
  assert.deepEqual(ids('all', 'Missing'), []);
  words[0].createdAt = new Date('2000-01-01');
  assert.deepEqual(ids('date', 'Travel', undefined, 7), ['c', 'd']);
});
