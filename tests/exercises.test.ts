import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFlashcardSession, createLessonSession, getDailyBalance, scheduleExerciseRetry } from '../src/lib/exercises';
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
    expect(newIds).toHaveLength(4);
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
    const wordChoice = new Set(['audio_to_translation_choice', 'translation_to_original_choice', 'original_to_translation_choice']);
    expect(session.exercises.filter((exercise) => exercise.wordId === 'car' && wordChoice.has(exercise.type)).every((exercise) => !exercise.options)).toBe(true);
  });

  it('mixes task types and no longer asks to type the hiragana reading', () => {
    const words: Word[] = Array.from({ length: 8 }, (_, index) => ({
      ...word(`ja-${index}`), language: 'japanese', original: `漢字${index}`, transcription: `[かんじ · kanji${index}]`, example_original: `これは漢字${index}です。`,
    }));
    const session = createLessonSession({ mode: 'default', words, storage: storage(), durationMinutes: 10 })!;
    const types = session.exercises.map((exercise) => exercise.type);
    expect(types).not.toContain('kanji_to_hiragana_input');
    expect(types).not.toContain('sentence_cloze_input');
    expect(new Set(types).size).toBeGreaterThanOrEqual(5);
    const typing = types.filter((type) => type.endsWith('_input')).length;
    expect(typing / types.length).toBeLessThan(0.5);
  });
});

describe('daily balance of new words and reviews', () => {
  const pool = Array.from({ length: 80 }, (_, i) => word(`w${i}`));
  const dueProgress = (id: string) => progress(id, 'review', {
    interval_days: 4, next_review_at: new Date(now.getTime() - 86_400_000).toISOString(),
  });
  const withDue = (count: number) => storage(Object.fromEntries(pool.slice(0, count).map((w) => [w.id, dueProgress(w.id)])));

  it('keeps the full new-word quota while reviews fit the lesson', () => {
    const balance = getDailyBalance(pool, withDue(3), 20);
    expect(balance.deferredNewWords).toBe(0);
    expect(balance.newWords).toBeGreaterThan(0);
  });

  it('halves new words when reviews exceed the slots and drops them at twice the slots', () => {
    const base = getDailyBalance(pool, withDue(0), 20);
    const over = getDailyBalance(pool, withDue(base.reviewSlots + 2), 20);
    expect(over.newWords).toBe(Math.max(1, Math.floor(base.newWords / 2)));
    expect(over.reviewSlots).toBe(base.reviewSlots + over.deferredNewWords);
    const backlog = getDailyBalance(pool, withDue(base.reviewSlots * 2), 20);
    expect(backlog.newWords).toBe(0);
    expect(backlog.reviewSlots).toBe(base.reviewSlots + base.newWords);
  });

  it('builds a review-only daily lesson after a long break', () => {
    const state = withDue(60);
    const session = createLessonSession({ mode: 'default', words: pool, storage: state, durationMinutes: 20 });
    const introduced = new Set(session?.exercises.map((exercise) => exercise.wordId));
    const newIntroduced = [...introduced].filter((id) => !state.progressByWordId[id]);
    expect(newIntroduced).toHaveLength(0);
  });
});

describe('«5 минут» quick review', () => {
  const pool = Array.from({ length: 30 }, (_, i) => word(`q${i}`));

  it('takes only due reviews, most urgent first, two tasks each', () => {
    const due = (id: string, days: number) => progress(id, 'review', {
      interval_days: 4, next_review_at: new Date(now.getTime() - days * 86_400_000).toISOString(),
    });
    const state = storage(Object.fromEntries(pool.slice(0, 12).map((w, i) => [w.id, due(w.id, i + 1)])));
    const session = createLessonSession({ mode: 'extra', quick: true, words: pool, storage: state, durationMinutes: 10 });
    expect(session?.title).toBe('Пять минут');
    const ids = new Set(session?.exercises.map((exercise) => exercise.wordId));
    expect(ids.size).toBe(8);
    expect([...ids].every((id) => state.progressByWordId[id]?.status === 'review')).toBe(true);
    expect(session?.exercises).toHaveLength(16);
  });

  it('falls back to the weakest words when nothing is due and never adds new words', () => {
    const state = storage({ q1: progress('q1', 'difficult', { wrong_count: 3, shown_count: 4 }) });
    const session = createLessonSession({ mode: 'extra', quick: true, words: pool, storage: state, durationMinutes: 10 });
    expect(new Set(session?.exercises.map((exercise) => exercise.wordId))).toEqual(new Set(['q1']));
    expect(createLessonSession({ mode: 'extra', quick: true, words: pool, storage: storage(), durationMinutes: 10 })).toBeNull();
  });
});

describe('wrong options that can be confused with the answer', () => {
  it('prefers the same part of speech and similar spelling', async () => {
    const { scoreDistractor } = await import('../src/lib/exercises');
    const base = { ...word('a'), original: 'maison', translation: 'дом', part_of_speech: 'noun' };
    const close = { ...word('b'), original: 'raison', translation: 'причина', part_of_speech: 'noun' };
    const far = { ...word('c'), original: 'courir', translation: 'бегать', part_of_speech: 'verb' };
    expect(scoreDistractor(base, close, 'original')).toBeGreaterThan(scoreDistractor(base, far, 'original') + 3);
  });

  it('builds choice tasks whose wrong options mostly share the part of speech', () => {
    const nouns = Array.from({ length: 30 }, (_, i) => ({ ...word(`n${i}`), part_of_speech: 'noun' }));
    const verbs = Array.from({ length: 30 }, (_, i) => ({ ...word(`v${i}`), part_of_speech: 'verb' }));
    const pool = [...nouns, ...verbs];
    const session = createLessonSession({ mode: 'default', words: pool, storage: storage(), durationMinutes: 20 })!;
    const byId = new Map(pool.map((item) => [item.id, item]));
    let same = 0;
    let total = 0;
    for (const exercise of session.exercises.filter((item) => item.options)) {
      const pos = byId.get(exercise.wordId)!.part_of_speech;
      for (const option of exercise.options!.filter((item) => item.id !== exercise.wordId)) {
        total += 1;
        if (byId.get(option.id)?.part_of_speech === pos) same += 1;
      }
    }
    expect(total).toBeGreaterThan(0);
    expect(same / total).toBeGreaterThan(0.7);
  });
});

describe('phrase, article and reading tasks', () => {
  it('splits a French example into words to order, keeping punctuation attached', async () => {
    const { getSentenceTokens } = await import('../src/lib/exercises');
    expect(getSentenceTokens({ ...word('a'), example_original: 'Nous allons à Paris demain matin.' })).toEqual(['Nous', 'allons', 'à', 'Paris', 'demain', 'matin.']);
    expect(getSentenceTokens({ ...word('b'), example_original: 'On dit : « à pied ».' })).toEqual(['On', 'dit :', '« à', 'pied ».']);
    expect(getSentenceTokens({ ...word('c'), example_original: 'Oui.' })).toBeNull();
    expect(getSentenceTokens({ ...word('d'), language: 'japanese', example_original: '猫がいます。' })).toBeNull();
  });

  it('builds a sentence-order task whose words never come already in order', () => {
    // Every word carries the sentence: which word gets the task depends on the
    // rotation of task types, not on the word.
    const pool = Array.from({ length: 7 }, (_, i) => ({ ...word(`s${i}`), example_original: 'Le chat dort sur le lit.', example_translation: 'Кот спит на кровати.' }));
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const session = createLessonSession({ mode: 'default', words: pool, storage: storage(), durationMinutes: 20 })!;
      const task = session.exercises.find((exercise) => exercise.type === 'sentence_order');
      if (!task) continue;
      expect(task.correctAnswer).toBe('Le chat dort sur le lit.');
      expect(task.options!.map((option) => option.label).join(' ')).not.toBe(task.correctAnswer);
      expect([...task.options!.map((option) => option.label)].sort()).toEqual(['Le', 'chat', 'dort', 'le', 'lit.', 'sur'].sort());
      return;
    }
    throw new Error('no sentence-order task in ten lessons');
  });

  it('asks to recall the word from its picture and translation (definition as a quiet line)', () => {
    const pool = Array.from({ length: 8 }, (_, i) => ({ ...word(`d${i}`), imageUrl: `/generated-word-images/d${i}.webp`, definition: `Définition numéro ${i}.`, definition_translation: `Определение ${i}.` }));
    let task;
    for (let attempt = 0; attempt < 10 && !task; attempt += 1) {
      const session = createLessonSession({ mode: 'default', words: pool, storage: storage(), durationMinutes: 20 })!;
      task = session.exercises.find((exercise) => exercise.type === 'definition_choice');
    }
    expect(task).toBeTruthy();
    const target = pool.find((item) => item.id === task!.wordId)!;
    expect(task!.prompt).toBe(target.translation);
    expect(task!.context).toBe(target.definition);
    expect(task!.correctAnswer).toBe(target.original);
    expect(task!.options!.some((option) => option.label === target.original)).toBe(true);
    expect(task!.options!.length).toBeGreaterThanOrEqual(2);
  });

  it('does not ask to recall a word from a picture it does not have', () => {
    const pool = Array.from({ length: 8 }, (_, i) => ({ ...word(`n${i}`), definition: `Définition ${i}.` }));
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const session = createLessonSession({ mode: 'default', words: pool, storage: storage(), durationMinutes: 20 })!;
      expect(session.exercises.some((exercise) => exercise.type === 'definition_choice')).toBe(false);
    }
  });

  it('spells single French words and Japanese kana, never katakana words', async () => {
    const { getLetterAssemblyAnswer } = await import('../src/lib/exercises');
    expect(getLetterAssemblyAnswer({ ...word('m'), original: 'Maison' })).toBe('maison');
    expect(getLetterAssemblyAnswer({ ...word('b'), original: 'à bientôt' })).toBeNull();
    expect(getLetterAssemblyAnswer({ ...word('n'), language: 'japanese', original: '猫', transcription: '[ねこ · neko]' })).toBeNull();
    expect(getLetterAssemblyAnswer({ ...word('t'), language: 'japanese', original: '食べる', transcription: '[たべる · taberu]' })).toBe('たべる');
    expect(getLetterAssemblyAnswer({ ...word('a'), language: 'japanese', original: 'ああ', transcription: '[ああ · aa]' })).toBeNull();
    expect(getLetterAssemblyAnswer({ ...word('k'), language: 'japanese', original: 'テレビ', transcription: '[てれび · terebi]' })).toBeNull();
  });

  it('builds a letter puzzle with exactly the letters of the word', () => {
    const pool = Array.from({ length: 8 }, (_, i) => ({ ...word(`l${i}`), original: ['maison', 'chat', 'livre', 'table', 'pomme', 'école', 'jardin', 'soleil'][i] }));
    let task;
    for (let attempt = 0; attempt < 10 && !task; attempt += 1) {
      task = createLessonSession({ mode: 'default', words: pool, storage: storage(), durationMinutes: 20 })!
        .exercises.find((exercise) => exercise.type === 'letter_assembly');
    }
    expect(task).toBeTruthy();
    expect(task!.options!.map((option) => option.label).sort().join('')).toBe([...task!.correctAnswer].sort().join(''));
  });

  it('never asks by a definition that gives the word away', () => {
    const pool = Array.from({ length: 8 }, (_, i) => ({ ...word(`g${i}`), definition: `Le mot mot-g${i}.` }));
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const session = createLessonSession({ mode: 'default', words: pool, storage: storage(), durationMinutes: 20 })!;
      expect(session.exercises.some((exercise) => exercise.type === 'definition_choice')).toBe(false);
    }
  });

  it('asks le or la only for nouns with a known gender that do not take l’', () => {
    const maison = { ...word('m'), original: 'maison', translation: 'дом', part_of_speech: 'noun' };
    const arbre = { ...word('ar'), original: 'arbre', translation: 'дерево', part_of_speech: 'noun' };
    const pool = [maison, arbre, ...Array.from({ length: 6 }, (_, i) => ({ ...word(`n${i}`), part_of_speech: 'noun' }))];
    let seenMaison = false;
    for (let attempt = 0; attempt < 15 && !seenMaison; attempt += 1) {
      const session = createLessonSession({ mode: 'default', words: pool, storage: storage(), durationMinutes: 20 })!;
      for (const task of session.exercises.filter((exercise) => exercise.type === 'article_choice')) {
        expect(task.wordId).not.toBe('ar');
        if (task.wordId === 'm') {
          seenMaison = true;
          expect(task.correctAnswer).toBe('la');
          expect(task.options!.map((option) => option.label)).toEqual(['le', 'la']);
        }
      }
    }
    expect(seenMaison).toBe(true);
  });
});
