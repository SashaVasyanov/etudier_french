import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createFlashcardSession, createLessonSession } from '../src/lib/exercises';
import { finishLessonSession, getLessonProgress, removeUpcomingWord } from '../src/lib/lessonSession';
import { markWordAsKnown } from '../src/lib/storage';
import type { ExerciseOutcome, LessonSession } from '../src/types';
import { localDateKey, now, storage, word } from './fixtures';

const words = [word('a'), word('ab'), word('b')];
const sessionFor = (mode: 'default' | 'extra' = 'default') => createLessonSession({ mode, words, storage: storage(), durationMinutes: 10 })!;
const answersFor = (session: LessonSession): ExerciseOutcome[] => session.exercises.map((exercise) => ({
  exerciseId: exercise.id, wordId: exercise.wordId, type: exercise.type,
  userAnswer: exercise.correctAnswer, correctAnswer: exercise.correctAnswer, isCorrect: true,
}));

describe('lesson lifecycle', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); });
  afterEach(() => { vi.useRealTimers(); });

  it('removes only upcoming repetitions and keeps the next different word at the current index', () => {
    const session = sessionFor();
    const index = session.steps.findIndex((step) => step.kind === 'exercise');
    const currentWordId = session.steps[index].wordId;
    const expectedNext = session.steps.slice(index).find((step) => step.wordId !== currentWordId)!;
    const snapshot = structuredClone(session);
    const updated = removeUpcomingWord(session, index, currentWordId);
    expect(updated.steps.slice(0, index)).toEqual(session.steps.slice(0, index));
    expect(updated.steps[index].id).toBe(expectedNext.id);
    expect(updated.steps.slice(index).some((step) => step.wordId === currentWordId)).toBe(false);
    expect(updated.steps.slice(0, index).some((step) => step.wordId === currentWordId)).toBe(true);
    expect(session).toEqual(snapshot);
    for (const module of updated.modules) {
      const moduleSteps = updated.steps.filter((step) => step.moduleId === module.id);
      expect(module.stepIds).toEqual(moduleSteps.map((step) => step.id));
      expect(new Set(module.wordIds)).toEqual(new Set(moduleSteps.map((step) => step.wordId)));
      expect(moduleSteps.map((step) => step.indexInModule)).toEqual(moduleSteps.map((_, stepIndex) => stepIndex + 1));
      expect(moduleSteps.every((step) => step.totalInModule === moduleSteps.length)).toBe(true);
    }
  });

  it('matches exact word ids instead of removing ids that contain the skipped word id', () => {
    const session = sessionFor();
    const updated = removeUpcomingWord(session, 0, 'a');
    expect(updated.steps.some((step) => step.wordId === 'a')).toBe(false);
    expect(updated.steps.filter((step) => step.wordId === 'ab')).toEqual(session.steps.filter((step) => step.wordId === 'ab').map((step) => ({
      ...step,
      indexInModule: updated.steps.find((item) => item.id === step.id)!.indexInModule,
      totalInModule: updated.steps.find((item) => item.id === step.id)!.totalInModule,
    })));
    expect(updated.exerciseIds).toEqual(updated.exercises.map((exercise) => exercise.id));
  });

  it('reports completed and remaining modules at real step boundaries', () => {
    const session = sessionFor();
    expect(getLessonProgress(session, 0)).toEqual({ completedSteps: 0, completedModules: 0, remainingModules: 5, percent: 0 });
    const firstModuleLength = session.modules[0].stepIds.length;
    expect(getLessonProgress(session, firstModuleLength).completedModules).toBe(1);
    expect(getLessonProgress(session, firstModuleLength).remainingModules).toBe(4);
    expect(getLessonProgress(session, session.steps.length)).toEqual({ completedSteps: session.steps.length, completedModules: 5, remainingModules: 0, percent: 100 });
  });

  it('commits a full daily lesson once with the local completion date', () => {
    const session = sessionFor();
    const state = storage();
    const answers = answersFor(session);
    const completed = finishLessonSession(state, session, answers, [], now);
    expect(completed.completedDailyLessons).toHaveLength(1);
    expect(completed.completedDailyLessons[0]).toMatchObject({ date: localDateKey(now), completedModules: 5, completedSteps: session.steps.length, totalAnswers: answers.length });
    expect(completed.studyHistory).toHaveLength(1);
    expect(completed.dailyStats[0].totalAnswers).toBe(answers.length);
    expect(finishLessonSession(completed, session, answers, [], now)).toBe(completed);
    expect(state.studyHistory).toHaveLength(0);
  });

  it('records extra practice without replacing a completed daily lesson', () => {
    const daily = sessionFor();
    const completed = finishLessonSession(storage(), daily, answersFor(daily), [], now);
    const extra = sessionFor('extra');
    const updated = finishLessonSession(completed, extra, answersFor(extra), [], now);
    expect(updated.completedDailyLessons).toEqual(completed.completedDailyLessons);
    expect(updated.studyHistory).toHaveLength(2);
    expect(updated.studyHistory.at(-1)?.mode).toBe('extra');
  });

  it('does not mark a skipped daily lesson complete or create fake answer counts', () => {
    let session = sessionFor();
    let state = storage();
    for (const item of words) {
      session = removeUpcomingWord(session, 0, item.id);
      state = markWordAsKnown(state, item.id);
    }
    const updated = finishLessonSession(state, session, [], words.map((item) => item.id), now);
    expect(updated.completedDailyLessons).toHaveLength(0);
    expect(updated.dailyStats).toHaveLength(0);
    expect(updated.studyHistory[0]).toMatchObject({ modulesCompleted: 0, totalAnswers: 0, wordsLearned: 3 });
    expect(getLessonProgress(session, 0).completedModules).toBe(0);
    expect(finishLessonSession(state, session, [], [], now)).toBe(state);
  });

  it('does not award word progress or daily completion for preview-only flashcards', () => {
    const session = createFlashcardSession({ mode: 'extra', words, storage: storage(), durationMinutes: 10 })!;
    const state = storage();
    const updated = finishLessonSession(state, session, [], [], now);
    expect(updated.completedDailyLessons).toHaveLength(0);
    expect(updated).toBe(state);
  });
});
