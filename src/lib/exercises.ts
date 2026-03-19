import type {
  AppStorage,
  Exercise,
  ExerciseOption,
  ExerciseType,
  LessonDurationMinutes,
  LessonMode,
  LessonModule,
  LessonSession,
  LessonStep,
  LessonSummary,
  Word,
  WordProgress,
} from '../types';
import { getWordProgress } from './storage';
import { isReviewDue, shuffleArray } from './utils';

const LESSON_LIMITS: Record<
  LessonDurationMinutes,
  {
    newWords: number;
    activeWords: number;
    reinforcementWords: number;
    mistakesWords: number;
  }
> = {
  10: {
    newWords: 3,
    activeWords: 4,
    reinforcementWords: 4,
    mistakesWords: 4,
  },
  20: {
    newWords: 6,
    activeWords: 6,
    reinforcementWords: 6,
    mistakesWords: 6,
  },
  30: {
    newWords: 8,
    activeWords: 8,
    reinforcementWords: 10,
    mistakesWords: 8,
  },
};

interface CreateLessonSessionInput {
  mode: LessonMode;
  words: Word[];
  storage: AppStorage;
  durationMinutes: LessonDurationMinutes;
  wordIds?: string[];
  activePackIds?: string[];
  title?: string;
}

interface CreateFlashcardSessionInput {
  mode: 'extra' | 'pack';
  words: Word[];
  storage: AppStorage;
  durationMinutes: LessonDurationMinutes;
  activePackIds?: string[];
  title?: string;
}

function buildChoiceOptions(word: Word, words: Word[], mode: 'translation' | 'original'): ExerciseOption[] {
  const correctLabel = mode === 'translation' ? word.translation : word.original;
  const pool = words.filter((candidate) => candidate.id !== word.id);
  const distractors: ExerciseOption[] = [];
  const seen = new Set<string>([correctLabel]);

  shuffleArray(pool).forEach((candidate) => {
    const label = mode === 'translation' ? candidate.translation : candidate.original;

    if (seen.has(label) || distractors.length >= 3) {
      return;
    }

    seen.add(label);
    distractors.push({
      id: candidate.id,
      label,
    });
  });

  return shuffleArray([
    {
      id: word.id,
      label: correctLabel,
    },
    ...distractors,
  ]);
}

function createExercise(word: Word, optionPool: Word[], type: ExerciseType, index: number): Exercise {
  switch (type) {
    case 'audio_to_translation_choice':
      return {
        id: `${word.id}-${type}-${index}`,
        type,
        wordId: word.id,
        prompt: 'Прослушайте слово и выберите перевод',
        correctAnswer: word.translation,
        options: buildChoiceOptions(word, optionPool, 'translation'),
      };
    case 'translation_to_original_choice':
      return {
        id: `${word.id}-${type}-${index}`,
        type,
        wordId: word.id,
        prompt: word.translation,
        correctAnswer: word.original,
        options: buildChoiceOptions(word, optionPool, 'original'),
      };
    case 'original_to_translation_choice':
      return {
        id: `${word.id}-${type}-${index}`,
        type,
        wordId: word.id,
        prompt: word.original,
        correctAnswer: word.translation,
        options: buildChoiceOptions(word, optionPool, 'translation'),
      };
    case 'audio_to_original_input':
      return {
        id: `${word.id}-${type}-${index}`,
        type,
        wordId: word.id,
        prompt: 'Напишите слово, которое слышите',
        correctAnswer: word.original,
      };
    default:
      throw new Error('Unsupported exercise type');
  }
}

function levelWeight(level: Word['level']): number {
  if (level === 'A1') {
    return 0;
  }

  if (level === 'A2') {
    return 1;
  }

  return 2;
}

function sortByCurriculum(left: Word, right: Word): number {
  const levelDiff = levelWeight(left.level) - levelWeight(right.level);

  if (levelDiff !== 0) {
    return levelDiff;
  }

  return left.id.localeCompare(right.id);
}

function pickNewWords(words: Word[], storage: AppStorage, limit: number): Word[] {
  return words
    .filter((word) => getWordProgress(storage, word.id).status === 'new')
    .sort(sortByCurriculum)
    .slice(0, limit);
}

function pickLearningWords(words: Word[], storage: AppStorage, limit: number): Word[] {
  const activeLearning = words.filter((word) => {
    const progress = getWordProgress(storage, word.id);
    return progress.status === 'learning' || progress.status === 'difficult';
  });

  const dueReview = words.filter((word) => {
    const progress = getWordProgress(storage, word.id);
    return progress.status === 'review' && isReviewDue(progress.next_review_at);
  });

  return [...activeLearning, ...dueReview]
    .sort((left, right) => {
      const leftProgress = getWordProgress(storage, left.id);
      const rightProgress = getWordProgress(storage, right.id);
      if (leftProgress.status === 'difficult' && rightProgress.status !== 'difficult') {
        return -1;
      }

      if (leftProgress.status !== 'difficult' && rightProgress.status === 'difficult') {
        return 1;
      }

      return rightProgress.wrong_count - leftProgress.wrong_count;
    })
    .slice(0, limit);
}

function getPoolFromIds(words: Word[], wordIds: string[]): Word[] {
  const idSet = new Set(wordIds);
  return words.filter((word) => idSet.has(word.id));
}

function uniqueWords(words: Word[]): Word[] {
  return Array.from(new Map(words.map((word) => [word.id, word])).values());
}

function pickExtraFocusWords(words: Word[], storage: AppStorage, limit: number): Word[] {
  const difficultWords = words.filter((word) => getWordProgress(storage, word.id).status === 'difficult');
  const reviewWords = words.filter((word) => {
    const progress = getWordProgress(storage, word.id);
    return progress.status === 'review' && isReviewDue(progress.next_review_at);
  });
  const learningWords = words.filter((word) => getWordProgress(storage, word.id).status === 'learning');
  const untouchedWords = words.filter((word) => getWordProgress(storage, word.id).status === 'new');

  return uniqueWords([
    ...difficultWords.sort((left, right) => getWordProgress(storage, right.id).wrong_count - getWordProgress(storage, left.id).wrong_count),
    ...reviewWords,
    ...learningWords,
    ...untouchedWords.sort(sortByCurriculum),
  ]).slice(0, limit);
}

function createMistakesSession(
  words: Word[],
  activePackIds: string[],
  durationMinutes: LessonDurationMinutes,
): LessonSession | null {
  if (words.length === 0) {
    return null;
  }

  const limits = LESSON_LIMITS[durationMinutes];
  const mistakeWords = words.slice(0, limits.mistakesWords);
  const reviewModule = createExerciseModule(
    'module-mistakes',
    'Сложные слова',
    'Точечное повторение слов, где были ошибки.',
    mistakeWords,
    ['original_to_translation_choice', 'audio_to_original_input'],
    words,
  );
  const modules = renumberModules([reviewModule.module]);
  const steps = buildSteps(modules, {
    [reviewModule.module.id]: reviewModule.exercises,
  });

  return {
    id: `mistakes-${Date.now()}`,
    title: 'Повтор ошибок',
    mode: 'mistakes',
    presentation: 'standard',
    durationMinutes,
    startedAt: new Date().toISOString(),
    exerciseIds: reviewModule.exercises.map((exercise) => exercise.id),
    exercises: reviewModule.exercises,
    sourceWordIds: mistakeWords.map((word) => word.id),
    modules,
    steps,
    activePackIds,
  };
}

function createDailySession(
  words: Word[],
  storage: AppStorage,
  activePackIds: string[],
  durationMinutes: LessonDurationMinutes,
): LessonSession | null {
  const limits = LESSON_LIMITS[durationMinutes];
  const newWords = pickNewWords(words, storage, limits.newWords);
  const learningWords = pickLearningWords(words, storage, limits.activeWords);
  const reviewWords = learningWords.filter((word) => {
    const progress = getWordProgress(storage, word.id);
    return progress.status === 'review' || progress.status === 'difficult' || progress.status === 'learning';
  });
  const reinforcementWords = shuffleArray(uniqueWords([...newWords, ...learningWords])).slice(
    0,
    limits.reinforcementWords,
  );

  if (newWords.length === 0 && learningWords.length === 0 && reinforcementWords.length === 0) {
    return null;
  }

  const module1 = createPreviewModule(newWords);
  const module2 = createExerciseModule(
    'module-training-new',
    'Тренировка новых слов',
    'Быстрое закрепление слов, которые вы только что увидели.',
    newWords,
    ['audio_to_translation_choice', 'translation_to_original_choice'],
    uniqueWords([...newWords, ...learningWords, ...reinforcementWords]),
  );
  const module3 = createExerciseModule(
    'module-review-learning',
    'Повторение не до конца выученных слов',
    'Возврат к словам, которые еще требуют внимания.',
    reviewWords,
    ['original_to_translation_choice', 'audio_to_original_input'],
    uniqueWords([...reviewWords, ...reinforcementWords, ...newWords]),
  );
  const module4 = createExerciseModule(
    'module-reinforcement',
    'Закрепление',
    'Финальный смешанный блок для фиксации результата дня.',
    reinforcementWords,
    ['audio_to_translation_choice', 'original_to_translation_choice'],
    uniqueWords([...reinforcementWords, ...newWords, ...learningWords]),
  );

  const modules = renumberModules(
    [module1, module2.module, module3.module, module4.module].filter((module) => module.wordIds.length > 0),
  );
  const exercises = [...module2.exercises, ...module3.exercises, ...module4.exercises];
  const steps = buildSteps(modules, {
    [module2.module.id]: module2.exercises,
    [module3.module.id]: module3.exercises,
    [module4.module.id]: module4.exercises,
  });

  return {
    id: `default-${Date.now()}`,
    title: 'Сегодняшний урок',
    mode: 'default',
    presentation: 'standard',
    durationMinutes,
    startedAt: new Date().toISOString(),
    exerciseIds: exercises.map((exercise) => exercise.id),
    exercises,
    sourceWordIds: uniqueWords([...newWords, ...learningWords, ...reinforcementWords]).map((word) => word.id),
    modules,
    steps,
    activePackIds,
  };
}

function createExtraSession(
  mode: 'extra' | 'pack',
  words: Word[],
  storage: AppStorage,
  activePackIds: string[],
  durationMinutes: LessonDurationMinutes,
  title?: string,
): LessonSession | null {
  const limits = LESSON_LIMITS[durationMinutes];
  const focusWords = pickExtraFocusWords(words, storage, limits.activeWords);
  const newWords = words
    .filter((word) => getWordProgress(storage, word.id).status === 'new' && !focusWords.some((item) => item.id === word.id))
    .sort(sortByCurriculum)
    .slice(0, limits.newWords);
  const mixedWords = shuffleArray(uniqueWords([...focusWords, ...newWords])).slice(0, limits.reinforcementWords);

  if (focusWords.length === 0 && newWords.length === 0 && mixedWords.length === 0) {
    return null;
  }

  const module1 = createPreviewModule(newWords);
  const module2 = createExerciseModule(
    mode === 'pack' ? 'module-pack-focus' : 'module-extra-focus',
    mode === 'pack' ? 'Практика слов пака' : 'Дополнительная практика',
    mode === 'pack'
      ? 'Тренируйте слова выбранного пака вне ежедневного лимита.'
      : 'Продолжайте обучение после завершения ежедневного урока.',
    focusWords,
    ['audio_to_translation_choice', 'original_to_translation_choice'],
    uniqueWords([...focusWords, ...newWords, ...mixedWords]),
  );
  const module3 = createExerciseModule(
    mode === 'pack' ? 'module-pack-new' : 'module-extra-new',
    mode === 'pack' ? 'Новые слова из пака' : 'Новые слова вне дневного лимита',
    mode === 'pack'
      ? 'Просмотрите и закрепите новые слова, которые лежат внутри выбранного пака.'
      : 'Здесь появляются слова, которые еще не попали в дневной урок.',
    newWords,
    ['audio_to_translation_choice', 'translation_to_original_choice'],
    uniqueWords([...newWords, ...focusWords, ...mixedWords]),
  );
  const module4 = createExerciseModule(
    mode === 'pack' ? 'module-pack-mixed' : 'module-extra-mixed',
    'Смешанное закрепление',
    'Финальный блок на закрепление активных и новых слов.',
    mixedWords,
    ['audio_to_translation_choice', 'audio_to_original_input'],
    uniqueWords([...mixedWords, ...focusWords, ...newWords]),
  );

  const modules = renumberModules(
    [module1, module2.module, module3.module, module4.module].filter((module) => module.wordIds.length > 0),
  );
  const exercises = [...module2.exercises, ...module3.exercises, ...module4.exercises];
  const steps = buildSteps(modules, {
    [module2.module.id]: module2.exercises,
    [module3.module.id]: module3.exercises,
    [module4.module.id]: module4.exercises,
  });

  return {
    id: `${mode}-${Date.now()}`,
    title: title ?? (mode === 'pack' ? 'Практика пака' : 'Дополнительное обучение'),
    mode,
    presentation: 'standard',
    durationMinutes,
    startedAt: new Date().toISOString(),
    exerciseIds: exercises.map((exercise) => exercise.id),
    exercises,
    sourceWordIds: uniqueWords([...focusWords, ...newWords, ...mixedWords]).map((word) => word.id),
    modules,
    steps,
    activePackIds,
  };
}

export function createFlashcardSession({
  mode,
  words,
  storage,
  durationMinutes,
  activePackIds = [],
  title,
}: CreateFlashcardSessionInput): LessonSession | null {
  const limits = LESSON_LIMITS[durationMinutes];
  const focusWords =
    mode === 'pack'
      ? words.slice(0, Math.max(limits.newWords + 2, 6))
      : uniqueWords([...pickExtraFocusWords(words, storage, limits.activeWords), ...pickNewWords(words, storage, limits.newWords)]).slice(
          0,
          Math.max(limits.newWords + 2, 6),
        );

  if (focusWords.length === 0) {
    return null;
  }

  const module = {
    id: mode === 'pack' ? 'module-pack-flashcards' : 'module-extra-flashcards',
    title: mode === 'pack' ? 'Карточки пака' : 'Карточки для повторения',
    description:
      mode === 'pack'
        ? 'Изучайте слова выбранного пака в формате карточек с картинкой, аудио и примерами.'
        : 'Карточки для спокойного повторения новых, сложных и активных слов.',
    theme: 'new' as const,
    position: 1,
    kind: 'preview' as const,
    wordIds: focusWords.map((word) => word.id),
    exerciseTypes: [],
    stepIds: focusWords.map((word) => `flashcard-${word.id}`),
  };

  const modules = renumberModules([module]);
  const steps = buildSteps(modules, {});

  return {
    id: `${mode}-flashcards-${Date.now()}`,
    title: title ?? (mode === 'pack' ? 'Карточки пака' : 'Карточки слов'),
    mode,
    presentation: 'flashcards',
    durationMinutes,
    startedAt: new Date().toISOString(),
    exerciseIds: [],
    exercises: [],
    sourceWordIds: focusWords.map((word) => word.id),
    modules,
    steps,
    activePackIds,
  };
}

function renumberModules(modules: LessonModule[]): LessonModule[] {
  return modules.map((module, index) => ({
    ...module,
    position: index + 1,
  }));
}

function createPreviewModule(words: Word[]): LessonModule {
  return {
    id: 'module-new-words',
    title: 'Новые слова',
    description: 'Знакомство с новой французской лексикой на сегодня.',
    theme: 'new',
    position: 1,
    kind: 'preview',
    wordIds: words.map((word) => word.id),
    exerciseTypes: [],
    stepIds: words.map((word) => `preview-${word.id}`),
  };
}

function createExerciseModule(
  id: string,
  title: string,
  description: string,
  words: Word[],
  exerciseTypes: ExerciseType[],
  optionPool: Word[] = words,
): { module: LessonModule; exercises: Exercise[] } {
  const exercises = words.flatMap((word, wordIndex) =>
    exerciseTypes.map((type, typeIndex) =>
      createExercise(word, optionPool, type, wordIndex * exerciseTypes.length + typeIndex),
    ),
  );

  return {
    module: {
      id,
      title,
      description,
      theme:
        id === 'module-training-new'
          ? 'practice'
          : id === 'module-review-learning'
            ? 'review'
            : id === 'module-reinforcement'
              ? 'reinforcement'
              : 'mistakes',
      position:
        id === 'module-training-new'
          ? 2
          : id === 'module-review-learning'
            ? 3
            : id === 'module-reinforcement'
              ? 4
              : 1,
      kind: 'exercise',
      wordIds: words.map((word) => word.id),
      exerciseTypes,
      stepIds: exercises.map((exercise) => exercise.id),
    },
    exercises,
  };
}

function buildSteps(modules: LessonModule[], moduleExercises: Record<string, Exercise[]>): LessonStep[] {
  const steps: LessonStep[] = [];
  const markKnownModuleIds = new Set(['module-new-words', 'module-training-new', 'module-extra-new', 'module-pack-new']);

  modules.forEach((module) => {
    if (module.kind === 'preview') {
      module.wordIds.forEach((wordId, index) => {
        steps.push({
          id: `${module.id}-${wordId}`,
          moduleId: module.id,
          moduleTitle: module.title,
          moduleDescription: module.description,
          moduleTheme: module.theme,
          modulePosition: module.position,
          moduleCount: modules.length,
          allowMarkKnown: module.theme === 'new',
          kind: 'preview',
          wordId,
          indexInModule: index + 1,
          totalInModule: module.wordIds.length,
        });
      });
      return;
    }

    const exercises = moduleExercises[module.id] ?? [];
    exercises.forEach((exercise, index) => {
      steps.push({
        id: `${module.id}-${exercise.id}`,
        moduleId: module.id,
        moduleTitle: module.title,
        moduleDescription: module.description,
        moduleTheme: module.theme,
        modulePosition: module.position,
        moduleCount: modules.length,
        allowMarkKnown: markKnownModuleIds.has(module.id),
        kind: 'exercise',
        exercise,
        wordId: exercise.wordId,
        indexInModule: index + 1,
        totalInModule: exercises.length,
      });
    });
  });

  return steps;
}

export function createLessonSession({
  mode,
  words,
  storage,
  durationMinutes,
  wordIds,
  activePackIds = [],
  title,
}: CreateLessonSessionInput): LessonSession | null {
  if (mode === 'mistakes' && wordIds?.length) {
    return createMistakesSession(getPoolFromIds(words, wordIds), activePackIds, durationMinutes);
  }

  if (mode === 'default') {
    return createDailySession(words, storage, activePackIds, durationMinutes);
  }

  if (mode === 'extra' || mode === 'pack') {
    return createExtraSession(mode, words, storage, activePackIds, durationMinutes, title);
  }

  return null;
}

export function countWordsByStatus(progressList: WordProgress[], status: WordProgress['status']): number {
  return progressList.filter((progress) => progress.status === status).length;
}

export function buildLessonSummary(progressList: WordProgress[]): LessonSummary {
  return {
    newWords: countWordsByStatus(progressList, 'new'),
    learningWords:
      countWordsByStatus(progressList, 'learning') +
      countWordsByStatus(progressList, 'review') +
      countWordsByStatus(progressList, 'difficult'),
    reviewWords: countWordsByStatus(progressList, 'review'),
    knownWords: countWordsByStatus(progressList, 'known'),
    difficultWords: countWordsByStatus(progressList, 'difficult'),
    masteredWords: countWordsByStatus(progressList, 'mastered'),
    totalWords: progressList.length,
    accuracy: 0,
  };
}
