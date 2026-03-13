import {
  Suspense,
  lazy,
  startTransition,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AudioInputExercise } from './components/AudioInputExercise';
import { DailyCompletionScreen } from './components/DailyCompletionScreen';
import { HomeDashboard } from './components/HomeDashboard';
import { LessonResult } from './components/LessonResult';
import { LessonWordPreview } from './components/LessonWordPreview';
import { MultipleChoiceExercise } from './components/MultipleChoiceExercise';
import { ProgressBar } from './components/ProgressBar';
import { getWordById, loadWords } from './data/words';
import { playWordAudio, stopAudio } from './lib/audio';
import { createLessonSession } from './lib/exercises';
import {
  applyOutcomes,
  completeDailyLesson,
  getCompletedDailyLesson,
  loadStorage,
  markWordAsKnown,
  saveStorage,
} from './lib/storage';
import { getTodayDateKey, normalizeAnswer } from './lib/utils';
import type { AppStorage, DailyLessonRecord, ExerciseOutcome, LessonSession, Word } from './types';
import './styles/app.css';

const DictionaryScreen = lazy(() => import('./components/DictionaryScreen'));
const StatisticsScreen = lazy(() => import('./components/StatisticsScreen'));

type Screen = 'home' | 'lesson' | 'result' | 'completion' | 'dictionary' | 'statistics';

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

  const progressList = useMemo(() => Object.values(storage.progressByWordId), [storage]);
  const currentStep = session?.steps[stepIndex] ?? null;
  const currentExercise = currentStep?.kind === 'exercise' ? currentStep.exercise : null;
  const currentWord = currentStep ? getWordById(words, currentStep.wordId) : null;
  const todayCompletion = useMemo(() => getCompletedDailyLesson(storage), [storage]);
  const currentModuleIndex = useMemo(
    () => (session && currentStep ? session.modules.findIndex((module) => module.id === currentStep.moduleId) : -1),
    [currentStep, session],
  );
  const visibleModules = useMemo(
    () => session?.modules.filter((module) => module.wordIds.length > 0) ?? [],
    [session],
  );
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
      words,
      storage,
      wordIds,
    });

    if (!nextSession) {
      if (mode === 'default') {
        const emptyRecord: DailyLessonRecord = {
          date: getTodayDateKey(),
          completedAt: new Date().toISOString(),
          sessionId: `default-empty-${Date.now()}`,
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
        };

        setStorage((currentStorage) => completeDailyLesson(currentStorage, emptyRecord));
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
      currentExercise.type === 'audio_to_original_input'
        ? normalizeAnswer(answer)
        : answer;
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
      const nextStorage = applyOutcomes(currentStorage, lessonOutcomes);

      if (activeSession.mode !== 'default') {
        return nextStorage;
      }

      const difficultWordIds = Array.from(
        new Set(
          activeSession.sourceWordIds.filter((wordId) => nextStorage.progressByWordId[wordId]?.status === 'difficult'),
        ),
      );
      const dailyRecord: DailyLessonRecord = {
        date: getTodayDateKey(),
        completedAt: new Date().toISOString(),
        sessionId: activeSession.id,
        totalModules: activeSession.modules.filter((module) => module.wordIds.length > 0).length,
        completedModules: activeSession.modules.filter((module) => module.wordIds.length > 0).length,
        totalSteps: activeSession.steps.length,
        completedSteps: activeSession.steps.length,
        correctAnswers: lessonOutcomes.filter((outcome) => outcome.isCorrect).length,
        totalAnswers: lessonOutcomes.length,
        newWords: activeSession.modules.find((module) => module.id === 'module-new-words')?.wordIds.length ?? 0,
        reviewWords: activeSession.modules.find((module) => module.id === 'module-review-learning')?.wordIds.length ?? 0,
        reinforcementWords:
          activeSession.modules.find((module) => module.id === 'module-reinforcement')?.wordIds.length ?? 0,
        knownWords: Array.from(new Set(manuallyKnownWordIds)).length,
        difficultWordIds,
      };

      return completeDailyLesson(nextStorage, dailyRecord);
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

  if (isLoadingWords) {
    return (
      <main className="app-shell">
        <div className="app-frame">
          <section className="hero-card">
            <span className="eyebrow">Загрузка</span>
            <h1 className="hero-title">Подготавливаем словарь</h1>
            <p className="hero-text">Загружаем французские слова, интервальные статусы и экран урока.</p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <div className="app-frame">
        {screen === 'home' ? (
          <HomeDashboard
            words={words}
            storage={storage}
            progressList={progressList}
            onStartLesson={() => startLesson('default')}
            onOpenCompletion={() => {
              startTransition(() => {
                setScreen('completion');
              });
            }}
            onOpenDictionary={() => {
              startTransition(() => {
                setScreen('dictionary');
              });
            }}
            onOpenStatistics={() => {
              startTransition(() => {
                setScreen('statistics');
              });
            }}
          />
        ) : null}

        {screen === 'lesson' && currentStep && currentWord && session ? (
          <section className="lesson-shell">
            <div className="module-header">
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
              </div>
            </div>

            <div className="module-nav" aria-label="Модули урока">
              {visibleModules.map((module) => {
                const moduleIndex = visibleModules.findIndex((item) => item.id === module.id);
                const state =
                  module.id === currentStep.moduleId
                    ? 'current'
                    : moduleIndex < visibleModules.findIndex((item) => item.id === currentStep.moduleId)
                      ? 'done'
                      : 'upcoming';

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
              <section
                className={latestOutcome.isCorrect ? 'feedback-card success' : 'feedback-card error'}
              >
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
                <button
                  type="button"
                  className="primary-button"
                  disabled={!isSubmitted}
                  onClick={goToNextStep}
                >
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
            words={words}
            onOpenDictionary={() => {
              startTransition(() => {
                setScreen('dictionary');
              });
            }}
            onReviewDifficult={() => {
              if (!todayCompletion || todayCompletion.difficultWordIds.length === 0) {
                return;
              }

              startLesson('mistakes', todayCompletion.difficultWordIds);
            }}
            onBackHome={() => {
              startTransition(() => {
                setScreen('home');
              });
            }}
          />
        ) : null}

        {screen === 'dictionary' ? (
          <Suspense fallback={<section className="hero-card">Загружаем словарь…</section>}>
            <DictionaryScreen
              words={words}
              storage={storage}
              onBack={() => {
                startTransition(() => {
                  setScreen('home');
                });
              }}
            />
          </Suspense>
        ) : null}

        {screen === 'statistics' ? (
          <Suspense fallback={<section className="hero-card">Загружаем статистику…</section>}>
            <StatisticsScreen
              storage={storage}
              progressList={progressList}
              onBack={() => {
                startTransition(() => {
                  setScreen('home');
                });
              }}
            />
          </Suspense>
        ) : null}
      </div>
    </main>
  );
}

export default App;
