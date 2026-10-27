import { getStudyLevelRank } from './levels';
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
import { getJapaneseHiraganaReading } from './wordPresentation';

interface LessonLimits {
  newWords: number;
  activeWords: number;
  reinforcementWords: number;
  recapWords: number;
  mistakesWords: number;
  memoryCheckWords: number;
}

// One source of truth for lesson size: the word target. A duration preset only
// picks a default target (see setLessonDurationPreference in storage.ts).
const DEFAULT_WORD_TARGET_BY_DURATION: Record<LessonDurationMinutes, number> = { 10: 10, 20: 20, 30: 30 };

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
  /** Daily lesson only: restrict new words to these ids (a chosen topic pack),
   *  while due reviews still come from every word in `words`. */
  newWordIds?: string[];
  activePackIds?: string[];
  title?: string;
  /** «5 минут»: only the most urgent reviews, two short tasks per word. */
  quick?: boolean;
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

function getNewWordsQuota(target: number): number {
  return Math.max(3, Math.round(target * 0.34));
}

export interface DailyBalance {
  /** Words whose review is due now. */
  dueCount: number;
  /** New words the daily lesson will introduce. */
  newWords: number;
  /** New words held back today because reviews piled up. */
  deferredNewWords: number;
  /** Review slots in the lesson after the balance. */
  reviewSlots: number;
}

/**
 * New words give way to reviews when reviews pile up (after a break): with
 * more due words than review slots the lesson takes half the new words, with
 * twice as many it takes none, and the freed slots go to reviews. The most
 * urgent reviews come first, so a backlog is worked off over a few days
 * instead of in one exhausting session.
 */
export function getDailyBalance(
  words: Word[],
  storage: AppStorage,
  durationMinutes: LessonDurationMinutes,
  wordTarget?: number,
  useFullPool = false,
): DailyBalance {
  const limits = getLessonLimits(durationMinutes, wordTarget, useFullPool, words.length);
  const dueCount = words.filter((word) => isWordDueForReview(getWordProgress(storage, word.id))).length;
  const slots = limits.activeWords;
  const newWords = dueCount >= slots * 2 ? 0 : dueCount > slots ? Math.max(1, Math.floor(limits.newWords / 2)) : limits.newWords;
  const deferredNewWords = limits.newWords - newWords;
  return { dueCount, newWords, deferredNewWords, reviewSlots: slots + deferredNewWords };
}

function getLessonLimits(
  durationMinutes: LessonDurationMinutes,
  wordTarget: number | undefined,
  useFullPool: boolean,
  poolSize: number,
): LessonLimits {
  const target = Math.max(10, Math.min(50, wordTarget ?? DEFAULT_WORD_TARGET_BY_DURATION[durationMinutes]));
  const newWords = getNewWordsQuota(target);

  if (useFullPool) {
    // Without a lesson limit every due review and practice word may come up,
    // but new words still follow the daily quota: introducing the whole
    // dictionary at once is never a useful lesson.
    const pool = Math.max(target, poolSize);
    return {
      newWords,
      activeWords: pool,
      reinforcementWords: pool,
      recapWords: pool,
      mistakesWords: pool,
      memoryCheckWords: Math.max(1, Math.min(6, Math.round(pool / 40))),
    };
  }

  const memoryCheckWords = Math.max(1, Math.min(3, Math.round(target / 30)));

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
  const comparable = (value: string) => value.normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
  // Duplicate dictionary entries and synonyms must not become competing
  // answers to the same prompt.
  const pool = words.filter((candidate) =>
    candidate.id !== word.id &&
    comparable(candidate.original) !== comparable(word.original) &&
    comparable(candidate.translation) !== comparable(word.translation),
  );
  const distractors: ExerciseOption[] = [];
  const seen = new Set<string>([comparable(correctLabel)]);

  shuffleArray(pool).forEach((candidate) => {
    const label = mode === 'translation' ? candidate.translation : candidate.original;

    if (seen.has(comparable(label)) || distractors.length >= 3) {
      return;
    }

    seen.add(comparable(label));
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

const KANJI_CHAR = /[\u3400-\u9fff\u3005]/;
const KATAKANA_CHAR = /[\u30a0-\u30ff]/;
const HIRAGANA_CHAR = /[\u3041-\u309f]/;
// Hiragana that may follow a kanji word: particles, the copula and する.
// Matched as whole prefixes, so okurigana (話す, 書き, 早く) is not mistaken
// for a particle the way single letters (す, し, ほ) would be.
const PARTICLE_PREFIXES = [
  'まで', 'から', 'より', 'しか', 'ほど', 'けど', 'じゃ', 'こそ', 'さえ', 'すら', 'ばかり', 'など', 'くらい', 'ぐらい',
  'です', 'でし', 'だ', 'できる', 'でき',
  'が', 'を', 'に', 'は', 'の', 'で', 'と', 'も', 'へ', 'や', 'か', 'な', 'よ', 'ね',
];
// «勉強します» is a noun + する, but after a single kanji the same letters are
// usually okurigana (話します, 出して), so する forms need a compound noun.
const SURU_PREFIXES = ['する', 'すれ', 'しま', 'した', 'して', 'しな', 'しよ', 'させ', 'され'];

/**
 * Japanese has no spaces, so a plain substring search would blank out 日 inside
 * 今日 or 少年 inside 青少年. Only cut occurrences whose edges do not run into
 * the same script (a kanji word must not touch other kanji, a katakana word
 * other katakana). Hiragana-only words cannot be delimited reliably and get a
 * different exercise instead.
 */
function createJapaneseSentenceCloze(example: string, original: string): string | null {
  if (!KANJI_CHAR.test(original) && !KATAKANA_CHAR.test(original)) {
    return null;
  }

  const first = original[0];
  const last = original[original.length - 1];
  const clashes = (neighbour: string | undefined, edge: string) =>
    neighbour !== undefined
    && ((KANJI_CHAR.test(edge) && KANJI_CHAR.test(neighbour)) || (KATAKANA_CHAR.test(edge) && KATAKANA_CHAR.test(neighbour)));
  // After a word ending in kanji, hiragana must start a particle or copula
  // (日が, 日です, 簡単に); otherwise it is okurigana of another word (数える).
  const allowedPrefixes = original.length >= 2 ? [...PARTICLE_PREFIXES, ...SURU_PREFIXES] : PARTICLE_PREFIXES;
  const startsOtherWord = (rest: string) =>
    KANJI_CHAR.test(last) && HIRAGANA_CHAR.test(rest[0] ?? '') && !allowedPrefixes.some((prefix) => rest.startsWith(prefix));

  let result = '';
  let cursor = 0;
  let replaced = false;
  let index = example.indexOf(original);

  while (index !== -1) {
    const before = index > 0 ? example[index - 1] : undefined;
    const after = example[index + original.length];
    if (!clashes(before, first) && !clashes(after, last) && !startsOtherWord(example.slice(index + original.length))) {
      result += `${example.slice(cursor, index)}＿＿`;
      cursor = index + original.length;
      replaced = true;
    }
    index = example.indexOf(original, index + original.length);
  }

  return replaced ? result + example.slice(cursor) : null;
}

export function createSentenceCloze(word: Word): string | null {
  const example = word.example_original.trim();
  const original = word.original.trim();

  if (!example || !original) {
    return null;
  }

  if (word.language === 'japanese') {
    return createJapaneseSentenceCloze(example, original);
  }

  const pattern = new RegExp(`(^|[^\\p{L}])${escapeRegExp(original)}(?=$|[^\\p{L}])`, 'giu');
  return pattern.test(example) ? example.replace(pattern, '$1＿＿') : null;
}

function canCreateExercise(word: Word, type: ExerciseType): boolean {
  // «Type the hiragana reading» was dropped from lessons: it trained spelling
  // of readings rather than the word itself.
  if (type === 'kanji_to_hiragana_input') {
    return false;
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

    // No usable sentence for a gap: ask for the word by choice instead, so
    // lessons do not turn into a row of typing tasks.
    return type === 'sentence_cloze_input' ? 'translation_to_original_choice' : null;
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

function sortByCurriculum(left: Word, right: Word): number {
  const levelDiff = getStudyLevelRank(left) - getStudyLevelRank(right);

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
  perWord?: number,
): Array<{ word: Word; type: ExerciseType }> {
  const orderedWords = storage ? rankWordsForStudy(words, storage) : shuffleArray(words);
  const queues = orderedWords.map((word, wordIndex) => {
    const types = storage
      ? reorderExerciseTypesForWord(word, storage, exerciseTypes)
      : shuffleArray(getAvailableExerciseTypes(word, exerciseTypes));
    if (!perWord || perWord >= types.length) return { word, queue: types };
    // Each word gets a few of the module's task types, starting at a
    // different one for every word, so a module mixes all of its types.
    const offset = wordIndex % types.length;
    const rotated = [...types.slice(offset), ...types.slice(0, offset)];
    return { word, queue: rotated.slice(0, perWord) };
  });
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
  // Voluntary practice remains available immediately after a daily lesson.
  // applyOutcomes separately protects the interval for reviews before due.
  return rankWordsForStudy(words.filter((word) => {
    const status = getWordProgress(storage, word.id).status;
    return status !== 'new' && status !== 'known' && status !== 'ignored';
  }), storage).slice(0, limit);
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

  const memoryExercises = memoryWords.map((word, index) => ({
    ...createExercise(word, optionPool, 'memory_check', moduleResult.exercises.length + index),
    id: `${moduleResult.module.id}-${word.id}-memory_check-${moduleResult.exercises.length + index}`,
  }));
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

  const limits = getLessonLimits(durationMinutes, wordTarget, useFullPool, words.length);
  const mistakeWords = words.slice(0, limits.mistakesWords);
  const reviewModule = createExerciseModule(
    'module-mistakes',
    'Сложные слова',
    'Точечное повторение слов, где были ошибки.',
    mistakeWords,
    ['translation_to_original_input', 'sentence_cloze_input', 'translation_to_original_choice', 'audio_to_translation_choice'],
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
  newWordIds?: string[],
): LessonSession | null {
  const balance = getDailyBalance(words, storage, durationMinutes, wordTarget, useFullPool);
  const baseLimits = getLessonLimits(durationMinutes, wordTarget, useFullPool, words.length);
  const limits = { ...baseLimits, newWords: balance.newWords, activeWords: balance.reviewSlots };
  const newWordIdSet = newWordIds ? new Set(newWordIds) : null;
  const newWords = pickNewWords(newWordIdSet ? words.filter((word) => newWordIdSet.has(word.id)) : words, storage, limits.newWords);
  const learningWords = pickLearningWords(words, storage, limits.activeWords);
  const introductionWords = newWords.length > 0 ? newWords : learningWords.slice(0, Math.max(1, baseLimits.newWords));
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

  // On a review-only day the first module must not show translations of the
  // very words the next modules test: that would hand out the answers and
  // inflate every interval. Ask for an objectively checked answer first (it is
  // the first answer of the day that grades the review), reveal afterwards.
  const recallWarmup =
    newWords.length > 0
      ? null
      : (() => {
          const result = createExerciseModule(
            'module-recall-warmup',
            'Вспомните слова',
            'Выберите значение слова — ответ откроется только после выбора.',
            introductionWords,
            ['original_to_translation_choice'],
            uniqueWords(words),
            storage,
          );
          return { ...result, module: { ...result.module, theme: 'review' as const, position: 1 } };
        })();
  const module1 = recallWarmup?.module ?? createPreviewModule(introductionWords);
  const module2 = createExerciseModule(
    'module-training-new',
    newWords.length > 0 ? 'Тренировка новых слов' : 'Разминка перед повторением',
    newWords.length > 0
      ? 'Быстрое закрепление слов, которые вы только что увидели.'
      : 'Проверка узнавания перед основным запланированным повторением.',
    introductionWords,
    // On review days module 1 already asked for the meaning; ask the other way.
    newWords.length > 0
      ? ['original_to_translation_choice', 'translation_to_original_choice', 'audio_to_translation_choice']
      : ['translation_to_original_choice', 'audio_to_translation_choice', 'translation_to_original_input'],
    uniqueWords(words),
    storage,
  );
  const module3 = createExerciseModule(
    'module-review-learning',
    scheduledReviewWords.length > 0 ? 'Повторение не до конца выученных слов' : 'Повторение слов урока',
    scheduledReviewWords.length > 0
      ? 'Возврат к словам, которые еще требуют внимания.'
      : 'Первое повторение новых слов после знакомства и тренировки.',
    reviewWords,
    ['audio_to_translation_choice', 'translation_to_original_input', 'original_to_translation_choice', 'audio_to_original_input'],
    uniqueWords(words),
    storage,
  );
  const module4 = createExerciseModule(
    'module-reinforcement',
    'Смешанное закрепление',
    'Слова возвращаются в новом порядке, чтобы проверить узнавание без заучивания по шаблону.',
    reinforcementWords,
    ['sentence_cloze_input', 'translation_to_original_choice', 'audio_to_original_input', 'original_to_translation_choice'],
    uniqueWords(words),
    storage,
  );
  const module5 = addMemoryCheckExercises(
    createExerciseModule(
      'module-final-recap',
      'Финальная мини-проверка',
      'Короткий итоговый блок: ключевые слова дня и редкая проверка давно выученного.',
      recapWords,
      ['translation_to_original_input', 'sentence_cloze_input', 'original_to_translation_choice'],
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
  const exercises = [...(recallWarmup?.exercises ?? []), ...module2.exercises, ...module3.exercises, ...module4.exercises, ...module5.exercises];
  const steps = buildSteps(modules, {
    ...(recallWarmup ? { [recallWarmup.module.id]: recallWarmup.exercises } : {}),
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

/** Words in a «5 минут» session: two tasks each, about 15–20 seconds a task. */
export const QUICK_REVIEW_WORDS = 8;
export const QUICK_REVIEW_TITLE = 'Пять минут';

/**
 * A short session for a busy day: the most urgent due reviews (they advance
 * the schedule like any review), or, when nothing is due, the weakest words
 * for practice. No new words.
 */
function createQuickReviewSession(
  words: Word[],
  storage: AppStorage,
  activePackIds: string[],
  title?: string,
): LessonSession | null {
  const due = pickLearningWords(words, storage, QUICK_REVIEW_WORDS);
  const focus = due.length > 0 ? due : pickExtraFocusWords(words, storage, QUICK_REVIEW_WORDS);
  if (focus.length === 0) return null;

  const result = createExerciseModule(
    'module-quick-review',
    due.length > 0 ? 'Срочные повторения' : 'Слабые слова',
    due.length > 0
      ? 'Слова, которые пора повторить сегодня, — самые забываемые первыми.'
      : 'Повторений на сегодня нет — короткая практика самых трудных слов.',
    focus,
    ['original_to_translation_choice', 'translation_to_original_input', 'audio_to_translation_choice'],
    uniqueWords(words),
    storage,
  );
  const modules = renumberModules([result.module]);
  return {
    id: `extra-quick-${Date.now()}`,
    title: title ?? QUICK_REVIEW_TITLE,
    mode: 'extra',
    presentation: 'standard',
    durationMinutes: 10,
    startedAt: new Date().toISOString(),
    exerciseIds: result.exercises.map((exercise) => exercise.id),
    exercises: result.exercises,
    sourceWordIds: focus.map((word) => word.id),
    modules,
    steps: buildSteps(modules, { [result.module.id]: result.exercises }),
    activePackIds,
  };
}

/** Due reviews over all active words — what «5 минут» would pick from. */
export function countDueReviews(words: Word[], storage: AppStorage): number {
  return words.filter((word) => isWordDueForReview(getWordProgress(storage, word.id))).length;
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
  const limits = getLessonLimits(durationMinutes, wordTarget, useFullPool, words.length);
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
    ['original_to_translation_choice', 'translation_to_original_choice', 'audio_to_translation_choice', 'translation_to_original_input'],
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
    ['original_to_translation_choice', 'translation_to_original_choice', 'audio_to_translation_choice', 'translation_to_original_input'],
    uniqueWords(words),
    storage,
  );
  const module4 = addMemoryCheckExercises(
    createExerciseModule(
      mode === 'pack' ? 'module-pack-mixed' : 'module-extra-mixed',
      'Смешанное закрепление',
      'Финальный блок на закрепление активных, новых и давно выученных слов.',
      mixedWords,
      ['sentence_cloze_input', 'audio_to_original_input', 'translation_to_original_choice', 'original_to_translation_choice'],
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
  const eligibleWords = getPracticePool(words, storage);
  const limits = getLessonLimits(durationMinutes, wordTarget, useFullPool, eligibleWords.length);
  const flashcardLimit = useFullPool ? eligibleWords.length : wordTarget ?? Math.max(limits.newWords + 2, 6);
  const focusWords =
    mode === 'pack'
      ? eligibleWords.slice(0, flashcardLimit)
      : uniqueWords([...pickExtraFocusWords(eligibleWords, storage, limits.activeWords), ...pickNewWords(eligibleWords, storage, limits.newWords)]).slice(
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
    stepIds: focusWords.map((word) => `${mode === 'pack' ? 'module-pack-flashcards' : 'module-extra-flashcards'}-${word.id}`),
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
    stepIds: words.map((word) => `module-new-words-${word.id}`),
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
  perWord = 2,
): { module: LessonModule; exercises: Exercise[] } {
  const orderedWords = storage ? weaveWordOrder(rankWordsForStudy(words, storage)) : shuffleArray(words);
  const sequence = buildExerciseSequence(orderedWords, exerciseTypes, storage, perWord);
  const exercises = sequence.map((item, index) => {
    const exercise = createExercise(item.word, optionPool, item.type, index);
    return { ...exercise, id: `${id}-${exercise.id}` };
  });

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
        id: exercise.id,
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
    id: retryExercise.id,
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
      wordIds: Array.from(new Set(moduleSteps.map((step) => step.wordId))),
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

function getPracticePool(words: Word[], storage: AppStorage): Word[] {
  return uniqueWords(words).filter((word) => {
    const status = getWordProgress(storage, word.id).status;
    return status !== 'known' && status !== 'ignored';
  });
}

export function createLessonSession({
  mode,
  words,
  storage,
  durationMinutes,
  wordTarget,
  useFullPool = false,
  wordIds,
  newWordIds,
  activePackIds = [],
  title,
  quick = false,
}: CreateLessonSessionInput): LessonSession | null {
  const eligibleWords = getPracticePool(words, storage);
  if (mode === 'mistakes' && wordIds?.length) {
    const mistakeWords = getPoolFromIds(eligibleWords, wordIds);
    return createMistakesSession(mistakeWords, activePackIds, durationMinutes, wordTarget, useFullPool);
  }

  if (mode === 'default') {
    const session = createDailySession(eligibleWords, storage, activePackIds, durationMinutes, wordTarget, useFullPool, newWordIds);
    return session && title ? { ...session, title } : session;
  }

  if (mode === 'extra' && quick) {
    return createQuickReviewSession(eligibleWords, storage, activePackIds, title);
  }

  if (mode === 'extra' || mode === 'pack') {
    return createExtraSession(mode, eligibleWords, storage, activePackIds, durationMinutes, wordTarget, useFullPool, title);
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
