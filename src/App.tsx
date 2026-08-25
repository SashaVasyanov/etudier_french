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
import {
  addCustomPack,
  addWordPack,
  addCustomWord,
  applyOutcomes,
  completeDailyLesson,
  loadStorage,
  markWordAsIgnored,
  markWordAsKnown,
  recordRadicalStudySession,
  recordStudyHistory,
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
  DailyLessonRecord,
  ExerciseOutcome,
  LessonMode,
  LessonSession,
  StorageError,
  StudyHistoryEntry,
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

function removeWordFromSession(session: LessonSession, wordId: string): LessonSession {
  const exercises = session.exercises.filter((exercise) => exercise.wordId !== wordId);
  const steps = session.steps.filter((step) => step.wordId !== wordId);
  const modules = session.modules.map((module) => ({
    ...module,
    wordIds: module.wordIds.filter((id) => id !== wordId),
    stepIds: module.stepIds.filter((stepId) => !stepId.includes(wordId)),
  }));

  return {
    ...session,
    exercises,
    steps,
    modules,
    exerciseIds: exercises.map((exercise) => exercise.id),
    sourceWordIds: session.sourceWordIds.filter((id) => id !== wordId),
  };
}

function App() {
  const [initialStorageLoad] = useState(() => loadStorage());
  const [screen, setScreen] = useState<Screen>('home');
  const [storage, setStorage] = useState<AppStorage>(initialStorageLoad.storage);
  const [storageError, setStorageError] = useState<StorageError | null>(initialStorageLoad.error);
  const [baseWords, setBaseWords] = useState<Word[]>([]);
  const [session, setSession] = useState<LessonSession | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [outcomes, setOutcomes] = useState<ExerciseOutcome[]>([]);
  const [knownWordIds, setKnownWordIds] = useState<string[]>([]);
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
  const enabledPackIds = useMemo(() => getEnabledPackIds(storage), [storage]);
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
  const progressList = useMemo(() => words.map((word) => getWordProgress(storage, word.id)), [storage, words]);
  const currentStep = session?.steps[stepIndex] ?? null;
  const currentExercise = currentStep?.kind === 'exercise' ? currentStep.exercise : null;
  const currentWord = currentStep ? wordsById.get(currentStep.wordId) ?? null : null;
  const dailyCompletion = getCompletedDailyLesson(storage);
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
  }, [packs, words.length]);

  useEffect(() => {
    if (!currentStep || !currentWord) {
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
  }, [currentStep, currentWord]);

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

  function startLesson(mode: LessonMode, options?: { wordIds?: string[]; title?: string; packId?: string }) {
    if (mode === 'default' && getCompletedDailyLesson(storage)) {
      setScreen('dailyComplete');
      return;
    }

    if (mode !== 'pack' && lessonPoolWords.length === 0) {
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
      }
      return;
    }

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
    if (mode !== 'pack' && lessonPoolWords.length === 0) {
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
      return;
    }

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
    setStorage((currentStorage) => {
      const storageWithOutcomes = applyOutcomes(currentStorage, lessonOutcomes);
      if (activeSession.presentation === 'flashcards' && lessonOutcomes.length === 0) {
        return storageWithOutcomes;
      }

      const completedModules = activeSession.modules.filter((module) =>
        activeSession.steps.some((step) => step.moduleId === module.id),
      );
      const difficultWordIds = Array.from(
        new Set(
          activeSession.sourceWordIds.filter(
            (wordId) => storageWithOutcomes.progressByWordId[wordId]?.status === 'difficult',
          ),
        ),
      );
      const completedAt = new Date().toISOString();
      const timeSpentSeconds = Math.max(
        0,
        Math.round((new Date(completedAt).getTime() - new Date(activeSession.startedAt).getTime()) / 1000),
      );
      const transitionedWordIds = activeSession.sourceWordIds.filter((wordId) => {
        const before = getWordProgress(currentStorage, wordId).status;
        const after = getWordProgress(storageWithOutcomes, wordId).status;
        return before !== 'mastered' && before !== 'known' && (after === 'mastered' || after === 'known');
      });
      const wordsLearned = new Set([...transitionedWordIds, ...manuallyKnownWordIds]).size;
      const newWords = new Set(
        lessonOutcomes
          .map((outcome) => outcome.wordId)
          .filter((wordId) =>
            getWordProgress(currentStorage, wordId).status === 'new' &&
            getWordProgress(storageWithOutcomes, wordId).status !== 'new',
          ),
      ).size;
      const historyEntry: StudyHistoryEntry = {
        id: `${activeSession.id}-history`,
        date: getTodayDateKey(),
        language: currentStorage.learningLanguage,
        completedAt,
        sessionId: activeSession.id,
        mode: activeSession.mode,
        durationMinutes: activeSession.durationMinutes,
        moduleTitles: completedModules.map((module) => module.title),
        modulesCompleted: completedModules.length,
        wordsLearned,
        mistakesMade: lessonOutcomes.filter((outcome) => !outcome.isCorrect).length,
        correctAnswers: lessonOutcomes.filter((outcome) => outcome.isCorrect).length,
        totalAnswers: lessonOutcomes.length,
        timeSpentSeconds,
        activePackIds: activeSession.activePackIds,
      };

      if (activeSession.mode !== 'default') {
        return recordStudyHistory(storageWithOutcomes, historyEntry);
      }

      const record: DailyLessonRecord = {
        date: getTodayDateKey(),
        language: currentStorage.learningLanguage,
        completedAt,
        sessionId: activeSession.id,
        totalModules: completedModules.length,
        completedModules: completedModules.length,
        totalSteps: activeSession.steps.length,
        completedSteps: activeSession.steps.length,
        correctAnswers: historyEntry.correctAnswers,
        totalAnswers: historyEntry.totalAnswers,
        newWords,
        reviewWords: activeSession.modules.find((module) => module.id === 'module-review-learning')?.wordIds.length ?? 0,
        reinforcementWords: activeSession.modules.find((module) => module.id === 'module-reinforcement')?.wordIds.length ?? 0,
        knownWords: Array.from(new Set(manuallyKnownWordIds)).length,
        difficultWordIds,
        timeSpentSeconds,
      };

      return completeDailyLesson(storageWithOutcomes, { record, historyEntry });
    });

    clearSessionState(activeSession.mode === 'default' ? 'dailyComplete' : 'result', { preserveOutcomes: true });
  }

  function goToNextStep() {
    if (!session) {
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
      setStorage((currentStorage) => markWordAsKnown(currentStorage, wordId));
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

    const nextSession = removeWordFromSession(session, currentWord.id);
    const nextKnownWordIds = Array.from(new Set([...knownWordIds, currentWord.id]));

    if (!markWordKnown(currentWord.id)) {
      return;
    }
    setKnownWordIds(nextKnownWordIds);
    resetExerciseState();

    if (nextSession.steps.length === 0) {
      finishLesson(nextSession, outcomes, nextKnownWordIds);
      return;
    }

    setSession(nextSession);
    setStepIndex((current) => Math.min(current, nextSession.steps.length - 1));
  }

  function handleIgnoreWord() {
    if (!session || !currentWord) {
      return;
    }

    const nextSession = removeWordFromSession(session, currentWord.id);

    setStorage((currentStorage) => markWordAsIgnored(currentStorage, currentWord.id));
    resetExerciseState();

    if (nextSession.steps.length === 0) {
      finishLesson(nextSession);
      return;
    }

    setSession(nextSession);
    setStepIndex((current) => Math.min(current, nextSession.steps.length - 1));
  }

  function handleNavigate(target: 'home' | 'lesson' | 'dictionary' | 'radicals' | 'statistics' | 'profile' | 'packs') {
    if (target === 'lesson') {
      if (session) {
        setScreen('lesson');
        return;
      }

      setScreen(getCompletedDailyLesson(storage) ? 'dailyComplete' : 'home');
      return;
    }

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
        {screen === 'home' ? (
          <HomeDashboard
            totalWords={words}
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
                  <span>{stepIndex + 1} / {session.steps.length}</span>
                </div>
                <div className="lesson-session-track" aria-hidden="true">
                  <span style={{ width: `${((stepIndex + 1) / session.steps.length) * 100}%` }} />
                </div>
              </header>
              <button
                type="button"
                className="lesson-close-button"
                aria-label="Выйти из урока"
                onClick={() => {
                  clearSessionState('home');
                }}
              >
                <AppIcon name="close" size={25} />
              </button>
              {currentStep.kind === 'exercise' ? (
                currentExercise?.type === 'memory_check' ? (
                  <MemoryCheckExercise
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
                } catch (error) {
                  reportStorageMutationError(error);
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
