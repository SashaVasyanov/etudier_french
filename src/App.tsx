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
import { MultipleChoiceExercise } from './components/MultipleChoiceExercise';
import { getLessonPoolWords, getStarterPacks, loadWords } from './data/words';
import { playWordAudio, stopAudio } from './lib/audio';
import { createFlashcardSession, createLessonSession, scheduleExerciseRetry } from './lib/exercises';
import {
  getLearningLanguageProductTitle,
  getLearningLanguageTitle,
} from './lib/languages';
import { derivePackStatus, getActiveWords, getEnabledPackIds } from './lib/packs';
import { finishLessonSession, getLessonProgress, removeUpcomingWord } from './lib/lessonSession';
import { loadLessonDraft, saveLessonDraft, type LessonDraft } from './lib/lessonDraft';
import {
  addCustomPack,
  addWordPack,
  addCustomWord,
  loadStorage,
  markWordAsIgnored,
  markWordAsKnown,
  recordRadicalStudySession,
  saveStorage,
  setLearningLanguagePreference,
  setLessonDurationEnabledPreference,
  setLessonDurationPreference,
  setLessonSourcePackPreference,
  setLessonWordTargetPreference,
  setWordPackStatus,
  getWordProgress,
  getCompletedDailyLesson,
  getCurrentStreakDays,
  updateProfileName,
} from './lib/storage';
import { parseImportedPack } from './lib/importPacks';
import { getTodayDateKey, isAnswerMatch, isJapaneseReadingMatch } from './lib/utils';
import type {
  AppStorage,
  ExerciseOutcome,
  LessonMode,
  LessonSession,
  StorageError,
  Word,
} from './types';
import './styles/app.css';

const DictionaryScreen = lazy(() => import('./components/DictionaryScreen'));
const PackDetailScreen = lazy(() =>
  import('./components/PackDetailScreen').then((module) => ({ default: module.PackDetailScreen })),
);
const PacksScreen = lazy(() => import('./components/PacksScreen'));
const ProfileScreen = lazy(() => import('./components/ProfileScreen'));
const StatisticsScreen = lazy(() => import('./components/StatisticsScreen'));
const KanjiRadicalsScreen = lazy(() => import('./components/KanjiRadicalsScreen'));

type Screen =
  | 'home'
  | 'lesson'
  | 'result'
  | 'dailyComplete'
  | 'dictionary'
  | 'radicals'
  | 'statistics'
  | 'profile'
  | 'packs'
  | 'packDetail';

function App() {
  const [initialStorageLoad] = useState(() => loadStorage());
  const [initialDraft] = useState(() => {
    const draft = loadLessonDraft(initialStorageLoad.storage.learningLanguage);
    return draft && !initialStorageLoad.storage.studyHistory.some((entry) => entry.sessionId === draft.session.id)
      && !getCompletedDailyLesson(initialStorageLoad.storage) ? draft : null;
  });
  const dailyDraftRef = useRef<LessonDraft | null>(initialDraft);
  const [lessonNotice, setLessonNotice] = useState<string | null>(null);
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
  const [baseWords, setBaseWords] = useState<Word[]>([]);
  const [session, setSession] = useState<LessonSession | null>(initialDraft?.session ?? null);
  const [stepIndex, setStepIndex] = useState(initialDraft?.stepIndex ?? 0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(initialDraft?.selectedAnswer ?? null);
  const [typedAnswer, setTypedAnswer] = useState(initialDraft?.typedAnswer ?? '');
  const [isSubmitted, setIsSubmitted] = useState(initialDraft?.isSubmitted ?? false);
  const [outcomes, setOutcomes] = useState<ExerciseOutcome[]>(initialDraft?.outcomes ?? []);
  const [knownWordIds, setKnownWordIds] = useState<string[]>(initialDraft?.knownWordIds ?? []);
  const [isLoadingWords, setIsLoadingWords] = useState(true);
  const [wordsLoadError, setWordsLoadError] = useState<string | null>(null);
  const [wordsReloadKey, setWordsReloadKey] = useState(0);
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const storageRef = useRef(storage);
  const storageErrorRef = useRef(storageError);

  const starterPacks = useMemo(() => getStarterPacks(storage.learningLanguage), [storage.learningLanguage]);
  const importedPacks = useMemo(
    () => storage.customPacks.filter((pack) => pack.language === storage.learningLanguage),
    [storage.customPacks, storage.learningLanguage],
  );
  const packs = useMemo(() => [...starterPacks, ...importedPacks], [starterPacks, importedPacks]);
  const selectedPack = useMemo(
    () => (selectedPackId ? packs.find((pack) => pack.id === selectedPackId) ?? null : null),
    [packs, selectedPackId],
  );
  const selectedLessonSourcePack = useMemo(
    () => (storage.lessonSourcePackId ? packs.find((pack) => pack.id === storage.lessonSourcePackId) ?? null : null),
    [packs, storage.lessonSourcePackId],
  );
  const enabledPackIds = useMemo(() => getEnabledPackIds(storage).filter((id) => packs.some((pack) => pack.id === id)), [storage, packs]);
  const customWords = useMemo(
    () => storage.customWords.filter((word) => word.language === storage.learningLanguage),
    [storage.customWords, storage.learningLanguage],
  );
  const customPackWords = useMemo(() => importedPacks.flatMap((pack) => pack.words), [importedPacks]);
  const words = useMemo(() => [...baseWords, ...customWords, ...customPackWords], [baseWords, customPackWords, customWords]);
  const wordsById = useMemo(() => new Map(words.map((word) => [word.id, word])), [words]);
  const availableWords = useMemo(() => getActiveWords(words, enabledPackIds), [enabledPackIds, words]);
  const selectedLessonSourceWords = useMemo(() => {
    if (!selectedLessonSourcePack) {
      return null;
    }

    const packWords = words.filter((word) => word.packIds.includes(selectedLessonSourcePack.id));
    return packWords.length > 0 ? packWords : selectedLessonSourcePack.words;
  }, [selectedLessonSourcePack, words]);
  const lessonSourceWords = selectedLessonSourceWords ?? availableWords;
  const lessonPoolWords = useMemo(
    () => getLessonPoolWords(lessonSourceWords).filter((word) => getWordProgress(storage, word.id).status !== 'ignored'),
    [lessonSourceWords, storage],
  );
  const progressList = useMemo(() => availableWords.map((word) => getWordProgress(storage, word.id)), [storage, availableWords]);
  const currentStep = session?.steps[stepIndex] ?? null;
  const currentExercise = currentStep?.kind === 'exercise' ? currentStep.exercise : null;
  const currentWord = currentStep ? wordsById.get(currentStep.wordId) ?? null : null;
  const dailyCompletion = getCompletedDailyLesson(storage, today);
  const lessonProgress = session ? getLessonProgress(session, stepIndex) : null;
  const currentLessonDraft = session ? { session, stepIndex, outcomes, knownWordIds, selectedAnswer, typedAnswer, isSubmitted } : null;
  const pausedDailyDraft = session?.mode === 'default' ? currentLessonDraft : dailyDraftRef.current;

  useEffect(() => {
    if (session?.mode !== 'default') return;
    const draft = { session, stepIndex, outcomes, knownWordIds, selectedAnswer, typedAnswer, isSubmitted };
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

  useEffect(() => {
    const persistLatestStorage = () => {
      if (!storageErrorRef.current?.blocksSave) {
        void saveStorage(storageRef.current);
      }
    };

    window.addEventListener('pagehide', persistLatestStorage);

    return () => {
      window.removeEventListener('pagehide', persistLatestStorage);
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

    const shouldAutoplay =
      currentStep.kind === 'preview' ||
      currentStep.exercise.type === 'audio_to_translation_choice' ||
      currentStep.exercise.type === 'audio_to_original_input';

    if (!shouldAutoplay) {
      return undefined;
    }

    void playWordAudio(currentWord);

    return () => {
      stopAudio();
    };
  }, [currentStep, currentWord, screen]);

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

  function resumeDraft(draft: LessonDraft) {
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
      ['known', 'ignored'].includes(getWordProgress(storage, step.wordId).status),
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

  function startLesson(mode: LessonMode, options?: { wordIds?: string[]; title?: string; packId?: string }) {
    if (mode === 'default' && getCompletedDailyLesson(storage)) {
      setScreen('dailyComplete');
      return;
    }

    if (mode === 'default' && dailyDraftRef.current && resumeDraft(dailyDraftRef.current)) return;
    if (session?.mode === mode && session.presentation === 'standard' && mode !== 'pack' && mode !== 'default') {
      if (currentLessonDraft && resumeDraft(currentLessonDraft)) return;
    }
    setLessonNotice(null);
    if (mode !== 'pack' && lessonPoolWords.length === 0 && !options?.wordIds?.length) {
      if (mode === 'default') setScreen('dailyComplete');
      else setLessonNotice('Для практики пока нет слов. Добавьте слова или выберите другой пак.');
      return;
    }

    if (mode === 'pack' && words.length === 0) {
      return;
    }

    const lessonWordsBase =
      options?.wordIds && options.wordIds.length > 0
        ? words
        : mode === 'default'
          ? lessonPoolWords
          : mode === 'pack' && options?.packId
            ? words.filter((word) => word.packIds.includes(options.packId!))
            : lessonPoolWords;
    const lessonWords = lessonWordsBase.filter((word) => {
      const status = getWordProgress(storage, word.id).status;
      return status !== 'ignored' && status !== 'known';
    });
    const activePackIds =
      mode === 'pack' && options?.packId
        ? Array.from(new Set([...enabledPackIds, options.packId]))
        : selectedLessonSourcePack
          ? Array.from(new Set([...enabledPackIds, selectedLessonSourcePack.id]))
          : enabledPackIds;
    const lessonWordTarget = storage.lessonDurationEnabled ? storage.lessonWordTarget : Math.max(lessonWords.length, 10);
    const nextSession = createLessonSession({
      mode,
      words: lessonWords,
      storage,
      durationMinutes: storage.lessonDurationMinutes,
      wordTarget: lessonWordTarget,
      useFullPool: !storage.lessonDurationEnabled,
      wordIds: options?.wordIds,
      activePackIds,
      title: options?.title ?? (mode === 'default' && selectedLessonSourcePack ? `Урок: ${selectedLessonSourcePack.title}` : undefined),
    });

    if (!nextSession) {
      if (mode === 'default') {
        // No new quota and no scheduled reviews: show an honest no-due state,
        // but do not create a completion/history/streak record.
        setScreen('dailyComplete');
      } else {
        setLessonNotice('Все слова в этой подборке уже известны или исключены. Выберите другую тему в разделе «Темы».');
      }
      return;
    }

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
    const flashcardWordTarget = storage.lessonDurationEnabled ? storage.lessonWordTarget : Math.max(flashcardWords.length, 10);
    const nextSession = createFlashcardSession({
      mode,
      words: flashcardWords,
      storage,
      durationMinutes: storage.lessonDurationMinutes,
      wordTarget: flashcardWordTarget,
      useFullPool: !storage.lessonDurationEnabled,
      activePackIds:
        mode === 'pack' && options?.packId ? Array.from(new Set([...enabledPackIds, options.packId])) : enabledPackIds,
      title: options?.title,
    });

    if (!nextSession) {
      setLessonNotice('В этой подборке нет слов для карточек. Выберите другой пак или добавьте новые слова.');
      return;
    }
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
    const isCorrect =
      currentExercise.type === 'kanji_to_hiragana_input'
        ? isJapaneseReadingMatch(answer, currentExercise.correctAnswer, currentWord ?? undefined)
        : isWordInputExercise
          ? isAnswerMatch(answer, currentExercise.correctAnswer, currentWord?.language ?? 'french', currentWord ?? undefined)
          : answer === currentExercise.correctAnswer;

    const outcome: ExerciseOutcome = {
      exerciseId: currentExercise.id,
      wordId: currentExercise.wordId,
      type: currentExercise.type,
      userAnswer: answer,
      correctAnswer: currentExercise.correctAnswer,
      isCorrect,
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
      currentExercise.type === 'translation_to_original_choice' && selectedOptionWordId
        ? wordsById.get(selectedOptionWordId) ?? null
        : null;
    const resultAudioWord = selectedOriginalWord ?? currentWord;

    if (resultAudioWord) {
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

    clearSessionState(activeSession.mode === 'default' ? 'dailyComplete' : 'result', { preserveOutcomes: true });
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

    if (!markWordKnown(currentWord.id)) {
      return;
    }
    setKnownWordIds(nextKnownWordIds);
    resetExerciseState();

    if (nextIndex >= nextSession.steps.length) {
      finishLesson(nextSession, outcomes, nextKnownWordIds);
      return;
    }

    setSession(nextSession);
    setStepIndex(nextIndex);
  }

  function handleIgnoreWord() {
    if (!session || !currentWord) {
      return;
    }

    const nextIndex = stepIndex + (isSubmitted ? 1 : 0);
    const nextSession = removeUpcomingWord(session, nextIndex, currentWord.id);

    const updated = markWordAsIgnored(storageRef.current, currentWord.id);
    storageRef.current = updated;
    setStorage(updated);
    resetExerciseState();

    if (nextIndex >= nextSession.steps.length) {
      finishLesson(nextSession);
      return;
    }

    setSession(nextSession);
    setStepIndex(nextIndex);
  }

  function handleNavigate(target: 'home' | 'lesson' | 'dictionary' | 'radicals' | 'statistics' | 'profile' | 'packs') {
    if (target === 'lesson') {
      if (session?.mode === 'default' && dailyDraftRef.current && resumeDraft(dailyDraftRef.current)) return;
      if (currentLessonDraft && resumeDraft(currentLessonDraft)) return;

      if (dailyDraftRef.current && resumeDraft(dailyDraftRef.current)) return;
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

  const navScreen = screen === 'dictionary' || screen === 'radicals' || screen === 'statistics' || screen === 'profile' || screen === 'packs' || screen === 'lesson'
    ? screen
    : screen === 'packDetail'
      ? 'packs'
      : 'home';

  return (
    <AppShell>
      <div className={screen === 'lesson' ? 'desktop-app-layout lesson-desktop-layout' : 'desktop-app-layout'}>
        <AppNavigation
          activeScreen={navScreen}
          lessonAvailable={lessonPoolWords.length > 0 || Boolean(session)}
          showKanjiRadicals={storage.learningLanguage === 'japanese'}
          streakDays={getCurrentStreakDays(storage)}
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
        {lessonNotice ? (
          <section className="app-error-state" role="status">
            <p>{lessonNotice}</p>
            <button type="button" className="ghost-button" onClick={() => { setSelectedPackId(null); setScreen('packs'); setLessonNotice(null); }}>Открыть паки</button>
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
          />
        ) : null}

        {screen === 'lesson' && currentStep && currentWord && session ? (
          <section className="lesson-shell">
            <div className="lesson-focus-screen">
              <header className="lesson-session-progress" aria-label="Прогресс текущего урока">
                <div className="lesson-session-topline">
                  <span className="lesson-session-module">Модуль {currentStep.modulePosition} из {currentStep.moduleCount}</span>
                  <span>{currentStep.indexInModule} / {currentStep.totalInModule} в модуле</span>
                </div>
                <div className="lesson-session-title-row">
                  <div>
                    <strong>{currentStep.moduleTitle}</strong>
                    <small>{currentStep.moduleDescription}</small>
                  </div>
                  <span>{lessonProgress?.completedSteps} / {session.steps.length} выполнено</span>
                </div>
                <div className="lesson-session-track" role="progressbar" aria-label="Общий прогресс урока" aria-valuemin={0} aria-valuemax={100} aria-valuenow={lessonProgress?.percent ?? 0}>
                  <span style={{ width: `${lessonProgress?.percent ?? 0}%` }} />
                </div>
                <small>Модулей завершено: {lessonProgress?.completedModules} · осталось: {lessonProgress?.remainingModules}</small>
              </header>
              <button
                type="button"
                className="lesson-close-button"
                aria-label="Приостановить урок и вернуться на главную"
                onClick={() => {
                  stopAudio();
                  setScreen('home');
                }}
              >
                <AppIcon name="close" size={25} />
              </button>
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
                      void playWordAudio(currentWord);
                    }}
                    onMarkKnown={currentStep.allowMarkKnown ? handleMarkKnown : undefined}
                    onIgnoreWord={handleIgnoreWord}
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
                    onChange={setTypedAnswer}
                    onSubmit={() => handleSubmit(typedAnswer)}
                    onReplayAudio={() => {
                      void playWordAudio(currentWord);
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
              onProfileNameChange={(value) => {
                setStorage((currentStorage) => updateProfileName(currentStorage, value));
              }}
              onLearningLanguageChange={(value) => {
                clearSessionState('profile');
                dailyDraftRef.current = loadLessonDraft(value);
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
            />
          ) : null}
          {screen === 'statistics' ? (
            <StatisticsScreen learningLanguage={storage.learningLanguage} storage={storage} words={availableWords} />
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
  );
}

export default App;
