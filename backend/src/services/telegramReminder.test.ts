import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';
import express from 'express';
import telegramRouter from '../routes/telegram.js';
import { initDatabase, saveAppStateJson } from '../db/index.js';
import { getTelegramReminderStatus, saveTelegramReminderConfig, runTelegramReminderTick, sendTelegramMessage } from './telegramReminder.js';

initDatabase();
const db = new Database(process.env.DB_PATH!);
function reset(timezone = 'UTC', timeOfDay = '21:00') {
  process.env.TELEGRAM_BOT_TOKEN = 'test-secret-token';
  process.env.TELEGRAM_CHAT_ID = '1234';
  db.prepare('DELETE FROM daily_review_counts').run();
  db.prepare('DELETE FROM streak_data').run();
  saveAppStateJson('telegram:reminder_state', {});
  saveAppStateJson('streak:daily_goal', 20);
  saveTelegramReminderConfig({ enabled: true, timeOfDay, timezone });
}
const at = (value: string) => new Date(value);

test('missing credentials, disabled reminders and times before the schedule never send', async () => {
  reset();
  let sends = 0;
  const send = async () => { sends++; };
  await runTelegramReminderTick(at('2026-11-23T20:59:00Z'), send);
  delete process.env.TELEGRAM_BOT_TOKEN;
  assert.equal(getTelegramReminderStatus().configured, false);
  assert.deepEqual(getTelegramReminderStatus().missing, ['TELEGRAM_BOT_TOKEN']);
  await runTelegramReminderTick(at('2026-11-23T21:00:00Z'), send);
  assert.throws(() => saveTelegramReminderConfig({ enabled: true, timeOfDay: '21:00', timezone: 'UTC' }), /TELEGRAM_BOT_TOKEN/);
  process.env.TELEGRAM_BOT_TOKEN = 'test-secret-token';
  saveTelegramReminderConfig({ enabled: false, timeOfDay: '21:00', timezone: 'UTC' });
  await runTelegramReminderTick(at('2026-11-23T21:00:00Z'), send);
  assert.equal(sends, 0);
});

test('reminds once when incomplete, persists deduplication across settings changes and catches up after downtime', async () => {
  reset();
  db.prepare('INSERT INTO daily_review_counts (date, count) VALUES (?, ?)').run('2026-11-23', 7);
  const messages: string[] = [];
  const send = async (text: string) => { messages.push(text); };
  await runTelegramReminderTick(at('2026-11-23T22:30:00Z'), send);
  assert.match(messages[0], /7\/20.*13 remaining/);
  assert.equal(getTelegramReminderStatus().state.lastSentAt, '2026-11-23T22:30:00.000Z');
  saveTelegramReminderConfig({ enabled: true, timeOfDay: '20:00', timezone: 'UTC' });
  await runTelegramReminderTick(at('2026-11-23T23:00:00Z'), send);
  assert.equal(messages.length, 1);
  await runTelegramReminderTick(at('2026-11-24T21:00:00Z'), send);
  assert.equal(messages.length, 2);
  assert.match(messages[1], /0\/20/);
});

test('completed goals and already-earned streak days suppress scheduled messages', async () => {
  for (const count of [20, 25]) {
    reset();
    db.prepare('INSERT INTO daily_review_counts (date, count) VALUES (?, ?)').run('2026-11-23', count);
    await runTelegramReminderTick(at('2026-11-23T21:00:00Z'), async () => { assert.fail('completed day sent a reminder'); });
    assert.equal(getTelegramReminderStatus().state.lastOutcome, 'completed');
  }
  reset();
  db.prepare("INSERT INTO streak_data (id, last_activity_date) VALUES ('main-streak', '2026-11-23')").run();
  saveAppStateJson('streak:daily_goal', 40);
  await runTelegramReminderTick(at('2026-11-23T21:00:00Z'), async () => { assert.fail('already earned streak sent a reminder'); });
});

test('chosen timezone observes DST and completion uses UTC rather than local date', async () => {
  reset('Asia/Jerusalem');
  let sends = 0;
  const send = async () => { sends++; };
  await runTelegramReminderTick(at('2026-07-01T17:59:00Z'), send);
  assert.equal(sends, 0);
  await runTelegramReminderTick(at('2026-07-01T18:00:00Z'), send);
  assert.equal(sends, 1);
  reset('Asia/Jerusalem');
  await runTelegramReminderTick(at('2026-11-23T18:59:00Z'), send);
  assert.equal(sends, 1);
  await runTelegramReminderTick(at('2026-11-23T19:00:00Z'), send);
  assert.equal(sends, 2);
  reset('Asia/Jerusalem', '00:30');
  db.prepare('INSERT INTO daily_review_counts (date, count) VALUES (?, ?)').run('2026-11-23', 20);
  await runTelegramReminderTick(at('2026-11-23T22:30:00Z'), async () => { assert.fail('UTC completed day must be skipped'); });
  assert.equal(getTelegramReminderStatus().state.handledLocalDate, '2026-11-24');
});

test('failures retry after five minutes and recheck completion before sending', async () => {
  reset();
  let attempts = 0;
  const fail = async () => { attempts++; throw new Error('offline'); };
  await runTelegramReminderTick(at('2026-11-23T21:00:00Z'), fail);
  assert.equal(getTelegramReminderStatus().state.lastError, 'offline');
  await runTelegramReminderTick(at('2026-11-23T21:01:00Z'), fail);
  assert.equal(attempts, 1);
  await runTelegramReminderTick(at('2026-11-23T21:05:00Z'), fail);
  assert.equal(attempts, 2);
  db.prepare('INSERT INTO daily_review_counts (date, count) VALUES (?, ?)').run('2026-11-23', 20);
  await runTelegramReminderTick(at('2026-11-23T21:10:00Z'), fail);
  assert.equal(attempts, 2);
  assert.equal(getTelegramReminderStatus().state.lastError, undefined);
});

test('overlapping ticks cannot send the same reminder concurrently', async () => {
  reset();
  let finish!: () => void;
  let calls = 0;
  const pending = runTelegramReminderTick(at('2026-11-23T21:00:00Z'), async () => {
    calls++;
    await new Promise<void>(resolve => { finish = resolve; });
  });
  await runTelegramReminderTick(at('2026-11-23T21:01:00Z'), async () => { calls++; });
  finish();
  await pending;
  assert.equal(calls, 1);
});

test('rejects malformed schedules and validates Telegram responses without exposing the token', async () => {
  reset();
  for (const config of [
    { enabled: true, timeOfDay: '24:00', timezone: 'UTC' },
    { enabled: true, timeOfDay: '21:00', timezone: 'invalid/timezone' },
    { enabled: 'true', timeOfDay: '21:00', timezone: 'UTC' },
  ]) assert.throws(() => saveTelegramReminderConfig(config));
  assert.ok(!JSON.stringify(getTelegramReminderStatus()).includes('test-secret-token'));
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://api.telegram.org/bottest-secret-token/sendMessage');
      assert.deepEqual(JSON.parse(options!.body as string), { chat_id: '1234', text: 'hello' });
      return new Response(JSON.stringify({ ok: true }));
    };
    await sendTelegramMessage('hello');
    globalThis.fetch = async () => new Response(JSON.stringify({ ok: false }), { status: 403 });
    await assert.rejects(sendTelegramMessage('hello'), /HTTP 403/);
    globalThis.fetch = async () => { throw new Error('https://api.telegram.org/bottest-secret-token/sendMessage'); };
    await assert.rejects(sendTelegramMessage('hello'), error => error instanceof Error && !error.message.includes('test-secret-token'));
  } finally { globalThis.fetch = originalFetch; }
});

test('settings API reports configuration, persists validated schedules and sends explicit tests independently of completion', async () => {
  reset();
  const originalFetch = globalThis.fetch;
  const app = express();
  app.use(express.json());
  app.use('/api/telegram', telegramRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address() as { port: number };
  const url = `http://127.0.0.1:${address.port}/api/telegram`;
  try {
    delete process.env.TELEGRAM_CHAT_ID;
    let response = await originalFetch(url);
    let status = await response.json() as ReturnType<typeof getTelegramReminderStatus>;
    assert.equal(status.configured, false);
    response = await originalFetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: true, timeOfDay: '21:00', timezone: 'UTC' }) });
    assert.equal(response.status, 400);
    response = await originalFetch(`${url}/test`, { method: 'POST' });
    assert.equal(response.status, 502);
    process.env.TELEGRAM_CHAT_ID = '1234';
    response = await originalFetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: true, timeOfDay: '19:30', timezone: 'Asia/Jerusalem' }) });
    assert.equal(response.status, 200);
    status = await response.json() as ReturnType<typeof getTelegramReminderStatus>;
    assert.deepEqual(status.config, { enabled: true, timeOfDay: '19:30', timezone: 'Asia/Jerusalem' });
    assert.ok(!JSON.stringify(status).includes('test-secret-token'));
    const today = new Date().toISOString().slice(0, 10);
    db.prepare('INSERT INTO daily_review_counts (date, count) VALUES (?, ?)').run(today, 20);
    let testsSent = 0;
    globalThis.fetch = async () => { testsSent++; return new Response(JSON.stringify({ ok: true })); };
    response = await originalFetch(`${url}/test`, { method: 'POST' });
    assert.equal(response.status, 200);
    assert.equal(testsSent, 1);
    assert.deepEqual(getTelegramReminderStatus().state, {}, 'manual test must not consume the scheduled reminder');
  } finally {
    globalThis.fetch = originalFetch;
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
