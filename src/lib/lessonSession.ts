import type { AppStorage, ExerciseOutcome, LessonSession, StudyHistoryEntry } from '../types';
import { applyOutcomes, completeDailyLesson, getWordProgress, recordStudyHistory } from './storage';
import { getTodayDateKey } from './utils';

/** Keep completed steps in place so dismissing a repeated word cannot skip another word. */
export function removeUpcomingWord(session: LessonSession, stepIndex: number, wordId: string): LessonSession {
  const remainingSteps = session.steps.filter((step, index) => index < stepIndex || step.wordId !== wordId);
  const modules = session.modules.map((module) => {
    const steps = remainingSteps.filter((step) => step.moduleId === module.id);
    return { ...module, wordIds: [...new Set(steps.map((step) => step.wordId))], stepIds: steps.map((step) => step.id) };
  });
  const steps = remainingSteps.map((step) => {
    const module = modules.find((item) => item.id === step.moduleId)!;
    return { ...step, indexInModule: module.stepIds.indexOf(step.id) + 1, totalInModule: module.stepIds.length };
  });
  const exercises = steps.flatMap((step) => step.kind === 'exercise' ? [step.exercise] : []);
  return {
    ...session, modules, steps, exercises,
    exerciseIds: exercises.map((exercise) => exercise.id),
    sourceWordIds: [...new Set(steps.map((step) => step.wordId))],
  };
}

export function getLessonProgress(session: LessonSession, stepIndex: number) {
  const completedSteps = Math.min(stepIndex, session.steps.length);
  const completedModules = session.modules.filter((module) => {
    const indices = session.steps.flatMap((step, index) => step.moduleId === module.id ? [index] : []);
    return indices.length > 0 && indices.every((index) => index < completedSteps);
  }).length;
  return {
    completedSteps,
    completedModules,
    remainingModules: session.modules.length - completedModules,
    percent: session.steps.length ? Math.round(completedSteps / session.steps.length * 100) : 0,
  };
}

/** The only commit point for lesson answers, history and daily completion. */
export function finishLessonSession(
  storage: AppStorage,
  session: LessonSession,
  outcomes: ExerciseOutcome[],
  knownWordIds: string[],
  now = new Date(),
): AppStorage {
  if (storage.studyHistory.some((entry) => entry.sessionId === session.id && entry.language === storage.learningLanguage)) {
    return storage;
  }
  if (outcomes.length === 0 && knownWordIds.length === 0) return storage;

  const updated = applyOutcomes(storage, outcomes, now);
  const completedModules = session.modules.filter((module) => module.stepIds.length > 0);
  const completedAt = now.toISOString();
  const date = getTodayDateKey(now);
  const timeSpentSeconds = Math.max(0, Math.round((now.getTime() - new Date(session.startedAt).getTime()) / 1000));
  const masteredIds = session.sourceWordIds.filter((wordId) => {
    const before = getWordProgress(storage, wordId).status;
    return before !== 'mastered' && before !== 'known' && getWordProgress(updated, wordId).status === 'mastered';
  });
  const historyEntry: StudyHistoryEntry = {
    id: `${session.id}-history`, date, language: storage.learningLanguage, completedAt,
    sessionId: session.id, mode: session.mode, durationMinutes: session.durationMinutes,
    moduleTitles: completedModules.map((module) => module.title), modulesCompleted: completedModules.length,
    wordsLearned: new Set([...masteredIds, ...knownWordIds]).size,
    mistakesMade: outcomes.filter((outcome) => !outcome.isCorrect).length,
    correctAnswers: outcomes.filter((outcome) => outcome.isCorrect).length,
    totalAnswers: outcomes.length, timeSpentSeconds, activePackIds: session.activePackIds,
  };

  // Skipping every word is not evidence of completing five learning modules.
  if (session.mode !== 'default' || completedModules.length !== 5 || outcomes.length === 0) {
    return recordStudyHistory(updated, historyEntry);
  }

  return completeDailyLesson(updated, {
    historyEntry,
    record: {
      date, language: storage.learningLanguage, completedAt, sessionId: session.id,
      totalModules: 5, completedModules: 5,
      totalSteps: session.steps.length, completedSteps: session.steps.length,
      correctAnswers: historyEntry.correctAnswers, totalAnswers: outcomes.length,
      newWords: new Set(outcomes.map((outcome) => outcome.wordId).filter((id) =>
        getWordProgress(storage, id).status === 'new' && getWordProgress(updated, id).status !== 'new',
      )).size,
      reviewWords: session.modules.find((module) => module.id === 'module-review-learning')?.wordIds.length ?? 0,
      reinforcementWords: session.modules.find((module) => module.id === 'module-reinforcement')?.wordIds.length ?? 0,
      knownWords: new Set(knownWordIds).size,
      difficultWordIds: session.sourceWordIds.filter((id) => getWordProgress(updated, id).status === 'difficult'),
      timeSpentSeconds,
    },
  });
}
