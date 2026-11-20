import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import {
  initDatabase, addWord, getAllWords, getWordStats, getStreakData,
  getWordReviewHistory, exportFullBackup, recordReview, updateStreak,
} from '../db/index.js';

const storeUrl = new URL('../../../frontend/src/stores/vocabStore.ts', import.meta.url);
const { useVocabStore } = await import(storeUrl.href);
const frontendRequire = createRequire(storeUrl);
const axiosUrl = new URL('./index.js', pathToFileURL(frontendRequire.resolve('axios/package.json')));
const { default: axios } = await import(axiosUrl.href);
initDatabase();

test('saving new words leaves review activity unchanged; actual reviews count once each', async () => {
  const originalAdapter = axios.defaults.adapter;
  const originalState = useVocabStore.getState();
  const requests: string[] = [];
  axios.defaults.adapter = async (config: { method: string; url: string; data?: string }) => {
    requests.push(`${config.method} ${config.url}`);
    let data: unknown;
    if (config.method === 'post' && config.url === '/api/data/words') {
      data = addWord(JSON.parse(config.data!));
    } else if (config.method === 'post' && config.url.endsWith('/review')) {
      const body = JSON.parse(config.data!);
      data = { streak: recordReview(config.url.split('/')[4], body.result, body.reviewId) };
    } else if (config.method === 'post' && config.url === '/api/data/streak/increment') {
      data = updateStreak();
    } else if (config.url === '/api/data/words') {
      data = { words: getAllWords() };
    } else if (config.url === '/api/data/words/stats') {
      data = getWordStats();
    } else if (config.url === '/api/data/streak') {
      data = getStreakData();
    } else if (config.url === '/api/data/tags') {
      data = { tags: [] };
    } else {
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    }
    return { data, status: 200, statusText: 'OK', headers: {}, config };
  };
  try {
    const before = getStreakData();
    const dailyCounts = exportFullBackup().dailyReviewCounts;
    const english = randomUUID();
    for (const value of [english, randomUUID()]) {
      assert.equal((await useVocabStore.getState().saveWord(value, ['test'], ['test'])).success, true);
    }
    assert.equal((await useVocabStore.getState().saveWord(english, ['test'], ['test'])).isDuplicate, true);
    assert.deepEqual(getStreakData(), before);
    assert.deepEqual(useVocabStore.getState().streak, before);
    assert.deepEqual(exportFullBackup().dailyReviewCounts, dailyCounts);
    assert.ok(!requests.includes('post /api/data/streak/increment'));
    const word = getAllWords().find(word => word.english === english)!;
    assert.equal(word.status, 'new');
    assert.equal(word.lastReviewedAt, undefined);
    assert.deepEqual(getWordReviewHistory(word.id), []);
    assert.equal(await useVocabStore.getState().markAsKnown(word.id, randomUUID()), true);
    assert.equal(getStreakData().reviewsToday, before.reviewsToday + 1);
    assert.equal(await useVocabStore.getState().markAsProblem(word.id, randomUUID()), true);
    assert.equal(getStreakData().reviewsToday, before.reviewsToday + 2);
    assert.equal(getWordReviewHistory(word.id).length, 2);
  } finally {
    axios.defaults.adapter = originalAdapter;
    useVocabStore.setState(originalState, true);
  }
});
