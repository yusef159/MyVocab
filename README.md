# MyVocab

MyVocab is a personal app for learning English vocabulary with Arabic meanings. Build a word list, review it with flashcards, and track your progress from the dashboard.

- **Vocabulary** — Generate words by CEFR level or topic, look up meanings for words you enter, organize words with tags, or schedule automatic word generation.
- **Review and practice** — Use spaced repetition, focus on at-risk or problem words, take quick quizzes and practice tests, and work through grammar and reading-aloud exercises with AI feedback.
- **Streaks and reminders** — Set a daily review goal and a correct-answer streak for problem words. The daily streak resets at 00:00 UTC. Flashcard reviews count toward it. Adding words and taking practice tests do not.
- **Backups** — Export or restore a JSON backup from **My Words**, or schedule backups to Google Drive from **Settings**.

## Run with Docker Compose

Docker Compose runs the Express API and the built React frontend in one service named `web`. From the repository root, copy the example environment file if `backend/.env` does not already exist:

```sh
cp backend/.env.example backend/.env
```

Set `OPENAI_API_KEY` in `backend/.env` to enable AI features. Then start the app:

```sh
docker compose up -d --build web
docker compose ps web
```

Open `http://localhost:4000` on the Docker host, or use the host's IP address from another device. The health endpoint is `/api/health`. To troubleshoot startup, run `docker compose logs --tail=50 web`.

### Update the Raspberry Pi

The [deployment workflow](.github/workflows/deploy.yml) pulls `main` into `~/apps/myVocab` on the Pi and rebuilds on pushes to `main` when GitHub Actions is configured for that host. For a manual update, run the following on the Pi once the updated code is in that folder:

```sh
cd ~/apps/myVocab
docker compose up -d --build web
```

Frontend and backend compilation use separate Docker build stages. Docker can reuse unchanged layers. To see which steps are being rebuilt, run `docker compose --progress plain build web` from the same folder.

If you only changed `backend/.env`, recreate the container to load the new values without building:

```sh
docker compose up -d --force-recreate web
```

Compose stores SQLite data in `./data/myvocab.db` on the host. Container recreation keeps that directory in place.

## Run locally without Docker

Use Node.js 22 or 24 with npm. From the repository root, create or update `backend/.env` using [the example file](backend/.env.example), then run:

```sh
npm --prefix frontend ci
npm --prefix backend ci
npm --prefix frontend run build
cd backend
npm run dev
```

Open `http://localhost:4000`. Express serves the compiled frontend alongside the API. The frontend uses relative `/api` URLs, so the standalone Vite server on port 3000 needs an API proxy for full app functionality. With the commands above, rebuild from the repository root with `npm --prefix frontend run build` after frontend changes. The backend watcher handles changes to backend source files.

## Settings

Telegram reminders, Google Drive Backup, Daily Streak Goal, and Problem Word Streak can each be expanded or collapsed. Each card shows a summary of its saved settings and remembers its open or closed state in the same browser. The Telegram and Google Drive switches work from their headers, even when the details are collapsed.

### Telegram streak reminders

1. To create a bot, send `/newbot` to [@BotFather](https://t.me/BotFather) and follow the prompts. For an existing bot, use its current token. [Telegram bot setup guide](https://core.telegram.org/bots/tutorial#obtain-your-bot-token)
2. Open the bot's private chat, press **Start**, and send a message.
3. Find your chat ID in `message.chat.id` using Telegram's [getUpdates API](https://core.telegram.org/bots/api#getupdates). On Windows, you can run this PowerShell snippet and paste the token at the hidden prompt:

   ```powershell
   $telegramSecret = Read-Host 'Bot token' -AsSecureString
   $telegramToken = [System.Net.NetworkCredential]::new('', $telegramSecret).Password
   try {
     $telegramUpdates = Invoke-RestMethod -Method Post -Uri "https://api.telegram.org/bot$telegramToken/getUpdates" -Body @{ timeout = 0 }
     $telegramUpdates.result | ForEach-Object { $_.message.chat } |
       Where-Object { $_.type -eq 'private' } | Select-Object id, first_name, username -Unique
   } finally {
     Remove-Variable telegramToken, telegramSecret, telegramUpdates -ErrorAction SilentlyContinue
   }
   ```

   If the response is empty, send the bot a fresh message and try again. If another app already receives this bot's updates, use the chat ID from that app's incoming message data. MyVocab only sends messages.
4. Add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` to `backend/.env` on the machine running MyVocab. Keep the token private. [Recreate the Docker container](#update-the-raspberry-pi) or restart the local backend.
5. Open **Settings → Telegram streak reminders**. **Bot configured** means both values are present. Click **Send test message** to confirm delivery, save a time and timezone such as `Asia/Jerusalem`, then turn reminders on using the header switch.

The server sends a reminder only if the daily goal is incomplete at the scheduled check. The reminder time uses your chosen timezone, while streak completion uses the app's UTC day. The browser can be closed as long as the server is running. Test messages send immediately, even if the goal is complete.

### Google Drive backup and restore

Configure an rclone Google Drive remote on the host. If its configuration file is outside the default path in [docker-compose.yml](docker-compose.yml), set `RCLONE_CONFIG_FILE` to the host file path in the repository-root `.env` that Compose reads. You can also set `BACKUP_GDRIVE_DEST` there to override the default destination. Recreate the container after making either change.

In **Settings → Google Drive Backup**, use a destination such as `gdrive:MyVocab backup/myvocab-backup.json`. Choose a daily, weekly, or monthly schedule and use the header switch to enable it. Use **Backup Now** to verify an upload and check the last run status in Settings.

A JSON backup contains words, tags, review history, daily counts, streaks, and grammar progress. Restoring replaces those records. Server configuration, reminder and backup schedules, and browser preferences are kept separately. If you're moving from an older browser-only version, **My Words** also has an option to import legacy IndexedDB data from the browser that contains it.

## Project layout and checks

| Path | Contents |
| --- | --- |
| [frontend/](frontend/) | React, TypeScript, Vite, Tailwind CSS, and Zustand. Dexie reads legacy IndexedDB data for migration. |
| [backend/](backend/) | Express API, SQLite via better-sqlite3, background schedules, and OpenAI integrations. |
| [Dockerfile](Dockerfile) and [docker-compose.yml](docker-compose.yml) | Build and runtime definitions for the `web` service. |

Useful API routes include `GET /api/health`, `GET /api/data/streak`, `POST /api/data/words/:id/review`, `GET /api/data/backup/schedule`, and `GET /api/telegram`.

After installing both sets of dependencies, run these checks from the repository root:

```sh
npm --prefix backend test
npm --prefix backend run build
npm --prefix frontend run build
```

The backend test launcher uses a temporary SQLite database. Review tests cover saving answers before advancing, avoiding double counts on retries, and keeping word updates, review history, daily counts, and streaks in one transaction. [CI](.github/workflows/build.yml) runs the backend tests, builds both packages, and checks the Docker image build.

## License

MIT
