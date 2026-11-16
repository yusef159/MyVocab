import test from 'node:test';
import assert from 'node:assert/strict';

const helperUrl = new URL('../../../frontend/src/lib/flashcardSwipe.ts', import.meta.url);
const { createFlashcardSwipe } = await import(helperUrl.href);

test('horizontal swipes stay locked despite large vertical drift in either direction', () => {
  for (const direction of [-1, 1]) {
    const gesture = createFlashcardSwipe();
    gesture.start(200, 200);
    assert.equal(gesture.move(200 + direction * 15, 204).axis, 'horizontal');
    assert.equal(gesture.move(200 + direction * 90, 350).axis, 'horizontal');
    assert.equal(gesture.finish(200 + direction * 95, 380), direction > 0 ? 'known' : 'problem');
  }
});

test('vertical scrolling cannot become an answer after sideways finger drift', () => {
  const gesture = createFlashcardSwipe();
  gesture.start(100, 100);
  assert.deepEqual(gesture.move(102, 125), { axis: 'vertical', offset: 0 });
  assert.deepEqual(gesture.move(220, 140), { axis: 'vertical', offset: 0 });
  assert.equal(gesture.finish(250, 150), null);
});

test('taps, short drags, and canceled swipes never submit answers', () => {
  const gesture = createFlashcardSwipe();
  gesture.start(100, 100);
  assert.equal(gesture.finish(102, 101), null);
  gesture.start(100, 100);
  gesture.move(130, 102);
  assert.equal(gesture.finish(155, 105), null);
  gesture.start(100, 100);
  gesture.move(200, 105);
  gesture.cancel();
  assert.equal(gesture.finish(220, 110), null);
});

test('the release position determines the answer and each gesture resets its direction', () => {
  const gesture = createFlashcardSwipe();
  gesture.start(100, 100);
  gesture.move(125, 101);
  assert.equal(gesture.finish(190, 105), 'known');
  assert.equal(gesture.finish(190, 105), null);
  gesture.start(100, 100);
  gesture.move(99, 125);
  assert.equal(gesture.finish(0, 150), null);
  gesture.start(100, 100);
  gesture.move(80, 101);
  assert.equal(gesture.finish(0, 105), 'problem');
});

test('dragging back to the center cancels an answer and large offsets stay bounded', () => {
  const gesture = createFlashcardSwipe();
  gesture.start(100, 100);
  assert.equal(gesture.move(600, 110).offset, 160);
  assert.equal(gesture.move(-400, 110).offset, -160);
  assert.equal(gesture.finish(110, 110), null);
});
