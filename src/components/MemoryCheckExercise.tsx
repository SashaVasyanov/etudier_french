import { useEffect, useRef } from 'react';
import type { Exercise, Word } from '../types';
import { getExerciseCopy } from '../lib/wordPresentation';
import { LessonCard } from './LessonCard';
import { AnswerWordDetails } from './AnswerWordDetails';

interface MemoryCheckExerciseProps {
  exercise: Exercise;
  word: Word;
  isSubmitted: boolean;
  selectedAnswer: string | null;
  onSelect: (answer: string) => void;
  onNext: () => void;
  onReplayAudio: () => void;
  onMarkKnown?: () => void;
  onIgnoreWord?: () => void;
}

export function MemoryCheckExercise({
  exercise,
  word,
  isSubmitted,
  selectedAnswer,
  onSelect,
  onNext,
  onReplayAudio,
  onMarkKnown,
  onIgnoreWord,
}: MemoryCheckExerciseProps) {
  const nextButtonRef = useRef<HTMLButtonElement | null>(null);
  const copy = getExerciseCopy(exercise.type, word.language);

  useEffect(() => {
    if (!isSubmitted) {
      return undefined;
    }

    nextButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Enter') {
        return;
      }

      event.preventDefault();
      onNext();
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSubmitted, onNext]);

  return (
    <LessonCard
      className="lesson-exercise-card lesson-memory-card"
      header={
        <header className="exercise-header lesson-focus-header lesson-memory-header">
          <span className="eyebrow">{copy.eyebrow}</span>
          <button className="audio-button memory-audio-button" type="button" onClick={onReplayAudio}>
            Прослушать
          </button>
          <h2 className="exercise-title lesson-memory-title">{copy.title}</h2>
          <strong className="lesson-memory-word">{exercise.prompt}</strong>
          {exercise.context ? <p className="lesson-memory-context">{exercise.context}</p> : null}
        </header>
      }
      body={
        <div className="lesson-memory-actions">
          <button
            type="button"
            className={selectedAnswer === 'Помню' ? 'primary-button full-width' : 'secondary-button full-width'}
            disabled={isSubmitted}
            onClick={() => onSelect('Помню')}
          >
            Помню
          </button>
          <button
            type="button"
            className={selectedAnswer === 'Не помню' ? 'danger-button full-width' : 'ghost-button full-width'}
            disabled={isSubmitted}
            onClick={() => onSelect('Не помню')}
          >
            Не помню
          </button>

          {isSubmitted ? (
            <div className={selectedAnswer === 'Помню' ? 'answer-feedback success' : 'answer-feedback error'}>
              <strong>{selectedAnswer === 'Помню' ? 'Отмечено: помню' : 'Отмечено: не помню'}</strong>
              <AnswerWordDetails word={word} />
            </div>
          ) : null}
        </div>
      }
      actions={
        <>
          {isSubmitted ? (
            <button ref={nextButtonRef} type="button" className="primary-button full-width" onClick={onNext}>
              Дальше
            </button>
          ) : null}
          {onMarkKnown || onIgnoreWord ? (
            <div className="lesson-word-action-row">
              {onMarkKnown ? (
                <button type="button" className="secondary-button full-width" onClick={onMarkKnown}>
                  Уже знаю
                </button>
              ) : null}
              {onIgnoreWord ? (
                <button type="button" className="danger-button full-width" onClick={onIgnoreWord}>
                  Не хочу учить
                </button>
              ) : null}
            </div>
          ) : null}
        </>
      }
    />
  );
}
