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

## Review reliability

Flashcard answers are saved before advancing or completing the session. The backend commits the word update, history event, daily count, and streak in one SQLite transaction. Retrying an unconfirmed answer in the current session reuses its review ID to avoid counting it twice.

Daily activity continues to use UTC calendar dates; existing history is not shifted. Adding a word still counts as activity. Practice tests remain separate from flashcard review counts.

Run regression checks with `cd backend` then `npm test`. The test launcher sets a unique temporary SQLite path before loading application modules, overriding any personal DB_PATH. Tests cover transaction rollback, duplicate requests, missing words, UTC rollover and streak goals, unchanged backup fields, and waiting/retrying before session advancement. CI runs these tests before building.

No database schema or JSON backup format changes are required by this update. Existing Google Drive destination and scheduling settings are unchanged.
