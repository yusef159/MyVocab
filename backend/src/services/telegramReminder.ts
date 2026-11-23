import { z } from 'zod';
import { getAppStateJson, saveAppStateJson, getReviewCountsByDateRange, getStreakDailyGoal, getStreakData } from '../db/index.js';

export const telegramReminderSchema = z.object({
  enabled: z.boolean(),
  timeOfDay: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm (24-hour time).'),
  timezone: z.string().min(1).max(100).refine(value => {
    try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; }
  }, 'Choose a valid IANA timezone, such as Asia/Jerusalem.'),
});
export type TelegramReminderConfig = z.infer<typeof telegramReminderSchema>;
interface ReminderState {
  handledLocalDate?: string;
  lastAttemptAt?: string;
  lastSentAt?: string;
  lastError?: string;
  lastOutcome?: 'sent' | 'completed' | 'failed';
}

const CONFIG_KEY = 'telegram:reminder_config';
const STATE_KEY = 'telegram:reminder_state';
const RETRY_MS = 5 * 60_000;
let timer: NodeJS.Timeout | null = null;
let running = false;

function credentials() {
  return { token: process.env.TELEGRAM_BOT_TOKEN?.trim(), chatId: process.env.TELEGRAM_CHAT_ID?.trim() };
}

export function getTelegramReminderStatus() {
  const { token, chatId } = credentials();
  return {
    config: getAppStateJson<TelegramReminderConfig>(CONFIG_KEY) ?? { enabled: false, timeOfDay: '21:00', timezone: 'UTC' },
    configured: Boolean(token && chatId),
    missing: [!token && 'TELEGRAM_BOT_TOKEN', !chatId && 'TELEGRAM_CHAT_ID'].filter(Boolean) as string[],
    state: getAppStateJson<ReminderState>(STATE_KEY) ?? {},
  };
}

export function saveTelegramReminderConfig(input: unknown) {
  const config = telegramReminderSchema.parse(input);
  if (config.enabled && !getTelegramReminderStatus().configured) {
    throw new Error('Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID on the server before enabling reminders.');
  }
  // Preserve delivery history when editing or toggling the schedule.
  saveAppStateJson(CONFIG_KEY, config);
  return getTelegramReminderStatus();
}

export async function sendTelegramMessage(text: string): Promise<void> {
  const { token, chatId } = credentials();
  if (!token || !chatId) throw new Error('Telegram is not configured on the server.');
  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    // Fetch errors may contain the request URL (and therefore the bot token).
    throw new Error('Could not reach Telegram. Check the server internet connection and try again.');
  }
  const result = await response.json().catch(() => null) as { ok?: boolean } | null;
  if (!response.ok || !result?.ok) {
    throw new Error(`Telegram rejected the message (HTTP ${response.status}). Check the bot token and chat ID, start the bot, and ensure it is not blocked.`);
  }
}

function localClock(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const part = (type: string) => parts.find(value => value.type === type)!.value;
  return { date: `${part('year')}-${part('month')}-${part('day')}`, time: `${part('hour')}:${part('minute')}` };
}

export async function runTelegramReminderTick(now = new Date(), send = sendTelegramMessage): Promise<void> {
  if (running) return;
  running = true;
  try {
    const { config, configured, state } = getTelegramReminderStatus();
    if (!configured || !config.enabled) return;
    const local = localClock(now, config.timezone);
    if (local.time < config.timeOfDay || state.handledLocalDate === local.date) return;
    if (state.lastAttemptAt && now.getTime() - Date.parse(state.lastAttemptAt) < RETRY_MS) return;

    // Use the same UTC day, daily activity count, and goal as the streak UI.
    const today = now.toISOString().slice(0, 10);
    const count = getReviewCountsByDateRange(today, today)[0].count;
    const goal = getStreakDailyGoal();
    if (count >= goal || getStreakData().lastActivityDate === today) {
      saveAppStateJson(STATE_KEY, { ...state, handledLocalDate: local.date, lastOutcome: 'completed', lastError: undefined });
      return;
    }
    const attempted = { ...state, lastAttemptAt: now.toISOString() };
    saveAppStateJson(STATE_KEY, attempted);
    try {
      await send(`MyVocab reminder: take a quiz and finish today's streak before the day ends! You have completed ${count}/${goal} daily reviews (${goal - count} remaining). Your streak day resets at 00:00 UTC.`);
      saveAppStateJson(STATE_KEY, { ...attempted, handledLocalDate: local.date, lastSentAt: now.toISOString(), lastOutcome: 'sent', lastError: undefined });
    } catch (error) {
      saveAppStateJson(STATE_KEY, { ...attempted, lastOutcome: 'failed', lastError: error instanceof Error ? error.message : 'Telegram delivery failed.' });
    }
  } finally {
    running = false;
  }
}

export function startTelegramReminderScheduler(): void {
  if (timer) return;
  const tick = () => void runTelegramReminderTick().catch(() => console.error('Telegram reminder scheduler failed.'));
  tick();
  timer = setInterval(tick, 60_000);
}

export function stopTelegramReminderScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
