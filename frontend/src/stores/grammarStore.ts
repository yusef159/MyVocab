import { create } from 'zustand';
import axios from 'axios';
import type {
  GrammarLevelId,
  GrammarSkill,
  GrammarLesson,
  GrammarExercise,
  GrammarProgress,
  GrammarAnswerEvaluation,
} from '../types';
import {
  getAllGrammarProgress,
  saveGrammarProgress,
  resetGrammarProgressForSkill,
} from '../db';
import { GRAMMAR_CATALOG, GRAMMAR_LEVELS } from '../lib/grammarCatalog';

const API_URL = '';

const MASTERY_ATTEMPTS_THRESHOLD = 8;
const MASTERY_PERCENT_THRESHOLD = 80;

function computeMastery(attempts: number, correct: number): number {
  if (attempts <= 0) return 0;
  return Math.max(0, Math.min(100, Math.floor((correct / attempts) * 100)));
}

interface GrammarState {
  levels: GrammarLevelId[];
  levelSummaries: Record<GrammarLevelId, { title: string; description?: string; skills: GrammarSkill[] }>;
  progressBySkillId: Record<string, GrammarProgress>;

  currentLevelId: GrammarLevelId;
  currentSkillId: string | null;
  currentLesson: GrammarLesson | null;
  currentExercises: GrammarExercise[];
  exerciseIndex: number;

  isLessonLoading: boolean;
  isExercisesLoading: boolean;
  isSubmittingAnswer: boolean;
  error: string | null;

  loadProgress: () => Promise<void>;
  selectLevel: (levelId: GrammarLevelId) => void;
  startSkill: (skillId: string, levelId: GrammarLevelId) => Promise<void>;
  fetchMoreExercises: (skillId: string, levelId: GrammarLevelId, count?: number) => Promise<void>;
  nextExercise: () => void;
  submitAnswer: (exercise: GrammarExercise, userAnswer: string | string[]) => Promise<GrammarAnswerEvaluation | null>;
  resetSkill: (skillId: string) => Promise<void>;
  clearCurrentSkill: () => void;
}

function buildSummaries() {
  const summaries = {} as Record<GrammarLevelId, { title: string; description?: string; skills: GrammarSkill[] }>;
  for (const level of GRAMMAR_CATALOG) {
    summaries[level.id] = { title: level.title, description: level.description, skills: level.skills };
  }
  return summaries;
}

export const useGrammarStore = create<GrammarState>((set, get) => ({
  levels: GRAMMAR_LEVELS,
  levelSummaries: buildSummaries(),
  progressBySkillId: {},

  currentLevelId: 'A1',
  currentSkillId: null,
  currentLesson: null,
  currentExercises: [],
  exerciseIndex: 0,

  isLessonLoading: false,
  isExercisesLoading: false,
  isSubmittingAnswer: false,
  error: null,

  loadProgress: async () => {
    try {
      const items = await getAllGrammarProgress();
      const map: Record<string, GrammarProgress> = {};
      for (const p of items) map[p.skillId] = p;
      set({ progressBySkillId: map });
    } catch (error) {
      console.error('Failed to load grammar progress:', error);
    }
  },

  selectLevel: (levelId) => {
    set({ currentLevelId: levelId, currentSkillId: null, currentLesson: null, currentExercises: [], exerciseIndex: 0, error: null });
  },

  startSkill: async (skillId, levelId) => {
    const state = get();
    const levelSummary = state.levelSummaries[levelId];
    const skillMeta = levelSummary?.skills.find((s) => s.id === skillId);

    set({ currentSkillId: skillId, currentLevelId: levelId, isLessonLoading: true, isExercisesLoading: true, error: null, currentLesson: null, currentExercises: [], exerciseIndex: 0 });

    // Fetch lesson
    try {
      const lessonRes = await axios.post<{ lesson: GrammarLesson }>(`${API_URL}/api/grammar/lesson`, {
        skillId,
        levelId,
        skillTitle: skillMeta?.title,
        skillDescription: skillMeta?.description,
      });
      set({ currentLesson: lessonRes.data.lesson, isLessonLoading: false });
    } catch (error) {
      console.error('Failed to load grammar lesson:', error);
      set({ isLessonLoading: false, error: 'Failed to load lesson. Check your connection.' });
    }

    // Fetch exercises in parallel
    try {
      const exercisesRes = await axios.post<{ exercises: GrammarExercise[] }>(`${API_URL}/api/grammar/exercises`, {
        skillId,
        levelId,
        skillTitle: skillMeta?.title,
        count: 5,
      });
      const exercises = exercisesRes.data.exercises ?? [];
      set({ currentExercises: exercises, isExercisesLoading: false });
    } catch (error) {
      console.error('Failed to load grammar exercises:', error);
      set({ isExercisesLoading: false });
    }

    // Ensure progress entry exists
    const existing = get().progressBySkillId[skillId];
    if (!existing) {
      const newProgress: GrammarProgress = {
        skillId, levelId, attempts: 0, correct: 0, masteryPercent: 0,
        status: 'in_progress', lastResult: undefined, lastUpdated: new Date().toISOString(),
      };
      await saveGrammarProgress(newProgress);
      set((s) => ({ progressBySkillId: { ...s.progressBySkillId, [skillId]: newProgress } }));
    }
  },

  fetchMoreExercises: async (skillId, levelId, count = 5) => {
    const state = get();
    const skillMeta = state.levelSummaries[levelId]?.skills.find((s) => s.id === skillId);
    set({ isExercisesLoading: true });
    try {
      const res = await axios.post<{ exercises: GrammarExercise[] }>(`${API_URL}/api/grammar/exercises`, {
        skillId, levelId, skillTitle: skillMeta?.title, count,
      });
      const more = res.data.exercises ?? [];
      set((s) => ({ currentExercises: [...s.currentExercises, ...more], isExercisesLoading: false }));
    } catch (error) {
      console.error('Failed to fetch more grammar exercises:', error);
      set({ isExercisesLoading: false, error: 'Failed to get more practice questions' });
    }
  },

  nextExercise: () => {
    set((s) => ({ exerciseIndex: s.exerciseIndex + 1 }));
  },

  submitAnswer: async (exercise, userAnswer) => {
    set({ isSubmittingAnswer: true });
    try {
      const res = await axios.post<{ evaluation: GrammarAnswerEvaluation }>(`${API_URL}/api/grammar/grade`, {
        exercise, userAnswer,
      });

      const evaluation = res.data.evaluation;
      const currentProgress = get().progressBySkillId[exercise.skillId];

      const attempts = (currentProgress?.attempts ?? 0) + 1;
      const correct = (currentProgress?.correct ?? 0) + (evaluation.isCorrect ? 1 : 0);
      const masteryPercent = computeMastery(attempts, correct);

      const updatedProgress: GrammarProgress = {
        skillId: exercise.skillId, levelId: exercise.levelId,
        attempts, correct, masteryPercent,
        status: masteryPercent >= MASTERY_PERCENT_THRESHOLD && attempts >= MASTERY_ATTEMPTS_THRESHOLD
          ? 'mastered' : currentProgress?.status === 'mastered' ? 'mastered' : 'in_progress',
        lastResult: evaluation.isCorrect ? 'correct' : 'incorrect',
        lastUpdated: new Date().toISOString(),
      };

      await saveGrammarProgress(updatedProgress);
      set((s) => ({
        isSubmittingAnswer: false,
        progressBySkillId: { ...s.progressBySkillId, [exercise.skillId]: updatedProgress },
      }));

      return evaluation;
    } catch (error) {
      console.error('Failed to grade grammar answer:', error);
      set({ isSubmittingAnswer: false, error: 'Failed to grade your answer' });
      return null;
    }
  },

  resetSkill: async (skillId) => {
    await resetGrammarProgressForSkill(skillId);
    set((s) => {
      const next = { ...s.progressBySkillId };
      delete next[skillId];
      return { progressBySkillId: next };
    });
  },

  clearCurrentSkill: () => {
    set({ currentSkillId: null, currentLesson: null, currentExercises: [], exerciseIndex: 0, error: null });
  },
}));
