import { useEffect, useState } from 'react';
import axios from 'axios';

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
  const [config, setConfig] = useState<ReminderConfig>({ enabled: false, timeOfDay: '21:00', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' });
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
      setConfig(data.config);
    } catch (error) { setError(errorMessage(error)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError(''); setMessage('');
    try {
      const { data } = await axios.put<ReminderStatus>('/api/telegram', config);
      setStatus(data); setConfig(data.config);
      setMessage('Telegram reminder settings saved.');
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
    <section aria-labelledby="telegram-heading" className="bg-gray-800 rounded-xl border border-gray-700 p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="telegram-heading" className="text-base font-semibold text-white">Telegram streak reminders</h2>
        <span className={`text-sm ${status?.configured ? 'text-emerald-300' : 'text-amber-300'}`}>
          {loading ? 'Checking configuration...' : !status ? 'Configuration unavailable' : status.configured ? 'Bot configured' : 'Bot not configured'}
        </span>
      </div>
      <p className="text-sm text-gray-400">Get one reminder per day at your chosen time if your daily streak goal is still incomplete. Completed days are skipped. The server must be running; you can close the app.</p>
      {status && !status.configured && <p className="text-sm text-amber-200">Set {status.missing.join(' and ')} in backend/.env and restart the server. Setup instructions are below.</p>}
      {status?.configured && <p className="text-sm text-gray-400">Server credentials are present. Send a test message to confirm Telegram can deliver to your chat.</p>}
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {message && <p role="status" className="text-sm text-emerald-300">{message}</p>}
      {!status && !loading && <button type="button" onClick={() => void load()} className="text-sm text-emerald-300 underline">Retry loading settings</button>}
      <form onSubmit={save} className="space-y-4">
        <fieldset disabled={busy || loading || !status} className="space-y-4 disabled:opacity-60">
          <label className="flex items-center gap-3 text-sm text-white">
            <input type="checkbox" checked={config.enabled} disabled={!status?.configured} onChange={event => setConfig({ ...config, enabled: event.target.checked })} className="accent-emerald-500 h-4 w-4" />
            Enable daily Telegram reminder
          </label>
          <div className="grid sm:grid-cols-2 gap-4 max-w-xl">
            <label className="block text-sm text-gray-400 space-y-2"><span>Reminder time</span>
              <input type="time" required value={config.timeOfDay} onChange={event => setConfig({ ...config, timeOfDay: event.target.value })} className={inputClass} />
            </label>
            <label className="block text-sm text-gray-400 space-y-2"><span>Timezone</span>
              <input type="text" required list="telegram-timezones" placeholder="Asia/Jerusalem" value={config.timezone} onChange={event => setConfig({ ...config, timezone: event.target.value })} className={inputClass} />
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
          <li>Reload Settings, send a test message, choose your time and timezone, enable the reminder, and save.</li>
        </ol>
      </details>
    </section>
  );
}
