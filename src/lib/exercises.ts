import type {
  AppStorage,
  Exercise,
  ExerciseOption,
  ExerciseType,
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
    .slice(0, LEARNING_WORDS_PER_LESSON);
}

function getPoolFromIds(words: Word[], wordIds: string[]): Word[] {
  const idSet = new Set(wordIds);
  return words.filter((word) => idSet.has(word.id));
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
          allowMarkKnown: module.id === 'module-new-words',
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
        allowMarkKnown: module.id === 'module-training-new',
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
}: CreateLessonSessionInput): LessonSession | null {
  if (mode === 'mistakes' && wordIds?.length) {
    const mistakeWords = getPoolFromIds(words, wordIds);
    if (mistakeWords.length === 0) {
      return null;
    }
    const reviewModule = createExerciseModule(
      'module-mistakes',
      'Сложные слова',
      'Точечное повторение слов, где были ошибки.',
      mistakeWords,
      ['original_to_translation_choice', 'audio_to_original_input'],
    );
    const modules = renumberModules([reviewModule.module]);
    const steps = buildSteps(modules, {
      [reviewModule.module.id]: reviewModule.exercises,
    });

    return {
      id: `${mode}-${Date.now()}`,
      title: 'Повтор ошибок',
      mode,
      exerciseIds: reviewModule.exercises.map((exercise) => exercise.id),
      exercises: reviewModule.exercises,
      sourceWordIds: mistakeWords.map((word) => word.id),
      modules,
      steps,
    };
  }

  const newWords = pickNewWords(words, storage);
  const learningWords = pickLearningWords(words, storage);
  const reviewWords = learningWords.filter((word) => {
    const progress = getWordProgress(storage, word.id);
    return progress.status === 'review' || progress.status === 'difficult' || progress.status === 'learning';
  });
  const reinforcementWords = shuffleArray(
    Array.from(new Map([...newWords, ...learningWords].map((word) => [word.id, word])).values()),
  ).slice(0, Math.max(newWords.length, learningWords.length, 6));

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
  );
  const module3 = createExerciseModule(
    'module-review-learning',
    'Повторение не до конца выученных слов',
    'Возврат к словам, которые еще требуют внимания.',
    reviewWords,
    ['original_to_translation_choice', 'audio_to_original_input'],
  );
  const module4 = createExerciseModule(
    'module-reinforcement',
    'Закрепление',
    'Финальный смешанный блок для фиксации результата дня.',
    reinforcementWords,
    ['audio_to_translation_choice', 'original_to_translation_choice'],
  );

  const modules = renumberModules(
    [module1, module2.module, module3.module, module4.module].filter((module) => module.wordIds.length > 0),
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
