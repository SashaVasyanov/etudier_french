import type {
  AppStorage,
  DailyLessonCompletionPayload,
  DailyLessonRecord,
  ExerciseOutcome,
  KanaProgress,
  LearningLanguage,
  LessonDurationMinutes,
  LessonWordTarget,
  RadicalExerciseOutcome,
  RadicalProgress,
  RadicalStatus,
  RadicalStudyHistoryEntry,
  SpeechPreferences,
  StorageLoadResult,
  StorageSaveResult,
  StudyHistoryEntry,
  UserPackState,
  UserProfile,
  Word,
  WordProgress,
  WordStatus,
} from '../types';
import { addDays, clamp, deriveFrenchLatinTranscription, getTodayDateKey, MAX_DAY_START_HOUR, normalizeTranscription, setDayStartHour, startOfDay } from './utils';

const STORAGE_KEY = 'anki-plus-storage';
const STORAGE_BACKUP_KEY = `${STORAGE_KEY}-backup`;
const STORAGE_QUARANTINE_KEY = `${STORAGE_KEY}-quarantine`;
const STORAGE_VERSION = 2;
const MAX_PROFILE_NAME_LENGTH = 80;
const MAX_CUSTOM_WORDS = 2_000;
const MAX_CUSTOM_PACKS = 50;
const MAX_WORDS_PER_PACK = 2_000;
const MAX_SUCCESSFUL_REVIEW_DATES = 32;
const VALID_WORD_STATUSES = new Set<WordStatus>(['new', 'learning', 'review', 'known', 'mastered', 'difficult', 'ignored']);

interface StorageEnvelope {
  version: number;
  savedAt: string;
  payload: AppStorage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanText(value: unknown, fallback = '', maxLength = 1_000): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : fallback;
}

function finiteNumber(value: unknown, fallback: number, minimum = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(minimum, value) : fallback;
}

function isValidDateString(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(new Date(value).getTime());
}

function isValidDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function nonNegativeInteger(value: unknown): number {
  return Math.floor(finiteNumber(value, 0));
}

function stringList(value: unknown, maxLength = 1_000): string[] {
  return Array.isArray(value)
    ? value.map((item) => cleanText(item, '', maxLength)).filter(Boolean)
    : [];
}

function createDefaultProfile(): UserProfile {
  const now = new Date().toISOString();

  return {
    displayName: 'Ученик',
    createdAt: now,
    updatedAt: now,
    lastStudiedAt: null,
  };
}

function createDefaultStorage(): AppStorage {
  return {
    learningLanguage: 'french',
    progressByWordId: {},
    dailyStats: [],
    completedDailyLessons: [],
    streakDays: 0,
    lastLessonDate: null,
    lessonDurationEnabled: true,
    lessonDurationMinutes: 20,
    lessonWordTarget: 20,
    lessonSourcePackId: null,
    profile: createDefaultProfile(),
    studyHistory: [],
    packStates: {},
    customWords: [],
    customPacks: [],
    radicalProgressById: {},
    radicalStudyHistory: [],
    lessonTotals: { french: 0, japanese: 0 },
    dayStartHour: 0,
    kanaProgress: {},
    speech: { voices: {}, rate: 0.9 },
  };
}

// History used to be one list of 180 entries for both languages, so a busy
// learner's counters stopped growing. Each language now keeps its own window.
const HISTORY_LIMIT_PER_LANGUAGE = 365;
const DAILY_RECORDS_LIMIT_PER_LANGUAGE = 730;

function capPerLanguage<T extends { language: LearningLanguage }>(items: T[], limit: number): T[] {
  const kept = new Set<T>();
  (['french', 'japanese'] as const).forEach((language) => {
    items.filter((item) => item.language === language).slice(-limit).forEach((item) => kept.add(item));
  });
  return items.filter((item) => kept.has(item));
}

function countLessonsByLanguage(history: StudyHistoryEntry[]): Record<LearningLanguage, number> {
  return {
    french: history.filter((entry) => entry.language === 'french').length,
    japanese: history.filter((entry) => entry.language === 'japanese').length,
  };
}

function withLessonTotal(currentStorage: AppStorage, entry: StudyHistoryEntry): Record<LearningLanguage, number> {
  const isNew = !currentStorage.studyHistory.some((item) => item.id === entry.id);
  const totals = currentStorage.lessonTotals ?? { french: 0, japanese: 0 };
  return isNew ? { ...totals, [entry.language]: totals[entry.language] + 1 } : totals;
}

function normalizeWord(word: Word): Word {
  const language = word.language === 'japanese' ? 'japanese' : 'french';
  const normalizedSource = word.source === 'core' || word.source === 'pack' ? word.source : 'custom';
  const original = cleanText(word.original, '', 240);
  const translation = cleanText(word.translation, '', 400);
  const rawTranscription = cleanText(word.transcription, '', 240);
  const transcription =
    language === 'french'
      ? normalizedSource === 'custom'
        ? normalizeTranscription(rawTranscription) || deriveFrenchLatinTranscription(original, '')
        : deriveFrenchLatinTranscription(original, rawTranscription)
      : rawTranscription.normalize('NFKC') || original;

  return {
    ...word,
    language,
    original,
    translation,
    transcription,
    audio_original: cleanText(word.audio_original, '', 2_048),
    example_original: cleanText(word.example_original, original, 1_000),
    example_reading: language === 'japanese' ? cleanText(word.example_reading, '', 1_000) || undefined : undefined,
    example_translation: cleanText(word.example_translation, translation, 1_000),
    part_of_speech: cleanText(word.part_of_speech, 'word', 80) || 'word',
    tags: Array.isArray(word.tags) ? word.tags.map((tag) => cleanText(tag, '', 80)).filter(Boolean).slice(0, 30) : [],
    packIds: Array.isArray(word.packIds) ? word.packIds.filter((id) => typeof id === 'string').slice(0, 50) : [],
    source: normalizedSource,
    level: word.level === 'A2' || word.level === 'B1' ? word.level : 'A1',
    imagePath: word.imagePath ?? undefined,
    imageUrl: word.imageUrl ?? undefined,
    imageAlt: word.imageAlt ?? undefined,
    imagePackCategory: word.imagePackCategory ?? undefined,
    illustrationType: word.illustrationType ?? undefined,
    imagePrompt: word.imagePrompt ?? undefined,
    imageSource: word.imageSource ?? undefined,
  };
}

function createInitialProgress(wordId: string): WordProgress {
  return {
    word_id: wordId,
    shown_count: 0,
    correct_count: 0,
    wrong_count: 0,
    last_seen_at: null,
    next_review_at: null,
    ease_factor: 2.5,
    interval_days: 0,
    repetition_step: 0,
    status: 'new',
    learned_at: null,
    successful_review_dates: [],
  };
}

function createInitialRadicalProgress(radicalId: string): RadicalProgress {
  return {
    radicalId,
    attempts: 0,
    correctAnswers: 0,
    wrongAnswers: 0,
    status: 'new',
    lastStudiedAt: null,
    masteredAt: null,
  };
}

function normalizeRadicalProgress(progress: Partial<RadicalProgress>, radicalId: string): RadicalProgress {
  const correctAnswers = Math.floor(finiteNumber(progress.correctAnswers, 0));
  const wrongAnswers = Math.floor(finiteNumber(progress.wrongAnswers, 0));
  const attempts = correctAnswers + wrongAnswers;
  const accuracy = correctAnswers / Math.max(1, attempts);
  const status: RadicalStatus = attempts === 0
    ? 'new'
    : attempts >= 6 && accuracy >= 0.8
      ? 'mastered'
      : 'learning';

  return {
    radicalId,
    attempts,
    correctAnswers,
    wrongAnswers,
    status,
    lastStudiedAt: isValidDateString(progress.lastStudiedAt) ? progress.lastStudiedAt : null,
    masteredAt: isValidDateString(progress.masteredAt) ? progress.masteredAt : null,
  };
}

function normalizeProgress(progress: Partial<WordProgress>, wordId: string): WordProgress {
  const base = createInitialProgress(wordId);
  const rawStatus = progress.status as string | undefined;
  // v1 merged `known` into `mastered`. The previous manual action has a
  // deterministic low-attempt/high-step/null-due shape. Other mastered records
  // remain algorithmic mastered because guessing would destroy review history.
  const isLegacyManualKnown =
    rawStatus === 'mastered' &&
    progress.next_review_at == null &&
    finiteNumber(progress.shown_count, 0) <= 1 &&
    finiteNumber(progress.correct_count, 0) <= 1 &&
    finiteNumber(progress.wrong_count, 0) === 0 &&
    finiteNumber(progress.repetition_step, 0) >= 6 &&
    finiteNumber(progress.interval_days, 0) >= 14 &&
    typeof progress.learned_at === 'string';
  const normalizedStatus: WordStatus | undefined = rawStatus === 'known' || isLegacyManualKnown
    ? 'known'
    : progress.status;
  const successfulReviewDates = Array.isArray(progress.successful_review_dates)
    ? Array.from(
        new Set(
          progress.successful_review_dates.filter(isValidDateKey),
        ),
      ).sort().slice(-MAX_SUCCESSFUL_REVIEW_DATES)
    : [];

  return {
    ...base,
    word_id: wordId,
    shown_count: Math.floor(finiteNumber(progress.shown_count, base.shown_count)),
    correct_count: Math.floor(finiteNumber(progress.correct_count, base.correct_count)),
    wrong_count: Math.floor(finiteNumber(progress.wrong_count, base.wrong_count)),
    ease_factor: clamp(finiteNumber(progress.ease_factor, base.ease_factor), MIN_EASE, MAX_EASE),
    interval_days: Math.floor(finiteNumber(progress.interval_days, base.interval_days)),
    repetition_step: Math.floor(finiteNumber(progress.repetition_step, base.repetition_step)),
    last_seen_at: isValidDateString(progress.last_seen_at) ? progress.last_seen_at : null,
    next_review_at: isValidDateString(progress.next_review_at) ? progress.next_review_at : null,
    learned_at: isValidDateString(progress.learned_at) ? progress.learned_at : null,
    status: normalizedStatus && VALID_WORD_STATUSES.has(normalizedStatus) ? normalizedStatus : base.status,
    successful_review_dates: successfulReviewDates,
  };
}

function normalizeCustomPack(value: unknown): import('../types').WordPack | null {
  if (!isRecord(value)) {
    return null;
  }

  const pack = value as Partial<import('../types').WordPack>;

  if (typeof pack.id !== 'string' || !pack.id.trim() || typeof pack.title !== 'string' || !Array.isArray(pack.words)) {
    return null;
  }

  return {
    id: pack.id,
    language: pack.language === 'japanese' ? 'japanese' : 'french',
    title: cleanText(pack.title, 'Импортированный пак', 80),
    description: cleanText(pack.description, 'Импортированный пользовательский пак.', 500),
    accent: cleanText(pack.accent, '#1a8ce2', 80),
    coverImageUrl: pack.coverImageUrl,
    coverImageAlt: pack.coverImageAlt,
    words: pack.words
      .filter((word): word is Word => isRecord(word) && typeof word.id === 'string' && typeof word.original === 'string' && typeof word.translation === 'string')
      .map((word) => normalizeWord({ ...word, language: pack.language === 'japanese' ? 'japanese' : 'french', source: 'pack', packIds: [pack.id!] })),
  };
}

function normalizeProfile(profile?: Partial<UserProfile>): UserProfile {
  const fallback = createDefaultProfile();

  return {
    ...fallback,
    displayName: cleanText(profile?.displayName, fallback.displayName, MAX_PROFILE_NAME_LENGTH) || fallback.displayName,
    createdAt: isValidDateString(profile?.createdAt) ? profile.createdAt : fallback.createdAt,
    updatedAt: isValidDateString(profile?.updatedAt) ? profile.updatedAt : fallback.updatedAt,
    lastStudiedAt: isValidDateString(profile?.lastStudiedAt) ? profile.lastStudiedAt : null,
  };
}

function normalizeHistoryEntry(value: unknown): StudyHistoryEntry | null {
  if (!isRecord(value)) {
    return null;
  }

  const entry = value as Partial<StudyHistoryEntry>;

  if (
    typeof entry.id !== 'string' || !entry.id || typeof entry.sessionId !== 'string' || !entry.sessionId ||
    !isValidDateKey(entry.date) || !isValidDateString(entry.completedAt) ||
    !['default', 'extra', 'mistakes', 'pack'].includes(entry.mode ?? '')
  ) {
    return null;
  }

  return {
    id: entry.id,
    date: entry.date,
    language: entry.language === 'japanese' ? 'japanese' : 'french',
    completedAt: entry.completedAt,
    sessionId: entry.sessionId,
    mode: entry.mode!,
    durationMinutes: entry.durationMinutes === 10 || entry.durationMinutes === 30 ? entry.durationMinutes : 20,
    moduleTitles: stringList(entry.moduleTitles),
    modulesCompleted: nonNegativeInteger(entry.modulesCompleted),
    wordsLearned: nonNegativeInteger(entry.wordsLearned),
    mistakesMade: Math.min(nonNegativeInteger(entry.mistakesMade), nonNegativeInteger(entry.totalAnswers)),
    correctAnswers: Math.min(nonNegativeInteger(entry.correctAnswers), nonNegativeInteger(entry.totalAnswers)),
    totalAnswers: nonNegativeInteger(entry.totalAnswers),
    timeSpentSeconds: nonNegativeInteger(entry.timeSpentSeconds),
    activePackIds: stringList(entry.activePackIds),
  };
}

function normalizeDailyLessonRecord(value: unknown): DailyLessonRecord | null {
  if (!isRecord(value) || !isValidDateKey(value.date) || !isValidDateString(value.completedAt) || typeof value.sessionId !== 'string') {
    return null;
  }

  const totalModules = nonNegativeInteger(value.totalModules);
  const totalSteps = nonNegativeInteger(value.totalSteps);
  const totalAnswers = nonNegativeInteger(value.totalAnswers);
  return {
    date: value.date,
    language: value.language === 'japanese' ? 'japanese' : 'french',
    completedAt: value.completedAt,
    sessionId: value.sessionId,
    totalModules,
    completedModules: Math.min(totalModules, nonNegativeInteger(value.completedModules)),
    totalSteps,
    completedSteps: Math.min(totalSteps, nonNegativeInteger(value.completedSteps)),
    correctAnswers: Math.min(totalAnswers, nonNegativeInteger(value.correctAnswers)),
    totalAnswers,
    newWords: nonNegativeInteger(value.newWords),
    reviewWords: nonNegativeInteger(value.reviewWords),
    reinforcementWords: nonNegativeInteger(value.reinforcementWords),
    knownWords: nonNegativeInteger(value.knownWords),
    difficultWordIds: stringList(value.difficultWordIds),
    timeSpentSeconds: nonNegativeInteger(value.timeSpentSeconds),
  };
}

function normalizeRadicalHistoryEntry(value: unknown): RadicalStudyHistoryEntry | null {
  if (!isRecord(value)) {
    return null;
  }

  const entry = value as Partial<RadicalStudyHistoryEntry>;

  if (typeof entry.id !== 'string' || !entry.id || !isValidDateKey(entry.date) || !isValidDateString(entry.completedAt) || !Array.isArray(entry.radicalIds)) {
    return null;
  }

  return {
    id: entry.id,
    date: entry.date,
    completedAt: entry.completedAt,
    radicalIds: entry.radicalIds.filter((id): id is string => typeof id === 'string').slice(0, 50),
    correctAnswers: Math.min(nonNegativeInteger(entry.correctAnswers), nonNegativeInteger(entry.totalAnswers)),
    totalAnswers: Math.floor(finiteNumber(entry.totalAnswers, 0)),
  };
}

function normalizePackState(packState: Partial<UserPackState> | undefined, packId: string): UserPackState {
  return {
    packId,
    status: packState?.status === 'added' || packState?.status === 'in_progress' || packState?.status === 'completed' ? packState.status : 'not_added',
    addedAt: isValidDateString(packState?.addedAt) ? packState.addedAt : null,
    completedAt: isValidDateString(packState?.completedAt) ? packState.completedAt : null,
  };
}

function normalizeStorage(parsedValue: Record<string, unknown>): AppStorage {
  const parsed = parsedValue as Partial<AppStorage>;
  const defaults = createDefaultStorage();
  const progressEntries: Array<[string, unknown]> = isRecord(parsed.progressByWordId)
    ? Object.entries(parsed.progressByWordId)
    : [];
  const dailyStats: unknown[] = Array.isArray(parsed.dailyStats) ? parsed.dailyStats : [];
  const completedDailyLessons: unknown[] = Array.isArray(parsed.completedDailyLessons) ? parsed.completedDailyLessons : [];
  const studyHistory: unknown[] = Array.isArray(parsed.studyHistory) ? parsed.studyHistory : [];
  const packStateEntries = isRecord(parsed.packStates) ? Object.entries(parsed.packStates) : [];
  const customWords: unknown[] = Array.isArray(parsed.customWords) ? parsed.customWords : [];
  const customPacks: unknown[] = Array.isArray(parsed.customPacks) ? parsed.customPacks : [];
  const radicalProgressEntries: Array<[string, unknown]> = isRecord(parsed.radicalProgressById)
    ? Object.entries(parsed.radicalProgressById)
    : [];
  const radicalStudyHistory: unknown[] = Array.isArray(parsed.radicalStudyHistory) ? parsed.radicalStudyHistory : [];
  const normalizedHistory = capPerLanguage(
    studyHistory
      .map((entry) => normalizeHistoryEntry(entry))
      .filter((entry): entry is StudyHistoryEntry => entry !== null)
      .sort((left, right) => left.completedAt.localeCompare(right.completedAt)),
    HISTORY_LIMIT_PER_LANGUAGE,
  );
  const historyTotals = countLessonsByLanguage(normalizedHistory);
  const storedTotals: Partial<Record<LearningLanguage, unknown>> = isRecord(parsed.lessonTotals) ? parsed.lessonTotals : {};

  return {
    ...defaults,
    learningLanguage: parsed.learningLanguage === 'japanese' ? 'japanese' : 'french',
    streakDays: nonNegativeInteger(parsed.streakDays),
    lastLessonDate: isValidDateKey(parsed.lastLessonDate) ? parsed.lastLessonDate : null,
    progressByWordId: Object.fromEntries(
      progressEntries
        .filter((entry): entry is [string, Partial<WordProgress>] => isRecord(entry[1]))
        .map(([wordId, progress]) => [wordId, normalizeProgress(progress, wordId)]),
    ),
    dailyStats: capPerLanguage(dailyStats
      .filter((item): item is Record<string, unknown> => isRecord(item) && isValidDateKey(item.date))
      .map((item) => ({
        date: item.date as string,
        language: (item.language === 'japanese' ? 'japanese' : 'french') as LearningLanguage,
        completedLessons: Math.floor(finiteNumber(item.completedLessons, 0)),
        correctAnswers: Math.min(nonNegativeInteger(item.correctAnswers), nonNegativeInteger(item.totalAnswers)),
        totalAnswers: Math.floor(finiteNumber(item.totalAnswers, 0)),
        wordsLearned: Math.floor(finiteNumber(item.wordsLearned, 0)),
        reviewsCompleted: Math.floor(finiteNumber(item.reviewsCompleted, 0)),
      }))
      .sort((left, right) => left.date.localeCompare(right.date)), DAILY_RECORDS_LIMIT_PER_LANGUAGE),
    completedDailyLessons: capPerLanguage(
      completedDailyLessons
        .map(normalizeDailyLessonRecord)
        .filter((item): item is DailyLessonRecord => item !== null)
        .sort((left, right) => left.date.localeCompare(right.date)),
      DAILY_RECORDS_LIMIT_PER_LANGUAGE,
    ),
    lessonDurationMinutes:
      parsed.lessonDurationMinutes === 10 || parsed.lessonDurationMinutes === 30 ? parsed.lessonDurationMinutes : 20,
    lessonDurationEnabled: typeof parsed.lessonDurationEnabled === 'boolean' ? parsed.lessonDurationEnabled : true,
    lessonWordTarget:
      parsed.lessonWordTarget === 10 ||
      parsed.lessonWordTarget === 15 ||
      parsed.lessonWordTarget === 25 ||
      parsed.lessonWordTarget === 30 ||
      parsed.lessonWordTarget === 35 ||
      parsed.lessonWordTarget === 40 ||
      parsed.lessonWordTarget === 45 ||
      parsed.lessonWordTarget === 50
        ? parsed.lessonWordTarget
        : 20,
    lessonSourcePackId: typeof parsed.lessonSourcePackId === 'string' ? parsed.lessonSourcePackId : null,
    profile: normalizeProfile(isRecord(parsed.profile) ? parsed.profile as Partial<UserProfile> : undefined),
    studyHistory: normalizedHistory,
    lessonTotals: {
      french: Math.max(nonNegativeInteger(storedTotals.french), historyTotals.french),
      japanese: Math.max(nonNegativeInteger(storedTotals.japanese), historyTotals.japanese),
    },
    speech: normalizeSpeech(parsed.speech),
    kanaProgress: Object.fromEntries(
      (isRecord(parsed.kanaProgress) ? Object.entries(parsed.kanaProgress as Record<string, unknown>) : [])
        .filter((entry): entry is [string, Record<string, unknown>] => entry[0].length <= 2 && isRecord(entry[1]))
        .map(([kana, item]) => [kana, {
          correct: nonNegativeInteger(item.correct),
          wrong: nonNegativeInteger(item.wrong),
          streak: nonNegativeInteger(item.streak),
          lastSeenAt: isValidDateString(item.lastSeenAt) ? item.lastSeenAt : null,
        }]),
    ),
    dayStartHour:
      Number.isInteger(parsed.dayStartHour) && (parsed.dayStartHour as number) >= 0 && (parsed.dayStartHour as number) <= MAX_DAY_START_HOUR
        ? (parsed.dayStartHour as number)
        : 0,
    packStates: Object.fromEntries(
      packStateEntries.map(([packId, packState]) => [
        packId,
        normalizePackState(isRecord(packState) ? packState as Partial<UserPackState> : undefined, packId),
      ]),
    ),
    customWords: customWords
      .filter((word): word is Word =>
        isRecord(word) && typeof word.id === 'string' && typeof word.original === 'string' && typeof word.translation === 'string',
      )
      .map((word) => normalizeWord(word)),
    customPacks: customPacks
      .filter(isRecord)
      .map((pack) => normalizeCustomPack(pack))
      .filter((pack): pack is import('../types').WordPack => pack !== null),
    radicalProgressById: Object.fromEntries(
      radicalProgressEntries
        .filter((entry): entry is [string, Partial<RadicalProgress>] => isRecord(entry[1]))
        .map(([radicalId, progress]) => [radicalId, normalizeRadicalProgress(progress, radicalId)]),
    ),
    radicalStudyHistory: radicalStudyHistory
      .map((entry) => normalizeRadicalHistoryEntry(entry))
      .filter((entry): entry is RadicalStudyHistoryEntry => entry !== null)
      .sort((left, right) => left.completedAt.localeCompare(right.completedAt))
      .slice(-120),
  };
}

function parseStoredStorage(raw: string): AppStorage {
  const parsedValue: unknown = JSON.parse(raw);

  if (!isRecord(parsedValue)) {
    throw new Error('Хранилище не является объектом.');
  }

  if ('version' in parsedValue) {
    if (parsedValue.version !== STORAGE_VERSION) {
      throw new RangeError(`Неподдерживаемая версия хранилища: ${String(parsedValue.version)}.`);
    }

    if (!isRecord(parsedValue.payload)) {
      throw new Error('В хранилище отсутствуют данные приложения.');
    }

    return normalizeStorage(parsedValue.payload);
  }

  // Legacy v1 stored AppStorage directly, without an envelope.
  return normalizeStorage(parsedValue);
}

function quarantineCorruptStorage(raw: string): boolean {
  try {
    window.localStorage.setItem(
      STORAGE_QUARANTINE_KEY,
      JSON.stringify({ capturedAt: new Date().toISOString(), raw }),
    );
    return true;
  } catch {
    return false;
  }
}

export function loadStorage(): StorageLoadResult {
  let raw: string | null;

  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return {
      storage: createDefaultStorage(),
      error: {
        kind: 'read',
        message: 'Локальное хранилище недоступно. Изменения пока не будут сохранены.',
        blocksSave: true,
      },
    };
  }

  if (!raw) {
    return { storage: createDefaultStorage(), error: null };
  }

  try {
    const storage = parseStoredStorage(raw);
    setDayStartHour(storage.dayStartHour);
    return { storage, error: null };
  } catch (primaryError) {
    const unsupportedVersion = primaryError instanceof RangeError;
    const quarantined = unsupportedVersion ? false : quarantineCorruptStorage(raw);
    let backupRaw: string | null = null;

    try {
      backupRaw = window.localStorage.getItem(STORAGE_BACKUP_KEY);
      if (backupRaw) {
        const recovered = parseStoredStorage(backupRaw);
        setDayStartHour(recovered.dayStartHour);
        return {
          storage: recovered,
          error: {
            kind: unsupportedVersion ? 'unsupported_version' : 'corrupt',
            message: unsupportedVersion
              ? 'Версия локальных данных новее приложения. Загружена резервная копия.'
              : 'Повреждённые локальные данные изолированы. Загружена резервная копия.',
            blocksSave: unsupportedVersion,
          },
        };
      }
    } catch {
      // An invalid backup must never replace the primary failure details.
    }

    return {
      storage: createDefaultStorage(),
      error: {
        kind: unsupportedVersion ? 'unsupported_version' : 'corrupt',
        message: unsupportedVersion
          ? 'Версия локальных данных новее приложения. Автосохранение приостановлено.'
          : quarantined
            ? 'Локальные данные повреждены и сохранены в карантине. Автосохранение приостановлено.'
            : 'Локальные данные повреждены, а создать карантин не удалось. Автосохранение приостановлено.',
        blocksSave: true,
      },
    };
  }
}

/**
 * localStorage holds about 5 MB per app. The daily backup is optional (it is
 * dropped when space runs out), so the main copy may use most of the quota;
 * leave room for the lesson draft and refuse imports past this estimate.
 */
export const STORAGE_SOFT_LIMIT_BYTES = 3_500_000;

/** Rough UTF-16 size of the saved data, as localStorage counts it. */
export function estimateStorageBytes(storage: AppStorage): number {
  return JSON.stringify(storage).length * 2;
}

function readEnvelopeDay(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return isRecord(value) && typeof value.savedAt === 'string' ? getTodayDateKey(new Date(value.savedAt)) : null;
  } catch {
    return null;
  }
}

export function saveStorage(storage: AppStorage): StorageSaveResult {
  const now = new Date();
  const envelope: StorageEnvelope = {
    version: STORAGE_VERSION,
    savedAt: now.toISOString(),
    payload: storage,
  };
  const serialized = JSON.stringify(envelope);

  try {
    const currentRaw = window.localStorage.getItem(STORAGE_KEY);
    if (currentRaw) {
      let currentIsValid = true;
      try {
        parseStoredStorage(currentRaw);
      } catch {
        currentIsValid = false;
        const quarantineRaw = window.localStorage.getItem(STORAGE_QUARANTINE_KEY);
        const quarantineValue: unknown = quarantineRaw ? JSON.parse(quarantineRaw) : null;
        if (!isRecord(quarantineValue) || quarantineValue.raw !== currentRaw) {
          throw new Error('Primary storage was not safely quarantined.');
        }
      }

      // The backup is a once-a-day snapshot (the state before today's first
      // save), not a copy that trails the main data by one keystroke. A full
      // quota must never block saving the main data.
      // The main copy was last written on an earlier day → this is today's first
      // save, so the main copy is exactly «yesterday's state».
      const firstSaveToday = readEnvelopeDay(currentRaw) !== getTodayDateKey(now);
      if (currentIsValid && (firstSaveToday || !window.localStorage.getItem(STORAGE_BACKUP_KEY))) {
        try {
          window.localStorage.setItem(STORAGE_BACKUP_KEY, currentRaw);
        } catch {
          window.localStorage.removeItem(STORAGE_BACKUP_KEY);
        }
      }
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, serialized);
    } catch {
      // Make room by dropping the backup, then retry once. The quarantine copy
      // may be the only trace of damaged data, so it is never dropped here.
      window.localStorage.removeItem(STORAGE_BACKUP_KEY);
      window.localStorage.setItem(STORAGE_KEY, serialized);
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: {
        kind: 'write',
        message: 'Не удалось сохранить прогресс: хранилище недоступно или переполнено.',
        blocksSave: false,
      },
    };
  }
}

/** A portable copy of all progress (for the «Резервная копия» panel). */
export function exportStorageSnapshot(storage: AppStorage): string {
  return JSON.stringify({ version: STORAGE_VERSION, savedAt: new Date().toISOString(), payload: storage });
}

/** Parses a copy made by exportStorageSnapshot; throws a readable error otherwise. */
export function importStorageSnapshot(raw: string): AppStorage {
  const invalid = 'Это не резервная копия étudier или она повреждена.';
  let value: unknown;
  try {
    value = JSON.parse(raw.trim());
  } catch {
    throw new Error(invalid);
  }
  // Any JSON object would normalize into an empty profile and silently wipe
  // progress, so only a real exported envelope is accepted.
  if (
    !isRecord(value)
    || typeof value.version !== 'number'
    || typeof value.savedAt !== 'string'
    || !isRecord(value.payload)
    || !isRecord(value.payload.progressByWordId)
    || !isRecord(value.payload.profile)
  ) {
    throw new Error(invalid);
  }
  try {
    return parseStoredStorage(raw.trim());
  } catch (error) {
    throw new Error(error instanceof RangeError ? error.message : invalid);
  }
}

const SCHEDULED_WORD_STATUSES = new Set<WordStatus>(['learning', 'difficult', 'review', 'mastered']);
const MASTERY_REVIEW_DAYS = 3;
const SUCCESSFUL_SESSION_RATIO = 0.75;
const DIFFICULT_SESSION_MISTAKES = 2;
const NEW_WORD_DIFFICULT_MISTAKES = 3;
const MIN_EASE = 1.3;
const MAX_EASE = 3.4;
const MAX_INTERVAL_DAYS = 180;

// Exercises where the learner produces the answer rather than recognizing it.
const RECALL_EXERCISES = new Set<ExerciseOutcome['type']>([
  'translation_to_original_input',
  'audio_to_original_input',
  'kanji_to_hiragana_input',
  'sentence_cloze_input',
  'memory_check',
]);

/**
 * SM-2 quality (0–5) of one word in one session. The first answer of the day
 * is the real recall signal; later slips lower the grade but do not fail it.
 * 5 — all correct with at least one recall exercise; 4 — all correct with
 * only recognition, or one slip; 3 — first answer correct, several slips
 * (still ≥ 75 % right);
 * 2 — failed after a correct start or one wrong first answer; 1 — mostly wrong.
 */
export function gradeSession(outcomes: ExerciseOutcome[]): number {
  if (outcomes.length === 0) return 3;
  const correctAnswers = outcomes.filter((outcome) => outcome.isCorrect).length;
  const wrongAnswers = outcomes.length - correctAnswers;
  if (!outcomes[0].isCorrect) return wrongAnswers >= DIFFICULT_SESSION_MISTAKES && correctAnswers < wrongAnswers ? 1 : 2;
  if (correctAnswers / outcomes.length < SUCCESSFUL_SESSION_RATIO) return 2;
  // A single slip after a correct first answer is usually a typo.
  if (wrongAnswers >= 2) return 3;
  if (wrongAnswers === 1) return 4;
  return outcomes.some((outcome) => RECALL_EXERCISES.has(outcome.type)) ? 5 : 4;
}

/** The SM-2 ease update: EF' = EF + 0.1 − (5 − q)(0.08 + (5 − q)·0.02). */
export function nextEaseFactor(easeFactor: number, quality: number): number {
  const miss = 5 - quality;
  return clamp(easeFactor + 0.1 - miss * (0.08 + miss * 0.02), MIN_EASE, MAX_EASE);
}

export function isWordDueForReview(progress: WordProgress, now = new Date()): boolean {
  if (!SCHEDULED_WORD_STATUSES.has(progress.status)) {
    return false;
  }

  if (!progress.next_review_at) {
    return true;
  }

  const dueAt = new Date(progress.next_review_at).getTime();
  return !Number.isFinite(dueAt) || dueAt <= now.getTime();
}

/** A stable ±10 % spread so words learned together do not all fall on one day. */
function spreadInterval(seed: string, intervalDays: number): number {
  if (intervalDays < 7) return intervalDays;
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) % 1_000_003;
  const factor = 0.9 + (hash % 21) / 100;
  return Math.round(intervalDays * factor);
}

/**
 * Early steps follow a fixed ladder (2 → 4 → 10 days) so a new word is seen
 * three times in its first two weeks; after that the SM-2 rule applies:
 * previous interval × ease, plus half of the days the review was overdue
 * (the word was remembered for that long anyway). The due date is then
 * spread by ±10 % (see below).
 */
function nextSuccessfulInterval(progress: WordProgress, successfulReviewDays: number, easeFactor: number, now: Date): number {
  if (successfulReviewDays <= 1) return 2;
  if (successfulReviewDays === 2) return 4;
  if (successfulReviewDays === 3) return 10;

  const previous = Math.max(10, progress.interval_days);
  const overdueDays = progress.next_review_at
    ? Math.max(0, Math.floor((now.getTime() - new Date(progress.next_review_at).getTime()) / (24 * 60 * 60 * 1000)))
    : 0;
  const interval = Math.round((previous + Math.min(overdueDays, previous) / 2) * easeFactor);
  return clamp(interval, 10, MAX_INTERVAL_DAYS);
}

function buildAggregatedProgress(
  existing: WordProgress,
  outcomes: ExerciseOutcome[],
  now: Date,
): { progress: WordProgress; completedDueReview: boolean; becameMastered: boolean } {
  if (outcomes.length === 0 || existing.status === 'ignored' || existing.status === 'known') {
    return { progress: existing, completedDueReview: false, becameMastered: false };
  }

  const correctAnswers = outcomes.filter((outcome) => outcome.isCorrect).length;
  const wrongAnswers = outcomes.length - correctAnswers;
  // A daily lesson shows the same word 4–6 times. The first answer of the day is
  // the real recall signal; a later slip (typo) must not fail the whole review,
  // but repeated mistakes still do.
  const quality = gradeSession(outcomes);
  const isSuccessfulSession = quality >= 3;
  const easeFactor = nextEaseFactor(existing.ease_factor, quality);
  const wasDue = isWordDueForReview(existing, now);
  const base: WordProgress = {
    ...existing,
    shown_count: existing.shown_count + outcomes.length,
    correct_count: existing.correct_count + correctAnswers,
    wrong_count: existing.wrong_count + wrongAnswers,
    last_seen_at: now.toISOString(),
  };

  if (existing.status === 'new') {
    return {
      progress: {
        ...base,
        status: wrongAnswers >= NEW_WORD_DIFFICULT_MISTAKES ? 'difficult' : 'learning',
        // Mistakes on a word seen for the first time are not forgetting.
        ease_factor: existing.ease_factor,
        repetition_step: 1,
        interval_days: 1,
        next_review_at: addDays(startOfDay(now), 1).toISOString(),
      },
      completedDueReview: false,
      becameMastered: false,
    };
  }

  // Extra practice before the due date records answers, but never advances or
  // resets the scheduler.
  if (!wasDue) {
    return { progress: base, completedDueReview: false, becameMastered: false };
  }

  if (!isSuccessfulSession) {
    // A lapse restarts the ladder: earlier successful days no longer count
    // towards mastery, and the word comes back on short intervals (1 → 2 → 4).
    const forgotKnownWord = existing.status === 'mastered' || existing.status === 'difficult';
    return {
      progress: {
        ...base,
        status: forgotKnownWord || wrongAnswers >= DIFFICULT_SESSION_MISTAKES ? 'difficult' : 'learning',
        ease_factor: easeFactor,
        repetition_step: 1,
        interval_days: 1,
        next_review_at: addDays(startOfDay(now), 1).toISOString(),
        successful_review_dates: [],
      },
      completedDueReview: true,
      becameMastered: false,
    };
  }

  const reviewDate = getTodayDateKey(now);
  const successfulReviewDates = existing.successful_review_dates.includes(reviewDate)
    ? existing.successful_review_dates
    : [...existing.successful_review_dates, reviewDate].sort().slice(-MAX_SUCCESSFUL_REVIEW_DATES);
  const intervalDays = nextSuccessfulInterval(existing, successfulReviewDates.length, easeFactor, now);
  const status: WordStatus =
    existing.status === 'mastered' || successfulReviewDates.length >= MASTERY_REVIEW_DAYS
      ? 'mastered'
      : 'review';
  const becameMastered = existing.status !== 'mastered' && status === 'mastered';

  return {
    progress: {
      ...base,
      status,
      ease_factor: easeFactor,
      repetition_step: existing.repetition_step + 1,
      interval_days: intervalDays,
      // The stored interval stays exact; only the due date is spread, with a
      // seed that changes every review so no word drifts one way.
      next_review_at: addDays(
        startOfDay(now),
        Math.min(MAX_INTERVAL_DAYS, spreadInterval(`${existing.word_id}:${existing.repetition_step}`, intervalDays)),
      ).toISOString(),
      learned_at: becameMastered ? now.toISOString() : existing.learned_at,
      successful_review_dates: successfulReviewDates,
    },
    completedDueReview: true,
    becameMastered,
  };
}

function getUpdatedStreak(storage: AppStorage, now: Date): Pick<AppStorage, 'lastLessonDate' | 'streakDays'> {
  const today = getTodayDateKey(now);
  if (storage.lastLessonDate === today) return { lastLessonDate: today, streakDays: storage.streakDays };
  // Answers settled after the fact (a previous day's draft) must not move the
  // streak backwards past a later study day.
  if (storage.lastLessonDate && storage.lastLessonDate > today) {
    return { lastLessonDate: storage.lastLessonDate, streakDays: storage.streakDays };
  }
  if (!storage.lastLessonDate) return { lastLessonDate: today, streakDays: 1 };

  const previousDate = new Date(`${storage.lastLessonDate}T00:00:00`);
  const currentDate = new Date(`${today}T00:00:00`);
  const differenceInDays = Math.round((currentDate.getTime() - previousDate.getTime()) / (24 * 60 * 60 * 1000));
  return { lastLessonDate: today, streakDays: differenceInDays === 1 ? storage.streakDays + 1 : 1 };
}

export function getCurrentStreakDays(storage: AppStorage, now = new Date()): number {
  if (!storage.lastLessonDate) return 0;
  const today = getTodayDateKey(now);
  if (storage.lastLessonDate === today) return storage.streakDays;
  const yesterday = getTodayDateKey(addDays(startOfDay(now), -1));
  // «>=» also keeps the streak when the start of the day was moved later and
  // the last lesson now counts as «tomorrow».
  return storage.lastLessonDate >= yesterday ? storage.streakDays : 0;
}

export function applyOutcomes(currentStorage: AppStorage, outcomes: ExerciseOutcome[], now = new Date()): AppStorage {
  if (outcomes.length === 0) {
    return currentStorage;
  }

  const grouped = new Map<string, ExerciseOutcome[]>();
  outcomes.forEach((outcome) => grouped.set(outcome.wordId, [...(grouped.get(outcome.wordId) ?? []), outcome]));

  const progressByWordId = { ...currentStorage.progressByWordId };
  let wordsLearned = 0;
  let reviewsCompleted = 0;
  grouped.forEach((wordOutcomes, wordId) => {
    const existing = currentStorage.progressByWordId[wordId] ?? createInitialProgress(wordId);
    const update = buildAggregatedProgress(existing, wordOutcomes, now);
    progressByWordId[wordId] = update.progress;
    wordsLearned += update.becameMastered ? 1 : 0;
    reviewsCompleted += update.completedDueReview ? 1 : 0;
  });

  const today = getTodayDateKey(now);
  const language = currentStorage.learningLanguage;
  const existingStat = currentStorage.dailyStats.find((item) => item.date === today && item.language === language);
  const correctAnswers = outcomes.filter((outcome) => outcome.isCorrect).length;
  const nextStat = existingStat
    ? {
        ...existingStat,
        completedLessons: existingStat.completedLessons + 1,
        correctAnswers: existingStat.correctAnswers + correctAnswers,
        totalAnswers: existingStat.totalAnswers + outcomes.length,
        wordsLearned: existingStat.wordsLearned + wordsLearned,
        reviewsCompleted: existingStat.reviewsCompleted + reviewsCompleted,
      }
    : { date: today, language, completedLessons: 1, correctAnswers, totalAnswers: outcomes.length, wordsLearned, reviewsCompleted };

  return {
    ...currentStorage,
    ...getUpdatedStreak(currentStorage, now),
    progressByWordId,
    dailyStats: capPerLanguage([
      ...currentStorage.dailyStats.filter((item) => !(item.date === today && item.language === language)),
      nextStat,
    ].sort((left, right) => left.date.localeCompare(right.date)), DAILY_RECORDS_LIMIT_PER_LANGUAGE),
    profile: { ...currentStorage.profile, lastStudiedAt: now.toISOString(), updatedAt: now.toISOString() },
  };
}

export function markWordAsKnown(currentStorage: AppStorage, wordId: string): AppStorage {
  const now = new Date().toISOString();
  const existing = currentStorage.progressByWordId[wordId] ?? createInitialProgress(wordId);

  return {
    ...currentStorage,
    progressByWordId: {
      ...currentStorage.progressByWordId,
      [wordId]: {
        ...existing,
        status: 'known',
        shown_count: Math.max(existing.shown_count, 1),
        correct_count: Math.max(existing.correct_count, 1),
        repetition_step: existing.repetition_step,
        interval_days: 0,
        last_seen_at: now,
        next_review_at: null,
        learned_at: now,
        successful_review_dates: existing.successful_review_dates,
      },
    },
  };
}

export function markWordAsIgnored(currentStorage: AppStorage, wordId: string): AppStorage {
  const now = new Date().toISOString();
  const existing = currentStorage.progressByWordId[wordId] ?? createInitialProgress(wordId);

  return {
    ...currentStorage,
    progressByWordId: {
      ...currentStorage.progressByWordId,
      [wordId]: {
        ...existing,
        status: 'ignored',
        last_seen_at: now,
        next_review_at: null,
      },
    },
  };
}

/** Undo of «Уже знаю» / «Не хочу учить»: put back the exact previous progress. */
export function restoreWordProgress(currentStorage: AppStorage, wordId: string, previous: WordProgress | undefined): AppStorage {
  const progressByWordId = { ...currentStorage.progressByWordId };
  if (previous) progressByWordId[wordId] = previous;
  else delete progressByWordId[wordId];
  return { ...currentStorage, progressByWordId };
}

/** Bring a known or excluded word back into study from the dictionary. */
export function restoreWordToLearning(currentStorage: AppStorage, wordId: string, now = new Date()): AppStorage {
  const existing = currentStorage.progressByWordId[wordId];
  if (!existing || (existing.status !== 'known' && existing.status !== 'ignored')) return currentStorage;
  // «Уже знаю» bumps shown_count, so look at real study traces instead.
  const wasStudied = existing.repetition_step > 0 || existing.wrong_count > 0;

  return {
    ...currentStorage,
    progressByWordId: {
      ...currentStorage.progressByWordId,
      [wordId]: {
        ...existing,
        status: wasStudied ? 'learning' : 'new',
        next_review_at: wasStudied ? now.toISOString() : null,
        interval_days: wasStudied ? 1 : 0,
        repetition_step: wasStudied ? 1 : 0,
        successful_review_dates: [],
        learned_at: null,
      },
    },
  };
}

export function getCompletedDailyLesson(storage: AppStorage, date = getTodayDateKey()): DailyLessonRecord | null {
  return storage.completedDailyLessons.find(
    (item) => item.date === date && item.language === storage.learningLanguage,
  ) ?? null;
}

export function completeDailyLesson(
  currentStorage: AppStorage,
  payload: DailyLessonCompletionPayload,
): AppStorage {
  const completedDailyLessons = capPerLanguage(
    currentStorage.completedDailyLessons
      .filter((item) => !(item.date === payload.record.date && item.language === payload.record.language))
      .concat(payload.record)
      .sort((left, right) => left.date.localeCompare(right.date)),
    DAILY_RECORDS_LIMIT_PER_LANGUAGE,
  );
  const studyHistory = capPerLanguage(
    currentStorage.studyHistory
      .filter((item) => item.id !== payload.historyEntry.id)
      .concat(payload.historyEntry)
      .sort((left, right) => left.completedAt.localeCompare(right.completedAt)),
    HISTORY_LIMIT_PER_LANGUAGE,
  );

  return {
    ...currentStorage,
    completedDailyLessons,
    studyHistory,
    lessonTotals: withLessonTotal(currentStorage, payload.historyEntry),
    profile: {
      ...currentStorage.profile,
      lastStudiedAt: payload.historyEntry.completedAt,
      updatedAt: payload.historyEntry.completedAt,
    },
  };
}

export function recordStudyHistory(currentStorage: AppStorage, historyEntry: StudyHistoryEntry): AppStorage {
  const studyHistory = capPerLanguage(
    currentStorage.studyHistory
      .filter((item) => item.id !== historyEntry.id)
      .concat(historyEntry)
      .sort((left, right) => left.completedAt.localeCompare(right.completedAt)),
    HISTORY_LIMIT_PER_LANGUAGE,
  );

  return {
    ...currentStorage,
    studyHistory,
    lessonTotals: withLessonTotal(currentStorage, historyEntry),
    profile: {
      ...currentStorage.profile,
      lastStudiedAt: historyEntry.completedAt,
      updatedAt: historyEntry.completedAt,
    },
  };
}

export function updateProfileName(currentStorage: AppStorage, displayName: string): AppStorage {
  const normalizedName = displayName.replace(/\s+/g, ' ').trimStart().slice(0, MAX_PROFILE_NAME_LENGTH);

  return {
    ...currentStorage,
    profile: {
      ...currentStorage.profile,
      displayName: normalizedName,
      updatedAt: new Date().toISOString(),
    },
  };
}

export function setLessonDurationPreference(
  currentStorage: AppStorage,
  lessonDurationMinutes: LessonDurationMinutes,
): AppStorage {
  const lessonWordTargetByDuration: Record<LessonDurationMinutes, LessonWordTarget> = {
    10: 10,
    20: 20,
    30: 30,
  };

  return {
    ...currentStorage,
    lessonDurationMinutes,
    // The main duration control is the primary lesson-size control. Keeping the
    // target in sync prevents a hidden custom target from making 10/20/30-minute
    // choices feel identical to the learner.
    lessonWordTarget: lessonWordTargetByDuration[lessonDurationMinutes],
  };
}

export function setLessonDurationEnabledPreference(
  currentStorage: AppStorage,
  lessonDurationEnabled: boolean,
): AppStorage {
  return {
    ...currentStorage,
    lessonDurationEnabled,
  };
}

export function setLessonWordTargetPreference(
  currentStorage: AppStorage,
  lessonWordTarget: LessonWordTarget,
): AppStorage {
  // Keep the duration label honest: a 50-word lesson is not a 10-minute one.
  const lessonDurationMinutes: LessonDurationMinutes = lessonWordTarget <= 15 ? 10 : lessonWordTarget <= 30 ? 20 : 30;

  return {
    ...currentStorage,
    lessonWordTarget,
    lessonDurationMinutes,
  };
}

export function setLessonSourcePackPreference(currentStorage: AppStorage, lessonSourcePackId: string | null): AppStorage {
  return {
    ...currentStorage,
    lessonSourcePackId,
  };
}

export function setLearningLanguagePreference(
  currentStorage: AppStorage,
  learningLanguage: LearningLanguage,
): AppStorage {
  return {
    ...currentStorage,
    learningLanguage,
  };
}

export function addWordPack(currentStorage: AppStorage, packId: string): AppStorage {
  const now = new Date().toISOString();

  return {
    ...currentStorage,
    packStates: {
      ...currentStorage.packStates,
      [packId]: {
        packId,
        status: 'added',
        addedAt: currentStorage.packStates[packId]?.addedAt ?? now,
        completedAt: currentStorage.packStates[packId]?.completedAt ?? null,
      },
    },
  };
}

export function addCustomPack(currentStorage: AppStorage, pack: import('../types').WordPack): AppStorage {
  const replacesExisting = currentStorage.customPacks.some((item) => item.id === pack.id);
  if (!replacesExisting && currentStorage.customPacks.length >= MAX_CUSTOM_PACKS) {
    throw new RangeError(`Нельзя добавить больше ${MAX_CUSTOM_PACKS} пользовательских паков.`);
  }
  if (pack.words.length > MAX_WORDS_PER_PACK) {
    throw new RangeError(`Пак содержит больше ${MAX_WORDS_PER_PACK} слов.`);
  }
  const now = new Date().toISOString();
  const normalizedPack = normalizeCustomPack(pack);

  if (!normalizedPack || normalizedPack.words.length === 0) {
    return currentStorage;
  }

  const nextStorage: AppStorage = {
    ...currentStorage,
    customPacks: currentStorage.customPacks
      .filter((item) => item.id !== normalizedPack.id)
      .concat(normalizedPack),
    packStates: {
      ...currentStorage.packStates,
      [normalizedPack.id]: {
        packId: normalizedPack.id,
        status: 'added',
        addedAt: currentStorage.packStates[normalizedPack.id]?.addedAt ?? now,
        completedAt: currentStorage.packStates[normalizedPack.id]?.completedAt ?? null,
      },
    },
  };

  const nextBytes = estimateStorageBytes(nextStorage);
  if (nextBytes > STORAGE_SOFT_LIMIT_BYTES) {
    const usedMb = (estimateStorageBytes(currentStorage) / 1_000_000).toFixed(1);
    const packMb = Math.max(0.1, (nextBytes - estimateStorageBytes(currentStorage)) / 1_000_000).toFixed(1);
    throw new RangeError(
      `Локальное хранилище почти заполнено: занято около ${usedMb} МБ, пак добавит ещё ${packMb} МБ (предел около ${STORAGE_SOFT_LIMIT_BYTES / 1_000_000} МБ). Удалите ненужные паки или разделите этот на части.`,
    );
  }

  return nextStorage;
}

export function setWordPackStatus(
  currentStorage: AppStorage,
  packId: string,
  status: UserPackState['status'],
): AppStorage {
  const existing = normalizePackState(currentStorage.packStates[packId], packId);
  const completedAt = status === 'completed' ? existing.completedAt ?? new Date().toISOString() : null;

  return {
    ...currentStorage,
    packStates: {
      ...currentStorage.packStates,
      [packId]: {
        ...existing,
        status,
        completedAt,
      },
    },
  };
}

export function getWordProgress(storage: AppStorage, wordId: string): WordProgress {
  return storage.progressByWordId[wordId] ?? createInitialProgress(wordId);
}

export function getRadicalProgress(storage: AppStorage, radicalId: string): RadicalProgress {
  return storage.radicalProgressById[radicalId] ?? createInitialRadicalProgress(radicalId);
}

export function recordRadicalStudySession(
  currentStorage: AppStorage,
  outcomes: RadicalExerciseOutcome[],
): AppStorage {
  if (outcomes.length === 0) {
    return currentStorage;
  }

  const completedAt = new Date().toISOString();
  const radicalProgressById = { ...currentStorage.radicalProgressById };

  outcomes.forEach((outcome) => {
    const existing = radicalProgressById[outcome.radicalId]
      ?? createInitialRadicalProgress(outcome.radicalId);
    const correctAnswers = existing.correctAnswers + (outcome.isCorrect ? 1 : 0);
    const wrongAnswers = existing.wrongAnswers + (outcome.isCorrect ? 0 : 1);
    const attempts = correctAnswers + wrongAnswers;
    const accuracy = correctAnswers / Math.max(1, attempts);
    const status: RadicalStatus = attempts >= 6 && accuracy >= 0.8 ? 'mastered' : 'learning';

    radicalProgressById[outcome.radicalId] = {
      ...existing,
      attempts,
      correctAnswers,
      wrongAnswers,
      status,
      lastStudiedAt: completedAt,
      masteredAt: status === 'mastered' ? existing.masteredAt ?? completedAt : null,
    };
  });

  const radicalIds = Array.from(new Set(outcomes.map((outcome) => outcome.radicalId)));
  const historyEntry: RadicalStudyHistoryEntry = {
    id: `radicals-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: getTodayDateKey(),
    completedAt,
    radicalIds,
    correctAnswers: outcomes.filter((outcome) => outcome.isCorrect).length,
    totalAnswers: outcomes.length,
  };

  return {
    ...currentStorage,
    radicalProgressById,
    radicalStudyHistory: currentStorage.radicalStudyHistory
      .concat(historyEntry)
      .sort((left, right) => left.completedAt.localeCompare(right.completedAt))
      .slice(-120),
  };
}

/** Removes an imported pack together with its pack state and word progress. */
export function removeCustomPack(currentStorage: AppStorage, packId: string): AppStorage {
  const pack = currentStorage.customPacks.find((item) => item.id === packId);
  if (!pack) return currentStorage;
  const wordIds = new Set(pack.words.map((item) => item.id));
  const packStates = { ...currentStorage.packStates };
  delete packStates[packId];
  return {
    ...currentStorage,
    customPacks: currentStorage.customPacks.filter((item) => item.id !== packId),
    packStates,
    progressByWordId: Object.fromEntries(
      Object.entries(currentStorage.progressByWordId).filter(([wordId]) => !wordIds.has(wordId)),
    ),
    lessonSourcePackId: currentStorage.lessonSourcePackId === packId ? null : currentStorage.lessonSourcePackId,
  };
}

export function addCustomWord(currentStorage: AppStorage, word: Word): AppStorage {
  const replacesExisting = currentStorage.customWords.some((item) => item.id === word.id);
  if (!replacesExisting && currentStorage.customWords.length >= MAX_CUSTOM_WORDS) {
    throw new RangeError(`Нельзя добавить больше ${MAX_CUSTOM_WORDS} пользовательских слов.`);
  }
  const normalizedWord = normalizeWord(word);
  const customWords = currentStorage.customWords
    .filter((item) => item.id !== normalizedWord.id)
    .concat(normalizedWord)
    .sort((left, right) => left.original.localeCompare(right.original, normalizedWord.language === 'japanese' ? 'ja' : 'fr'));

  return {
    ...currentStorage,
    customWords,
  };
}

/** The hour (0–6) at which a new study day begins; applied immediately. */
export function setDayStartPreference(currentStorage: AppStorage, hour: number): AppStorage {
  setDayStartHour(hour);
  return { ...currentStorage, dayStartHour: Math.min(MAX_DAY_START_HOUR, Math.max(0, Math.floor(hour))) };
}

function normalizeSpeech(value: unknown): SpeechPreferences {
  const record = isRecord(value) ? value : {};
  const voices = isRecord(record.voices) ? record.voices : {};
  const rate = typeof record.rate === 'number' && record.rate >= 0.5 && record.rate <= 1.2 ? record.rate : 0.9;
  return {
    voices: {
      ...(typeof voices.french === 'string' ? { french: voices.french.slice(0, 300) } : {}),
      ...(typeof voices.japanese === 'string' ? { japanese: voices.japanese.slice(0, 300) } : {}),
    },
    rate,
  };
}

export function setSpeechPreference(
  currentStorage: AppStorage,
  change: { language?: LearningLanguage; voiceId?: string | null; rate?: number },
): AppStorage {
  const voices = { ...currentStorage.speech.voices };
  if (change.language) {
    if (change.voiceId) voices[change.language] = change.voiceId;
    else delete voices[change.language];
  }
  return { ...currentStorage, speech: normalizeSpeech({ voices, rate: change.rate ?? currentStorage.speech.rate }) };
}

export const KANA_LEARNED_STREAK = 3;

export type KanaStatus = 'new' | 'learning' | 'learned';

export function getKanaStatus(progress: KanaProgress | undefined): KanaStatus {
  if (!progress || progress.correct + progress.wrong === 0) return 'new';
  return progress.streak >= KANA_LEARNED_STREAK ? 'learned' : 'learning';
}

/** Saves one katakana practice: a mistake resets the sign's streak. */
export function recordKanaSession(
  currentStorage: AppStorage,
  outcomes: Array<{ kana: string; isCorrect: boolean }>,
  now = new Date(),
): AppStorage {
  if (outcomes.length === 0) return currentStorage;
  const kanaProgress = { ...currentStorage.kanaProgress };
  outcomes.forEach(({ kana, isCorrect }) => {
    const existing = kanaProgress[kana] ?? { correct: 0, wrong: 0, streak: 0, lastSeenAt: null };
    kanaProgress[kana] = {
      correct: existing.correct + (isCorrect ? 1 : 0),
      wrong: existing.wrong + (isCorrect ? 0 : 1),
      streak: isCorrect ? existing.streak + 1 : 0,
      lastSeenAt: now.toISOString(),
    };
  });
  return { ...currentStorage, kanaProgress };
}
