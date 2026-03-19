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
import { addDays, clamp, getTodayDateKey, isReviewDue, startOfDay } from './utils';

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
    transcription: (word.transcription ?? '').trim(),
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
  if (progress.status === 'known') {
    return 'known';
  }

  if (progress.correct_count >= 8 && progress.repetition_step >= 6) {
    return 'mastered';
  }

  if (progress.wrong_count >= 3 && progress.repetition_step < 4) {
    return 'difficult';
  }

  if (progress.repetition_step >= 3 || (progress.status === 'mastered' && !isReviewDue(progress.next_review_at))) {
    return 'review';
  }

  if (progress.shown_count > 0) {
    return 'learning';
  }

  return 'new';
}

function nextIntervalDays(progress: WordProgress, isCorrect: boolean): number {
  if (!isCorrect) {
    return 1;
  }

  if (progress.status === 'new') {
    return 1;
  }

  if (progress.status === 'learning') {
    return progress.repetition_step >= 2 ? 3 : 1;
  }

  const base = progress.interval_days > 0 ? progress.interval_days : 3;
  return clamp(Math.round(base * progress.ease_factor), 2, 45);
}

function buildUpdatedProgress(existing: WordProgress, outcome: ExerciseOutcome): WordProgress {
  const now = new Date();
  const easeFactor = outcome.isCorrect
    ? clamp(existing.ease_factor + 0.15, 1.3, 3.4)
    : clamp(existing.ease_factor - 0.2, 1.3, 3.4);
  const intervalDays = nextIntervalDays(existing, outcome.isCorrect);
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
