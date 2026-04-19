import type {
  AppStorage,
  DailyLessonCompletionPayload,
  DailyLessonRecord,
  ExerciseOutcome,
  LessonDurationMinutes,
  StudyHistoryEntry,
  UserPackState,
  UserProfile,
  Word,
  WordProgress,
  WordStatus,
} from '../types';
import { addDays, clamp, deriveFrenchLatinTranscription, getTodayDateKey, normalizeTranscription, isReviewDue, startOfDay } from './utils';

const STORAGE_KEY = 'anki-plus-storage';

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
    progressByWordId: {},
    dailyStats: [],
    completedDailyLessons: [],
    streakDays: 0,
    lastLessonDate: null,
    lessonDurationMinutes: 20,
    profile: createDefaultProfile(),
    studyHistory: [],
    packStates: {},
    customWords: [],
  };
}

function normalizeWord(word: Word): Word {
  return {
    ...word,
    original: word.original.trim(),
    translation: word.translation.trim(),
    transcription:
      word.source === 'custom'
        ? normalizeTranscription((word.transcription ?? '').trim()) || deriveFrenchLatinTranscription(word.original, '')
        : deriveFrenchLatinTranscription(word.original, (word.transcription ?? '').trim()),
    audio_original: word.audio_original ?? '',
    example_original: word.example_original.trim(),
    example_translation: word.example_translation.trim(),
    part_of_speech: word.part_of_speech.trim() || 'word',
    tags: Array.isArray(word.tags) ? word.tags.map((tag) => tag.trim()).filter(Boolean) : [],
    packIds: Array.isArray(word.packIds) ? word.packIds : [],
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
  };
}

function normalizeProgress(progress: WordProgress): WordProgress {
  return {
    ...createInitialProgress(progress.word_id),
    ...progress,
  };
}

function normalizeProfile(profile?: Partial<UserProfile>): UserProfile {
  const fallback = createDefaultProfile();

  return {
    ...fallback,
    ...profile,
    displayName: profile?.displayName?.trim() || fallback.displayName,
  };
}

function normalizeHistoryEntry(entry: Partial<StudyHistoryEntry>): StudyHistoryEntry | null {
  if (!entry.id || !entry.date || !entry.completedAt || !entry.sessionId || !entry.mode) {
    return null;
  }

  return {
    id: entry.id,
    date: entry.date,
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

function normalizePackState(packState: Partial<UserPackState> | undefined, packId: string): UserPackState {
  return {
    packId,
    status: packState?.status ?? 'not_added',
    addedAt: packState?.addedAt ?? null,
    completedAt: packState?.completedAt ?? null,
  };
}

export function loadStorage(): AppStorage {
  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return createDefaultStorage();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AppStorage>;
    const defaults = createDefaultStorage();

    return {
      ...defaults,
      ...parsed,
      progressByWordId: Object.fromEntries(
        Object.entries(parsed.progressByWordId ?? {}).map(([wordId, progress]) => [
          wordId,
          normalizeProgress(progress),
        ]),
      ),
      dailyStats: (parsed.dailyStats ?? []).map((item) => ({
        ...item,
        wordsLearned: item.wordsLearned ?? 0,
        reviewsCompleted: item.reviewsCompleted ?? 0,
      })),
      completedDailyLessons: (parsed.completedDailyLessons ?? [])
        .filter((item): item is DailyLessonRecord => Boolean(item?.date && item?.completedAt && item?.sessionId))
        .map((item) => ({
          ...item,
          timeSpentSeconds: item.timeSpentSeconds ?? 0,
        }))
        .slice(-180),
      lessonDurationMinutes:
        parsed.lessonDurationMinutes === 10 || parsed.lessonDurationMinutes === 30 ? parsed.lessonDurationMinutes : 20,
      profile: normalizeProfile(parsed.profile),
      studyHistory: (parsed.studyHistory ?? [])
        .map((entry) => normalizeHistoryEntry(entry))
        .filter((entry): entry is StudyHistoryEntry => entry !== null)
        .slice(-180),
      packStates: Object.fromEntries(
        Object.entries(parsed.packStates ?? {}).map(([packId, packState]) => [
          packId,
          normalizePackState(packState, packId),
        ]),
      ),
      customWords: (parsed.customWords ?? [])
        .filter((word): word is Word => Boolean(word?.id && word?.original && word?.translation))
        .map((word) => normalizeWord(word)),
    };
  } catch {
    return createDefaultStorage();
  }
}

export function saveStorage(storage: AppStorage): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
}

function resolveStatus(progress: WordProgress): WordStatus {
  const accuracy = progress.shown_count > 0 ? progress.correct_count / progress.shown_count : 0;
  const errorRate = progress.shown_count > 0 ? progress.wrong_count / progress.shown_count : 0;

  if (progress.status === 'known') {
    return 'known';
  }

  if (
    progress.shown_count >= 8 &&
    progress.correct_count >= 6 &&
    progress.repetition_step >= 6 &&
    progress.interval_days >= 10 &&
    accuracy >= 0.82
  ) {
    return 'mastered';
  }

  if (
    progress.shown_count >= 3 &&
    progress.wrong_count >= 3 &&
    (accuracy < 0.68 || errorRate >= 0.35) &&
    progress.repetition_step < 5
  ) {
    return 'difficult';
  }

  if (
    progress.repetition_step >= 4 ||
    (progress.shown_count >= 4 && accuracy >= 0.8) ||
    (progress.status === 'mastered' && !isReviewDue(progress.next_review_at))
  ) {
    return 'review';
  }

  if (progress.shown_count > 0) {
    return 'learning';
  }

  return 'new';
}

function getAnswerAccuracy(correctCount: number, shownCount: number): number {
  return shownCount > 0 ? correctCount / shownCount : 0;
}

function getErrorPressure(correctCount: number, wrongCount: number): number {
  const attempts = correctCount + wrongCount;

  if (attempts === 0) {
    return 0;
  }

  const errorRate = wrongCount / attempts;
  const wrongToCorrectRatio = wrongCount / Math.max(1, correctCount);

  return clamp(errorRate * 0.75 + wrongToCorrectRatio * 0.18, 0, 1);
}

function getProjectedAnswerStats(
  progress: WordProgress,
  outcome: ExerciseOutcome,
): { correctCount: number; wrongCount: number; shownCount: number; accuracy: number; errorPressure: number } {
  const correctCount = progress.correct_count + (outcome.isCorrect ? 1 : 0);
  const wrongCount = progress.wrong_count + (outcome.isCorrect ? 0 : 1);
  const shownCount = progress.shown_count + 1;

  return {
    correctCount,
    wrongCount,
    shownCount,
    accuracy: getAnswerAccuracy(correctCount, shownCount),
    errorPressure: getErrorPressure(correctCount, wrongCount),
  };
}

function getBaseExerciseEaseDelta(outcome: ExerciseOutcome): number {
  if (!outcome.isCorrect) {
    switch (outcome.type) {
      case 'memory_check':
        return -0.28;
      case 'audio_to_original_input':
        return -0.18;
      case 'translation_to_original_choice':
        return -0.16;
      case 'audio_to_translation_choice':
      case 'original_to_translation_choice':
      default:
        return -0.12;
    }
  }

  switch (outcome.type) {
    case 'audio_to_original_input':
      return 0.18;
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

function getExerciseEaseDelta(progress: WordProgress, outcome: ExerciseOutcome): number {
  const baseDelta = getBaseExerciseEaseDelta(outcome);
  const stats = getProjectedAnswerStats(progress, outcome);

  if (!outcome.isCorrect) {
    return baseDelta - stats.errorPressure * 0.22;
  }

  const accuracyBonus = stats.shownCount >= 4 && stats.accuracy >= 0.86 ? 0.06 : 0;
  const errorPenalty = stats.errorPressure * 0.14;

  return baseDelta + accuracyBonus - errorPenalty;
}

function getBaseExerciseIntervalMultiplier(type: ExerciseOutcome['type']): number {
  switch (type) {
    case 'audio_to_original_input':
      return 1.18;
    case 'translation_to_original_choice':
      return 1.08;
    case 'memory_check':
      return 1.05;
    case 'audio_to_translation_choice':
    case 'original_to_translation_choice':
    default:
      return 0.88;
  }
}

function getExerciseIntervalMultiplier(progress: WordProgress, outcome: ExerciseOutcome): number {
  const stats = getProjectedAnswerStats(progress, outcome);
  const accuracyAdjustment = clamp((stats.accuracy - 0.72) * 0.85, -0.28, 0.24);
  const errorPenalty = stats.errorPressure * 0.45;

  return clamp(getBaseExerciseIntervalMultiplier(outcome.type) + accuracyAdjustment - errorPenalty, 0.45, 1.35);
}

function getLateReviewBoost(progress: WordProgress): number {
  if (!progress.next_review_at || !isReviewDue(progress.next_review_at)) {
    return 0;
  }

  const overdueDays = Math.floor((Date.now() - new Date(progress.next_review_at).getTime()) / (24 * 60 * 60 * 1000));

  return clamp(Math.floor(overdueDays * 0.35), 0, 14);
}

function nextIntervalDays(progress: WordProgress, outcome: ExerciseOutcome): number {
  if (!outcome.isCorrect) {
    return 1;
  }

  const multiplier = getExerciseIntervalMultiplier(progress, outcome);
  const lateBoost = getLateReviewBoost(progress);

  if (progress.status === 'new') {
    return clamp(Math.round(multiplier), 1, 2);
  }

  if (progress.status === 'learning') {
    const base = progress.repetition_step >= 3 ? 4 : progress.repetition_step >= 1 ? 2 : 1;
    return clamp(Math.round(base * multiplier), 1, 7);
  }

  if (progress.status === 'difficult') {
    const base = progress.repetition_step >= 3 ? 3 : 1;
    return clamp(Math.round(base * multiplier), 1, 5);
  }

  const base = progress.interval_days > 0 ? progress.interval_days : 3;
  return clamp(Math.round((base + lateBoost) * progress.ease_factor * multiplier), 2, 60);
}

function buildUpdatedProgress(existing: WordProgress, outcome: ExerciseOutcome): WordProgress {
  const now = new Date();
  const easeFactor = clamp(existing.ease_factor + getExerciseEaseDelta(existing, outcome), 1.3, 3.4);
  const intervalDays = nextIntervalDays(existing, outcome);
  const repetitionStep = outcome.isCorrect
    ? existing.repetition_step + 1
    : Math.max(1, existing.repetition_step - 1);
  const draft: WordProgress = {
    ...existing,
    shown_count: existing.shown_count + 1,
    correct_count: existing.correct_count + (outcome.isCorrect ? 1 : 0),
    wrong_count: existing.wrong_count + (outcome.isCorrect ? 0 : 1),
    ease_factor: easeFactor,
    repetition_step: repetitionStep,
    interval_days: intervalDays,
    last_seen_at: now.toISOString(),
    next_review_at: addDays(startOfDay(now), outcome.isCorrect ? intervalDays : 1).toISOString(),
    learned_at: existing.learned_at,
    status: existing.status,
  };

  if (!outcome.isCorrect) {
    draft.status = draft.wrong_count >= 3 ? 'difficult' : 'learning';
  } else {
    draft.status = resolveStatus(draft);

    if (draft.status === 'mastered' && !draft.learned_at) {
      draft.learned_at = now.toISOString();
    }
  }

  return draft;
}

function updateDailyStats(storage: AppStorage, outcomes: ExerciseOutcome[]): void {
  const today = getTodayDateKey();
  const correctAnswers = outcomes.filter((item) => item.isCorrect).length;
  const masteredWordIds = new Set<string>();
  const reviewWordIds = new Set<string>();

  outcomes.forEach((outcome) => {
    const progress = storage.progressByWordId[outcome.wordId];

    if (!progress) {
      return;
    }

    if (progress.status === 'mastered') {
      masteredWordIds.add(outcome.wordId);
    }

    if (progress.status === 'review' || progress.status === 'mastered') {
      reviewWordIds.add(outcome.wordId);
    }
  });

  const existingDailyStat = storage.dailyStats.find((item) => item.date === today);

  if (existingDailyStat) {
    existingDailyStat.completedLessons += 1;
    existingDailyStat.correctAnswers += correctAnswers;
    existingDailyStat.totalAnswers += outcomes.length;
    existingDailyStat.wordsLearned += masteredWordIds.size;
    existingDailyStat.reviewsCompleted += reviewWordIds.size;
  } else {
    storage.dailyStats.push({
      date: today,
      completedLessons: 1,
      correctAnswers,
      totalAnswers: outcomes.length,
      wordsLearned: masteredWordIds.size,
      reviewsCompleted: reviewWordIds.size,
    });
  }

  storage.dailyStats = storage.dailyStats
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(-180);
}

function updateStreak(storage: AppStorage): void {
  const today = getTodayDateKey();
  const lastLessonDate = storage.lastLessonDate;
  storage.lastLessonDate = today;

  if (lastLessonDate === today) {
    return;
  }

  if (!lastLessonDate) {
    storage.streakDays = 1;
    return;
  }

  const previousDate = new Date(`${lastLessonDate}T00:00:00`);
  const currentDate = new Date(`${today}T00:00:00`);
  const differenceInDays = Math.round(
    (currentDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  storage.streakDays = differenceInDays === 1 ? storage.streakDays + 1 : 1;
}

export function applyOutcomes(currentStorage: AppStorage, outcomes: ExerciseOutcome[]): AppStorage {
  const storage: AppStorage = {
    ...currentStorage,
    progressByWordId: { ...currentStorage.progressByWordId },
    dailyStats: [...currentStorage.dailyStats],
    completedDailyLessons: [...currentStorage.completedDailyLessons],
    studyHistory: [...currentStorage.studyHistory],
    packStates: { ...currentStorage.packStates },
    profile: { ...currentStorage.profile },
  };

  outcomes.forEach((outcome) => {
    const existing = storage.progressByWordId[outcome.wordId] ?? createInitialProgress(outcome.wordId);
    storage.progressByWordId[outcome.wordId] = buildUpdatedProgress(existing, outcome);
  });

  updateDailyStats(storage, outcomes);
  updateStreak(storage);

  return storage;
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
        repetition_step: Math.max(existing.repetition_step, 1),
        last_seen_at: now,
        next_review_at: null,
        learned_at: now,
      },
    },
  };
}

export function getCompletedDailyLesson(storage: AppStorage, date = getTodayDateKey()): DailyLessonRecord | null {
  return storage.completedDailyLessons.find((item) => item.date === date) ?? null;
}

export function completeDailyLesson(
  currentStorage: AppStorage,
  payload: DailyLessonCompletionPayload,
): AppStorage {
  const completedDailyLessons = currentStorage.completedDailyLessons
    .filter((item) => item.date !== payload.record.date)
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
  const normalizedName = displayName.trim() || 'Ученик';

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
  return {
    ...currentStorage,
    lessonDurationMinutes,
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

export function addCustomWord(currentStorage: AppStorage, word: Word): AppStorage {
  const normalizedWord = normalizeWord(word);
  const customWords = currentStorage.customWords
    .filter((item) => item.id !== normalizedWord.id)
    .concat(normalizedWord)
    .sort((left, right) => left.original.localeCompare(right.original, 'fr'));

  return {
    ...currentStorage,
    customWords,
  };
}
