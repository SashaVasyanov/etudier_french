import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFlashcardSession, createLessonSession, createSentenceCloze, scheduleExerciseRetry } from '../src/lib/exercises';
import { applyOutcomes, setLessonDurationPreference } from '../src/lib/storage';
import type { LessonDurationMinutes, LessonSession, Word } from '../src/types';
import { now, outcome, progress, storage, word } from './fixtures';

function checkSessionStructure(session: LessonSession) {
  expect(new Set(session.exerciseIds).size).toBe(session.exerciseIds.length);
  expect(new Set(session.steps.map((step) => step.id)).size).toBe(session.steps.length);
  expect(session.exerciseIds).toEqual(session.exercises.map((exercise) => exercise.id));
  for (const [index, module] of session.modules.entries()) {
    const steps = session.steps.filter((step) => step.moduleId === module.id);
    expect(module.position).toBe(index + 1);
    expect(module.stepIds).toEqual(steps.map((step) => step.id));
    expect(new Set(module.wordIds)).toEqual(new Set(steps.map((step) => step.wordId)));
    expect(steps.every((step, stepIndex) =>
      step.indexInModule === stepIndex + 1 && step.totalInModule === steps.length &&
      step.modulePosition === module.position && step.moduleCount === session.modules.length,
    )).toBe(true);
  }
}

describe('lesson generation and recovery', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); });
  afterEach(() => { vi.useRealTimers(); });

  it.each(['new', 'learning', 'mastered'] as const)('keeps five nonempty modules with only %s words', (status) => {
    const words = [word('only')];
    const state = storage({ only: progress('only', status) });
    const session = createLessonSession({ mode: 'default', words, storage: state, durationMinutes: 10 })!;
    expect(session.modules).toHaveLength(5);
    expect(session.modules.every((module) => module.stepIds.length > 0)).toBe(true);
    expect(session.modules[0].theme).toBe(status === 'new' ? 'new' : 'review');
    checkSessionStructure(session);
  });

  it('on a review-only day starts with an objective check instead of previewing translations', () => {
    const words = [word('a'), word('b')];
    const due = new Date(now.getTime() - 86_400_000).toISOString();
    const state = storage({ a: progress('a', 'learning', { next_review_at: due }), b: progress('b', 'review', { next_review_at: due }) });
    const session = createLessonSession({ mode: 'default', words, storage: state, durationMinutes: 10 })!;
    expect(session.modules[0].kind).toBe('exercise');
    expect(session.steps.some((step) => step.kind === 'preview')).toBe(false);
    const firstModuleSteps = session.steps.filter((step) => step.moduleId === session.modules[0].id);
    expect(firstModuleSteps.every((step) => step.kind === 'exercise' && step.exercise.type !== 'memory_check')).toBe(true);
    checkSessionStructure(session);
  });

  it('keeps known and ignored words out of lessons and flashcards', () => {
    const words = [word('known'), word('ignored'), word('new'), word('new')];
    const state = storage({ known: progress('known', 'known'), ignored: progress('ignored', 'ignored') });
    for (const mode of ['default', 'extra', 'pack', 'mistakes'] as const) {
      const session = createLessonSession({ mode, words, storage: state, durationMinutes: 10, wordIds: words.map((item) => item.id) })!;
      expect(session.sourceWordIds).toEqual(['new']);
      checkSessionStructure(session);
    }
    for (const mode of ['extra', 'pack'] as const) {
      const session = createFlashcardSession({ mode, words, storage: state, durationMinutes: 10 })!;
      expect(session.sourceWordIds).toEqual(['new']);
      checkSessionStructure(session);
    }
  });

  it('allows voluntary practice immediately after the daily session without advancing due dates', () => {
    const words = [word('learned')];
    const state = applyOutcomes(storage(), [outcome('learned')], now);
    const snapshot = structuredClone(state);
    expect(createLessonSession({ mode: 'default', words, storage: state, durationMinutes: 10 })).toBeNull();
    for (const mode of ['extra', 'pack', 'mistakes'] as const) {
      const session = createLessonSession({ mode, words, storage: state, durationMinutes: 10, wordIds: ['learned'] })!;
      expect(session.sourceWordIds).toEqual(['learned']);
      expect(session.mode).toBe(mode);
      const after = applyOutcomes(state, session.exercises.map((exercise, index) => outcome(exercise.wordId, true, index)), now);
      expect(after.progressByWordId.learned.next_review_at).toBe(state.progressByWordId.learned.next_review_at);
      expect(after.progressByWordId.learned.repetition_step).toBe(1);
      expect(after.completedDailyLessons).toEqual(state.completedDailyLessons);
    }
    expect(createFlashcardSession({ mode: 'extra', words, storage: state, durationMinutes: 10 })?.sourceWordIds).toEqual(['learned']);
    expect(state).toEqual(snapshot);
  });

  it('changes lesson size through the saved 10/20/30 minute controls', () => {
    const words = Array.from({ length: 60 }, (_, index) => word(String(index)));
    const sizes = ([10, 20, 30] as LessonDurationMinutes[]).map((duration) => {
      const state = setLessonDurationPreference(storage(), duration);
      return createLessonSession({ mode: 'default', words, storage: state, durationMinutes: state.lessonDurationMinutes, wordTarget: state.lessonWordTarget })!.steps.length;
    });
    expect(sizes[0]).toBeLessThan(sizes[1]);
    expect(sizes[1]).toBeLessThan(sizes[2]);
  });

  it('without a duration limit keeps the daily new-word quota but includes every due review', () => {
    const words = Array.from({ length: 24 }, (_, index) => word(String(index)));
    const due = new Date(now.getTime() - 86_400_000).toISOString();
    const dueWords = Array.from({ length: 20 }, (_, index) => word(`due-${index}`));
    const state = storage(Object.fromEntries(dueWords.map((item) => [item.id, progress(item.id, 'learning', { next_review_at: due })])));
    const session = createLessonSession({ mode: 'default', words: [...words, ...dueWords], storage: state, durationMinutes: 10, wordTarget: 10, useFullPool: true })!;
    const newIds = session.sourceWordIds.filter((id) => !id.startsWith('due-'));
    expect(newIds).toHaveLength(3);
    expect(dueWords.every((item) => session.sourceWordIds.includes(item.id))).toBe(true);
    for (const mode of ['extra', 'pack'] as const) {
      expect(createLessonSession({ mode, words, storage: storage(), durationMinutes: 10, useFullPool: true })!.sourceWordIds.length).toBeLessThan(words.length);
    }
    expect(createFlashcardSession({ mode: 'pack', words, storage: storage(), durationMinutes: 10, useFullPool: true })?.sourceWordIds).toHaveLength(words.length);
  });

  it('restricts new words to the chosen topic while reviews come from all words', () => {
    const topic = [word('t1'), word('t2'), word('t3'), word('t4')];
    const other = [word('o1'), word('o2'), word('o3'), word('o4')];
    const due = new Date(now.getTime() - 86_400_000).toISOString();
    const state = storage({ o4: progress('o4', 'review', { next_review_at: due }) });
    const session = createLessonSession({
      mode: 'default', words: [...topic, ...other], storage: state, durationMinutes: 10, wordTarget: 10,
      newWordIds: topic.map((item) => item.id),
    })!;
    expect(session.sourceWordIds).toContain('o4');
    expect(session.sourceWordIds.some((id) => ['o1', 'o2', 'o3'].includes(id))).toBe(false);
    expect(session.sourceWordIds.filter((id) => id.startsWith('t')).length).toBeGreaterThan(0);
  });

  it('preserves module metadata when a spaced retry lands in a later module', () => {
    const words = Array.from({ length: 10 }, (_, index) => word(String(index)));
    const session = createLessonSession({ mode: 'default', words, storage: storage(), durationMinutes: 10 })!;
    const firstExerciseModule = session.modules[1];
    const index = session.steps.findLastIndex((step) => step.moduleId === firstExerciseModule.id);
    const failedStep = session.steps[index];
    if (failedStep.kind !== 'exercise') throw new Error('Expected an exercise');
    const failedWord = words.find((item) => item.id === failedStep.wordId)!;
    const before = structuredClone(session);
    const withRetry = scheduleExerciseRetry(session, index, failedStep.exercise, failedWord);
    expect(session).toEqual(before);
    expect(withRetry.steps).toHaveLength(session.steps.length + 1);
    expect(withRetry.steps[index + 4].kind).toBe('exercise');
    checkSessionStructure(withRetry);
    expect(scheduleExerciseRetry(withRetry, index, failedStep.exercise, failedWord)).toBe(withRetry);
  });

  it('appends one retry for a mistake on the last step', () => {
    const words = [word('only')];
    const session = createLessonSession({ mode: 'default', words, storage: storage(), durationMinutes: 10 })!;
    const lastStep = session.steps.at(-1)!;
    if (lastStep.kind !== 'exercise') throw new Error('Expected an exercise');
    const withRetry = scheduleExerciseRetry(session, session.steps.length - 1, lastStep.exercise, words[0]);
    expect(withRetry.steps.at(-1)?.moduleId).toBe(session.modules.at(-1)?.id);
    checkSessionStructure(withRetry);
  });

  it('does not offer synonyms or duplicate prompts as incorrect options', () => {
    const words: Word[] = [
      { ...word('car'), original: 'voiture', translation: 'машина' },
      { ...word('auto'), original: 'automobile', translation: 'машина' },
      { ...word('other'), original: 'voiture', translation: 'автомобиль' },
    ];
    const session = createLessonSession({ mode: 'default', words, storage: storage(), durationMinutes: 10 })!;
    expect(session.exercises.filter((exercise) => exercise.wordId === 'car').every((exercise) => !exercise.options)).toBe(true);
  });

  it('hides repeated target words in French and Japanese cloze exercises', async () => {
    const { createSentenceCloze } = await import('../src/lib/exercises');
    const words: Word[] = [
      { ...word('cat'), original: 'chat', example_original: 'Le chat regarde le chat.' },
      { ...word('cat-ja'), language: 'japanese', original: '猫', transcription: '[ねこ · neko]', example_original: '猫と猫がいます。' },
    ];
    for (const item of words) {
      const prompt = createSentenceCloze(item);
      expect(prompt).toBeTruthy();
      expect(prompt!).not.toContain(item.original);
    }
  });

  it('mixes task types and no longer asks to type the hiragana reading', () => {
    const words: Word[] = Array.from({ length: 8 }, (_, index) => ({
      ...word(`ja-${index}`), language: 'japanese', original: `漢字${index}`, transcription: `[かんじ · kanji${index}]`, example_original: `これは漢字${index}です。`,
    }));
    const session = createLessonSession({ mode: 'default', words, storage: storage(), durationMinutes: 10 })!;
    const types = session.exercises.map((exercise) => exercise.type);
    expect(types).not.toContain('kanji_to_hiragana_input');
    expect(new Set(types).size).toBeGreaterThanOrEqual(5);
    const typing = types.filter((type) => type.endsWith('_input')).length;
    expect(typing / types.length).toBeLessThan(0.5);
  });
});

describe('Japanese sentence cloze', () => {
  const jaWord = (id: string, original: string, example: string): Word => ({
    ...word(id), language: 'japanese', original, transcription: '[x · x]', example_original: example,
  });
  const clozeFor = (item: Word) => createSentenceCloze(item);

  it('never cuts a word out of a longer compound or a different word', () => {
    expect(clozeFor(jaWord('hi', '日', '今日は暖かい日です。'))).toBe('今日は暖かい＿＿です。');
    expect(clozeFor(jaWord('shonen', '少年', '青少年と少年が来た。'))).toBe('青少年と＿＿が来た。');
    expect(clozeFor(jaWord('mokuteki', '目的', '盲目的に従う。'))).toBeNull();
    expect(clozeFor(jaWord('kazu', '数', '１０まで数えなさい。'))).toBeNull();
  });
});
