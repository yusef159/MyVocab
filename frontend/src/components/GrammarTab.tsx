import { useEffect, useMemo, useState, useCallback } from 'react';
import { useGrammarStore } from '../stores/grammarStore';
import { LEVEL_COLORS } from '../lib/grammarCatalog';
import type { GrammarLevelId, GrammarSkill, GrammarExercise, GrammarAnswerEvaluation } from '../types';

// ─── Level Pill ──────────────────────────────────────────────────────

function LevelPill({ id, title, active, mastered, total, onClick }: {
  id: GrammarLevelId; title: string; active: boolean; mastered: number; total: number; onClick: () => void;
}) {
  const colors = LEVEL_COLORS[id];
  const pct = total > 0 ? Math.round((mastered / total) * 100) : 0;

  return (
    <button type="button" onClick={onClick} className={`
      relative flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all duration-200
      ${active ? `bg-gradient-to-r ${colors.gradient} border ${colors.border}/40 shadow-lg shadow-${id === 'A1' ? 'green' : id === 'A2' ? 'teal' : id === 'B1' ? 'blue' : id === 'B2' ? 'indigo' : id === 'C1' ? 'purple' : 'amber'}-500/10` : 'bg-gray-800/60 border border-gray-700/50 hover:bg-gray-800 hover:border-gray-600'}
    `}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${active ? `${colors.bg}/20 ${colors.text}` : 'bg-gray-700/50 text-gray-400'}`}>
        {id}
      </div>
      <div className="flex-1 text-left">
        <p className={`text-sm font-semibold ${active ? 'text-white' : 'text-gray-300'}`}>{title}</p>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1.5 bg-gray-700/50 rounded-full overflow-hidden">
            <div className={`h-full ${colors.bg} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
          </div>
          <span className={`text-xs font-medium ${active ? colors.text : 'text-gray-500'}`}>{pct}%</span>
        </div>
      </div>
    </button>
  );
}

// ─── Skill Card ──────────────────────────────────────────────────────

function SkillCard({ skill, mastery, status, isActive, isLoading, onClick }: {
  skill: GrammarSkill; mastery: number; status: string; isActive: boolean; isLoading: boolean; onClick: () => void;
}) {
  const colors = LEVEL_COLORS[skill.levelId];
  const statusIcon = status === 'mastered' ? '✓' : status === 'in_progress' ? '◐' : '○';
  const statusColor = status === 'mastered' ? 'text-emerald-400' : status === 'in_progress' ? 'text-blue-400' : 'text-gray-500';

  return (
    <button type="button" onClick={onClick} disabled={isLoading && isActive} className={`
      group relative text-left w-full p-4 rounded-xl border transition-all duration-200
      ${isActive
        ? `bg-gradient-to-br ${colors.gradient} ${colors.border}/40 border shadow-md`
        : 'bg-gray-800/40 border-gray-700/40 hover:bg-gray-800/80 hover:border-gray-600/60'}
      ${isLoading && isActive ? 'animate-pulse' : ''}
    `}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${isActive ? 'text-white' : 'text-gray-200 group-hover:text-white'} truncate`}>
            {skill.title}
          </p>
          {skill.description && (
            <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{skill.description}</p>
          )}
        </div>
        <span className={`text-base ${statusColor} flex-shrink-0`}>{statusIcon}</span>
      </div>
      <div className="mt-2.5 h-1 bg-gray-700/40 rounded-full overflow-hidden">
        <div className={`h-full ${status === 'mastered' ? 'bg-emerald-500' : colors.bg} rounded-full transition-all duration-500`} style={{ width: `${mastery}%` }} />
      </div>
    </button>
  );
}

// ─── Exercise Card ───────────────────────────────────────────────────

function ExerciseCard({ exercise, onSubmit, isSubmitting, evaluation }: {
  exercise: GrammarExercise;
  onSubmit: (answer: string | string[]) => void;
  isSubmitting: boolean;
  evaluation: GrammarAnswerEvaluation | null;
}) {
  const [textAnswer, setTextAnswer] = useState('');
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);

  useEffect(() => {
    setTextAnswer('');
    setSelectedOptionId(null);
  }, [exercise.id]);

  const canSubmit = exercise.type === 'mcq' ? !!selectedOptionId : textAnswer.trim().length > 0;
  const answered = evaluation !== null;

  const handleSubmit = () => {
    if (!canSubmit || isSubmitting || answered) return;
    const answer = exercise.type === 'mcq' ? selectedOptionId! : textAnswer.trim();
    onSubmit(answer);
  };

  const typeLabels: Record<string, string> = {
    mcq: 'Multiple Choice',
    fillBlank: 'Fill in the Blank',
    rewrite: 'Rewrite',
    freeSentence: 'Free Writing',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="px-2.5 py-1 rounded-lg bg-gray-700/50 text-xs font-medium text-gray-300">
          {typeLabels[exercise.type] ?? exercise.type}
        </span>
      </div>

      <p className="text-base text-white font-medium leading-relaxed">{exercise.prompt}</p>

      {exercise.type === 'mcq' && (
        <div className="grid gap-2">
          {(exercise.options ?? []).map((opt) => {
            const selected = selectedOptionId === opt.id;
            let optClass = 'border-gray-700/50 bg-gray-800/40 text-gray-200 hover:bg-gray-800 hover:border-gray-600';
            if (answered && evaluation) {
              if (opt.id === exercise.correctOptionId) {
                optClass = 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300';
              } else if (selected && !evaluation.isCorrect) {
                optClass = 'border-red-500/60 bg-red-500/10 text-red-300';
              } else {
                optClass = 'border-gray-700/30 bg-gray-800/20 text-gray-500';
              }
            } else if (selected) {
              optClass = 'border-blue-500/60 bg-blue-500/10 text-blue-200';
            }

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => !answered && setSelectedOptionId(opt.id)}
                disabled={answered}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all duration-200 ${optClass}`}
              >
                <span className="font-medium mr-2 uppercase text-gray-500">{opt.id}.</span>
                {opt.text}
              </button>
            );
          })}
        </div>
      )}

      {exercise.type !== 'mcq' && (
        <textarea
          value={textAnswer}
          onChange={(e) => setTextAnswer(e.target.value)}
          disabled={answered}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
          className="w-full min-h-[90px] bg-gray-800/40 border border-gray-700/50 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 resize-none transition-all"
          placeholder={
            exercise.type === 'fillBlank' ? 'Type the missing word(s)...'
              : exercise.type === 'rewrite' ? 'Rewrite the sentence here...'
                : 'Write your sentence here...'
          }
        />
      )}

      {!answered && (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || isSubmitting}
          className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
            !canSubmit || isSubmitting
              ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-500/20'
          }`}
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Checking...
            </span>
          ) : 'Check Answer'}
        </button>
      )}

      {answered && evaluation && (
        <div className={`p-4 rounded-xl border ${evaluation.isCorrect ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`text-lg ${evaluation.isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
              {evaluation.isCorrect ? '✓' : '✗'}
            </span>
            <span className={`text-sm font-semibold ${evaluation.isCorrect ? 'text-emerald-300' : 'text-red-300'}`}>
              {evaluation.isCorrect ? 'Correct!' : 'Not quite right'}
            </span>
          </div>
          <p className="text-sm text-gray-300 leading-relaxed">{evaluation.feedback}</p>
          {evaluation.correctedAnswer && !evaluation.isCorrect && (
            <p className="text-sm text-gray-400 mt-1.5">
              <span className="text-gray-500">Correct answer: </span>
              <span className="text-emerald-300 font-medium">{evaluation.correctedAnswer}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Lesson View ─────────────────────────────────────────────────────

function LessonView({ skillTitle }: { skillTitle?: string }) {
  const { currentLesson, isLessonLoading } = useGrammarStore();

  if (isLessonLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <svg className="animate-spin h-8 w-8 mb-3 text-blue-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
        <p className="text-sm">Generating lesson with AI...</p>
      </div>
    );
  }

  if (!currentLesson) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
        </div>
        <p className="text-gray-400 text-sm">Select a skill to start learning</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {skillTitle && <h3 className="text-lg font-bold text-white">{skillTitle}</h3>}
      {currentLesson.intro && (
        <p className="text-sm text-gray-300 leading-relaxed bg-gray-800/30 rounded-xl p-4 border border-gray-700/30">
          {currentLesson.intro}
        </p>
      )}
      {currentLesson.sections.map((section, i) => (
        <div key={i} className="space-y-2">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">{i + 1}</span>
            {section.title}
          </h4>
          <p className="text-sm text-gray-300 leading-relaxed pl-8">{section.body}</p>
          {section.examples && section.examples.length > 0 && (
            <div className="pl-8 space-y-1.5 mt-2">
              {section.examples.map((ex, j) => (
                <div key={j} className="flex gap-2 text-sm">
                  <span className="text-emerald-500 mt-0.5 flex-shrink-0">→</span>
                  <div>
                    <span className="text-white italic">{ex.sentence}</span>
                    {ex.explanation && <span className="text-gray-500 ml-1">— {ex.explanation}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
          {section.commonMistakes && section.commonMistakes.length > 0 && (
            <div className="pl-8 mt-2 bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
              <p className="text-xs font-semibold text-amber-400 mb-1">Common Mistakes</p>
              {section.commonMistakes.map((m, j) => (
                <p key={j} className="text-xs text-gray-400 mt-0.5">• {m}</p>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Practice View ───────────────────────────────────────────────────

function PracticeView({ skill }: { skill: GrammarSkill }) {
  const {
    currentExercises, exerciseIndex, isExercisesLoading, isSubmittingAnswer,
    submitAnswer, nextExercise, fetchMoreExercises, progressBySkillId,
  } = useGrammarStore();

  const [evaluation, setEvaluation] = useState<GrammarAnswerEvaluation | null>(null);
  const exercise = currentExercises[exerciseIndex];
  const progress = progressBySkillId[skill.id];
  const hasNext = exerciseIndex < currentExercises.length - 1;

  useEffect(() => {
    setEvaluation(null);
  }, [exerciseIndex]);

  const handleSubmit = useCallback(async (answer: string | string[]) => {
    if (!exercise) return;
    const result = await submitAnswer(exercise, answer);
    if (result) setEvaluation(result);
  }, [exercise, submitAnswer]);

  const handleNext = useCallback(() => {
    setEvaluation(null);
    if (hasNext) {
      nextExercise();
    } else {
      fetchMoreExercises(skill.id, skill.levelId, 5);
      nextExercise();
    }
  }, [hasNext, nextExercise, fetchMoreExercises, skill.id, skill.levelId]);

  if (isExercisesLoading && !exercise) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <svg className="animate-spin h-8 w-8 mb-3 text-blue-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
        <p className="text-sm">Generating practice exercises...</p>
      </div>
    );
  }

  if (!exercise) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
        </div>
        <p className="text-gray-400 text-sm">No exercises yet. Select a skill to practice.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Progress indicator */}
      {progress && (
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span>{progress.attempts} attempts</span>
          <span className="w-1 h-1 rounded-full bg-gray-600" />
          <span>{progress.correct} correct</span>
          <span className="w-1 h-1 rounded-full bg-gray-600" />
          <span className="text-emerald-400 font-medium">{progress.masteryPercent}% mastery</span>
        </div>
      )}

      <ExerciseCard
        exercise={exercise}
        onSubmit={handleSubmit}
        isSubmitting={isSubmittingAnswer}
        evaluation={evaluation}
      />

      {evaluation && (
        <button
          type="button"
          onClick={handleNext}
          className="w-full py-3 rounded-xl text-sm font-semibold bg-gray-800 text-white border border-gray-700/50 hover:bg-gray-700 transition-all duration-200"
        >
          {hasNext ? 'Next Exercise →' : 'Get More Exercises →'}
        </button>
      )}
    </div>
  );
}

// ─── Main Grammar Tab ────────────────────────────────────────────────

export default function GrammarTab() {
  const {
    levels, levelSummaries, progressBySkillId, currentLevelId, currentSkillId,
    isLessonLoading, error, loadProgress, selectLevel, startSkill, clearCurrentSkill,
  } = useGrammarStore();

  const [activeTab, setActiveTab] = useState<'lesson' | 'practice'>('lesson');

  useEffect(() => { void loadProgress(); }, [loadProgress]);

  const levelStats = useMemo(() => {
    const stats = {} as Record<GrammarLevelId, { total: number; mastered: number; inProgress: number }>;
    for (const levelId of levels) {
      const skills = levelSummaries[levelId]?.skills ?? [];
      let mastered = 0, inProgress = 0;
      for (const s of skills) {
        const p = progressBySkillId[s.id];
        if (p?.status === 'mastered') mastered++;
        else if (p?.status === 'in_progress') inProgress++;
      }
      stats[levelId] = { total: skills.length, mastered, inProgress };
    }
    return stats;
  }, [levels, levelSummaries, progressBySkillId]);

  const overallStats = useMemo(() => {
    let total = 0, mastered = 0;
    for (const s of Object.values(levelStats)) { total += s.total; mastered += s.mastered; }
    return { total, mastered, percent: total > 0 ? Math.round((mastered / total) * 100) : 0 };
  }, [levelStats]);

  const currentLevel = useMemo(() => {
    const ordered: GrammarLevelId[] = ['C2', 'C1', 'B2', 'B1', 'A2', 'A1'];
    for (const id of ordered) {
      const s = levelStats[id];
      if (s && s.mastered > 0 && s.mastered >= s.total * 0.7) return id;
    }
    return 'A1' as GrammarLevelId;
  }, [levelStats]);

  const skillsForLevel = levelSummaries[currentLevelId]?.skills ?? [];
  const activeSkill = skillsForLevel.find((s) => s.id === currentSkillId);

  const handleSkillClick = async (skill: GrammarSkill) => {
    setActiveTab('lesson');
    await startSkill(skill.id, skill.levelId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Grammar</h2>
          <p className="text-gray-400 text-sm mt-1">AI-powered lessons and practice for every level</p>
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl px-3 sm:px-4 py-3 text-center">
            <p className="text-2xl font-bold text-white">{overallStats.mastered}<span className="text-gray-500 text-lg">/{overallStats.total}</span></p>
            <p className="text-xs text-gray-400 mt-0.5">Skills mastered</p>
          </div>
          <div className={`bg-gradient-to-br ${LEVEL_COLORS[currentLevel].gradient} border ${LEVEL_COLORS[currentLevel].border}/30 rounded-xl px-3 sm:px-4 py-3 text-center`}>
            <p className={`text-2xl font-bold ${LEVEL_COLORS[currentLevel].text}`}>{currentLevel}</p>
            <p className="text-xs text-gray-400 mt-0.5">Your level</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-300 flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        {/* Sidebar: Levels */}
        <div className="lg:col-span-3 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-1">Levels</p>
          {levels.map((levelId) => {
            const st = levelStats[levelId];
            return (
              <LevelPill
                key={levelId}
                id={levelId}
                title={levelSummaries[levelId]?.title ?? levelId}
                active={currentLevelId === levelId}
                mastered={st.mastered}
                total={st.total}
                onClick={() => selectLevel(levelId)}
              />
            );
          })}
        </div>

        {/* Main Content */}
        <div className="lg:col-span-9 space-y-6">
          {/* Skills Grid */}
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {currentLevelId} — {levelSummaries[currentLevelId]?.title ?? ''} Skills
              </p>
              <span className="text-xs text-gray-500">
                {levelStats[currentLevelId]?.mastered ?? 0}/{levelStats[currentLevelId]?.total ?? 0} mastered
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
              {skillsForLevel.map((skill) => {
                const p = progressBySkillId[skill.id];
                return (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    mastery={p?.masteryPercent ?? 0}
                    status={p?.status ?? 'not_started'}
                    isActive={currentSkillId === skill.id}
                    isLoading={isLessonLoading}
                    onClick={() => handleSkillClick(skill)}
                  />
                );
              })}
            </div>
          </div>

          {/* Lesson / Practice Panels */}
          {activeSkill && (
            <div className="bg-gray-800/30 border border-gray-700/30 rounded-2xl overflow-hidden">
              {/* Tab Switcher */}
              <div className="flex flex-wrap items-center border-b border-gray-700/30">
                <button
                  type="button"
                  onClick={() => setActiveTab('lesson')}
                  className={`flex-1 min-w-[140px] px-4 sm:px-6 py-3.5 text-sm font-semibold transition-all ${
                    activeTab === 'lesson'
                      ? 'text-white border-b-2 border-blue-500 bg-gray-800/30'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                    Lesson
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('practice')}
                  className={`flex-1 min-w-[140px] px-4 sm:px-6 py-3.5 text-sm font-semibold transition-all ${
                    activeTab === 'practice'
                      ? 'text-white border-b-2 border-emerald-500 bg-gray-800/30'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                    Practice
                  </span>
                </button>
                <button
                  type="button"
                  onClick={clearCurrentSkill}
                className="px-4 py-3.5 text-gray-500 hover:text-gray-300 transition-colors ml-auto"
                  title="Close"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Panel Content */}
              <div className="p-4 sm:p-6 max-h-[500px] overflow-y-auto">
                {activeTab === 'lesson' ? (
                  <LessonView skillTitle={activeSkill.title} />
                ) : (
                  <PracticeView skill={activeSkill} />
                )}
              </div>
            </div>
          )}

          {/* Empty state when no skill selected */}
          {!activeSkill && (
            <div className="bg-gray-800/20 border border-dashed border-gray-700/40 rounded-2xl p-12 text-center">
              <div className="w-20 h-20 rounded-2xl bg-gray-800/60 flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <p className="text-gray-400 text-sm font-medium">Choose a skill above to start your lesson</p>
              <p className="text-gray-500 text-xs mt-1">AI will generate a personalized lesson and practice exercises</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
