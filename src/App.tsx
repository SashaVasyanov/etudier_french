import {
  Suspense,
  lazy,
  startTransition,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AudioInputExercise } from './components/AudioInputExercise';
import { HomeDashboard } from './components/HomeDashboard';
import { LessonResult } from './components/LessonResult';
import { LessonWordPreview } from './components/LessonWordPreview';
import { MultipleChoiceExercise } from './components/MultipleChoiceExercise';
import { ProgressBar } from './components/ProgressBar';
import { getWordById, loadWords } from './data/words';
import { playWordAudio, stopAudio } from './lib/audio';
import { createLessonSession } from './lib/exercises';
import { applyOutcomes, loadStorage, saveStorage } from './lib/storage';
import { normalizeAnswer } from './lib/utils';
import type { AppStorage, ExerciseOutcome, LessonSession, Word } from './types';
import './styles/app.css';

const DictionaryScreen = lazy(() => import('./components/DictionaryScreen'));
const StatisticsScreen = lazy(() => import('./components/StatisticsScreen'));

type Screen = 'home' | 'lesson' | 'result' | 'dictionary' | 'statistics';

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
  const [isLoadingWords, setIsLoadingWords] = useState(true);

  const progressList = useMemo(() => Object.values(storage.progressByWordId), [storage]);
  const currentStep = session?.steps[stepIndex] ?? null;
  const currentExercise = currentStep?.kind === 'exercise' ? currentStep.exercise : null;
  const currentWord = currentStep ? getWordById(words, currentStep.wordId) : null;

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

    const nextSession = createLessonSession({
      mode,
      words,
      storage,
      wordIds,
    });

    setSession(nextSession);
    setOutcomes([]);
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

  function finishLesson() {
    setStorage((currentStorage) => applyOutcomes(currentStorage, outcomes));
    setScreen('result');
    stopAudio();
  }

  function goToNextStep() {
    if (!session) {
      return;
    }

    const isLastStep = stepIndex >= session.steps.length - 1;

    if (isLastStep) {
      finishLesson();
      return;
    }

    setStepIndex((current) => current + 1);
    resetExerciseState();
  }

  const latestOutcome =
    currentExercise && isSubmitted
      ? [...outcomes].reverse().find((outcome) => outcome.exerciseId === currentExercise.id) ?? null
      : null;

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
              <span className="eyebrow">{currentStep.moduleTitle}</span>
              <h2 className="section-title">{currentStep.moduleDescription}</h2>
              <p className="info-subtle">
                Шаг {currentStep.indexInModule} из {currentStep.totalInModule} в модуле
              </p>
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
