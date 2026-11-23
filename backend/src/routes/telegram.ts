import { Router } from 'express';
import { ZodError } from 'zod';
import { getTelegramReminderStatus, saveTelegramReminderConfig, sendTelegramMessage } from '../services/telegramReminder.js';

const router = Router();
router.get('/', (_req, res) => res.json(getTelegramReminderStatus()));
router.put('/', (req, res) => {
  try {
    res.json(saveTelegramReminderConfig(req.body));
  } catch (error) {
    res.status(400).json({ error: error instanceof ZodError ? error.issues[0].message : error instanceof Error ? error.message : 'Could not save Telegram reminders.' });
  }
});
router.post('/test', async (_req, res) => {
  try {
    await sendTelegramMessage('MyVocab test: your Telegram bot is connected. Scheduled reminders will only be sent if your daily streak goal is incomplete.');
    res.json({ ok: true });
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : 'Telegram test failed.' });
  }
});
export default router;
