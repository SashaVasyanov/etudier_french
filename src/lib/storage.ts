import type {
  AppStorage,
  DailyLessonCompletionPayload,
  DailyLessonRecord,
  ExerciseOutcome,
  LearningLanguage,
  LessonDurationMinutes,
  LessonWordTarget,
  RadicalExerciseOutcome,
  RadicalProgress,
  RadicalStatus,
  RadicalStudyHistoryEntry,
  StorageLoadResult,
  StorageSaveResult,
  StudyHistoryEntry,
  UserPackState,
  UserProfile,
  Word,
  WordProgress,
  WordStatus,
} from '../types';
import { addDays, clamp, deriveFrenchLatinTranscription, getTodayDateKey, normalizeTranscription, startOfDay } from './utils';

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

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isValidDateString(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(new Date(value).getTime());
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
  };
}

function normalizeWord(word: Word): Word {
  const language = word.language ?? 'french';
  const normalizedSource = word.source ?? 'custom';
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
    source: word.source ?? 'custom',
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
    lastStudiedAt: typeof progress.lastStudiedAt === 'string' ? progress.lastStudiedAt : null,
    masteredAt: typeof progress.masteredAt === 'string' ? progress.masteredAt : null,
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
          progress.successful_review_dates.filter(
            (date): date is string => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date),
          ),
        ),
      ).sort().slice(-MAX_SUCCESSFUL_REVIEW_DATES)
    : [];

  return {
    ...base,
    word_id: wordId,
    shown_count: Math.floor(finiteNumber(progress.shown_count, base.shown_count)),
    correct_count: Math.floor(finiteNumber(progress.correct_count, base.correct_count)),
    wrong_count: Math.floor(finiteNumber(progress.wrong_count, base.wrong_count)),
    ease_factor: clamp(finiteNumber(progress.ease_factor, base.ease_factor), 1.3, 3.4),
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

  if (!pack.id || !pack.title || !pack.language || !Array.isArray(pack.words)) {
    return null;
  }

  return {
    id: pack.id,
    language: pack.language,
    title: cleanText(pack.title, 'Импортированный пак', 80),
    description: cleanText(pack.description, 'Импортированный пользовательский пак.', 500),
    accent: pack.accent ?? '#1a8ce2',
    coverImageUrl: pack.coverImageUrl,
    coverImageAlt: pack.coverImageAlt,
    words: pack.words
      .filter((word): word is Word => Boolean(word?.id && word?.original && word?.translation))
      .map((word) => normalizeWord({ ...word, source: 'pack', packIds: [pack.id!] })),
  };
}

function normalizeProfile(profile?: Partial<UserProfile>): UserProfile {
  const fallback = createDefaultProfile();

  return {
    ...fallback,
    ...profile,
    displayName: cleanText(profile?.displayName, fallback.displayName, MAX_PROFILE_NAME_LENGTH) || fallback.displayName,
  };
}

function normalizeHistoryEntry(value: unknown): StudyHistoryEntry | null {
  if (!isRecord(value)) {
    return null;
  }

  const entry = value as Partial<StudyHistoryEntry>;

  if (!entry.id || !entry.date || !entry.completedAt || !entry.sessionId || !entry.mode) {
    return null;
  }

  return {
    id: entry.id,
    date: entry.date,
    language: entry.language ?? 'french',
    completedAt: entry.completedAt,
    sessionId: entry.sessionId,
    mode: entry.mode,
    durationMinutes: (entry.durationMinutes as LessonDurationMinutes | undefined) ?? 20,
    moduleTitles: entry.moduleTitles ?? [],
    modulesCompleted: entry.modulesCompleted ?? 0,
    wordsLearned: entry.wordsLearned ?? 0,
    mistakesMade: entry.mistakesMade ?? 0,
    correctAnswers: entry.correctAnswers ?? 0,
    totalAnswers: entry.totalAnswers ?? 0,
    timeSpentSeconds: entry.timeSpentSeconds ?? 0,
    activePackIds: entry.activePackIds ?? [],
  };
}

function normalizeRadicalHistoryEntry(value: unknown): RadicalStudyHistoryEntry | null {
  if (!isRecord(value)) {
    return null;
  }

  const entry = value as Partial<RadicalStudyHistoryEntry>;

  if (!entry.id || !entry.date || !entry.completedAt || !Array.isArray(entry.radicalIds)) {
    return null;
  }

  return {
    id: entry.id,
    date: entry.date,
    completedAt: entry.completedAt,
    radicalIds: entry.radicalIds.filter((id): id is string => typeof id === 'string').slice(0, 50),
    correctAnswers: Math.floor(finiteNumber(entry.correctAnswers, 0)),
    totalAnswers: Math.floor(finiteNumber(entry.totalAnswers, 0)),
  };
}

function normalizePackState(packState: Partial<UserPackState> | undefined, packId: string): UserPackState {
  return {
    packId,
    status: packState?.status ?? 'not_added',
    addedAt: packState?.addedAt ?? null,
    completedAt: packState?.completedAt ?? null,
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

    return {
      ...defaults,
      ...parsed,
      learningLanguage: parsed.learningLanguage === 'japanese' ? 'japanese' : 'french',
      progressByWordId: Object.fromEntries(
        progressEntries
          .filter((entry): entry is [string, Partial<WordProgress>] => isRecord(entry[1]))
          .map(([wordId, progress]) => [wordId, normalizeProgress(progress, wordId)]),
      ),
      dailyStats: dailyStats
        .filter((item): item is Record<string, unknown> => isRecord(item) && typeof item.date === 'string')
        .map((item) => ({
          date: item.date as string,
          language: (item.language === 'japanese' ? 'japanese' : 'french') as LearningLanguage,
          completedLessons: Math.floor(finiteNumber(item.completedLessons, 0)),
          correctAnswers: Math.floor(finiteNumber(item.correctAnswers, 0)),
          totalAnswers: Math.floor(finiteNumber(item.totalAnswers, 0)),
          wordsLearned: Math.floor(finiteNumber(item.wordsLearned, 0)),
          reviewsCompleted: Math.floor(finiteNumber(item.reviewsCompleted, 0)),
        }))
        .slice(-180),
      completedDailyLessons: completedDailyLessons
        .filter((item): item is DailyLessonRecord =>
          isRecord(item) && typeof item.date === 'string' && typeof item.completedAt === 'string' && typeof item.sessionId === 'string',
        )
        .map((item) => ({
          ...item,
          language: item.language ?? 'french',
          timeSpentSeconds: item.timeSpentSeconds ?? 0,
        }))
        .slice(-180),
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
      studyHistory: studyHistory
        .map((entry) => normalizeHistoryEntry(entry))
        .filter((entry): entry is StudyHistoryEntry => entry !== null)
        .slice(-180),
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
    return { storage: parseStoredStorage(raw), error: null };
  } catch (primaryError) {
    const unsupportedVersion = primaryError instanceof RangeError;
    const quarantined = unsupportedVersion ? false : quarantineCorruptStorage(raw);
    let backupRaw: string | null = null;

    try {
      backupRaw = window.localStorage.getItem(STORAGE_BACKUP_KEY);
      if (backupRaw) {
        const recovered = parseStoredStorage(backupRaw);
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

export function saveStorage(storage: AppStorage): StorageSaveResult {
  const envelope: StorageEnvelope = {
    version: STORAGE_VERSION,
    savedAt: new Date().toISOString(),
    payload: storage,
  };
  let currentRaw: string | null;

  try {
    currentRaw = window.localStorage.getItem(STORAGE_KEY);
    if (currentRaw) {
      try {
        parseStoredStorage(currentRaw);
        window.localStorage.setItem(STORAGE_BACKUP_KEY, currentRaw);
      } catch {
        const quarantineRaw = window.localStorage.getItem(STORAGE_QUARANTINE_KEY);
        const quarantineValue: unknown = quarantineRaw ? JSON.parse(quarantineRaw) : null;
        if (!isRecord(quarantineValue) || quarantineValue.raw !== currentRaw) {
          throw new Error('Primary storage was not safely quarantined.');
        }
      }
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
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

function getBaseExerciseEaseDelta(outcome: ExerciseOutcome): number {
  if (!outcome.isCorrect) {
    switch (outcome.type) {
      case 'memory_check':
        return -0.28;
      case 'translation_to_original_input':
        return -0.2;
      case 'audio_to_original_input':
        return -0.18;
      case 'kanji_to_hiragana_input':
        return -0.18;
      case 'sentence_cloze_input':
        return -0.16;
      case 'translation_to_original_choice':
        return -0.16;
      case 'audio_to_translation_choice':
      case 'original_to_translation_choice':
      default:
        return -0.12;
    }
  }

  switch (outcome.type) {
    case 'translation_to_original_input':
      return 0.18;
    case 'audio_to_original_input':
      return 0.18;
    case 'kanji_to_hiragana_input':
      return 0.16;
    case 'sentence_cloze_input':
      return 0.14;
    case 'translation_to_original_choice':
      return 0.12;
    case 'memory_check':
      return 0.08;
    case 'audio_to_translation_choice':
    case 'original_to_translation_choice':
    default:
      return 0.06;
  }
}

const SCHEDULED_WORD_STATUSES = new Set<WordStatus>(['learning', 'difficult', 'review', 'mastered']);
const MASTERY_REVIEW_DAYS = 3;

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

function getSessionEaseDelta(outcomes: ExerciseOutcome[]): number {
  return outcomes.length > 0
    ? outcomes.reduce((sum, outcome) => sum + getBaseExerciseEaseDelta(outcome), 0) / outcomes.length
    : 0;
}

function nextSuccessfulInterval(progress: WordProgress, successfulReviewDays: number, now: Date): number {
  if (successfulReviewDays <= 1) return 2;
  if (successfulReviewDays === 2) return 4;
  if (successfulReviewDays === 3) return 10;

  const overdueDays = progress.next_review_at
    ? Math.max(0, Math.floor((now.getTime() - new Date(progress.next_review_at).getTime()) / (24 * 60 * 60 * 1000)))
    : 0;
  return clamp(Math.round((Math.max(10, progress.interval_days) + Math.min(overdueDays, 14)) * progress.ease_factor), 10, 60);
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
  const isSuccessfulSession = correctAnswers > 0 && wrongAnswers === 0;
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
        status: base.wrong_count >= 3 ? 'difficult' : 'learning',
        ease_factor: clamp(existing.ease_factor + getSessionEaseDelta(outcomes), 1.3, 3.4),
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
    return {
      progress: {
        ...base,
        status: base.wrong_count >= 3 || existing.status === 'mastered' ? 'difficult' : 'learning',
        ease_factor: clamp(existing.ease_factor + getSessionEaseDelta(outcomes), 1.3, 3.4),
        repetition_step: Math.max(1, existing.repetition_step - 1),
        interval_days: 1,
        next_review_at: addDays(startOfDay(now), 1).toISOString(),
      },
      completedDueReview: true,
      becameMastered: false,
    };
  }

  const reviewDate = toLocalDateKey(now);
  const successfulReviewDates = existing.successful_review_dates.includes(reviewDate)
    ? existing.successful_review_dates
    : [...existing.successful_review_dates, reviewDate].sort().slice(-MAX_SUCCESSFUL_REVIEW_DATES);
  const intervalDays = nextSuccessfulInterval(existing, successfulReviewDates.length, now);
  const status: WordStatus =
    existing.status === 'mastered' || successfulReviewDates.length >= MASTERY_REVIEW_DAYS
      ? 'mastered'
      : 'review';
  const becameMastered = existing.status !== 'mastered' && status === 'mastered';

  return {
    progress: {
      ...base,
      status,
      ease_factor: clamp(existing.ease_factor + getSessionEaseDelta(outcomes), 1.3, 3.4),
      repetition_step: existing.repetition_step + 1,
      interval_days: intervalDays,
      next_review_at: addDays(startOfDay(now), intervalDays).toISOString(),
      learned_at: becameMastered ? now.toISOString() : existing.learned_at,
      successful_review_dates: successfulReviewDates,
    },
    completedDueReview: true,
    becameMastered,
  };
}

function getUpdatedStreak(storage: AppStorage, now: Date): Pick<AppStorage, 'lastLessonDate' | 'streakDays'> {
  const today = toLocalDateKey(now);
  if (storage.lastLessonDate === today) return { lastLessonDate: today, streakDays: storage.streakDays };
  if (!storage.lastLessonDate) return { lastLessonDate: today, streakDays: 1 };

  const previousDate = new Date(`${storage.lastLessonDate}T00:00:00`);
  const currentDate = new Date(`${today}T00:00:00`);
  const differenceInDays = Math.round((currentDate.getTime() - previousDate.getTime()) / (24 * 60 * 60 * 1000));
  return { lastLessonDate: today, streakDays: differenceInDays === 1 ? storage.streakDays + 1 : 1 };
}

export function getCurrentStreakDays(storage: AppStorage, now = new Date()): number {
  if (!storage.lastLessonDate) return 0;
  const today = toLocalDateKey(now);
  if (storage.lastLessonDate === today) return storage.streakDays;
  const yesterday = toLocalDateKey(addDays(startOfDay(now), -1));
  return storage.lastLessonDate === yesterday ? storage.streakDays : 0;
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

  const today = toLocalDateKey(now);
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
    dailyStats: [
      ...currentStorage.dailyStats.filter((item) => !(item.date === today && item.language === language)),
      nextStat,
    ].sort((left, right) => left.date.localeCompare(right.date)).slice(-180),
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

export function getCompletedDailyLesson(storage: AppStorage, date = getTodayDateKey()): DailyLessonRecord | null {
  return storage.completedDailyLessons.find(
    (item) => item.date === date && item.language === storage.learningLanguage,
  ) ?? null;
}

export function completeDailyLesson(
  currentStorage: AppStorage,
  payload: DailyLessonCompletionPayload,
): AppStorage {
  const completedDailyLessons = currentStorage.completedDailyLessons
    .filter((item) => !(item.date === payload.record.date && item.language === payload.record.language))
    .concat(payload.record)
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(-180);
  const studyHistory = currentStorage.studyHistory
    .filter((item) => item.id !== payload.historyEntry.id)
    .concat(payload.historyEntry)
    .sort((left, right) => left.completedAt.localeCompare(right.completedAt))
    .slice(-180);

  return {
    ...currentStorage,
    completedDailyLessons,
    studyHistory,
    profile: {
      ...currentStorage.profile,
      lastStudiedAt: payload.historyEntry.completedAt,
      updatedAt: payload.historyEntry.completedAt,
    },
  };
}

export function recordStudyHistory(currentStorage: AppStorage, historyEntry: StudyHistoryEntry): AppStorage {
  const studyHistory = currentStorage.studyHistory
    .filter((item) => item.id !== historyEntry.id)
    .concat(historyEntry)
    .sort((left, right) => left.completedAt.localeCompare(right.completedAt))
    .slice(-180);

  return {
    ...currentStorage,
    studyHistory,
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
  return {
    ...currentStorage,
    lessonWordTarget,
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

  return {
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
