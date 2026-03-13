import { Suspense, lazy, startTransition, useEffect, useMemo, useState } from 'react';
import { AppNavigation } from './components/AppNavigation';
import { AppShell } from './components/AppShell';
import { AudioInputExercise } from './components/AudioInputExercise';
import { DailyCompletionScreen } from './components/DailyCompletionScreen';
import { FlashcardView } from './components/FlashcardView';
import { HomeDashboard } from './components/HomeDashboard';
import { LessonResult } from './components/LessonResult';
import { LessonWordPreview } from './components/LessonWordPreview';
import { MultipleChoiceExercise } from './components/MultipleChoiceExercise';
import { ProgressBar } from './components/ProgressBar';
import { ProgressHeader } from './components/ProgressHeader';
import { TopNav } from './components/TopNav';
import { getStarterPacks, getWordById, loadWords } from './data/words';
import { playWordAudio, stopAudio } from './lib/audio';
import { createFlashcardSession, createLessonSession } from './lib/exercises';
import { derivePackStatus, getActiveWords, getEnabledPackIds } from './lib/packs';
import {
  addWordPack,
  applyOutcomes,
  completeDailyLesson,
  getCompletedDailyLesson,
  loadStorage,
  markWordAsKnown,
  recordStudyHistory,
  saveStorage,
  setLessonDurationPreference,
  setWordPackStatus,
  updateProfileName,
} from './lib/storage';
import { getTodayDateKey, normalizeAnswer } from './lib/utils';
import type {
  AppStorage,
  DailyLessonCompletionPayload,
  DailyLessonRecord,
  ExerciseOutcome,
  LessonMode,
  LessonSession,
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

type Screen =
  | 'home'
  | 'lesson'
  | 'result'
  | 'completion'
  | 'dictionary'
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

function buildEmptyCompletionPayload(sessionId: string, durationMinutes: AppStorage['lessonDurationMinutes']): DailyLessonCompletionPayload {
  const date = getTodayDateKey();
  const completedAt = new Date().toISOString();
  const record: DailyLessonRecord = {
    date,
    completedAt,
    sessionId,
    totalModules: 0,
    completedModules: 0,
    totalSteps: 0,
    completedSteps: 0,
    correctAnswers: 0,
    totalAnswers: 0,
    newWords: 0,
    reviewWords: 0,
    reinforcementWords: 0,
    knownWords: 0,
    difficultWordIds: [],
    timeSpentSeconds: 0,
  };
  const historyEntry: StudyHistoryEntry = {
    id: `${sessionId}-history`,
    date,
    completedAt,
    sessionId,
    mode: 'default',
    durationMinutes,
    moduleTitles: [],
    modulesCompleted: 0,
    wordsLearned: 0,
    mistakesMade: 0,
    correctAnswers: 0,
    totalAnswers: 0,
    timeSpentSeconds: 0,
    activePackIds: [],
  };

  return { record, historyEntry };
}

function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [storage, setStorage] = useState<AppStorage>(() => loadStorage());
  const [words, setWords] = useState<Word[]>([]);
  const [session, setSession] = useState<LessonSession | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [outcomes, setOutcomes] = useState<ExerciseOutcome[]>([]);
  const [knownWordIds, setKnownWordIds] = useState<string[]>([]);
  const [isLoadingWords, setIsLoadingWords] = useState(true);
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);

  const packs = useMemo(() => getStarterPacks(), []);
  const selectedPack = useMemo(
    () => (selectedPackId ? packs.find((pack) => pack.id === selectedPackId) ?? null : null),
    [packs, selectedPackId],
  );
  const enabledPackIds = useMemo(() => getEnabledPackIds(storage), [storage]);
  const availableWords = useMemo(() => getActiveWords(words, enabledPackIds), [enabledPackIds, words]);
  const progressList = useMemo(() => Object.values(storage.progressByWordId), [storage]);
  const currentStep = session?.steps[stepIndex] ?? null;
  const currentExercise = currentStep?.kind === 'exercise' ? currentStep.exercise : null;
  const currentWord = currentStep ? getWordById(words, currentStep.wordId) : null;
  const todayCompletion = useMemo(() => getCompletedDailyLesson(storage), [storage]);
  const currentModuleIndex = useMemo(
    () => (session && currentStep ? session.modules.findIndex((module) => module.id === currentStep.moduleId) : -1),
    [currentStep, session],
  );
  const visibleModules = useMemo(() => session?.modules.filter((module) => module.wordIds.length > 0) ?? [], [session]);
  const remainingModules = useMemo(() => {
    if (!session || currentModuleIndex < 0) {
      return 0;
    }

    return session.modules.slice(currentModuleIndex + 1).filter((module) => module.wordIds.length > 0).length;
  }, [currentModuleIndex, session]);

  useEffect(() => {
    let isMounted = true;

    void loadWords()
      .then((nextWords) => {
        if (!isMounted) {
          return;
        }

        setWords(nextWords);
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingWords(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    saveStorage(storage);
  }, [storage]);

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

    return incorrectWordIds.map((wordId) => getWordById(words, wordId));
  }, [outcomes, words]);

  function resetExerciseState() {
    setSelectedAnswer(null);
    setTypedAnswer('');
    setIsSubmitted(false);
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
    if (words.length === 0) {
      return;
    }

    if (mode === 'default' && todayCompletion) {
      setScreen('completion');
      return;
    }

    const lessonWords =
      options?.wordIds && options.wordIds.length > 0
        ? words
        : mode === 'default'
          ? availableWords
          : mode === 'pack' && options?.packId
            ? words.filter((word) => word.packIds.includes(options.packId!))
            : availableWords;
    const nextSession = createLessonSession({
      mode,
      words: lessonWords,
      storage,
      durationMinutes: storage.lessonDurationMinutes,
      wordIds: options?.wordIds,
      activePackIds:
        mode === 'pack' && options?.packId ? Array.from(new Set([...enabledPackIds, options.packId])) : enabledPackIds,
      title: options?.title,
    });

    if (!nextSession) {
      if (mode === 'default') {
        const sessionId = `default-empty-${Date.now()}`;
        setStorage((currentStorage) =>
          completeDailyLesson(currentStorage, buildEmptyCompletionPayload(sessionId, currentStorage.lessonDurationMinutes)),
        );
        setScreen('completion');
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
    if (words.length === 0) {
      return;
    }

    const flashcardWords =
      mode === 'pack' && options?.packId
        ? words.filter((word) => word.packIds.includes(options.packId!))
        : availableWords;
    const nextSession = createFlashcardSession({
      mode,
      words: flashcardWords,
      storage,
      durationMinutes: storage.lessonDurationMinutes,
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

    const normalizedUserAnswer =
      currentExercise.type === 'audio_to_original_input' ? normalizeAnswer(answer) : answer;
    const normalizedCorrectAnswer =
      currentExercise.type === 'audio_to_original_input'
        ? normalizeAnswer(currentExercise.correctAnswer)
        : currentExercise.correctAnswer;

    const outcome: ExerciseOutcome = {
      exerciseId: currentExercise.id,
      wordId: currentExercise.wordId,
      type: currentExercise.type,
      userAnswer: answer,
      correctAnswer: currentExercise.correctAnswer,
      isCorrect: normalizedUserAnswer === normalizedCorrectAnswer,
    };

    setOutcomes((current) => [...current, outcome]);
    setSelectedAnswer(answer);
    setIsSubmitted(true);
  }

  function finishLesson(
    activeSession: LessonSession,
    lessonOutcomes = outcomes,
    manuallyKnownWordIds = knownWordIds,
  ) {
    setStorage((currentStorage) => {
      const storageWithOutcomes = applyOutcomes(currentStorage, lessonOutcomes);
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
      const wordsLearned = activeSession.sourceWordIds.filter((wordId) => {
        const status = storageWithOutcomes.progressByWordId[wordId]?.status;
        return status === 'learning' || status === 'review' || status === 'known' || status === 'mastered';
      }).length;
      const historyEntry: StudyHistoryEntry = {
        id: `${activeSession.id}-history`,
        date: getTodayDateKey(),
        completedAt,
        sessionId: activeSession.id,
        mode: activeSession.mode,
        durationMinutes: activeSession.durationMinutes,
        moduleTitles: activeSession.modules.map((module) => module.title),
        modulesCompleted: activeSession.modules.filter((module) => module.wordIds.length > 0).length,
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
        completedAt,
        sessionId: activeSession.id,
        totalModules: activeSession.modules.filter((module) => module.wordIds.length > 0).length,
        completedModules: activeSession.modules.filter((module) => module.wordIds.length > 0).length,
        totalSteps: activeSession.steps.length,
        completedSteps: activeSession.steps.length,
        correctAnswers: historyEntry.correctAnswers,
        totalAnswers: historyEntry.totalAnswers,
        newWords: activeSession.modules.find((module) => module.id === 'module-new-words')?.wordIds.length ?? 0,
        reviewWords: activeSession.modules.find((module) => module.id === 'module-review-learning')?.wordIds.length ?? 0,
        reinforcementWords: activeSession.modules.find((module) => module.id === 'module-reinforcement')?.wordIds.length ?? 0,
        knownWords: Array.from(new Set(manuallyKnownWordIds)).length,
        difficultWordIds,
        timeSpentSeconds,
      };

      return completeDailyLesson(storageWithOutcomes, { record, historyEntry });
    });

    if (activeSession.mode === 'default') {
      clearSessionState('completion');
      return;
    }

    clearSessionState('result', { preserveOutcomes: true });
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

  function handleMarkKnown() {
    if (!session || !currentWord || !currentStep?.allowMarkKnown) {
      return;
    }

    const nextKnownWordIds = Array.from(new Set([...knownWordIds, currentWord.id]));
    const nextSession = removeWordFromSession(session, currentWord.id);

    setStorage((currentStorage) => markWordAsKnown(currentStorage, currentWord.id));
    setKnownWordIds(nextKnownWordIds);
    resetExerciseState();

    if (nextSession.steps.length === 0) {
      finishLesson(session, outcomes, nextKnownWordIds);
      return;
    }

    setSession(nextSession);
    setStepIndex((current) => Math.min(current, nextSession.steps.length - 1));
  }

  function handleNavigate(target: 'home' | 'lesson' | 'dictionary' | 'profile' | 'packs') {
    if (target === 'lesson') {
      if (session) {
        setScreen('lesson');
        return;
      }

      if (todayCompletion) {
        setScreen('completion');
        return;
      }

      setScreen('home');
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
          <section className="hero-card">
            <span className="eyebrow">Загрузка</span>
            <h1 className="hero-title">Подготавливаем словарь</h1>
            <p className="hero-text">Загружаем французские слова, активные паки и локальный прогресс.</p>
          </section>
      </AppShell>
    );
  }

  const navScreen = screen === 'dictionary' || screen === 'profile' || screen === 'packs' || screen === 'lesson'
    ? screen
    : screen === 'packDetail'
      ? 'packs'
      : 'home';

  return (
    <AppShell>
        <TopNav
          eyebrow="Французский словарь и уроки"
          title="Etudier French"
          meta={`${storage.profile.displayName} · Активных слов: ${availableWords.length} · Серия: ${storage.streakDays}`}
          navigation={<AppNavigation activeScreen={navScreen} lessonAvailable={words.length > 0} onNavigate={handleNavigate} />}
        />

        {screen === 'home' ? (
          <HomeDashboard
            availableWords={availableWords}
            totalWords={words}
            storage={storage}
            progressList={progressList}
            addedPacksCount={enabledPackIds.length}
            lessonDurationMinutes={storage.lessonDurationMinutes}
            onLessonDurationChange={(value) => {
              setStorage((currentStorage) => setLessonDurationPreference(currentStorage, value));
            }}
            onStartLesson={() => startLesson('default')}
            onStartExtraLesson={() => startLesson('extra', { title: 'Дополнительное обучение' })}
            onStartFlashcards={() => startFlashcards('extra', { title: 'Карточки слов' })}
            onOpenCompletion={() => setScreen('completion')}
            onOpenDictionary={() => setScreen('dictionary')}
            onOpenProfile={() => setScreen('profile')}
            onOpenPacks={() => {
              setSelectedPackId(null);
              setScreen('packs');
            }}
          />
        ) : null}

        {screen === 'lesson' && currentStep && currentWord && session ? (
          <section className="lesson-shell">
            <ProgressHeader
              eyebrow={
                session.mode === 'default'
                  ? 'Ежедневный урок'
                  : session.mode === 'extra'
                    ? 'Дополнительное обучение'
                    : session.mode === 'pack'
                      ? 'Практика пака'
                      : 'Повтор ошибок'
              }
              title={currentStep.moduleTitle}
              description={currentStep.moduleDescription}
              moduleLabel={`${currentStep.modulePosition}/${visibleModules.length}`}
              stepLabel={`${currentStep.indexInModule}/${currentStep.totalInModule}`}
              overallLabel={`${stepIndex + 1}/${session.steps.length}`}
              badges={[session.title, `${session.durationMinutes} мин`, `Осталось модулей: ${remainingModules}`]}
            />

            <div className="module-nav" aria-label="Модули урока">
              {visibleModules.map((module) => {
                const moduleIndex = visibleModules.findIndex((item) => item.id === module.id);
                const activeModuleIndex = visibleModules.findIndex((item) => item.id === currentStep.moduleId);
                const state =
                  module.id === currentStep.moduleId ? 'current' : moduleIndex < activeModuleIndex ? 'done' : 'upcoming';

                return (
                  <div key={module.id} className={`module-nav-item ${state}`}>
                    <span className="module-nav-index">М{module.position}</span>
                    <strong>{module.title}</strong>
                    <span>{module.wordIds.length} слов</span>
                  </div>
                );
              })}
            </div>

            <ProgressBar current={stepIndex + 1} total={session.steps.length} />

            {currentStep.kind === 'preview' && session.presentation === 'flashcards' ? (
              <FlashcardView
                word={currentWord}
                current={currentStep.indexInModule}
                total={currentStep.totalInModule}
                onReplayAudio={() => {
                  void playWordAudio(currentWord);
                }}
                onMarkKnown={currentStep.allowMarkKnown ? handleMarkKnown : undefined}
                onDefer={goToNextStep}
                onNext={goToNextStep}
              />
            ) : currentStep.kind === 'preview' ? (
              <LessonWordPreview
                word={currentWord}
                current={currentStep.indexInModule}
                total={currentStep.totalInModule}
                onReplayAudio={() => {
                  void playWordAudio(currentWord);
                }}
                onMarkKnown={currentStep.allowMarkKnown ? handleMarkKnown : undefined}
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
                onReplayAudio={
                  currentExercise.type === 'audio_to_translation_choice'
                    ? () => {
                        void playWordAudio(currentWord);
                      }
                    : undefined
                }
              />
            ) : currentExercise ? (
              <AudioInputExercise
                exercise={currentExercise}
                word={currentWord}
                value={typedAnswer}
                isSubmitted={isSubmitted}
                onChange={setTypedAnswer}
                onSubmit={() => handleSubmit(typedAnswer)}
                onReplayAudio={() => {
                  void playWordAudio(currentWord);
                }}
              />
            ) : null}

            {latestOutcome ? (
              <section className={latestOutcome.isCorrect ? 'feedback-card success' : 'feedback-card error'}>
                <h3>{latestOutcome.isCorrect ? 'Верно' : 'Есть ошибка'}</h3>
                <p>
                  {latestOutcome.isCorrect
                    ? `Отлично: ${currentWord.original} — ${currentWord.translation}`
                    : `Правильный ответ: ${latestOutcome.correctAnswer}`}
                </p>
                <p className="feedback-example">
                  {currentWord.example_original}
                  <br />
                  {currentWord.example_translation}
                </p>
              </section>
            ) : null}

            <div className="lesson-footer">
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  clearSessionState('home');
                }}
              >
                Выйти
              </button>
              {currentStep.allowMarkKnown ? (
                <button type="button" className="secondary-button" onClick={handleMarkKnown}>
                  Уже знаю
                </button>
              ) : null}
              {currentStep.kind === 'exercise' ? (
                <button type="button" className="primary-button" disabled={!isSubmitted} onClick={goToNextStep}>
                  Далее
                </button>
              ) : null}
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

        {screen === 'completion' ? (
          <DailyCompletionScreen
            completion={todayCompletion}
            words={availableWords}
            lessonDurationMinutes={storage.lessonDurationMinutes}
            onLessonDurationChange={(value) => {
              setStorage((currentStorage) => setLessonDurationPreference(currentStorage, value));
            }}
            onContinueLearning={() => startLesson('extra', { title: 'Дополнительное обучение' })}
            onOpenDictionary={() => setScreen('dictionary')}
            onReviewDifficult={() => {
              if (!todayCompletion?.difficultWordIds.length) {
                return;
              }

              startLesson('mistakes', { wordIds: todayCompletion.difficultWordIds });
            }}
            onBackHome={() => setScreen('home')}
          />
        ) : null}

        <Suspense fallback={<section className="hero-card">Открываем раздел…</section>}>
          {screen === 'dictionary' ? <DictionaryScreen words={availableWords} storage={storage} packs={packs} /> : null}
          {screen === 'packs' ? (
            <PacksScreen
              packs={packs}
              storage={storage}
              onAddPack={(packId) => {
                setStorage((currentStorage) => addWordPack(currentStorage, packId));
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
              profile={storage.profile}
              storage={storage}
              progressList={progressList}
              onProfileNameChange={(value) => {
                setStorage((currentStorage) => updateProfileName(currentStorage, value));
              }}
            />
          ) : null}
        </Suspense>
    </AppShell>
  );
}

export default App;
