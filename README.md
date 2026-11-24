# MyVocab - AI-Powered Vocabulary Learning App

A personal web app for learning English vocabulary with Arabic meanings. Uses AI to generate word suggestions and includes flashcard-based review with streak tracking.

## Features

- **AI Word Generator**: Generate vocabulary words by CEFR level (A2/B1/B2/C1) with optional topics
- **Manual Input**: Enter any English word and get AI-suggested Arabic meanings
- **Flashcards**: Review all words with flip cards and track known/problem status
- **Problem Deck**: Focused review on words you're struggling with
- **Streaks**: Daily activity tracking with current and longest streak display
- **Dashboard**: Overview of your learning progress and statistics

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **AI**: OpenAI GPT-4o-mini
- **Storage**: IndexedDB (browser-based, no server database needed)

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- OpenAI API key

### Setup

1. **Clone and install dependencies**:

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

2. **Configure environment**:

```bash
# In backend folder, create .env file
cd backend
cp .env.example .env
# Edit .env and add your OpenAI API key
```

3. **Start the servers**:

```bash
# Terminal 1: Start backend (port 3001)
cd backend
npm run dev

# Terminal 2: Start frontend (port 3000)
cd frontend
npm run dev
```

4. **Open the app**: Navigate to http://localhost:3000

## Project Structure

```
MyVocab cursor/
├── frontend/           # React frontend
│   ├── src/
│   │   ├── components/ # UI components
│   │   ├── db/         # IndexedDB schema (Dexie.js)
│   │   ├── stores/     # Zustand state management
│   │   ├── hooks/      # Custom React hooks
│   │   └── types/      # TypeScript interfaces
│   └── ...
├── backend/            # Express API server
│   ├── src/
│   │   ├── routes/     # API endpoints
│   │   ├── services/   # OpenAI integration
│   │   └── prompts/    # AI prompt templates
│   └── ...
└── README.md
```

## API Endpoints

- `POST /api/words/generate` - Generate vocabulary words by level
- `POST /api/words/suggest` - Get meanings for a specific word
- `GET /health` - Health check endpoint

## License

MIT

## Telegram streak reminders

Settings includes a Telegram configuration indicator, an on/off switch in the section header, a daily reminder time and IANA timezone (for example `Asia/Jerusalem`), and a **Send test message** button. Credentials stay on the backend; the browser never receives the bot token.

1. In Telegram, open the official [@BotFather](https://t.me/BotFather), send `/newbot`, and follow its prompts to choose a name and username. Copy the token it gives you and keep it private. See [Telegram's bot creation guide](https://core.telegram.org/bots/tutorial#obtain-your-bot-token).
2. Open your newly created bot's chat and press **Start**, or send `/start`.
3. Get your private chat ID using Telegram's [getUpdates API](https://core.telegram.org/bots/api#getupdates). In PowerShell, run the following locally, paste the token into the hidden prompt, and find the ID next to your Telegram name:

   ```powershell
   $telegramSecret = Read-Host 'Bot token' -AsSecureString
   $telegramToken = [System.Net.NetworkCredential]::new('', $telegramSecret).Password
   $telegramUpdates = Invoke-RestMethod -Method Post -Uri "https://api.telegram.org/bot$telegramToken/getUpdates" -Body @{ timeout = 0 }
   $telegramUpdates.result | ForEach-Object { $_.message.chat } | Select-Object id, first_name, username -Unique
   Remove-Variable telegramToken, telegramSecret, telegramUpdates
   ```

   If the list is empty, send the bot another message and try again. Use a dedicated bot: another process polling this bot or an existing webhook can interfere with `getUpdates`. No webhook or ongoing polling is needed for MyVocab reminders.
4. Add these lines to your existing `backend/.env` (do not replace your other settings):

   ```dotenv
   TELEGRAM_BOT_TOKEN=your_token_from_BotFather
   TELEGRAM_CHAT_ID=your_numeric_private_chat_id
   ```

5. Restart the backend. For the existing Docker Compose deployment, run `docker compose up -d --build --force-recreate web` from the project root; Compose already loads `backend/.env` and persists the SQLite database in `./data`.
6. Open **Settings**, confirm **Bot configured**, and expand **Telegram streak reminders** to send a test message. This confirms delivery; the configuration indicator itself only checks that both credentials are present.
7. Choose a time and timezone, click **Save Telegram settings**, then turn on reminders using the switch in the section header.

The backend checks once per minute, including on startup, so reminders work with the browser closed. Keep the server running with internet access to `api.telegram.org`. If it starts after the selected time, it checks the current day immediately; it does not replay missed days. Failed deliveries retry every five minutes, rechecking completion before each attempt. Successful deliveries and skipped days are persisted in SQLite to prevent repeat reminders after restarts or schedule edits. Settings shows the last scheduled delivery, skipped completion, or delivery error. Reminder settings/history remain in SQLite and are not included in JSON vocabulary exports.

Completion follows the application's existing **UTC streak day** (reset at 00:00 UTC), regardless of the reminder timezone. Reaching the configured daily review goal, or having already earned today's streak, suppresses the message. Flashcard reviews count as usual; word additions and practice tests do not. The test button sends immediately even when the goal is complete and does not consume the daily reminder. This is a personal, single-user application: the configured chat receives reminders for this installation's shared streak.

If delivery fails, check the token and chat ID, start the bot, and ensure it is not blocked. You can disable reminders in Settings at any time. If a token is exposed, revoke it with BotFather, update `backend/.env`, and restart the backend.

## Review reliability

Flashcard answers are saved before advancing or completing the session. The backend commits the word update, history event, daily count, and streak in one SQLite transaction. Retrying an unconfirmed answer in the current session reuses its review ID to avoid counting it twice.

Daily activity continues to use UTC calendar dates; existing history is not shifted. Adding a word does not count as a review. Practice tests remain separate from flashcard review counts.

Run regression checks with `cd backend` then `npm test`. The test launcher sets a unique temporary SQLite path before loading application modules, overriding any personal DB_PATH. Tests cover transaction rollback, duplicate requests, missing words, UTC rollover and streak goals, unchanged backup fields, and waiting/retrying before session advancement. CI runs these tests before building.

No database schema or JSON backup format changes are required by this update. Existing Google Drive destination and scheduling settings are unchanged.
