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
import { getWordProgress, isWordDueForReview } from './storage';
import { isReviewDue, shuffleArray } from './utils';
import { containsJapaneseKanji, getJapaneseHiraganaReading } from './wordPresentation';

const LESSON_LIMITS: Record<
  LessonDurationMinutes,
  {
    newWords: number;
    activeWords: number;
    reinforcementWords: number;
    recapWords: number;
    mistakesWords: number;
    memoryCheckWords: number;
  }
> = {
  10: {
    newWords: 3,
    activeWords: 4,
    reinforcementWords: 4,
    recapWords: 3,
    mistakesWords: 4,
    memoryCheckWords: 1,
  },
  20: {
    newWords: 6,
    activeWords: 6,
    reinforcementWords: 6,
    recapWords: 4,
    mistakesWords: 6,
    memoryCheckWords: 1,
  },
  30: {
    newWords: 8,
    activeWords: 8,
    reinforcementWords: 10,
    recapWords: 5,
    mistakesWords: 8,
    memoryCheckWords: 2,
  },
};

type LessonLimits = (typeof LESSON_LIMITS)[LessonDurationMinutes];

const LONG_TERM_MEMORY_MIN_DAYS = 3;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

interface CreateLessonSessionInput {
  mode: LessonMode;
  words: Word[];
  storage: AppStorage;
  durationMinutes: LessonDurationMinutes;
  wordTarget?: number;
  useFullPool?: boolean;
  wordIds?: string[];
  activePackIds?: string[];
  title?: string;
}

interface CreateFlashcardSessionInput {
  mode: 'extra' | 'pack';
  words: Word[];
  storage: AppStorage;
  durationMinutes: LessonDurationMinutes;
  wordTarget?: number;
  useFullPool?: boolean;
  activePackIds?: string[];
  title?: string;
}

function getLessonLimits(durationMinutes: LessonDurationMinutes, wordTarget?: number, useFullPool = false): LessonLimits {
  if (useFullPool && wordTarget && wordTarget > 0) {
    const target = Math.max(10, wordTarget);
    const memoryCheckWords = Math.max(1, Math.min(6, Math.round(target / 40)));

    return {
      newWords: target,
      activeWords: target,
      reinforcementWords: target,
      recapWords: target,
      mistakesWords: target,
      memoryCheckWords,
    };
  }

  if (!wordTarget) {
    return LESSON_LIMITS[durationMinutes];
  }

  const target = Math.max(10, Math.min(50, wordTarget));
  const memoryCheckWords = Math.max(1, Math.min(3, Math.round(target / 30)));
  const newWords = Math.max(3, Math.round(target * 0.34));

  return {
    newWords,
    activeWords: Math.max(4, target - newWords - memoryCheckWords),
    reinforcementWords: Math.max(4, Math.round(target * 0.5)),
    recapWords: Math.max(3, Math.round(target * 0.28)),
    mistakesWords: target,
    memoryCheckWords,
  };
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createSentenceCloze(word: Word): string | null {
  const example = word.example_original.trim();
  const original = word.original.trim();

  if (!example || !original) {
    return null;
  }

  if (word.language === 'japanese') {
    return example.includes(original) ? example.replace(original, '＿＿') : null;
  }

  const pattern = new RegExp(`(^|[^\\p{L}])${escapeRegExp(original)}(?=$|[^\\p{L}])`, 'iu');
  return pattern.test(example) ? example.replace(pattern, '$1＿＿') : null;
}

function canCreateExercise(word: Word, type: ExerciseType): boolean {
  if (type === 'kanji_to_hiragana_input') {
    return word.language === 'japanese' && containsJapaneseKanji(word.original) && Boolean(getJapaneseHiraganaReading(word));
  }

  if (type === 'sentence_cloze_input') {
    return Boolean(createSentenceCloze(word));
  }

  return true;
}

function getAvailableExerciseTypes(word: Word, exerciseTypes: ExerciseType[]): ExerciseType[] {
  const availableTypes = exerciseTypes.map((type) => {
    if (canCreateExercise(word, type)) {
      return type;
    }

    return type === 'kanji_to_hiragana_input' || type === 'sentence_cloze_input'
      ? 'translation_to_original_input'
      : null;
  });

  return Array.from(new Set(availableTypes.filter((type): type is ExerciseType => type !== null)));
}

function createExercise(word: Word, optionPool: Word[], type: ExerciseType, index: number): Exercise {
  switch (type) {
    case 'audio_to_translation_choice':
      {
        const options = buildChoiceOptions(word, optionPool, 'translation');

        // A one-word custom pack has no plausible distractor. Rendering its
        // only answer as a choice turns the exercise into a free pass, so use
        // audio recall instead.
        if (options.length < 2) {
          return createExercise(word, optionPool, 'audio_to_original_input', index);
        }

      return {
        id: `${word.id}-${type}-${index}`,
        type,
        wordId: word.id,
        prompt: 'Прослушайте слово и выберите перевод',
        correctAnswer: word.translation,
        options,
      };
      }
    case 'translation_to_original_choice':
      {
        const options = buildChoiceOptions(word, optionPool, 'original');

        if (options.length < 2) {
          return createExercise(word, optionPool, 'translation_to_original_input', index);
        }

      return {
        id: `${word.id}-${type}-${index}`,
        type,
        wordId: word.id,
        prompt: word.translation,
        correctAnswer: word.original,
        options,
      };
      }
    case 'original_to_translation_choice':
      {
        const options = buildChoiceOptions(word, optionPool, 'translation');

        if (options.length < 2) {
          return createExercise(word, optionPool, 'translation_to_original_input', index);
        }

      return {
        id: `${word.id}-${type}-${index}`,
        type,
        wordId: word.id,
        prompt: word.original,
        correctAnswer: word.translation,
        options,
      };
      }
    case 'audio_to_original_input':
      return {
        id: `${word.id}-${type}-${index}`,
        type,
        wordId: word.id,
        prompt: 'Напишите слово, которое слышите',
        correctAnswer: word.original,
      };
    case 'translation_to_original_input':
      return {
        id: `${word.id}-${type}-${index}`,
        type,
        wordId: word.id,
        prompt: word.translation,
        correctAnswer: word.original,
      };
    case 'kanji_to_hiragana_input': {
      const reading = getJapaneseHiraganaReading(word);

      if (!reading) {
        return createExercise(word, optionPool, 'translation_to_original_input', index);
      }

      return {
        id: `${word.id}-${type}-${index}`,
        type,
        wordId: word.id,
        prompt: word.original,
        correctAnswer: reading,
      };
    }
    case 'sentence_cloze_input': {
      const cloze = createSentenceCloze(word);

      if (!cloze) {
        return createExercise(word, optionPool, 'translation_to_original_input', index);
      }

      return {
        id: `${word.id}-${type}-${index}`,
        type,
        wordId: word.id,
        prompt: cloze,
        context: word.example_translation,
        correctAnswer: word.original,
      };
    }
    case 'memory_check':
      return {
        id: `${word.id}-${type}-${index}`,
        type,
        wordId: word.id,
        prompt: word.original,
        context: word.example_original,
        correctAnswer: 'Помню',
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

function getProgressAccuracy(progress: WordProgress): number {
  return progress.shown_count > 0 ? progress.correct_count / progress.shown_count : 0;
}

function getElapsedDaysSinceLastSeen(progress: WordProgress): number {
  if (!progress.last_seen_at) {
    return 0;
  }

  return Math.max(0, (Date.now() - new Date(progress.last_seen_at).getTime()) / DAY_IN_MS);
}

function getRetrievabilityScore(progress: WordProgress): number {
  if (!progress.last_seen_at || progress.interval_days <= 0) {
    return progress.status === 'new' ? 0.45 : 0.7;
  }

  const stabilityDays = Math.max(1, progress.interval_days * progress.ease_factor);
  const elapsedDays = getElapsedDaysSinceLastSeen(progress);

  return Math.exp(-elapsedDays / stabilityDays);
}

function getStudyUrgency(progress: WordProgress): number {
  const accuracy = getProgressAccuracy(progress);
  const retrievability = getRetrievabilityScore(progress);
  const difficultBonus = progress.status === 'difficult' ? 44 : 0;
  const reviewBonus = progress.status === 'review' ? 24 : 0;
  const learningBonus = progress.status === 'learning' ? 16 : 0;
  const newBonus = progress.status === 'new' ? 10 : 0;
  const dueBonus = progress.next_review_at && isReviewDue(progress.next_review_at) ? 30 : 0;
  const retrievalBonus = Math.round((1 - retrievability) * 38);

  return (
    difficultBonus +
    reviewBonus +
    learningBonus +
    newBonus +
    dueBonus +
    retrievalBonus +
    progress.wrong_count * 10 +
    Math.max(0, 4 - progress.repetition_step) * 5 +
    Math.round((1 - accuracy) * 24)
  );
}

function getProgressAgeInDays(progress: WordProgress): number {
  const timestamp = progress.learned_at ?? progress.last_seen_at;

  if (!timestamp) {
    return 0;
  }

  return Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / DAY_IN_MS));
}

function isLongTermMemoryCandidate(progress: WordProgress): boolean {
  const ageInDays = getProgressAgeInDays(progress);

  if (!isWordDueForReview(progress)) {
    return false;
  }

  if (progress.status === 'mastered') {
    return ageInDays >= LONG_TERM_MEMORY_MIN_DAYS;
  }

  return (
    progress.status === 'review' &&
    progress.repetition_step >= 4 &&
    (ageInDays >= LONG_TERM_MEMORY_MIN_DAYS || Boolean(progress.next_review_at && isReviewDue(progress.next_review_at)))
  );
}

function rankWordsForStudy(words: Word[], storage: AppStorage): Word[] {
  return [...words].sort((left, right) => {
    const leftProgress = getWordProgress(storage, left.id);
    const rightProgress = getWordProgress(storage, right.id);
    const urgencyDiff = getStudyUrgency(rightProgress) - getStudyUrgency(leftProgress);

    if (urgencyDiff !== 0) {
      return urgencyDiff;
    }

    return sortByCurriculum(left, right);
  });
}

function weaveWordOrder(words: Word[]): Word[] {
  const result: Word[] = [];
  let left = 0;
  let right = words.length - 1;

  while (left <= right) {
    const first = words[left];

    if (first) {
      result.push(first);
    }

    if (left !== right) {
      const last = words[right];

      if (last) {
        result.push(last);
      }
    }

    left += 1;
    right -= 1;
  }

  return result;
}

function getMemoryBand(progress: WordProgress): 'fragile' | 'growing' | 'stable' {
  const accuracy = getProgressAccuracy(progress);
  const retrievability = getRetrievabilityScore(progress);

  if (progress.status === 'difficult' || progress.wrong_count >= 3 || accuracy < 0.62 || retrievability < 0.58) {
    return 'fragile';
  }

  if (progress.repetition_step >= 4 && accuracy >= 0.8 && retrievability >= 0.76) {
    return 'stable';
  }

  return 'growing';
}

function reorderExerciseTypesForWord(word: Word, storage: AppStorage, exerciseTypes: ExerciseType[]): ExerciseType[] {
  const progress = getWordProgress(storage, word.id);
  const band = getMemoryBand(progress);
  const availableExerciseTypes = getAvailableExerciseTypes(word, exerciseTypes);

  const priorities: Record<'fragile' | 'growing' | 'stable', Record<ExerciseType, number>> = {
    fragile: {
      original_to_translation_choice: 0,
      translation_to_original_choice: 1,
      audio_to_translation_choice: 2,
      audio_to_original_input: 3,
      translation_to_original_input: 2,
      kanji_to_hiragana_input: 2,
      sentence_cloze_input: 1,
      memory_check: 4,
    },
    growing: {
      original_to_translation_choice: 1,
      translation_to_original_choice: 0,
      audio_to_translation_choice: 2,
      audio_to_original_input: 2,
      translation_to_original_input: 0,
      kanji_to_hiragana_input: 1,
      sentence_cloze_input: 0,
      memory_check: 3,
    },
    stable: {
      original_to_translation_choice: 2,
      translation_to_original_choice: 0,
      audio_to_translation_choice: 3,
      audio_to_original_input: 1,
      translation_to_original_input: 0,
      kanji_to_hiragana_input: 0,
      sentence_cloze_input: 0,
      memory_check: 0,
    },
  };

  const buckets = new Map<number, ExerciseType[]>();

  availableExerciseTypes.forEach((type) => {
    const priority = priorities[band][type];
    const bucket = buckets.get(priority) ?? [];
    bucket.push(type);
    buckets.set(priority, bucket);
  });

  return [...buckets.entries()]
    .sort((left, right) => left[0] - right[0])
    .flatMap(([, types]) => shuffleArray(types));
}

function buildExerciseSequence(
  words: Word[],
  exerciseTypes: ExerciseType[],
  storage?: AppStorage,
): Array<{ word: Word; type: ExerciseType }> {
  const orderedWords = storage ? rankWordsForStudy(words, storage) : shuffleArray(words);
  const queues = orderedWords.map((word) => ({
    word,
    queue: storage
      ? reorderExerciseTypesForWord(word, storage, exerciseTypes)
      : shuffleArray(getAvailableExerciseTypes(word, exerciseTypes)),
  }));
  const sequence: Array<{ word: Word; type: ExerciseType }> = [];
  let previousWordId: string | null = null;
  let previousType: ExerciseType | null = null;

  while (queues.some((item) => item.queue.length > 0)) {
    const available = queues.filter((item) => item.queue.length > 0);
    const preferredWords = available.filter((item) => item.word.id !== previousWordId);
    const wordPool = preferredWords.length > 0 ? preferredWords : available;
    const shuffledWordPool = shuffleArray(wordPool);

    const selected = shuffledWordPool.find((item) => item.queue[0] !== previousType) ?? shuffledWordPool[0];

    if (!selected) {
      break;
    }

    const type = selected.queue.shift();

    if (!type) {
      continue;
    }

    sequence.push({ word: selected.word, type });
    previousWordId = selected.word.id;
    previousType = type;
  }

  return sequence;
}

function pickNewWords(words: Word[], storage: AppStorage, limit: number): Word[] {
  return words
    .filter((word) => getWordProgress(storage, word.id).status === 'new')
    .sort(sortByCurriculum)
    .slice(0, limit);
}

function pickLearningWords(words: Word[], storage: AppStorage, limit: number): Word[] {
  return words
    .filter((word) => isWordDueForReview(getWordProgress(storage, word.id)))
    .sort((left, right) => getStudyUrgency(getWordProgress(storage, right.id)) - getStudyUrgency(getWordProgress(storage, left.id)))
    .slice(0, limit);
}

function interleaveWordGroups(...groups: Word[][]): Word[] {
  const queues = groups.map((group) => [...group]);
  const result: Word[] = [];
  const seen = new Set<string>();

  while (queues.some((queue) => queue.length > 0)) {
    queues.forEach((queue) => {
      const next = queue.shift();

      if (!next || seen.has(next.id)) {
        return;
      }

      seen.add(next.id);
      result.push(next);
    });
  }

  return result;
}

function pickReinforcementWords(newWords: Word[], reviewWords: Word[], limit: number): Word[] {
  return interleaveWordGroups(newWords, reviewWords, newWords.slice(1), reviewWords.slice(1)).slice(0, limit);
}

function pickRecapWords(newWords: Word[], reviewWords: Word[], reinforcementWords: Word[], limit: number): Word[] {
  return interleaveWordGroups(
    reviewWords,
    newWords,
    reinforcementWords,
    reviewWords.filter((word) => !reinforcementWords.some((item) => item.id === word.id)),
  ).slice(0, limit);
}

function getPoolFromIds(words: Word[], wordIds: string[]): Word[] {
  const idSet = new Set(wordIds);
  return words.filter((word) => idSet.has(word.id));
}

function uniqueWords(words: Word[]): Word[] {
  return Array.from(new Map(words.map((word) => [word.id, word])).values());
}

function pickExtraFocusWords(words: Word[], storage: AppStorage, limit: number): Word[] {
  return words
    .filter((word) => isWordDueForReview(getWordProgress(storage, word.id)))
    .sort((left, right) => getStudyUrgency(getWordProgress(storage, right.id)) - getStudyUrgency(getWordProgress(storage, left.id)))
    .slice(0, limit);
}

function pickLongTermMemoryWords(
  words: Word[],
  storage: AppStorage,
  limit: number,
  excludedWordIds = new Set<string>(),
): Word[] {
  if (limit <= 0) {
    return [];
  }

  return words
    .filter((word) => {
      if (excludedWordIds.has(word.id)) {
        return false;
      }

      return isLongTermMemoryCandidate(getWordProgress(storage, word.id));
    })
    .sort((left, right) => {
      const leftProgress = getWordProgress(storage, left.id);
      const rightProgress = getWordProgress(storage, right.id);
      const statusPriority = (progress: WordProgress) => (progress.status === 'mastered' ? 0 : 1);
      const priorityDiff = statusPriority(leftProgress) - statusPriority(rightProgress);

      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      const retrievabilityDiff = getRetrievabilityScore(leftProgress) - getRetrievabilityScore(rightProgress);

      if (retrievabilityDiff !== 0) {
        return retrievabilityDiff;
      }

      const ageDiff = getProgressAgeInDays(rightProgress) - getProgressAgeInDays(leftProgress);

      if (ageDiff !== 0) {
        return ageDiff;
      }

      return sortByCurriculum(left, right);
    })
    .slice(0, limit);
}

function addMemoryCheckExercises(
  moduleResult: { module: LessonModule; exercises: Exercise[] },
  memoryWords: Word[],
  optionPool: Word[],
): { module: LessonModule; exercises: Exercise[] } {
  if (memoryWords.length === 0) {
    return moduleResult;
  }

  const memoryExercises = memoryWords.map((word, index) =>
    createExercise(word, optionPool, 'memory_check', moduleResult.exercises.length + index),
  );
  const exercises = shuffleArray([...moduleResult.exercises, ...memoryExercises]);
  const wordIds = Array.from(new Set([...moduleResult.module.wordIds, ...memoryWords.map((word) => word.id)]));

  return {
    module: {
      ...moduleResult.module,
      wordIds,
      exerciseTypes: Array.from(new Set([...moduleResult.module.exerciseTypes, 'memory_check'])),
      stepIds: exercises.map((exercise) => exercise.id),
    },
    exercises,
  };
}

function createMistakesSession(
  words: Word[],
  activePackIds: string[],
  durationMinutes: LessonDurationMinutes,
  wordTarget?: number,
  useFullPool = false,
): LessonSession | null {
  if (words.length === 0) {
    return null;
  }

  const limits = getLessonLimits(durationMinutes, wordTarget, useFullPool);
  const mistakeWords = words.slice(0, limits.mistakesWords);
  const reviewModule = createExerciseModule(
    'module-mistakes',
    'Сложные слова',
    'Точечное повторение слов, где были ошибки.',
    mistakeWords,
    ['translation_to_original_input', 'sentence_cloze_input', 'kanji_to_hiragana_input'],
    uniqueWords(words),
    undefined,
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
  wordTarget?: number,
  useFullPool = false,
): LessonSession | null {
  const limits = getLessonLimits(durationMinutes, wordTarget, useFullPool);
  const newWords = pickNewWords(words, storage, limits.newWords);
  const learningWords = pickLearningWords(words, storage, limits.activeWords);
  const introductionWords = newWords.length > 0 ? newWords : learningWords.slice(0, Math.max(1, limits.newWords));
  const scheduledReviewWords = learningWords;
  // A daily lesson always has five meaningful modules. On a learner's first
  // day there are no previously scheduled reviews, so the same new words are
  // deliberately revisited in module 3 instead of dropping that module.
  const reviewWords =
    scheduledReviewWords.length > 0
      ? scheduledReviewWords
      : introductionWords.slice(0, Math.max(1, Math.min(introductionWords.length, limits.activeWords)));
  const selectedReinforcementWords = pickReinforcementWords(
    introductionWords,
    reviewWords,
    limits.reinforcementWords,
  );
  const reinforcementWords =
    selectedReinforcementWords.length > 0
      ? selectedReinforcementWords
      : uniqueWords([...introductionWords, ...reviewWords]).slice(0, Math.max(1, limits.reinforcementWords));
  const selectedRecapWords = pickRecapWords(introductionWords, reviewWords, reinforcementWords, limits.recapWords);
  const recapWords =
    selectedRecapWords.length > 0
      ? selectedRecapWords
      : uniqueWords([...reviewWords, ...reinforcementWords, ...introductionWords]).slice(0, Math.max(1, limits.recapWords));
  const memoryCheckWords = pickLongTermMemoryWords(
    words,
    storage,
    limits.memoryCheckWords,
    new Set(uniqueWords([...introductionWords, ...reviewWords, ...reinforcementWords, ...recapWords]).map((word) => word.id)),
  );

  if (
    introductionWords.length === 0 &&
    reviewWords.length === 0 &&
    reinforcementWords.length === 0 &&
    recapWords.length === 0 &&
    memoryCheckWords.length === 0
  ) {
    return null;
  }

  const module1 = createPreviewModule(
    introductionWords,
    newWords.length > 0
      ? undefined
      : {
          title: 'Слова к повторению',
          description: 'Короткая подготовка перед запланированным повторением.',
          theme: 'review',
        },
  );
  const module2 = createExerciseModule(
    'module-training-new',
    newWords.length > 0 ? 'Тренировка новых слов' : 'Разминка перед повторением',
    newWords.length > 0
      ? 'Быстрое закрепление слов, которые вы только что увидели.'
      : 'Проверка узнавания перед основным запланированным повторением.',
    introductionWords,
    ['original_to_translation_choice', 'translation_to_original_input'],
    uniqueWords(words),
    storage,
  );
  const module3 = createExerciseModule(
    'module-review-learning',
    'Повторение не до конца выученных слов',
    'Возврат к словам, которые еще требуют внимания.',
    reviewWords,
    ['audio_to_original_input', 'kanji_to_hiragana_input'],
    uniqueWords(words),
    storage,
  );
  const module4 = createExerciseModule(
    'module-reinforcement',
    'Смешанное закрепление',
    'Слова возвращаются в новом порядке, чтобы проверить узнавание без заучивания по шаблону.',
    reinforcementWords,
    ['sentence_cloze_input', 'translation_to_original_choice'],
    uniqueWords(words),
    storage,
  );
  const module5 = addMemoryCheckExercises(
    createExerciseModule(
      'module-final-recap',
      'Финальная мини-проверка',
      'Короткий итоговый блок: ключевые слова дня и редкая проверка давно выученного.',
      recapWords,
      ['translation_to_original_input', 'sentence_cloze_input'],
      uniqueWords(words),
      storage,
    ),
    memoryCheckWords,
    uniqueWords(words),
  );

  const modules = renumberModules(
    [module1, module2.module, module3.module, module4.module, module5.module]
      .filter((module) => module.wordIds.length > 0 && module.stepIds.length > 0),
  );
  const exercises = [...module2.exercises, ...module3.exercises, ...module4.exercises, ...module5.exercises];
  const steps = buildSteps(modules, {
    [module2.module.id]: module2.exercises,
    [module3.module.id]: module3.exercises,
    [module4.module.id]: module4.exercises,
    [module5.module.id]: module5.exercises,
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
    sourceWordIds: uniqueWords([...introductionWords, ...reviewWords, ...reinforcementWords, ...recapWords, ...memoryCheckWords]).map((word) => word.id),
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
  wordTarget?: number,
  useFullPool = false,
  title?: string,
): LessonSession | null {
  const limits = getLessonLimits(durationMinutes, wordTarget, useFullPool);
  const focusWords = pickExtraFocusWords(words, storage, limits.activeWords);
  const newWords = words
    .filter((word) => getWordProgress(storage, word.id).status === 'new' && !focusWords.some((item) => item.id === word.id))
    .sort(sortByCurriculum)
    .slice(0, limits.newWords);
  const mixedWords = shuffleArray(uniqueWords([...focusWords, ...newWords])).slice(0, limits.reinforcementWords);
  const memoryCheckWords = pickLongTermMemoryWords(
    words,
    storage,
    limits.memoryCheckWords,
    new Set(uniqueWords([...focusWords, ...newWords, ...mixedWords]).map((word) => word.id)),
  );

  if (focusWords.length === 0 && newWords.length === 0 && mixedWords.length === 0 && memoryCheckWords.length === 0) {
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
    ['original_to_translation_choice', 'translation_to_original_input'],
    uniqueWords(words),
    storage,
  );
  const module3 = createExerciseModule(
    mode === 'pack' ? 'module-pack-new' : 'module-extra-new',
    mode === 'pack' ? 'Новые слова из пака' : 'Новые слова вне дневного лимита',
    mode === 'pack'
      ? 'Просмотрите и закрепите новые слова, которые лежат внутри выбранного пака.'
      : 'Здесь появляются слова, которые еще не попали в дневной урок.',
    newWords,
    ['original_to_translation_choice', 'translation_to_original_input'],
    uniqueWords(words),
    storage,
  );
  const module4 = addMemoryCheckExercises(
    createExerciseModule(
      mode === 'pack' ? 'module-pack-mixed' : 'module-extra-mixed',
      'Смешанное закрепление',
      'Финальный блок на закрепление активных, новых и давно выученных слов.',
      mixedWords,
      ['sentence_cloze_input', 'audio_to_original_input', 'kanji_to_hiragana_input'],
      uniqueWords(words),
      storage,
    ),
    memoryCheckWords,
    uniqueWords(words),
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
    sourceWordIds: uniqueWords([...focusWords, ...newWords, ...mixedWords, ...memoryCheckWords]).map((word) => word.id),
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
  wordTarget,
  useFullPool = false,
  activePackIds = [],
  title,
}: CreateFlashcardSessionInput): LessonSession | null {
  const limits = getLessonLimits(durationMinutes, wordTarget, useFullPool);
  const flashcardLimit = useFullPool ? Math.max(words.length, wordTarget ?? 0) : wordTarget ?? Math.max(limits.newWords + 2, 6);
  const focusWords =
    mode === 'pack'
      ? words.slice(0, flashcardLimit)
      : uniqueWords([...pickExtraFocusWords(words, storage, limits.activeWords), ...pickNewWords(words, storage, limits.newWords)]).slice(
          0,
          flashcardLimit,
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

function createPreviewModule(
  words: Word[],
  copy?: { title: string; description: string; theme: LessonModule['theme'] },
): LessonModule {
  return {
    id: 'module-new-words',
    title: copy?.title ?? 'Новые слова',
    description: copy?.description ?? 'Знакомство с новой лексикой на сегодня.',
    theme: copy?.theme ?? 'new',
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
  storage?: AppStorage,
): { module: LessonModule; exercises: Exercise[] } {
  const orderedWords = storage ? weaveWordOrder(rankWordsForStudy(words, storage)) : shuffleArray(words);
  const sequence = buildExerciseSequence(orderedWords, exerciseTypes, storage);
  const exercises = sequence.map((item, index) => createExercise(item.word, optionPool, item.type, index));

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
              : id === 'module-final-recap'
                ? 'recap'
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
      wordIds: orderedWords.map((word) => word.id),
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

export function scheduleExerciseRetry(
  session: LessonSession,
  currentStepIndex: number,
  failedExercise: Exercise,
  word: Word,
): LessonSession {
  const retryAlreadyScheduled =
    Boolean(failedExercise.retryOfExerciseId) ||
    session.exercises.some((exercise) => exercise.wordId === word.id && Boolean(exercise.retryOfExerciseId));

  if (retryAlreadyScheduled) {
    return session;
  }

  const candidateTypes: ExerciseType[] = [
    ...(word.language === 'japanese' && failedExercise.type !== 'kanji_to_hiragana_input'
      ? (['kanji_to_hiragana_input'] as ExerciseType[])
      : []),
    ...(failedExercise.type !== 'sentence_cloze_input' ? (['sentence_cloze_input'] as ExerciseType[]) : []),
    'translation_to_original_input',
  ];
  const retryType = candidateTypes.find((type) => canCreateExercise(word, type)) ?? 'translation_to_original_input';
  const retryIndex = session.exercises.length;
  const baseRetryExercise = createExercise(word, [word], retryType, retryIndex);
  const retryExercise: Exercise = {
    ...baseRetryExercise,
    id: `${failedExercise.id}-retry-${retryIndex}`,
    retryOfExerciseId: failedExercise.id,
  };
  // Place the retry after three other tasks whenever enough lesson steps remain.
  const insertionIndex = Math.min(session.steps.length, currentStepIndex + 4);
  const anchorStep =
    session.steps[insertionIndex] ??
    [...session.steps].reverse().find((step) => step.kind === 'exercise') ??
    session.steps[currentStepIndex];

  if (!anchorStep) {
    return session;
  }

  const retryStep: LessonStep = {
    id: `${anchorStep.moduleId}-${retryExercise.id}`,
    moduleId: anchorStep.moduleId,
    moduleTitle: anchorStep.moduleTitle,
    moduleDescription: anchorStep.moduleDescription,
    moduleTheme: anchorStep.moduleTheme,
    modulePosition: anchorStep.modulePosition,
    moduleCount: anchorStep.moduleCount,
    allowMarkKnown: false,
    kind: 'exercise',
    exercise: retryExercise,
    wordId: word.id,
    indexInModule: 1,
    totalInModule: 1,
  };
  const insertedSteps = [
    ...session.steps.slice(0, insertionIndex),
    retryStep,
    ...session.steps.slice(insertionIndex),
  ];
  const modules = session.modules.map((module) => {
    const moduleSteps = insertedSteps.filter((step) => step.moduleId === module.id);

    return {
      ...module,
      exerciseTypes:
        module.id === anchorStep.moduleId
          ? Array.from(new Set([...module.exerciseTypes, retryExercise.type]))
          : module.exerciseTypes,
      stepIds: moduleSteps.map((step) => step.id),
    };
  });
  const moduleById = new Map(modules.map((module) => [module.id, module]));
  const moduleStepCounts = new Map<string, number>();
  const totalStepsByModule = new Map<string, number>();

  insertedSteps.forEach((step) => {
    totalStepsByModule.set(step.moduleId, (totalStepsByModule.get(step.moduleId) ?? 0) + 1);
  });

  const steps = insertedSteps.map((step) => {
    const module = moduleById.get(step.moduleId);
    const indexInModule = (moduleStepCounts.get(step.moduleId) ?? 0) + 1;
    moduleStepCounts.set(step.moduleId, indexInModule);

    return {
      ...step,
      moduleTitle: module?.title ?? step.moduleTitle,
      moduleDescription: module?.description ?? step.moduleDescription,
      moduleTheme: module?.theme ?? step.moduleTheme,
      modulePosition: module?.position ?? step.modulePosition,
      moduleCount: modules.length,
      indexInModule,
      totalInModule: totalStepsByModule.get(step.moduleId) ?? step.totalInModule,
    };
  });

  return {
    ...session,
    modules,
    steps,
    exercises: [...session.exercises, retryExercise],
    exerciseIds: [...session.exerciseIds, retryExercise.id],
  };
}

export function createLessonSession({
  mode,
  words,
  storage,
  durationMinutes,
  wordTarget,
  useFullPool = false,
  wordIds,
  activePackIds = [],
  title,
}: CreateLessonSessionInput): LessonSession | null {
  if (mode === 'mistakes' && wordIds?.length) {
    const dueMistakes = getPoolFromIds(words, wordIds).filter((word) =>
      isWordDueForReview(getWordProgress(storage, word.id)),
    );
    return createMistakesSession(dueMistakes, activePackIds, durationMinutes, wordTarget, useFullPool);
  }

  if (mode === 'default') {
    return createDailySession(words, storage, activePackIds, durationMinutes, wordTarget, useFullPool);
  }

  if (mode === 'extra' || mode === 'pack') {
    return createExtraSession(mode, words, storage, activePackIds, durationMinutes, wordTarget, useFullPool, title);
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
    difficultWords: countWordsByStatus(progressList, 'difficult'),
    masteredWords: countWordsByStatus(progressList, 'mastered'),
    totalWords: progressList.length,
    accuracy: 0,
  };
}
