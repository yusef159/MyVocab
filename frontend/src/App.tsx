import { Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import Dashboard from './components/Dashboard';
import WordGenerator from './components/WordGenerator';
import ManualInput from './components/ManualInput';
import WordList from './components/WordList';
import Flashcards from './components/Flashcards';
import TestTab from './components/TestTab';
import GrammarTab from './components/GrammarTab';
import ReadingFluencyTab from './components/ReadingFluencyTab';
import Settings from './components/Settings';
import { useVocabStore } from './stores/vocabStore';

function App() {
  const { loadStats, loadStreak } = useVocabStore();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    loadStats();
    loadStreak();
  }, [loadStats, loadStreak]);

  return (
    <div className="min-h-screen bg-gray-900">
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-6xl mx-auto px-4 py-3 sm:py-4 flex justify-center">
          <img src="/logo.png" alt="MyVocab" className="h-14 sm:h-20" />
        </div>
      </header>

      <nav className="bg-gray-800/50 border-b border-gray-700">
        <div className="max-w-6xl mx-auto px-2 sm:px-4">
          <div className="flex gap-1 py-2 overflow-x-auto whitespace-nowrap scrollbar-thin">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `flex-shrink-0 px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`
              }
            >
              Home
            </NavLink>
            <NavLink
              to="/words"
              className={({ isActive }) =>
                `flex-shrink-0 px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base transition-colors ${
                  isActive
                    ? 'bg-emerald-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`
              }
            >
              My Words
            </NavLink>
            <NavLink
              to="/flashcards"
              onClick={(e) => {
                // Re-clicking Flashcards while already on it returns to the options screen
                if (location.pathname === '/flashcards') {
                  e.preventDefault();
                  navigate('/flashcards', {
                    replace: true,
                    state: { resetToOptions: Date.now() },
                  });
                }
              }}
              className={({ isActive }) =>
                `flex-shrink-0 px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base transition-colors ${
                  isActive
                    ? 'bg-emerald-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`
              }
            >
              Flashcards
            </NavLink>
            <NavLink
              to="/generate"
              className={({ isActive }) =>
                `flex-shrink-0 px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base transition-colors ${
                  isActive
                    ? 'bg-emerald-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`
              }
            >
              Generate Words
            </NavLink>
            <NavLink
              to="/manual"
              className={({ isActive }) =>
                `flex-shrink-0 px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base transition-colors ${
                  isActive
                    ? 'bg-emerald-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`
              }
            >
              Manual Input
            </NavLink>
            <NavLink
              to="/test"
              className={({ isActive }) =>
                `flex-shrink-0 px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base transition-colors ${
                  isActive
                    ? 'bg-emerald-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`
              }
            >
              Test
            </NavLink>
            <NavLink
              to="/grammar"
              className={({ isActive }) =>
                `flex-shrink-0 px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base transition-colors ${
                  isActive
                    ? 'bg-emerald-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`
              }
            >
              Grammar
            </NavLink>
            <NavLink
              to="/reading"
              className={({ isActive }) =>
                `flex-shrink-0 px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`
              }
            >
              Reading Fluency
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `flex-shrink-0 min-w-[2.75rem] px-3 py-2 rounded-lg text-sm transition-colors inline-flex items-center justify-center ${
                  isActive
                    ? 'bg-gray-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`
              }
              title="Settings"
              aria-label="Settings"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </NavLink>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-5 sm:py-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/generate" element={<WordGenerator />} />
          <Route path="/manual" element={<ManualInput />} />
          <Route path="/words" element={<WordList />} />
          <Route path="/flashcards" element={<Flashcards />} />
          <Route path="/test" element={<TestTab />} />
          <Route path="/grammar" element={<GrammarTab />} />
          <Route path="/reading" element={<ReadingFluencyTab />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
