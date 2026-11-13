import test from 'node:test';
import assert from 'node:assert/strict';
const helperUrl = new URL('../../../frontend/src/lib/reviewSubmission.ts', import.meta.url);
const { createReviewSubmission } = await import(helperUrl.href);

test('session waits for saving, blocks rapid clicks, and completes only after success', async () => {
 const submit = createReviewSubmission(); let finish!: (value: boolean) => void;
 let calls = 0; let advances = 0;
 const first = submit('word', 'known', () => { calls++; return new Promise<boolean>(r => { finish = r; }); }, () => advances++);
 assert.equal(advances, 0);
 await submit('word', 'known', async () => { calls++; return true; }, () => advances++);
 assert.equal(calls, 1);
 finish(true); await first;
 assert.equal(advances, 1);
});

test('failed save retains review ID and original answer for a safe retry', async () => {
 const submit = createReviewSubmission(); let firstId = ''; let advances = 0;
 await submit('word', 'problem', async (review: {id: string}) => { firstId = review.id; return false; }, () => advances++);
 assert.equal(advances, 0);
 await submit('word', 'known', async (review: {id: string; result: string}) => {
  assert.equal(review.id, firstId); assert.equal(review.result, 'problem'); return true;
 }, () => advances++);
 assert.equal(advances, 1);
});
