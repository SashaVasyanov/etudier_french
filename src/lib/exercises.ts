import type {
  AppStorage,
  Exercise,
  ExerciseOption,
  ExerciseType,
  LessonMode,
  LessonModule,
  LessonSession,
  LessonStep,
  Word,
  WordProgress,
} from '../types';
import { getWordProgress } from './storage';
import { isReviewDue, shuffleArray } from './utils';

const NEW_WORDS_PER_LESSON = 6;
const LEARNING_WORDS_PER_LESSON = 6;

interface CreateLessonSessionInput {
  mode: LessonMode;
  words: Word[];
  storage: AppStorage;
  wordIds?: string[];
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

function createExercise(word: Word, words: Word[], type: ExerciseType, index: number): Exercise {
  switch (type) {
    case 'audio_to_translation_choice':
      return {
        id: `${word.id}-${type}-${index}`,
        type,
        wordId: word.id,
        prompt: 'Прослушайте слово и выберите перевод',
        correctAnswer: word.translation,
        options: buildChoiceOptions(word, words, 'translation'),
      };
    case 'translation_to_original_choice':
      return {
        id: `${word.id}-${type}-${index}`,
        type,
        wordId: word.id,
        prompt: word.translation,
        correctAnswer: word.original,
        options: buildChoiceOptions(word, words, 'original'),
      };
    case 'original_to_translation_choice':
      return {
        id: `${word.id}-${type}-${index}`,
        type,
        wordId: word.id,
        prompt: word.original,
        correctAnswer: word.translation,
        options: buildChoiceOptions(word, words, 'translation'),
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

function pickNewWords(words: Word[], storage: AppStorage): Word[] {
  return words
    .filter((word) => getWordProgress(storage, word.id).status === 'new')
    .sort(sortByCurriculum)
    .slice(0, NEW_WORDS_PER_LESSON);
}

function pickLearningWords(words: Word[], storage: AppStorage): Word[] {
  const learning = words.filter((word) => {
    const progress = getWordProgress(storage, word.id);
    return progress.status === 'learning';
  });

  const dueReview = words.filter((word) => {
    const progress = getWordProgress(storage, word.id);
    return progress.status === 'review' && isReviewDue(progress.next_review_at);
  });

  return [...learning, ...dueReview]
    .sort((left, right) => {
      const leftProgress = getWordProgress(storage, left.id);
      const rightProgress = getWordProgress(storage, right.id);
      return rightProgress.wrong_count - leftProgress.wrong_count;
    })
    .slice(0, LEARNING_WORDS_PER_LESSON);
}

function getPoolFromIds(words: Word[], wordIds: string[]): Word[] {
  const idSet = new Set(wordIds);
  return words.filter((word) => idSet.has(word.id));
}

function createPreviewModule(words: Word[]): LessonModule {
  return {
    id: 'module-new-words',
    title: 'Модуль 1',
    description: 'Новые слова',
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
): { module: LessonModule; exercises: Exercise[] } {
  const exercises = words.flatMap((word, wordIndex) =>
    exerciseTypes.map((type, typeIndex) =>
      createExercise(word, words, type, wordIndex * exerciseTypes.length + typeIndex),
    ),
  );

  return {
    module: {
      id,
      title,
      description,
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

  modules.forEach((module) => {
    if (module.kind === 'preview') {
      module.wordIds.forEach((wordId, index) => {
        steps.push({
          id: `${module.id}-${wordId}`,
          moduleId: module.id,
          moduleTitle: module.title,
          moduleDescription: module.description,
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
  wordIds,
}: CreateLessonSessionInput): LessonSession {
  if (mode === 'mistakes' && wordIds?.length) {
    const mistakeWords = getPoolFromIds(words, wordIds);
    const reviewModule = createExerciseModule(
      'module-mistakes',
      'Повтор ошибок',
      'Закрепление сложных слов',
      mistakeWords,
      ['original_to_translation_choice', 'audio_to_original_input'],
    );
    const steps = buildSteps([reviewModule.module], {
      [reviewModule.module.id]: reviewModule.exercises,
    });

    return {
      id: `${mode}-${Date.now()}`,
      title: 'Повтор ошибок',
      mode,
      exerciseIds: reviewModule.exercises.map((exercise) => exercise.id),
      exercises: reviewModule.exercises,
      sourceWordIds: mistakeWords.map((word) => word.id),
      modules: [reviewModule.module],
      steps,
    };
  }

  const newWords = pickNewWords(words, storage);
  const learningWords = pickLearningWords(words, storage);
  const reinforcementWords = shuffleArray(
    Array.from(new Map([...newWords, ...learningWords].map((word) => [word.id, word])).values()),
  ).slice(0, Math.max(newWords.length, learningWords.length, 6));

  const module1 = createPreviewModule(newWords);
  const module2 = createExerciseModule(
    'module-training-new',
    'Модуль 2',
    'Тренировка новых слов',
    newWords,
    ['audio_to_translation_choice', 'translation_to_original_choice'],
  );
  const module3 = createExerciseModule(
    'module-review-learning',
    'Модуль 3',
    'Повторение изучаемых слов',
    learningWords.length > 0 ? learningWords : newWords,
    ['original_to_translation_choice', 'audio_to_original_input'],
  );
  const module4 = createExerciseModule(
    'module-reinforcement',
    'Модуль 4',
    'Закрепление',
    reinforcementWords,
    ['audio_to_translation_choice', 'original_to_translation_choice'],
  );

  const modules = [module1, module2.module, module3.module, module4.module].filter(
    (module) => module.wordIds.length > 0,
  );
  const exercises = [
    ...module2.exercises,
    ...module3.exercises,
    ...module4.exercises,
  ];
  const steps = buildSteps(modules, {
    [module2.module.id]: module2.exercises,
    [module3.module.id]: module3.exercises,
    [module4.module.id]: module4.exercises,
  });

  return {
    id: `${mode}-${Date.now()}`,
    title: 'Сегодняшний урок',
    mode,
    exerciseIds: exercises.map((exercise) => exercise.id),
    exercises,
    sourceWordIds: Array.from(new Set([...newWords, ...learningWords, ...reinforcementWords].map((word) => word.id))),
    modules,
    steps,
  };
}

export function countWordsByStatus(progressList: WordProgress[], status: WordProgress['status']): number {
  return progressList.filter((progress) => progress.status === status).length;
}
