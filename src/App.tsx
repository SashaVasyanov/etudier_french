import { Suspense, lazy, startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { AppNavigation } from './components/AppNavigation';
import { AppIcon } from './components/AppIcon';
import { AppShell } from './components/AppShell';
import { TextInputExercise } from './components/TextInputExercise';
import { DailyCompletionScreen } from './components/DailyCompletionScreen';
import { FlashcardView } from './components/FlashcardView';
import { HomeDashboard } from './components/HomeDashboard';
import { LessonResult } from './components/LessonResult';
import { LessonWordPreview } from './components/LessonWordPreview';
import { MemoryCheckExercise } from './components/MemoryCheckExercise';
import { SentenceOrderExercise } from './components/SentenceOrderExercise';
import { MultipleChoiceExercise } from './components/MultipleChoiceExercise';
import { LetterAssemblyExercise } from './components/LetterAssemblyExercise';
import { getLessonPoolWords, getStarterPacks, loadWords } from './data/words';
import { playTextAudio, playWordAudio, setSpeechPreferences, stopAudio } from './lib/audio';
import { createFlashcardSession, createLessonSession, getDailyBalance, LISTENING_TITLE, pickPracticeWords, QUICK_REVIEW_TITLE, scheduleExerciseRetry } from './lib/exercises';
import { getPhraseOfTheDay } from './lib/reading';
import { getNextReminderAt, getReminderText, scheduleReminder, setDockBadge } from './lib/desktop';
import { setReadingPreferences } from './lib/readingPrefs';
import {
  getLearningLanguageProductTitle,
  getLearningLanguageTitle,
} from './lib/languages';
import { canonicalizePackWords, derivePackStatus, getActiveWords, getEnabledPackIds } from './lib/packs';
import { finishLessonSession, getLessonProgress, removeUpcomingWord } from './lib/lessonSession';
import { isSessionFromAnotherDay, loadLessonDraft, saveLessonDraft, type LessonDraft } from './lib/lessonDraft';
import {
  addCustomPack,
  addWordPack,
  addCustomWord,
  loadStorage,
  markWordAsIgnored,
  markWordAsKnown,
  restoreWordProgress,
  removeCustomPack,
  exportStorageSnapshot,
  importStorageSnapshot,
  restoreWordToLearning,
  recordKanaSession,
  recordRadicalStudySession,
  saveStorage,
  setLearningLanguagePreference,
  setLessonDurationEnabledPreference,
  setLessonDurationPreference,
  setLessonSourcePackPreference,
  setLessonWordTargetPreference,
  setDayStartPreference,
  setDesiredRetention,
  setSpeechPreference,
  setWordPackStatus,
  getWordProgress,
  getComfort,
  isWordDueForReview,
  setComfortPreference,
  getCompletedDailyLesson,
  getStreakSummary,
  reconcileWithProgressFile,
  recordSpeedScore,
  updateProfileName,
  reportContentIssue,
  removeContentReport,
} from './lib/storage';
import { ReportContext } from './components/ReportIssue';
import { parseImportedPack } from './lib/importPacks';
import { checkDictation, getTodayDateKey, isAnswerMatch, isFrenchNearMiss, isJapaneseReadingMatch, setDayStartHour } from './lib/utils';
import type {
  AppStorage,
  ContentIssue,
  ExerciseOutcome,
  LearningLanguage,
  LessonMode,
  LessonSession,
  StorageError,
  Word,
  WordProgress,
} from './types';
import './styles/app.css';
import './styles/refine.css';

const DictionaryScreen = lazy(() => import('./components/DictionaryScreen'));
const PackDetailScreen = lazy(() =>
  import('./components/PackDetailScreen').then((module) => ({ default: module.PackDetailScreen })),
);
const PacksScreen = lazy(() => import('./components/PacksScreen'));
const ProfileScreen = lazy(() => import('./components/ProfileScreen'));
const StatisticsScreen = lazy(() => import('./components/StatisticsScreen'));
const KanjiRadicalsScreen = lazy(() => import('./components/KanjiRadicalsScreen'));
const KatakanaScreen = lazy(() => import('./components/KatakanaScreen'));
const SpeedRoundScreen = lazy(() => import('./components/SpeedRoundScreen'));
const ReadingScreen = lazy(() => import('./components/ReadingScreen'));

type Screen =
  | 'home'
  | 'lesson'
  | 'result'
  | 'dailyComplete'
  | 'dictionary'
  | 'radicals'
  | 'katakana'
  | 'statistics'
  | 'profile'
  | 'packs'
  | 'packDetail'
  | 'speed'
  | 'reading';

const LATE_FINISH_NOTICE = 'Урок был начат в предыдущий день: ответы сохранены, а сегодняшний урок ещё впереди.';
const STALE_DRAFT_NOTICE = 'Урок прошлого дня остался незавершённым: ваши ответы сохранены. Сегодня начинается новый урок.';

interface PreparedDailyDraft {
  storage: AppStorage;
  draft: LessonDraft | null;
  settled: boolean;
}

/**
 * A daily lesson left unfinished on an earlier day is not resumed as today's
 * lesson: its answers are applied (dated by the last activity), it is recorded
 * as practice without a daily completion, and the draft is removed once the
 * result is safely saved.
 */
function settleStaleDailyDraft(currentStorage: AppStorage, language: LearningLanguage, draft: LessonDraft): PreparedDailyDraft {
  if (draft.outcomes.length === 0 && draft.knownWordIds.length === 0) {
    saveLessonDraft(language, null);
    return { storage: currentStorage, draft: null, settled: false };
  }
  const answeredAt = new Date(draft.updatedAt ?? draft.session.startedAt);
  const settled = finishLessonSession(
    { ...currentStorage, learningLanguage: language },
    draft.session, draft.outcomes, draft.knownWordIds, answeredAt, { partial: true },
  );
  const nextStorage = { ...settled, learningLanguage: currentStorage.learningLanguage };
  if (saveStorage(nextStorage).ok) saveLessonDraft(language, null);
  return { storage: nextStorage, draft: null, settled: true };
}

/** The saved daily draft that may be resumed today, settling a stale one. */
function prepareDailyDraft(currentStorage: AppStorage, language: LearningLanguage, canSave: boolean): PreparedDailyDraft {
  const saved = loadLessonDraft(language);
  const alreadyRecorded = saved
    ? currentStorage.studyHistory.some((entry) => entry.sessionId === saved.session.id && entry.language === language)
    : false;
  if (!saved || alreadyRecorded) return { storage: currentStorage, draft: null, settled: false };
  if (isSessionFromAnotherDay(saved.session, getTodayDateKey())) {
    return canSave ? settleStaleDailyDraft(currentStorage, language, saved) : { storage: currentStorage, draft: null, settled: false };
  }
  const completedToday = getCompletedDailyLesson({ ...currentStorage, learningLanguage: language });
  return { storage: currentStorage, draft: completedToday ? null : saved, settled: false };
}

function App() {
  const [initialState] = useState(() => {
    const storageLoad = loadStorage();
    const prepared = prepareDailyDraft(storageLoad.storage, storageLoad.storage.learningLanguage, !storageLoad.error?.blocksSave);
    return {
      storageLoad: { ...storageLoad, storage: prepared.storage },
      draft: prepared.draft,
      settledStaleDraft: prepared.settled,
    };
  });
  const initialStorageLoad = initialState.storageLoad;
  const initialDraft = initialState.draft;
  const dailyDraftRef = useRef<LessonDraft | null>(initialDraft);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const showShortcutsRef = useRef(showShortcuts);
  showShortcutsRef.current = showShortcuts;
  const [lessonNotice, setLessonNotice] = useState<string | null>(
    initialState.settledStaleDraft ? STALE_DRAFT_NOTICE : null,
  );
  const [today, setToday] = useState(getTodayDateKey);
  const [screen, setScreen] = useState<Screen>('home');
  useEffect(() => {
    const refreshDay = () => setToday(getTodayDateKey());
    const timer = window.setInterval(refreshDay, 60_000);
    window.addEventListener('focus', refreshDay);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refreshDay); };
  }, []);
  const [storage, setStorage] = useState<AppStorage>(initialStorageLoad.storage);
  const [storageError, setStorageError] = useState<StorageError | null>(initialStorageLoad.error);
  // The desktop app keeps a file copy of progress; a newer file (for example
  // after the WebView data was cleared) replaces what localStorage had.
  useEffect(() => {
    let cancelled = false;
    void reconcileWithProgressFile().then((restored) => {
      if (cancelled || !restored) return;
      setStorage(restored);
      setStorageError(null);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const [baseWords, setBaseWords] = useState<Word[]>([]);
  const [session, setSession] = useState<LessonSession | null>(initialDraft?.session ?? null);
  const [stepIndex, setStepIndex] = useState(initialDraft?.stepIndex ?? 0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(initialDraft?.selectedAnswer ?? null);
  const [typedAnswer, setTypedAnswer] = useState(initialDraft?.typedAnswer ?? '');
  // Hints taken on the current task (the key button).
  const [hintsUsed, setHintsUsed] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(initialDraft?.isSubmitted ?? false);
  const [outcomes, setOutcomes] = useState<ExerciseOutcome[]>(initialDraft?.outcomes ?? []);
  const [knownWordIds, setKnownWordIds] = useState<string[]>(initialDraft?.knownWordIds ?? []);
  const [isLoadingWords, setIsLoadingWords] = useState(true);
  const [wordsLoadError, setWordsLoadError] = useState<string | null>(null);
  const [wordsReloadKey, setWordsReloadKey] = useState(0);
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [undoExclusion, setUndoExclusion] = useState<{
    wordId: string;
    label: string;
    kind: 'known' | 'ignored';
    previous: WordProgress | undefined;
  } | null>(null);
  const storageRef = useRef(storage);
  const storageErrorRef = useRef(storageError);

  const starterPacks = useMemo(() => getStarterPacks(storage.learningLanguage), [storage.learningLanguage]);
  const importedPacks = useMemo(
    () => storage.customPacks.filter((pack) => pack.language === storage.learningLanguage),
    [storage.customPacks, storage.learningLanguage],
  );
  const customWords = useMemo(
    () => storage.customWords.filter((word) => word.language === storage.learningLanguage),
    [storage.customWords, storage.learningLanguage],
  );
  const customPackWords = useMemo(() => importedPacks.flatMap((pack) => pack.words), [importedPacks]);
  const words = useMemo(() => [...baseWords, ...customWords, ...customPackWords], [baseWords, customPackWords, customWords]);
  // A pack word that duplicates a dictionary word shares its id, so the pack
  // screens show the progress the learner made on that word in daily lessons.
  const packs = useMemo(
    () => canonicalizePackWords([...starterPacks, ...importedPacks], words),
    [starterPacks, importedPacks, words],
  );
  const selectedPack = useMemo(
    () => (selectedPackId ? packs.find((pack) => pack.id === selectedPackId) ?? null : null),
    [packs, selectedPackId],
  );
  const selectedLessonSourcePack = useMemo(
    () => (storage.lessonSourcePackId ? packs.find((pack) => pack.id === storage.lessonSourcePackId) ?? null : null),
    [packs, storage.lessonSourcePackId],
  );
  const enabledPackIds = useMemo(() => getEnabledPackIds(storage).filter((id) => packs.some((pack) => pack.id === id)), [storage, packs]);
  const wordsById = useMemo(() => new Map(words.map((word) => [word.id, word])), [words]);
  const availableWords = useMemo(() => getActiveWords(words, enabledPackIds), [enabledPackIds, words]);
  const selectedLessonSourceWords = useMemo(() => {
    if (!selectedLessonSourcePack) {
      return null;
    }

    // Merged words keep every pack id, so duplicates of dictionary words are
    // studied (and their progress saved) under one id.
    const packWords = availableWords.filter((word) => word.packIds.includes(selectedLessonSourcePack.id));
    return packWords.length > 0 ? packWords : selectedLessonSourcePack.words;
  }, [availableWords, selectedLessonSourcePack]);
  const lessonSourceWords = selectedLessonSourceWords ?? availableWords;
  const lessonPoolWords = useMemo(
    () => getLessonPoolWords(lessonSourceWords).filter((word) => getWordProgress(storage, word.id).status !== 'ignored'),
    [lessonSourceWords, storage],
  );
  // A chosen topic only decides which NEW words come next. Reviews that are due
  // must keep coming from every active word, otherwise they pile up unseen.
  const dailyLessonWords = useMemo(() => {
    if (!selectedLessonSourceWords) return lessonPoolWords;
    const seen = new Set<string>();
    return [...lessonPoolWords, ...getLessonPoolWords(availableWords)].filter((word) => {
      if (seen.has(word.id) || getWordProgress(storage, word.id).status === 'ignored') return false;
      seen.add(word.id);
      return true;
    });
  }, [availableWords, lessonPoolWords, selectedLessonSourceWords, storage]);
  const progressList = useMemo(() => availableWords.map((word) => getWordProgress(storage, word.id)), [storage, availableWords]);
  const phraseOfTheDay = useMemo(() => getPhraseOfTheDay(availableWords, storage, today), [availableWords, storage, today]);
  // Fixed while the speed round is open, so its questions do not reshuffle.
  const speedWords = useMemo(
    () => (screen === 'speed' ? pickPracticeWords(availableWords, storage, 40) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [screen, availableWords],
  );
  // How today's lesson splits into new words and reviews (shown on Home).
  const dailyBalance = useMemo(
    () => getDailyBalance(
      dailyLessonWords.filter((word) => getWordProgress(storage, word.id).status !== 'known'),
      storage,
      storage.lessonDurationMinutes,
      storage.lessonWordTarget,
      !storage.lessonDurationEnabled,
    ),
    [dailyLessonWords, storage],
  );
  const currentStep = session?.steps[stepIndex] ?? null;
  // When the current task appeared: the time to answer feeds the grade.
  const stepShownAtRef = useRef(Date.now());
  useEffect(() => {
    stepShownAtRef.current = Date.now();
  }, [currentStep?.id, screen]);
  const currentExercise = currentStep?.kind === 'exercise' ? currentStep.exercise : null;
  const currentWord = currentStep ? wordsById.get(currentStep.wordId) ?? null : null;
  const dailyCompletion = getCompletedDailyLesson(storage, today);
  const comfort = getComfort(storage);
  const reportedWordIds = useMemo(() => new Set((storage.contentReports ?? []).map((report) => report.wordId)), [storage.contentReports]);
  const reportContextValue = useMemo(
    () => ({
      report: (word: Word, issue: ContentIssue, note: string) => {
        setStorage((currentStorage) =>
          reportContentIssue(currentStorage, {
            wordId: word.id,
            language: word.language,
            original: word.original,
            translation: word.translation,
            issue,
            note: note.trim() || undefined,
          }),
        );
      },
      isReported: (wordId: string) => reportedWordIds.has(wordId),
    }),
    [reportedWordIds],
  );
  const autoplayEnabled = comfort.autoplay;
  // Read by the components that print Japanese readings, during this render.
  setReadingPreferences({ furigana: comfort.furigana, romaji: comfort.romaji });

  // Text size and calmer motion apply to the whole window.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.textSize = comfort.textSize;
    if (comfort.reduceMotion) root.dataset.motion = 'reduced';
    else delete root.dataset.motion;
  }, [comfort.reduceMotion, comfort.textSize]);

  // Dock badge: reviews due now. Reminder: the next chosen time, skipping
  // today once today's lesson is done. Both refresh every few minutes too,
  // as words come due.
  const hasDailyCompletion = Boolean(dailyCompletion);
  useEffect(() => {
    if (isLoadingWords) return undefined;
    const refresh = () => {
      const now = new Date();
      const dueNow = progressList.filter((progress) => isWordDueForReview(progress, now)).length;
      setDockBadge(comfort.dockBadge ? dueNow : null);
      if (!comfort.reminderTime) {
        scheduleReminder(null);
        return;
      }
      const at = getNextReminderAt(comfort.reminderTime, now, hasDailyCompletion);
      const dueThen = progressList.filter((progress) => isWordDueForReview(progress, at)).length;
      scheduleReminder({ at, ...getReminderText(dueThen, storage.streakDays) });
    };
    refresh();
    const timer = window.setInterval(refresh, 5 * 60_000);
    return () => window.clearInterval(timer);
  }, [comfort.dockBadge, comfort.reminderTime, hasDailyCompletion, isLoadingWords, progressList, storage.streakDays]);
  const lessonProgress = session ? getLessonProgress(session, stepIndex) : null;
  const currentLessonDraft = session ? { session, stepIndex, outcomes, knownWordIds, selectedAnswer, typedAnswer, isSubmitted } : null;
  const pausedDailyDraft = session?.mode === 'default' ? currentLessonDraft : dailyDraftRef.current;

  useEffect(() => {
    if (session?.mode !== 'default') return;
    const draft = { session, stepIndex, outcomes, knownWordIds, selectedAnswer, typedAnswer, isSubmitted, updatedAt: new Date().toISOString() };
    dailyDraftRef.current = draft;
    if (!storageError?.blocksSave && !saveLessonDraft(storage.learningLanguage, draft)) {
      setLessonNotice('Не удалось сохранить незавершённый урок. Не закрывайте приложение до завершения занятия.');
    }
  }, [session, stepIndex, outcomes, knownWordIds, selectedAnswer, typedAnswer, isSubmitted, storage.learningLanguage, storageError?.blocksSave]);
  useEffect(() => {
    let isMounted = true;
    setIsLoadingWords(true);
    setWordsLoadError(null);

    void loadWords(storage.learningLanguage)
      .then((nextWords) => {
        if (!isMounted) {
          return;
        }

        setBaseWords(nextWords);
      })
      .catch(() => {
        if (isMounted) {
          setBaseWords([]);
          setWordsLoadError('Не удалось загрузить словарь. Проверьте соединение и попробуйте ещё раз.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingWords(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [storage.learningLanguage, wordsReloadKey]);

  // A new screen or a new lesson step starts at the top, not where the
  // previous page was scrolled to.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [screen, stepIndex]);

  useEffect(() => {
    if (!undoExclusion) return undefined;
    const timeoutId = window.setTimeout(() => setUndoExclusion(null), 12_000);
    return () => window.clearTimeout(timeoutId);
  }, [undoExclusion]);

  useEffect(() => {
    storageRef.current = storage;
    storageErrorRef.current = storageError;
  }, [storage, storageError]);

  useEffect(() => {
    if (storageError?.blocksSave) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      const result = saveStorage(storage);
      if (!result.ok) {
        setStorageError(result.error);
      }
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [storage, storageError?.blocksSave]);

  // Voice and speed chosen in the profile apply to every playback.
  useEffect(() => {
    setSpeechPreferences(storage.speech);
  }, [storage.speech]);

  const restoringBackupRef = useRef(false);

  useEffect(() => {
    const persistLatestStorage = () => {
      // A restored copy is already saved; the page is reloading onto it.
      if (restoringBackupRef.current) return;
      if (!storageErrorRef.current?.blocksSave) {
        void saveStorage(withUnfinishedPracticeRef.current(storageRef.current));
      }
    };

    window.addEventListener('pagehide', persistLatestStorage);
    window.addEventListener('beforeunload', persistLatestStorage);

    return () => {
      window.removeEventListener('pagehide', persistLatestStorage);
      window.removeEventListener('beforeunload', persistLatestStorage);
      persistLatestStorage();
    };
  }, []);

  useEffect(() => {
    if (!storage.lessonSourcePackId || packs.some((pack) => pack.id === storage.lessonSourcePackId)) {
      return;
    }

    setStorage((currentStorage) => setLessonSourcePackPreference(currentStorage, null));
  }, [packs, storage.lessonSourcePackId]);

  useEffect(() => {
    if (words.length === 0) {
      return;
    }

    setStorage((currentStorage) => {
      let changed = false;
      let nextStorage = currentStorage;

      packs.forEach((pack) => {
        const derivedStatus = derivePackStatus(pack, currentStorage);
        const storedStatus = currentStorage.packStates[pack.id]?.status ?? 'not_added';

        if (storedStatus !== derivedStatus) {
          nextStorage = setWordPackStatus(nextStorage, pack.id, derivedStatus);
          changed = true;
        }
      });

      return changed ? nextStorage : currentStorage;
    });
  }, [packs, words.length, storage.progressByWordId, storage.packStates]);

  useEffect(() => {
    if (screen !== 'lesson' || !currentStep || !currentWord) {
      return undefined;
    }

    if (currentStep.kind === 'exercise' && (currentStep.exercise.type === 'audio_sentence_choice' || currentStep.exercise.type === 'sentence_dictation')) {
      void playTextAudio(currentWord.example_original, currentWord.language);
      return () => {
        stopAudio();
      };
    }

    // Listening tasks always play; the word card only when autoplay is on.
    const shouldAutoplay = currentStep.kind === 'preview'
      ? autoplayEnabled
      : currentStep.exercise.type === 'audio_to_translation_choice' || currentStep.exercise.type === 'audio_to_original_input';

    if (!shouldAutoplay) {
      return undefined;
    }

    void playWordAudio(currentWord);

    return () => {
      stopAudio();
    };
  }, [autoplayEnabled, currentStep, currentWord, screen]);

  const mistakeWords = useMemo(() => {
    const incorrectWordIds = Array.from(
      new Set(outcomes.filter((outcome) => !outcome.isCorrect).map((outcome) => outcome.wordId)),
    );

    return incorrectWordIds
      .map((wordId) => wordsById.get(wordId))
      .filter((word): word is Word => Boolean(word));
  }, [outcomes, wordsById]);

  function resetExerciseState() {
    setSelectedAnswer(null);
    setTypedAnswer('');
    setIsSubmitted(false);
    setHintsUsed(0);
  }

  /** «Пропустить»: on to the next step without an answer; the word is not marked. */
  function skipExercise() {
    if (!session || currentStep?.kind !== 'exercise' || isSubmitted) return;
    stopAudio();
    if (stepIndex >= session.steps.length - 1) {
      finishLesson(session);
      return;
    }
    setStepIndex((current) => current + 1);
    resetExerciseState();
  }

  function reportStorageMutationError(error: unknown) {
    setStorageError({
      kind: 'write',
      message: error instanceof Error ? error.message : 'Не удалось изменить локальные данные.',
      blocksSave: false,
    });
  }

  function clearSessionState(nextScreen: Screen = 'home', options?: { preserveOutcomes?: boolean }) {
    setSession(null);
    if (!options?.preserveOutcomes) {
      setOutcomes([]);
    }
    setKnownWordIds([]);
    setStepIndex(0);
    resetExerciseState();
    stopAudio();
    setScreen(nextScreen);
  }

  // Extra practice, pack and mistake sessions have no recovery draft. When one
  // is replaced or the app closes, its answers are committed instead of lost.
  function withUnfinishedPractice(currentStorage: AppStorage): AppStorage {
    if (!session || session.mode === 'default' || (outcomes.length === 0 && knownWordIds.length === 0)) return currentStorage;
    return finishLessonSession(currentStorage, session, outcomes, knownWordIds, new Date(), { partial: true });
  }
  function commitUnfinishedPractice() {
    // Synchronous on purpose: callers may go on to finishLesson(), which saves
    // from storageRef and would overwrite a deferred functional update.
    const nextStorage = withUnfinishedPractice(storageRef.current);
    if (nextStorage === storageRef.current) return;
    storageRef.current = nextStorage;
    setStorage(nextStorage);
  }
  const withUnfinishedPracticeRef = useRef(withUnfinishedPractice);
  withUnfinishedPracticeRef.current = withUnfinishedPractice;

  function resumeDraft(draft: LessonDraft) {
    if (session && session.mode !== 'default' && session.id !== draft.session.id) commitUnfinishedPractice();
    if (draft.session.steps.some((step) => !wordsById.has(step.wordId))) {
      setLessonNotice('Состав словаря изменился. Начните новый урок — сохранённые результаты остаются в профиле.');
      if (draft.session.mode === 'default') {
        dailyDraftRef.current = null;
        saveLessonDraft(storage.learningLanguage, null);
      }
      setSession(null);
      return false;
    }
    let nextSession = draft.session;
    const nextIndex = draft.stepIndex + (draft.isSubmitted ? 1 : 0);
    const removedIds = new Set(nextSession.steps.slice(nextIndex).filter((step) =>
      ['known', 'ignored'].includes(getWordProgress(storageRef.current, step.wordId).status),
    ).map((step) => step.wordId));
    removedIds.forEach((id) => { nextSession = removeUpcomingWord(nextSession, nextIndex, id); });
    if (nextIndex >= nextSession.steps.length && !draft.isSubmitted) {
      finishLesson(nextSession, draft.outcomes, draft.knownWordIds);
      return true;
    }
    setSession(nextSession);
    setStepIndex(draft.stepIndex);
    setOutcomes(draft.outcomes);
    setKnownWordIds(draft.knownWordIds);
    const sameStep = nextSession.steps[draft.stepIndex]?.id === draft.session.steps[draft.stepIndex]?.id;
    setSelectedAnswer(sameStep ? draft.selectedAnswer : null);
    setTypedAnswer(sameStep ? draft.typedAnswer : '');
    setIsSubmitted(sameStep && draft.isSubmitted);
    setLessonNotice(null);
    setScreen('lesson');
    return true;
  }

  function startLesson(mode: LessonMode, options?: { wordIds?: string[]; title?: string; packId?: string; quick?: boolean; listening?: boolean }) {
    let currentStorage = storageRef.current;
    let settledStaleDraft = false;
    if (mode === 'default' && dailyDraftRef.current && isSessionFromAnotherDay(dailyDraftRef.current.session, getTodayDateKey())) {
      if (storageErrorRef.current?.blocksSave) {
        setLessonNotice('Сначала нужно разобраться с сохранением прогресса — вчерашний урок пока не закрыт.');
        return;
      }
      if (session?.mode === 'default') clearSessionState('home');
      const prepared = settleStaleDailyDraft(currentStorage, currentStorage.learningLanguage, dailyDraftRef.current);
      dailyDraftRef.current = null;
      currentStorage = prepared.storage;
      storageRef.current = currentStorage;
      setStorage(currentStorage);
      settledStaleDraft = prepared.settled;
      if (prepared.settled) setLessonNotice(STALE_DRAFT_NOTICE);
    }

    if (mode === 'default' && getCompletedDailyLesson(currentStorage)) {
      setScreen('dailyComplete');
      return;
    }

    if (mode === 'default' && dailyDraftRef.current && resumeDraft(dailyDraftRef.current)) return;
    // An unfinished practice of the same kind is resumed («5 минут» and the
    // regular extra lesson are different kinds).
    const kindOf = (title?: string) => (title === QUICK_REVIEW_TITLE ? 'quick' : title === LISTENING_TITLE ? 'listening' : 'extra');
    const sameKind = kindOf(session?.title) === (options?.quick ? 'quick' : options?.listening ? 'listening' : 'extra');
    if (session?.mode === mode && session.presentation === 'standard' && mode !== 'pack' && mode !== 'default' && sameKind) {
      if (currentLessonDraft && resumeDraft(currentLessonDraft)) return;
    }
    if (!settledStaleDraft) setLessonNotice(null);
    if (mode !== 'pack' && (mode === 'default' ? dailyLessonWords : lessonPoolWords).length === 0 && !options?.wordIds?.length) {
      if (mode === 'default') setScreen('dailyComplete');
      else setLessonNotice('Для практики пока нет слов. Добавьте слова или выберите другой пак.');
      return;
    }

    if (mode === 'pack' && words.length === 0) {
      return;
    }

    const lessonWordsBase =
      (options?.wordIds && options.wordIds.length > 0) || options?.quick || options?.listening
        ? words
        : mode === 'default'
          ? dailyLessonWords
          : mode === 'pack' && options?.packId
            ? words.filter((word) => word.packIds.includes(options.packId!))
            : lessonPoolWords;
    const lessonWords = lessonWordsBase.filter((word) => {
      const status = getWordProgress(currentStorage, word.id).status;
      return status !== 'ignored' && status !== 'known';
    });
    const activePackIds =
      mode === 'pack' && options?.packId
        ? Array.from(new Set([...enabledPackIds, options.packId]))
        : selectedLessonSourcePack
          ? Array.from(new Set([...enabledPackIds, selectedLessonSourcePack.id]))
          : enabledPackIds;
    const nextSession = createLessonSession({
      mode,
      words: lessonWords,
      storage: currentStorage,
      durationMinutes: currentStorage.lessonDurationMinutes,
      wordTarget: currentStorage.lessonWordTarget,
      useFullPool: !currentStorage.lessonDurationEnabled,
      wordIds: options?.wordIds,
      newWordIds: mode === 'default' && selectedLessonSourceWords ? lessonPoolWords.map((word) => word.id) : undefined,
      activePackIds,
      title: options?.title ?? (mode === 'default' && selectedLessonSourcePack ? `Урок: ${selectedLessonSourcePack.title}` : undefined),
      quick: options?.quick,
      listening: options?.listening,
    });

    if (!nextSession) {
      if (mode === 'default') {
        // No new quota and no scheduled reviews: show an honest no-due state,
        // but do not create a completion/history/streak record.
        setScreen('dailyComplete');
      } else if (options?.quick || options?.listening) {
        setLessonNotice('Пока нечего повторять — начните с урока дня.');
      } else {
        setLessonNotice('Все слова в этой подборке уже известны или исключены. Выберите другую тему в разделе «Темы».');
      }
      return;
    }

    commitUnfinishedPractice();
    const sourcePackId = options?.packId ?? selectedLessonSourcePack?.id;
    if (sourcePackId) setStorage((current) => addWordPack(current, sourcePackId));
    nextSession.activePackIds = [...new Set(nextSession.sourceWordIds.flatMap((id) => wordsById.get(id)?.packIds ?? []))]
      .filter((id) => enabledPackIds.includes(id) || id === sourcePackId);
    setSession(nextSession);
    setOutcomes([]);
    setKnownWordIds([]);
    setStepIndex(0);
    resetExerciseState();
    startTransition(() => {
      setScreen('lesson');
    });
  }

  function startFlashcards(mode: 'extra' | 'pack', options?: { title?: string; packId?: string }) {
    setLessonNotice(null);
    if (session?.mode === mode && session.presentation === 'flashcards' && mode !== 'pack') {
      if (currentLessonDraft && resumeDraft(currentLessonDraft)) return;
    }
    if (mode !== 'pack' && lessonPoolWords.length === 0) {
      setLessonNotice('Для карточек пока нет слов. Добавьте слова или выберите другой пак.');
      return;
    }

    if (mode === 'pack' && words.length === 0) {
      return;
    }

    const flashcardWordsBase =
      mode === 'pack' && options?.packId
        ? words.filter((word) => word.packIds.includes(options.packId!))
        : lessonPoolWords;
    const flashcardWords = flashcardWordsBase.filter((word) => {
      const status = getWordProgress(storage, word.id).status;
      return status !== 'ignored' && status !== 'known';
    });
    const nextSession = createFlashcardSession({
      mode,
      words: flashcardWords,
      storage,
      durationMinutes: storage.lessonDurationMinutes,
      wordTarget: storage.lessonWordTarget,
      useFullPool: !storage.lessonDurationEnabled,
      activePackIds:
        mode === 'pack' && options?.packId ? Array.from(new Set([...enabledPackIds, options.packId])) : enabledPackIds,
      title: options?.title,
    });

    if (!nextSession) {
      setLessonNotice('В этой подборке нет слов для карточек. Выберите другой пак или добавьте новые слова.');
      return;
    }
    commitUnfinishedPractice();
    const sourcePackId = options?.packId ?? selectedLessonSourcePack?.id;
    if (sourcePackId) setStorage((current) => addWordPack(current, sourcePackId));
    nextSession.activePackIds = [...new Set(nextSession.sourceWordIds.flatMap((id) => wordsById.get(id)?.packIds ?? []))]
      .filter((id) => enabledPackIds.includes(id) || id === sourcePackId);
    setSession(nextSession);
    setOutcomes([]);
    setKnownWordIds([]);
    setStepIndex(0);
    resetExerciseState();
    startTransition(() => {
      setScreen('lesson');
    });
  }

  function handleSubmit(answer: string) {
    if (!currentExercise || isSubmitted) {
      return;
    }

    const isWordInputExercise =
      currentExercise.type === 'audio_to_original_input' ||
      currentExercise.type === 'translation_to_original_input' ||
      currentExercise.type === 'sentence_cloze_input';
    const dictation = currentExercise.type === 'sentence_dictation' ? checkDictation(answer, currentExercise.correctAnswer) : null;
    const isExactMatch = dictation
      ? dictation === 'exact'
      : currentExercise.type === 'kanji_to_hiragana_input'
        ? isJapaneseReadingMatch(answer, currentExercise.correctAnswer, currentWord ?? undefined)
        : isWordInputExercise
          ? isAnswerMatch(answer, currentExercise.correctAnswer, currentWord?.language ?? 'french', currentWord ?? undefined)
          : answer === currentExercise.correctAnswer;
    // A one-letter typo in a longer French word counts, as «почти верно».
    const nearMiss = dictation === 'near' || (
      !isExactMatch &&
      isWordInputExercise &&
      (currentWord?.language ?? 'french') === 'french' &&
      isFrenchNearMiss(answer, currentExercise.correctAnswer));
    const isCorrect = isExactMatch || nearMiss;

    const outcome: ExerciseOutcome = {
      exerciseId: currentExercise.id,
      wordId: currentExercise.wordId,
      type: currentExercise.type,
      userAnswer: answer,
      correctAnswer: currentExercise.correctAnswer,
      isCorrect,
      responseMs: Math.max(0, Date.now() - stepShownAtRef.current),
      ...(nearMiss ? { nearMiss: true } : {}),
      ...(hintsUsed > 0 ? { hinted: true } : {}),
    };

    setOutcomes((current) => [...current, outcome]);
    setSelectedAnswer(answer);
    setIsSubmitted(true);

    if (!isCorrect && session && currentWord) {
      setSession((currentSession) =>
        currentSession
          ? scheduleExerciseRetry(currentSession, stepIndex, currentExercise, currentWord)
          : currentSession,
      );
    }

    const selectedOptionWordId = currentExercise.options?.find((option) => option.label === answer)?.id;
    const selectedOriginalWord =
      (currentExercise.type === 'translation_to_original_choice' || currentExercise.type === 'definition_choice') && selectedOptionWordId
        ? wordsById.get(selectedOptionWordId) ?? null
        : null;
    const resultAudioWord = selectedOriginalWord ?? currentWord;

    // With autoplay off, sound plays only on request (R or the speaker buttons).
    if (!autoplayEnabled) return;
    if (currentWord && (currentExercise.type === 'sentence_order' || currentExercise.type === 'audio_sentence_choice' || currentExercise.type === 'sentence_dictation')) {
      // The whole sentence was the task: hear it again, not the single word.
      void playTextAudio(currentWord.example_original, currentWord.language);
    } else if (resultAudioWord) {
      void playWordAudio(resultAudioWord, { force: true });
    }
  }

  function finishLesson(
    activeSession: LessonSession,
    lessonOutcomes = outcomes,
    manuallyKnownWordIds = knownWordIds,
  ) {
    const nextStorage = finishLessonSession(storageRef.current, activeSession, lessonOutcomes, manuallyKnownWordIds);
    storageRef.current = nextStorage;
    setStorage(nextStorage);
    const saved = !storageErrorRef.current?.blocksSave ? saveStorage(nextStorage) : null;
    if (saved && !saved.ok) setStorageError(saved.error);
    if (activeSession.mode === 'default') {
      dailyDraftRef.current = null;
      // Persist the completion before removing its recovery checkpoint.
      if (saved?.ok) saveLessonDraft(storage.learningLanguage, null);
    }

    const finishedAsDaily = activeSession.mode === 'default' && !isSessionFromAnotherDay(activeSession, getTodayDateKey());
    if (activeSession.mode === 'default' && !finishedAsDaily) setLessonNotice(LATE_FINISH_NOTICE);
    clearSessionState(finishedAsDaily ? 'dailyComplete' : activeSession.mode === 'default' ? 'home' : 'result', { preserveOutcomes: true });
  }

  function goToNextStep() {
    if (!session || (currentStep?.kind === 'exercise' && !isSubmitted)) {
      return;
    }

    const isLastStep = stepIndex >= session.steps.length - 1;

    if (isLastStep) {
      finishLesson(session);
      return;
    }

    setStepIndex((current) => current + 1);
    resetExerciseState();
  }

  const latestOutcome =
    currentExercise && isSubmitted
      ? [...outcomes].reverse().find((outcome) => outcome.exerciseId === currentExercise.id) ?? null
      : null;

  function markWordKnown(wordId: string): boolean {
    try {
      const updated = markWordAsKnown(storageRef.current, wordId);
      storageRef.current = updated;
      setStorage(updated);
      return true;
    } catch (error) {
      reportStorageMutationError(error);
      return false;
    }
  }

  function handleMarkKnown() {
    if (!session || !currentWord || !currentStep?.allowMarkKnown) {
      return;
    }

    const nextIndex = stepIndex + (isSubmitted ? 1 : 0);
    const nextSession = removeUpcomingWord(session, nextIndex, currentWord.id);
    const nextKnownWordIds = Array.from(new Set([...knownWordIds, currentWord.id]));
    const previous = storageRef.current.progressByWordId[currentWord.id];

    if (!markWordKnown(currentWord.id)) {
      return;
    }
    setUndoExclusion({ wordId: currentWord.id, label: currentWord.original, kind: 'known', previous });
    setKnownWordIds(nextKnownWordIds);
    resetExerciseState();

    if (nextIndex >= nextSession.steps.length) {
      finishLesson(nextSession, outcomes, nextKnownWordIds);
      return;
    }

    setSession(nextSession);
    setStepIndex(nextIndex);
  }

  // The word does not come back into the running lesson (that would reshuffle
  // its steps), but its previous progress is restored for the next lessons.
  function undoLastExclusion() {
    if (!undoExclusion) return;
    const { wordId, previous } = undoExclusion;
    const restored = restoreWordProgress(storageRef.current, wordId, previous);
    storageRef.current = restored;
    setStorage(restored);
    setKnownWordIds((ids) => ids.filter((id) => id !== wordId));
    setUndoExclusion(null);
  }

  function handleIgnoreWord() {
    if (!session || !currentWord) {
      return;
    }

    const nextIndex = stepIndex + (isSubmitted ? 1 : 0);
    const nextSession = removeUpcomingWord(session, nextIndex, currentWord.id);

    const previous = storageRef.current.progressByWordId[currentWord.id];
    const updated = markWordAsIgnored(storageRef.current, currentWord.id);
    storageRef.current = updated;
    setStorage(updated);
    setUndoExclusion({ wordId: currentWord.id, label: currentWord.original, kind: 'ignored', previous });
    resetExerciseState();

    if (nextIndex >= nextSession.steps.length) {
      finishLesson(nextSession);
      return;
    }

    setSession(nextSession);
    setStepIndex(nextIndex);
  }

  function pauseLesson() {
    stopAudio();
    setScreen('home');
  }

  // Lesson keys: Esc pauses (progress stays in the draft), R plays the word
  // again, ? shows the list of keys. Letters are matched by physical key so
  // they work in the Russian layout too, and never while typing an answer.
  const currentWordRef = useRef(currentWord);
  currentWordRef.current = currentWord;
  useEffect(() => {
    if (screen !== 'lesson') {
      setShowShortcuts(false);
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        if (showShortcutsRef.current) {
          setShowShortcuts(false);
          return;
        }
        stopAudio();
        setScreen('home');
        return;
      }
      const typing = event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]');
      if (typing) return;
      if (event.code === 'KeyR' && !event.repeat) {
        event.preventDefault();
        const word = currentWordRef.current;
        if (word) void playWordAudio(word, { force: true });
        return;
      }
      if (event.key === '?' || (event.code === 'Slash' && event.shiftKey)) {
        event.preventDefault();
        setShowShortcuts((value) => !value);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [screen]);

  function handleNavigate(target: 'home' | 'lesson' | 'dictionary' | 'radicals' | 'katakana' | 'statistics' | 'profile' | 'packs') {
    if (target === 'lesson') {
      const dailyDraft = dailyDraftRef.current;
      const dailyDraftIsStale = Boolean(dailyDraft && isSessionFromAnotherDay(dailyDraft.session, getTodayDateKey()));
      if (dailyDraftIsStale && (!session || session.mode === 'default')) {
        startLesson('default');
        return;
      }
      if (session?.mode === 'default' && dailyDraft && resumeDraft(dailyDraft)) return;
      if (currentLessonDraft && resumeDraft(currentLessonDraft)) return;

      if (dailyDraftIsStale) {
        startLesson('default');
        return;
      }
      if (dailyDraft && resumeDraft(dailyDraft)) return;
      setScreen(getCompletedDailyLesson(storage) ? 'dailyComplete' : 'home');
      return;
    }

    stopAudio();
    setLessonNotice(null);
    if (target === 'packs') {
      setSelectedPackId(null);
    }

    startTransition(() => {
      setScreen(target);
    });
  }

  if (isLoadingWords) {
    return (
      <AppShell>
        <section className="app-loading-state" aria-live="polite" aria-busy="true">
          <span className="loading-mark" aria-hidden="true">é</span>
          <div>
            <span className="eyebrow">Почти готово</span>
            <h1 className="hero-title">Подготавливаем словарь</h1>
            <p className="hero-text">
              {`Загружаем ${getLearningLanguageTitle(storage.learningLanguage)} слова, активные паки и локальный прогресс.`}
            </p>
          </div>
          <div className="loading-progress" aria-hidden="true"><span /></div>
        </section>
      </AppShell>
    );
  }

  if (wordsLoadError) {
    return (
      <AppShell>
        <section className="app-loading-state app-error-state" role="alert">
          <span className="loading-mark error" aria-hidden="true">!</span>
          <div>
            <span className="eyebrow">Словарь недоступен</span>
            <h1 className="hero-title">Не получилось запустить обучение</h1>
            <p className="hero-text">{wordsLoadError}</p>
          </div>
          <button type="button" className="primary-button" onClick={() => setWordsReloadKey((key) => key + 1)}>
            Повторить загрузку
          </button>
        </section>
      </AppShell>
    );
  }

  const navScreen = screen === 'dictionary' || screen === 'radicals' || screen === 'katakana' || screen === 'statistics' || screen === 'profile' || screen === 'packs' || screen === 'lesson'
    ? screen
    : screen === 'packDetail'
      ? 'packs'
      : 'home';

  return (
    <ReportContext.Provider value={reportContextValue}>
    <AppShell>
      <div className={screen === 'lesson' ? 'desktop-app-layout lesson-desktop-layout' : 'desktop-app-layout'}>
        <AppNavigation
          activeScreen={navScreen}
          lessonAvailable={lessonPoolWords.length > 0 || Boolean(session)}
          showKanjiRadicals={storage.learningLanguage === 'japanese'}
          streak={getStreakSummary(storage)}
          onNavigate={handleNavigate}
        />

        <main className="desktop-app-content" aria-label={getLearningLanguageProductTitle(storage.learningLanguage)}>
        {storageError ? (
          <section className="app-error-state" role="status" aria-live="polite">
            <strong>Проблема с локальным прогрессом</strong>
            <p>{storageError.message}</p>
            {!storageError.blocksSave || storageError.kind === 'corrupt' ? (
              <button type="button" className="ghost-button" onClick={() => setStorageError(null)}>
                {storageError.blocksSave ? 'Продолжить с текущим состоянием' : 'Понятно'}
              </button>
            ) : null}
          </section>
        ) : null}
        {undoExclusion ? (
          <section className="app-error-state undo-exclusion" role="status" aria-live="polite">
            <p>
              {undoExclusion.kind === 'known'
                ? `«${undoExclusion.label}» отмечено как известное и больше не попадёт в уроки.`
                : `«${undoExclusion.label}» исключено из изучения.`}
            </p>
            <button type="button" className="ghost-button" onClick={undoLastExclusion}>Отменить</button>
            <button type="button" className="ghost-button" onClick={() => setUndoExclusion(null)}>Понятно</button>
          </section>
        ) : null}
        {lessonNotice ? (
          <section className="app-error-state" role="status">
            <p>{lessonNotice}</p>
            {/пак|«Темы»/i.test(lessonNotice) ? (
              <button type="button" className="ghost-button" onClick={() => { setSelectedPackId(null); setScreen('packs'); setLessonNotice(null); }}>Открыть паки</button>
            ) : null}
            <button type="button" className="ghost-button" onClick={() => setLessonNotice(null)}>Понятно</button>
          </section>
        ) : null}
        {screen === 'home' ? (
          <HomeDashboard
            totalWords={availableWords}
            dailyDraft={pausedDailyDraft}
            storage={storage}
            progressList={progressList}
            addedPacksCount={enabledPackIds.length}
            learningLanguage={storage.learningLanguage}
            lessonDurationEnabled={storage.lessonDurationEnabled}
            lessonDurationMinutes={storage.lessonDurationMinutes}
            lessonWordTarget={storage.lessonWordTarget}
            lessonSourcePackId={storage.lessonSourcePackId}
            dailyCompletion={dailyCompletion}
            packs={packs}
            onStartLesson={() => startLesson('default')}
            onStartExtraLesson={() => startLesson('extra')}
            onStartQuickReview={() => startLesson('extra', { quick: true })}
            dailyBalance={dailyBalance}
            onStartFlashcards={() => startFlashcards('extra')}
            onLessonDurationChange={(value) => {
              setStorage((currentStorage) => setLessonDurationPreference(currentStorage, value));
            }}
            onOpenStatistics={() => setScreen('statistics')}
            onOpenProfile={() => setScreen('profile')}
            onOpenPacks={() => {
              setSelectedPackId(null);
              setScreen('packs');
            }}
            onOpenRadicals={() => setScreen('radicals')}
            onOpenSpeed={() => setScreen('speed')}
            onOpenReading={() => setScreen('reading')}
            onStartListening={() => startLesson('extra', { listening: true })}
            speedBest={storage.speedRecords?.[storage.learningLanguage] ?? 0}
            phraseOfTheDay={phraseOfTheDay}
          />
        ) : null}

        {screen === 'lesson' && currentStep && currentWord && session ? (
          <section className="lesson-shell" lang={storage.learningLanguage === 'japanese' ? 'ja' : undefined}>
            <div className="lesson-focus-screen">
              <header className="lesson-session-progress" aria-label="Прогресс текущего урока">
                <div className="lesson-session-row">
                  <button
                    type="button"
                    className="lesson-close-button"
                    aria-label="Приостановить урок и вернуться на главную (Esc)"
                    title="Приостановить урок (Esc)"
                    onClick={pauseLesson}
                  >
                    <AppIcon name="close" size={20} />
                  </button>
                  <div className="lesson-session-heading">
                    <strong>{currentStep.moduleTitle}</strong>
                    <small>
                      Модуль {currentStep.modulePosition} из {currentStep.moduleCount} · шаг {currentStep.indexInModule} из {currentStep.totalInModule}
                    </small>
                  </div>
                  <span className="lesson-session-count" title="Выполнено заданий за урок">
                    {lessonProgress?.completedSteps} из {session.steps.length}
                  </span>
                  {currentStep.kind === 'exercise' && !isSubmitted ? (
                    <button type="button" className="lesson-skip-button" title="Пропустить задание, слово не отмечается" onClick={skipExercise}>
                      Пропустить
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={showShortcuts ? 'lesson-keys-button active' : 'lesson-keys-button'}
                    aria-label="Клавиши"
                    aria-expanded={showShortcuts}
                    title="Клавиши (?)"
                    onClick={() => setShowShortcuts((value) => !value)}
                  >
                    ?
                  </button>
                </div>
                {showShortcuts ? (
                  <dl className="lesson-keys-sheet" aria-label="Клавиши в уроке">
                    <div><dt><kbd>1</kbd>–<kbd>4</kbd></dt><dd>выбрать ответ</dd></div>
                    <div><dt><kbd>Enter</kbd></dt><dd>проверить, дальше</dd></div>
                    <div><dt><kbd>Пробел</kbd></dt><dd>дальше на карточке слова</dd></div>
                    <div><dt><kbd>R</kbd></dt><dd>прослушать слово ещё раз</dd></div>
                    <div><dt><kbd>Esc</kbd></dt><dd>пауза, урок сохранится</dd></div>
                    <div><dt><kbd>?</kbd></dt><dd>показать или скрыть подсказку</dd></div>
                  </dl>
                ) : null}
                <div
                  className="lesson-module-track"
                  role="progressbar"
                  aria-label={`Общий прогресс урока. Модулей завершено: ${lessonProgress?.completedModules ?? 0}, осталось: ${lessonProgress?.remainingModules ?? 0}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={lessonProgress?.percent ?? 0}
                >
                  {Array.from({ length: currentStep.moduleCount }, (_, index) => {
                    const position = index + 1;
                    const fill = position < currentStep.modulePosition
                      ? 100
                      : position === currentStep.modulePosition
                        ? Math.round(((currentStep.indexInModule - 1) / Math.max(1, currentStep.totalInModule)) * 100)
                        : 0;
                    return (
                      <span key={position} className={position === currentStep.modulePosition ? 'current' : undefined}>
                        <i style={{ width: `${fill}%` }} />
                      </span>
                    );
                  })}
                </div>
              </header>
              {currentStep.kind === 'exercise' ? (
                currentExercise?.type === 'memory_check' ? (
                  <MemoryCheckExercise
                    key={currentStep.id}
                    exercise={currentExercise}
                    word={currentWord}
                    isSubmitted={isSubmitted}
                    selectedAnswer={selectedAnswer}
                    onSelect={(answer) => {
                      setSelectedAnswer(answer);
                      handleSubmit(answer);
                    }}
                    onReplayAudio={() => {
                      void playWordAudio(currentWord);
                    }}
                    onMarkKnown={currentStep.allowMarkKnown ? handleMarkKnown : undefined}
                    onIgnoreWord={handleIgnoreWord}
                    onNext={goToNextStep}
                  />
                ) : currentExercise?.type === 'sentence_order' ? (
                  <SentenceOrderExercise
                    key={currentStep.id}
                    exercise={currentExercise}
                    word={currentWord}
                    isSubmitted={isSubmitted}
                    selectedAnswer={selectedAnswer}
                    onSubmit={(answer) => handleSubmit(answer)}
                    onMarkKnown={currentStep.allowMarkKnown ? handleMarkKnown : undefined}
                    onIgnoreWord={handleIgnoreWord}
                    onNext={goToNextStep}
                  />
                ) : currentExercise?.type === 'letter_assembly' ? (
                  <LetterAssemblyExercise
                    key={currentStep.id}
                    exercise={currentExercise}
                    word={currentWord}
                    isSubmitted={isSubmitted}
                    selectedAnswer={selectedAnswer}
                    hintsUsed={hintsUsed}
                    onHint={() => setHintsUsed((count) => count + 1)}
                    onSubmit={(answer) => handleSubmit(answer)}
                    onMarkKnown={currentStep.allowMarkKnown ? handleMarkKnown : undefined}
                    onIgnoreWord={handleIgnoreWord}
                    onNext={goToNextStep}
                  />
                ) : currentExercise?.options ? (
                  <MultipleChoiceExercise
                    key={currentStep.id}
                    exercise={currentExercise}
                    word={currentWord}
                    selectedAnswer={selectedAnswer}
                    isSubmitted={isSubmitted}
                    onSelect={(answer) => {
                      setSelectedAnswer(answer);
                      handleSubmit(answer);
                    }}
                    onReplayAudio={() => {
                      if (currentExercise.type === 'audio_sentence_choice') void playTextAudio(currentWord.example_original, currentWord.language);
                      else void playWordAudio(currentWord);
                    }}
                    onMarkKnown={currentStep.allowMarkKnown ? handleMarkKnown : undefined}
                    onIgnoreWord={handleIgnoreWord}
                    hintsUsed={hintsUsed}
                    onHint={() => setHintsUsed((count) => count + 1)}
                    onNext={goToNextStep}
                  />
                ) : currentExercise ? (
                  <TextInputExercise
                    key={currentStep.id}
                    exercise={currentExercise}
                    word={currentWord}
                    value={typedAnswer}
                    isSubmitted={isSubmitted}
                    isCorrect={latestOutcome?.isCorrect}
                    nearMiss={latestOutcome?.nearMiss}
                    onChange={setTypedAnswer}
                    hintsUsed={hintsUsed}
                    onHint={() => setHintsUsed((count) => count + 1)}
                    onSubmit={() => handleSubmit(typedAnswer)}
                    onReplayAudio={() => {
                      if (currentExercise.type === 'sentence_dictation') void playTextAudio(currentWord.example_original, currentWord.language);
                      else void playWordAudio(currentWord);
                    }}
                    onMarkKnown={currentStep.allowMarkKnown ? handleMarkKnown : undefined}
                    onIgnoreWord={handleIgnoreWord}
                    onNext={goToNextStep}
                  />
                ) : null
              ) : session.presentation === 'flashcards' ? (
                <FlashcardView
                  key={currentStep.id}
                  word={currentWord}
                  current={currentStep.indexInModule}
                  total={currentStep.totalInModule}
                  onReplayAudio={() => {
                    void playWordAudio(currentWord);
                  }}
                  onMarkKnown={currentStep.allowMarkKnown ? handleMarkKnown : undefined}
                  onIgnoreWord={handleIgnoreWord}
                  onDefer={goToNextStep}
                  onNext={goToNextStep}
                />
              ) : (
                <LessonWordPreview
                  key={currentStep.id}
                  word={currentWord}
                  current={currentStep.indexInModule}
                  total={currentStep.totalInModule}
                  onReplayAudio={() => {
                    void playWordAudio(currentWord);
                  }}
                  onMarkKnown={currentStep.allowMarkKnown ? handleMarkKnown : undefined}
                  onIgnoreWord={handleIgnoreWord}
                  onNext={goToNextStep}
                />
              )}
            </div>
          </section>
        ) : null}

        {screen === 'result' ? (
          <LessonResult
            outcomes={outcomes}
            mistakeWords={mistakeWords}
            onRepeatMistakes={() => startLesson('mistakes', { wordIds: mistakeWords.map((word) => word.id) })}
            onFinish={() => {
              clearSessionState('home');
            }}
          />
        ) : null}

        {screen === 'dailyComplete' ? (
          <DailyCompletionScreen
            completion={dailyCompletion}
            words={availableWords}
            lessonDurationMinutes={storage.lessonDurationMinutes}
            onLessonDurationChange={(value) => {
              setStorage((currentStorage) => setLessonDurationPreference(currentStorage, value));
            }}
            onContinueLearning={() => startLesson('extra')}
            onOpenDictionary={() => setScreen('dictionary')}
            onReviewDifficult={() => startLesson('mistakes', { wordIds: dailyCompletion?.difficultWordIds ?? [] })}
            onBackHome={() => setScreen('home')}
          />
        ) : null}

        <Suspense fallback={<section className="hero-card">Открываем раздел…</section>}>
          {screen === 'dictionary' ? (
            <DictionaryScreen
              learningLanguage={storage.learningLanguage}
              words={availableWords}
              storage={storage}
              packs={packs}
              onMarkWordKnown={(wordId) => markWordKnown(wordId)}
              onRestoreWord={(wordId) => {
                const restored = restoreWordToLearning(storageRef.current, wordId);
                storageRef.current = restored;
                setStorage(restored);
              }}
              onAddWord={(word) => {
                const customWord: Word = {
                  ...word,
                  id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                  language: storage.learningLanguage,
                  audio_original: '',
                  packIds: [],
                  source: 'custom',
                };

                try {
                  setStorage(addCustomWord(storageRef.current, customWord));
                  return true;
                } catch (error) {
                  reportStorageMutationError(error);
                  return false;
                }
              }}
            />
          ) : null}
          {screen === 'packs' ? (
            <PacksScreen
              learningLanguage={storage.learningLanguage}
              packs={packs}
              storage={storage}
              onAddPack={(packId) => {
                setStorage((currentStorage) => addWordPack(currentStorage, packId));
              }}
              onImportPack={(title, rawText) => {
                const importedPack = parseImportedPack({ title, rawText, language: storage.learningLanguage });

                if (!importedPack) {
                  return {
                    ok: false,
                    reason: 'Не удалось распознать ни одной пары «слово — перевод». Проверьте разделители TAB, «;», «,» или « - ».',
                  };
                }

                try {
                  // Validate against the rendered state first; the update itself stays functional to avoid stale writes.
                  addCustomPack(storage, importedPack);
                  setStorage((currentStorage) => addCustomPack(currentStorage, importedPack));
                  return { ok: true, importedWords: importedPack.words.length };
                } catch (error) {
                  reportStorageMutationError(error);
                  return {
                    ok: false,
                    reason: error instanceof Error ? error.message : 'Не удалось сохранить пак в локальном хранилище. Данные формы сохранены.',
                  };
                }
              }}
              onOpenPack={(packId) => {
                setSelectedPackId(packId);
                setScreen('packDetail');
              }}
            />
          ) : null}
          {screen === 'packDetail' && selectedPack ? (
            <PackDetailScreen
              pack={selectedPack}
              storage={storage}
              lessonDurationMinutes={storage.lessonDurationMinutes}
              onLessonDurationChange={(value) => {
                setStorage((currentStorage) => setLessonDurationPreference(currentStorage, value));
              }}
              onBack={() => {
                setScreen('packs');
              }}
              onAddPack={(packId) => {
                setStorage((currentStorage) => addWordPack(currentStorage, packId));
              }}
              onRemovePack={storage.customPacks.some((item) => item.id === selectedPack.id) ? (packId) => {
                const updated = removeCustomPack(storageRef.current, packId);
                storageRef.current = updated;
                setStorage(updated);
                setSelectedPackId(null);
                setScreen('packs');
              } : undefined}
              onStartPackLesson={(packId) => {
                const pack = packs.find((item) => item.id === packId);

                if (!pack) {
                  return;
                }

                startLesson('pack', { packId, title: `Пак: ${pack.title}` });
              }}
              onStartPackFlashcards={(packId) => {
                const pack = packs.find((item) => item.id === packId);

                if (!pack) {
                  return;
                }

                startFlashcards('pack', { packId, title: `Карточки: ${pack.title}` });
              }}
            />
          ) : null}
          {screen === 'profile' ? (
            <ProfileScreen
              learningLanguage={storage.learningLanguage}
              profile={storage.profile}
              storage={storage}
              progressList={progressList}
              packs={packs}
              lessonDurationEnabled={storage.lessonDurationEnabled}
              lessonDurationMinutes={storage.lessonDurationMinutes}
              lessonWordTarget={storage.lessonWordTarget}
              lessonSourcePackId={storage.lessonSourcePackId}
              onExportBackup={() => exportStorageSnapshot(storageRef.current)}
              onRemoveContentReport={(wordId, issue) => {
                setStorage((currentStorage) => removeContentReport(currentStorage, wordId, issue));
              }}
              onImportBackup={(raw) => {
                try {
                  const restored = importStorageSnapshot(raw);
                  const saved = saveStorage(restored);
                  if (!saved.ok) return saved.error.message;
                  // The unload handler would write the old progress (and an
                  // unfinished practice session) back over the restored copy.
                  restoringBackupRef.current = true;
                  storageRef.current = restored;
                  // Drafts belong to the replaced progress; start clean.
                  saveLessonDraft('french', null);
                  saveLessonDraft('japanese', null);
                  window.location.reload();
                  return null;
                } catch (error) {
                  return error instanceof Error ? error.message : 'Не удалось восстановить копию.';
                }
              }}
              onProfileNameChange={(value) => {
                setStorage((currentStorage) => updateProfileName(currentStorage, value));
              }}
              onLearningLanguageChange={(value) => {
                commitUnfinishedPractice();
                clearSessionState('profile');
                const prepared = prepareDailyDraft(storageRef.current, value, !storageErrorRef.current?.blocksSave);
                dailyDraftRef.current = prepared.draft;
                if (prepared.settled) {
                  storageRef.current = prepared.storage;
                  setStorage(prepared.storage);
                  setLessonNotice(STALE_DRAFT_NOTICE);
                }
                setSelectedPackId(null);
                setBaseWords([]);
                setIsLoadingWords(true);
                setStorage((currentStorage) => setLearningLanguagePreference(currentStorage, value));
              }}
              onLessonDurationEnabledChange={(value) => {
                setStorage((currentStorage) => setLessonDurationEnabledPreference(currentStorage, value));
              }}
              onLessonDurationChange={(value) => {
                setStorage((currentStorage) => setLessonDurationPreference(currentStorage, value));
              }}
              onLessonWordTargetChange={(value) => {
                setStorage((currentStorage) => setLessonWordTargetPreference(currentStorage, value));
              }}
              onLessonSourcePackChange={(packId) => {
                setStorage((currentStorage) => setLessonSourcePackPreference(currentStorage, packId));
              }}
              onSpeechChange={(change) => {
                setStorage((currentStorage) => setSpeechPreference(currentStorage, change));
              }}
              comfort={comfort}
              onComfortChange={(change) => {
                setStorage((currentStorage) => setComfortPreference(currentStorage, change));
              }}
              dayStartHour={storage.dayStartHour}
              desiredRetention={storage.desiredRetention}
              onDesiredRetentionChange={(retention) => {
                setStorage((currentStorage) => setDesiredRetention(currentStorage, retention));
              }}
              onDayStartHourChange={(hour) => {
                setStorage((currentStorage) => setDayStartPreference(currentStorage, hour));
                setDayStartHour(hour);
                setToday(getTodayDateKey());
              }}
            />
          ) : null}
          {screen === 'statistics' ? (
            <StatisticsScreen learningLanguage={storage.learningLanguage} storage={storage} words={availableWords} />
          ) : null}
          {screen === 'katakana' && storage.learningLanguage === 'japanese' ? (
            <KatakanaScreen
              storage={storage}
              onCompleteSession={(kanaOutcomes) => {
                setStorage((currentStorage) => recordKanaSession(currentStorage, kanaOutcomes));
              }}
            />
          ) : null}
          {screen === 'speed' ? (
            <SpeedRoundScreen
              words={speedWords}
              pool={availableWords}
              best={storage.speedRecords?.[storage.learningLanguage] ?? 0}
              language={storage.learningLanguage}
              onFinish={(score) => setStorage((currentStorage) => recordSpeedScore(currentStorage, score))}
              onClose={() => setScreen('home')}
            />
          ) : null}
          {screen === 'reading' ? (
            <ReadingScreen words={availableWords} dictionaryWords={words} storage={storage} onClose={() => setScreen('home')} />
          ) : null}
          {screen === 'radicals' && storage.learningLanguage === 'japanese' ? (
            <KanjiRadicalsScreen
              storage={storage}
              onCompleteSession={(radicalOutcomes) => {
                setStorage((currentStorage) => recordRadicalStudySession(currentStorage, radicalOutcomes));
              }}
            />
          ) : null}
        </Suspense>
        </main>
      </div>
    </AppShell>
    </ReportContext.Provider>
  );
}

export default App;
