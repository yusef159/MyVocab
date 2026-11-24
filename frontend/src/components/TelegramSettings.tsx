import { useEffect, useState } from 'react';
import axios from 'axios';
import SettingsSection, { SettingsSwitch } from './SettingsSection';

interface ReminderConfig { enabled: boolean; timeOfDay: string; timezone: string }
interface ReminderStatus {
  configured: boolean;
  missing: string[];
  config: ReminderConfig;
  state: { lastSentAt?: string; lastError?: string; lastOutcome?: 'sent' | 'completed' | 'failed' };
}

function errorMessage(error: unknown): string {
  return axios.isAxiosError(error) && typeof error.response?.data?.error === 'string'
    ? error.response.data.error : 'Could not connect to Telegram settings. Please try again.';
}

export default function TelegramSettings() {
  const [status, setStatus] = useState<ReminderStatus | null>(null);
  const [schedule, setSchedule] = useState<Omit<ReminderConfig, 'enabled'>>({ timeOfDay: '21:00', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.get<ReminderStatus>('/api/telegram');
      setStatus(data);
      setSchedule({ timeOfDay: data.config.timeOfDay, timezone: data.config.timezone });
    } catch (error) { setError(errorMessage(error)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!status) return;
    await update({ ...schedule, enabled: status.config.enabled }, 'Telegram reminder settings saved.');
  }

  async function toggle(enabled: boolean) {
    if (!status) return;
    await update({ ...status.config, enabled }, enabled ? 'Telegram reminders turned on.' : 'Telegram reminders turned off.');
  }

  async function update(config: ReminderConfig, successMessage: string) {
    setBusy(true); setError(''); setMessage('');
    try {
      const { data } = await axios.put<ReminderStatus>('/api/telegram', config);
      setStatus(data);
      setMessage(successMessage);
    } catch (error) { setError(errorMessage(error)); }
    finally { setBusy(false); }
  }
  async function test() {
    setBusy(true); setError(''); setMessage('');
    try {
      await axios.post('/api/telegram/test');
      setMessage('Test message sent. Check your Telegram chat.');
    } catch (error) { setError(errorMessage(error)); }
    finally { setBusy(false); }
  }

  const inputClass = 'w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:border-emerald-500';
  return (
    <SettingsSection
      id="telegram"
      title="Telegram streak reminders"
      defaultExpanded={false}
      summary={
        <>
          <span className={status?.configured ? 'text-emerald-300' : 'text-amber-300'}>
            {loading ? 'Checking configuration...' : !status ? 'Configuration unavailable' : status.configured ? 'Bot configured' : 'Bot not configured'}
          </span>
          {' · '}
          {status?.configured
            ? status.config.enabled
              ? `Daily at ${status.config.timeOfDay} (${status.config.timezone}) if your goal is incomplete`
              : 'Reminders off'
            : 'Reminds you when your daily goal is incomplete'}
        </>
      }
      feedback={
        error ? <p role="alert" className="text-red-300">{error}</p>
          : message ? <p role="status" className="text-emerald-300">{message}</p> : null
      }
      action={
        <SettingsSwitch
          label="Daily Telegram reminders"
          checked={status?.config.enabled ?? false}
          disabled={busy || loading || !status || (!status.configured && !status.config.enabled)}
          onChange={enabled => void toggle(enabled)}
        />
      }
    >
      <p className="text-sm text-gray-400">Get one reminder per day at your chosen time if your daily streak goal is still incomplete. Completed days are skipped. The server must be running; you can close the app.</p>
      {status && !status.configured && <p className="text-sm text-amber-200">Set {status.missing.join(' and ')} in backend/.env and restart the server. Setup instructions are below.</p>}
      {status?.configured && <p className="text-sm text-gray-400">Server credentials are present. Send a test message to confirm Telegram can deliver to your chat.</p>}
      {!status && !loading && <button type="button" onClick={() => void load()} className="text-sm text-emerald-300 underline">Retry loading settings</button>}
      <form onSubmit={save} className="space-y-4">
        <fieldset disabled={busy || loading || !status} className="space-y-4 disabled:opacity-60">
          <div className="grid sm:grid-cols-2 gap-4 max-w-xl">
            <label className="block text-sm text-gray-400 space-y-2"><span>Reminder time</span>
              <input type="time" required value={schedule.timeOfDay} onChange={event => setSchedule({ ...schedule, timeOfDay: event.target.value })} className={inputClass} />
            </label>
            <label className="block text-sm text-gray-400 space-y-2"><span>Timezone</span>
              <input type="text" required list="telegram-timezones" placeholder="Asia/Jerusalem" value={schedule.timezone} onChange={event => setSchedule({ ...schedule, timezone: event.target.value })} className={inputClass} />
              <datalist id="telegram-timezones"><option value={Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'} /><option value="UTC" /><option value="Asia/Jerusalem" /></datalist>
            </label>
          </div>
          <p className="text-xs text-gray-400">Time uses the timezone above. Streak progress follows the app's existing UTC day and resets at 00:00 UTC. Flashcard reviews count toward the goal; adding words and practice tests do not.</p>
          <div className="flex flex-wrap gap-3">
            <button type="submit" className="px-5 py-3 rounded-lg font-medium bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50">{busy ? 'Working...' : 'Save Telegram settings'}</button>
            <button type="button" disabled={!status?.configured} onClick={() => void test()} className="px-5 py-3 rounded-lg font-medium bg-gray-700 text-white hover:bg-gray-600 disabled:opacity-50">Send test message</button>
          </div>
          <p className="text-xs text-gray-400">The test button sends immediately, even if today's goal is complete, and does not change the daily reminder schedule.</p>
        </fieldset>
      </form>
      {status?.state.lastSentAt && <p className="text-sm text-gray-400">Last scheduled message: {new Date(status.state.lastSentAt).toLocaleString()}</p>}
      {status?.state.lastOutcome === 'completed' && <p className="text-sm text-emerald-300">Last reminder skipped: daily streak already complete.</p>}
      {status?.state.lastError && <p className="text-sm text-red-300">Last scheduled delivery failed: {status.state.lastError} Retrying every 5 minutes while due.</p>}
      <details className="text-sm text-gray-400 space-y-2">
        <summary className="cursor-pointer text-gray-200">How to set up your Telegram bot</summary>
        <ol className="list-decimal pl-5 space-y-2">
          <li>Open <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-emerald-300 underline">@BotFather</a> in Telegram, send /newbot, and follow the prompts. Keep the bot token private.</li>
          <li>Open your new bot and press Start or send /start.</li>
          <li>Use Telegram's getUpdates API with your token to find message.chat.id. See README.md for a PowerShell command that retrieves it.</li>
          <li>Add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to backend/.env, then restart the backend (or recreate your Docker container).</li>
          <li>Reload Settings, send a test message, save your time and timezone, then turn on reminders using the switch at the top of this section.</li>
        </ol>
      </details>
    </SettingsSection>
  );
}
