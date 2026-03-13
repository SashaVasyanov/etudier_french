import { Suspense, lazy, startTransition, useEffect, useMemo, useState } from 'react';
import { AppNavigation } from './components/AppNavigation';
import { AudioInputExercise } from './components/AudioInputExercise';
import { DailyCompletionScreen } from './components/DailyCompletionScreen';
import { HomeDashboard } from './components/HomeDashboard';
import { LessonResult } from './components/LessonResult';
import { LessonWordPreview } from './components/LessonWordPreview';
import { MultipleChoiceExercise } from './components/MultipleChoiceExercise';
import { ProgressBar } from './components/ProgressBar';
import { getStarterPacks, getWordById, loadWords } from './data/words';
import { playWordAudio, stopAudio } from './lib/audio';
import { createLessonSession } from './lib/exercises';
import { derivePackStatus, getActiveWords, getEnabledPackIds } from './lib/packs';
import {
  addWordPack,
  applyOutcomes,
  completeDailyLesson,
  getCompletedDailyLesson,
  loadStorage,
  markWordAsKnown,
  saveStorage,
  setWordPackStatus,
  updateProfileName,
} from './lib/storage';
import { getTodayDateKey, normalizeAnswer } from './lib/utils';
import type {
  AppStorage,
  DailyLessonCompletionPayload,
  DailyLessonRecord,
  ExerciseOutcome,
  LessonSession,
  StudyHistoryEntry,
  Word,
} from './types';
import './styles/app.css';

const DictionaryScreen = lazy(() => import('./components/DictionaryScreen'));
const PacksScreen = lazy(() => import('./components/PacksScreen'));
const ProfileScreen = lazy(() => import('./components/ProfileScreen'));

type Screen = 'home' | 'lesson' | 'result' | 'completion' | 'dictionary' | 'profile' | 'packs';

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

function buildEmptyCompletionPayload(): DailyLessonCompletionPayload {
  const date = getTodayDateKey();
  const completedAt = new Date().toISOString();
  const sessionId = `default-empty-${Date.now()}`;
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

  const packs = useMemo(() => getStarterPacks(), []);
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

  function startLesson(mode: 'default' | 'mistakes', wordIds?: string[]) {
    if (words.length === 0) {
      return;
    }

    if (mode === 'default' && todayCompletion) {
      setScreen('completion');
      return;
    }

    const nextSession = createLessonSession({
      mode,
      words: mode === 'default' ? availableWords : words,
      storage,
      wordIds,
      activePackIds: enabledPackIds,
    });

    if (!nextSession) {
      if (mode === 'default') {
        setStorage((currentStorage) => completeDailyLesson(currentStorage, buildEmptyCompletionPayload()));
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

  function handleSubmit(answer: string) {
    if (!currentExercise || isSubmitted) {
      return;
    }

    const normalizedUserAnswer =
      currentExercise.type === 'audio_to_original_input' ? normalizeAnswer(answer) : answer;
    const normalizedCorrectAnswer =
      currentExercise.type === 'audio_to_original_input' ? normalizeAnswer(currentExercise.correctAnswer) : currentExercise.correctAnswer;

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
      const nextStorage = applyOutcomes(currentStorage, lessonOutcomes);

      if (activeSession.mode !== 'default') {
        return nextStorage;
      }

      const difficultWordIds = Array.from(
        new Set(
          activeSession.sourceWordIds.filter((wordId) => nextStorage.progressByWordId[wordId]?.status === 'difficult'),
        ),
      );
      const completedAt = new Date().toISOString();
      const timeSpentSeconds = Math.max(
        0,
        Math.round((new Date(completedAt).getTime() - new Date(activeSession.startedAt).getTime()) / 1000),
      );
      const wordsLearned = activeSession.sourceWordIds.filter((wordId) => {
        const status = nextStorage.progressByWordId[wordId]?.status;
        return status === 'learning' || status === 'review' || status === 'known' || status === 'mastered';
      }).length;
      const record: DailyLessonRecord = {
        date: getTodayDateKey(),
        completedAt,
        sessionId: activeSession.id,
        totalModules: activeSession.modules.filter((module) => module.wordIds.length > 0).length,
        completedModules: activeSession.modules.filter((module) => module.wordIds.length > 0).length,
        totalSteps: activeSession.steps.length,
        completedSteps: activeSession.steps.length,
        correctAnswers: lessonOutcomes.filter((outcome) => outcome.isCorrect).length,
        totalAnswers: lessonOutcomes.length,
        newWords: activeSession.modules.find((module) => module.id === 'module-new-words')?.wordIds.length ?? 0,
        reviewWords: activeSession.modules.find((module) => module.id === 'module-review-learning')?.wordIds.length ?? 0,
        reinforcementWords: activeSession.modules.find((module) => module.id === 'module-reinforcement')?.wordIds.length ?? 0,
        knownWords: Array.from(new Set(manuallyKnownWordIds)).length,
        difficultWordIds,
        timeSpentSeconds,
      };
      const historyEntry: StudyHistoryEntry = {
        id: `${activeSession.id}-history`,
        date: record.date,
        completedAt,
        sessionId: activeSession.id,
        mode: activeSession.mode,
        moduleTitles: activeSession.modules.map((module) => module.title),
        modulesCompleted: record.completedModules,
        wordsLearned,
        mistakesMade: lessonOutcomes.filter((outcome) => !outcome.isCorrect).length,
        correctAnswers: record.correctAnswers,
        totalAnswers: record.totalAnswers,
        timeSpentSeconds,
        activePackIds: activeSession.activePackIds,
      };

      return completeDailyLesson(nextStorage, { record, historyEntry });
    });

    setSession(null);
    stopAudio();

    if (activeSession.mode === 'default') {
      setScreen('completion');
      return;
    }

    setScreen('result');
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

      startLesson('default');
      return;
    }

    startTransition(() => {
      setScreen(target);
    });
  }

  if (isLoadingWords) {
    return (
      <main className="app-shell">
        <div className="app-frame">
          <section className="hero-card">
            <span className="eyebrow">Загрузка</span>
            <h1 className="hero-title">Подготавливаем словарь</h1>
            <p className="hero-text">Загружаем французские слова, активные паки и локальный прогресс.</p>
          </section>
        </div>
      </main>
    );
  }

  const navScreen = screen === 'dictionary' || screen === 'profile' || screen === 'packs' || screen === 'lesson'
    ? screen
    : 'home';

  return (
    <main className="app-shell">
      <div className="app-frame">
        <header className="topbar-card">
          <div className="topbar-copy">
            <span className="eyebrow">Приложение для изучения слов</span>
            <strong className="topbar-title">Etudier French</strong>
            <span className="info-subtle">
              {storage.profile.displayName} · Активных слов: {availableWords.length} · Серия: {storage.streakDays}
            </span>
          </div>
          <AppNavigation activeScreen={navScreen} lessonAvailable={words.length > 0} onNavigate={handleNavigate} />
        </header>

        {screen === 'home' ? (
          <HomeDashboard
            availableWords={availableWords}
            totalWords={words}
            storage={storage}
            progressList={progressList}
            addedPacksCount={enabledPackIds.length}
            onStartLesson={() => startLesson('default')}
            onOpenCompletion={() => setScreen('completion')}
            onOpenDictionary={() => setScreen('dictionary')}
            onOpenProfile={() => setScreen('profile')}
            onOpenPacks={() => setScreen('packs')}
          />
        ) : null}

        {screen === 'lesson' && currentStep && currentWord && session ? (
          <section className="lesson-shell">
            <div className="module-header lesson-header-card">
              <div className="module-header-top">
                <span className={`module-chip ${currentStep.moduleTheme}`}>Модуль {currentStep.modulePosition}</span>
                <span className="eyebrow">Осталось модулей: {remainingModules}</span>
              </div>
              <h2 className="section-title">{currentStep.moduleTitle}</h2>
              <p className="hero-text">{currentStep.moduleDescription}</p>
              <div className="module-meta-grid">
                <div className="mini-stat">
                  <span className="mini-stat-value">
                    {currentStep.indexInModule}/{currentStep.totalInModule}
                  </span>
                  <span className="mini-stat-label">Шаг в модуле</span>
                </div>
                <div className="mini-stat">
                  <span className="mini-stat-value">
                    {currentStep.modulePosition}/{visibleModules.length}
                  </span>
                  <span className="mini-stat-label">Модуль дня</span>
                </div>
                <div className="mini-stat">
                  <span className="mini-stat-value">
                    {stepIndex + 1}/{session.steps.length}
                  </span>
                  <span className="mini-stat-label">Общий прогресс дня</span>
                </div>
              </div>
            </div>

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

            {currentStep.kind === 'preview' ? (
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
                  setScreen('home');
                  setSession(null);
                  setOutcomes([]);
                  resetExerciseState();
                  stopAudio();
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
            onRepeatMistakes={() => startLesson('mistakes', mistakeWords.map((word) => word.id))}
            onFinish={() => {
              setScreen('home');
              setSession(null);
              setOutcomes([]);
              resetExerciseState();
            }}
          />
        ) : null}

        {screen === 'completion' ? (
          <DailyCompletionScreen
            completion={todayCompletion}
            words={availableWords}
            onOpenDictionary={() => setScreen('dictionary')}
            onReviewDifficult={() => {
              if (!todayCompletion?.difficultWordIds.length) {
                return;
              }

              startLesson('mistakes', todayCompletion.difficultWordIds);
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
      </div>
    </main>
  );
}

export default App;
