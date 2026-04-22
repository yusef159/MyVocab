import { Routes, Route, NavLink } from 'react-router-dom';
import { useEffect } from 'react';
import Dashboard from './components/Dashboard';
import WordGenerator from './components/WordGenerator';
import ManualInput from './components/ManualInput';
import WordList from './components/WordList';
import Flashcards from './components/Flashcards';
import TestTab from './components/TestTab';
import GrammarTab from './components/GrammarTab';
import ReadingFluencyTab from './components/ReadingFluencyTab';
import { useVocabStore } from './stores/vocabStore';

function App() {
  const { loadStats, loadStreak } = useVocabStore();

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
                `px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`
              }
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/generate"
              className={({ isActive }) =>
                `px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base transition-colors ${
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
                `px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base transition-colors ${
                  isActive
                    ? 'bg-emerald-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`
              }
            >
              Manual Input
            </NavLink>
            <NavLink
              to="/words"
              className={({ isActive }) =>
                `px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base transition-colors ${
                  isActive
                    ? 'bg-emerald-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`
              }
            >
              My Words
            </NavLink>
            <NavLink
              to="/test"
              className={({ isActive }) =>
                `px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base transition-colors ${
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
                `px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base transition-colors ${
                  isActive
                    ? 'bg-emerald-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`
              }
            >
              Grammar
            </NavLink>
            <NavLink
              to="/flashcards"
              className={({ isActive }) =>
                `px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base transition-colors ${
                  isActive
                    ? 'bg-emerald-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`
              }
            >
              Flashcards
            </NavLink>
            <NavLink
              to="/reading"
              className={({ isActive }) =>
                `px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`
              }
            >
              Reading Fluency
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
        </Routes>
      </main>
    </div>
  );
}

export default App;
