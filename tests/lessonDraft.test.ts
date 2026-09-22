import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLessonSession, scheduleExerciseRetry } from '../src/lib/exercises';
import { loadLessonDraft, saveLessonDraft, type LessonDraft } from '../src/lib/lessonDraft';
import { removeUpcomingWord } from '../src/lib/lessonSession';
import { installStorage, now, storage, word } from './fixtures';

function draft(): LessonDraft {
  return {
    session: createLessonSession({ mode: 'default', words: [word('a'), word('b')], storage: storage(), durationMinutes: 10 })!,
    stepIndex: 0, outcomes: [], knownWordIds: [], selectedAnswer: null, typedAnswer: '', isSubmitted: false,
  };
}

describe('daily lesson drafts', () => {
  beforeEach(() => { installStorage(); vi.useFakeTimers(); vi.setSystemTime(now); });
  afterEach(() => { vi.useRealTimers(); });

  it('round trips the full lesson including answer feedback and unfinished input', () => {
    const saved = draft();
    saved.stepIndex = saved.session.steps.findIndex((step) => step.kind === 'exercise');
    const step = saved.session.steps[saved.stepIndex];
    if (step.kind !== 'exercise') throw new Error('Expected exercise');
    saved.typedAnswer = 'my answer';
    saved.selectedAnswer = 'my answer';
    saved.isSubmitted = true;
    saved.outcomes = [{ exerciseId: step.exercise.id, wordId: step.wordId, type: step.exercise.type,
      userAnswer: 'my answer', correctAnswer: step.exercise.correctAnswer, isCorrect: false }];
    expect(saveLessonDraft('french', saved)).toBe(true);
    expect(loadLessonDraft('french')).toEqual(saved);
  });

  it('keeps language drafts independent and clears only the requested language', () => {
    const french = draft();
    const japanese = draft();
    japanese.session = { ...japanese.session, id: 'japanese-daily' };
    japanese.typedAnswer = 'ねこ';
    saveLessonDraft('french', french);
    saveLessonDraft('japanese', japanese);
    expect(loadLessonDraft('french')).toEqual(french);
    expect(loadLessonDraft('japanese')).toEqual(japanese);
    saveLessonDraft('french', null);
    expect(loadLessonDraft('french')).toBeNull();
    expect(loadLessonDraft('japanese')).toEqual(japanese);
  });

  it('round trips a spaced retry without requiring exercise array order to equal step order', () => {
    const saved = draft();
    saved.stepIndex = saved.session.steps.findIndex((step) => step.kind === 'exercise');
    const step = saved.session.steps[saved.stepIndex];
    if (step.kind !== 'exercise') throw new Error('Expected exercise');
    saved.session = scheduleExerciseRetry(saved.session, saved.stepIndex, step.exercise, word(step.wordId));
    saved.selectedAnswer = 'incorrect';
    saved.isSubmitted = true;
    saved.outcomes = [{ exerciseId: step.exercise.id, wordId: step.wordId, type: step.exercise.type,
      userAnswer: 'incorrect', correctAnswer: step.exercise.correctAnswer, isCorrect: false }];
    saveLessonDraft('french', saved);
    expect(loadLessonDraft('french')).toEqual(saved);
  });

  it('round trips a draft after known words have been removed from upcoming steps', () => {
    const saved = draft();
    saved.session = removeUpcomingWord(saved.session, 0, 'a');
    saved.knownWordIds = ['a'];
    saveLessonDraft('french', saved);
    expect(loadLessonDraft('french')).toEqual(saved);
  });

  it.each(['{', 'null', '[]', '{"version":999,"draft":{}}', '{"version":1,"draft":{}}'])('ignores invalid JSON envelope %s', (raw) => {
    window.localStorage.setItem('anki-plus-daily-draft-french', raw);
    expect(loadLessonDraft('french')).toBeNull();
  });

  const corruptions: Array<[string, (value: LessonDraft) => void]> = [
    ['missing module', (value) => { value.session.modules.pop(); }],
    ['duplicate module id', (value) => { value.session.modules[1].id = value.session.modules[0].id; }],
    ['dangling module step', (value) => { value.session.modules[0].stepIds.push('missing-step'); }],
    ['duplicate step', (value) => { value.session.steps[1] = value.session.steps[0]; }],
    ['unknown step module', (value) => { value.session.steps[0].moduleId = 'missing-module'; }],
    ['inconsistent progress', (value) => { value.session.steps[0].totalInModule = 999; }],
    ['missing exercise index', (value) => { value.session.exerciseIds = []; }],
    ['invalid step index', (value) => { value.stepIndex = value.session.steps.length; }],
    ['feedback on preview', (value) => { value.isSubmitted = true; }],
    ['wrong exercise outcome', (value) => { value.outcomes = [{ exerciseId: 'missing', wordId: 'a', type: 'translation_to_original_input', userAnswer: 'a', correctAnswer: 'a', isCorrect: true }]; }],
  ];
  it.each(corruptions)('rejects structural corruption: %s', (_, corrupt) => {
    const value = draft();
    corrupt(value);
    saveLessonDraft('french', value);
    expect(loadLessonDraft('french') === null).toBe(true);
  });

  it('returns a recoverable failure when local storage cannot be read or written', () => {
    const local = installStorage();
    local.failWrites = true;
    expect(saveLessonDraft('french', draft())).toBe(false);
    vi.spyOn(local, 'getItem').mockImplementation(() => { throw new Error('unavailable'); });
    expect(loadLessonDraft('french')).toBeNull();
  });
});
