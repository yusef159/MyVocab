import assert from 'node:assert/strict';
import test from 'node:test';
import { collectUniqueSuggestions, computeNextRunAt } from './autoWordScheduler.js';
import type { WordSuggestion } from './openai.js';

test('computeNextRunAt daily uses same day when still upcoming', () => {
  const next = computeNextRunAt(
    {
      cadence: 'daily',
      timezone: 'UTC',
      timeOfDay: '09:00',
    },
    new Date('2026-01-01T08:00:00.000Z')
  );
  assert.equal(next, '2026-01-01T09:00:00.000Z');
});

test('computeNextRunAt daily rolls to next day when time passed', () => {
  const next = computeNextRunAt(
    {
      cadence: 'daily',
      timezone: 'UTC',
      timeOfDay: '09:00',
    },
    new Date('2026-01-01T09:30:00.000Z')
  );
  assert.equal(next, '2026-01-02T09:00:00.000Z');
});

test('computeNextRunAt weekly respects weekday', () => {
  const next = computeNextRunAt(
    {
      cadence: 'weekly',
      timezone: 'UTC',
      timeOfDay: '09:00',
      dayOfWeek: 1,
    },
    new Date('2026-01-05T10:00:00.000Z')
  );
  assert.equal(next, '2026-01-12T09:00:00.000Z');
});

test('computeNextRunAt monthly handles short months', () => {
  const next = computeNextRunAt(
    {
      cadence: 'monthly',
      timezone: 'UTC',
      timeOfDay: '09:00',
      dayOfMonth: 31,
    },
    new Date('2026-01-31T10:00:00.000Z')
  );
  assert.equal(next, '2026-02-28T09:00:00.000Z');
});

test('collectUniqueSuggestions filters duplicates and existing words', () => {
  const existing = new Set<string>(['hello']);
  const selected = new Map<string, WordSuggestion>();
  const generated: WordSuggestion[] = [
    {
      english: 'hello',
      arabicMeanings: ['مرحبا'],
      exampleSentences: ['Hello there'],
    },
    {
      english: ' travel ',
      arabicMeanings: ['سفر'],
      exampleSentences: ['I travel a lot'],
    },
    {
      english: 'Travel',
      arabicMeanings: ['السفر'],
      exampleSentences: ['Travel broadens the mind'],
    },
  ];

  const result = collectUniqueSuggestions({
    generated,
    existingNormalizedWords: existing,
    selectedByNormalizedWord: selected,
    maxAccepted: 3,
  });

  assert.equal(result.acceptedCount, 1);
  assert.equal(result.skippedCount, 2);
  assert.equal(selected.size, 1);
  assert.ok(selected.has('travel'));
});
