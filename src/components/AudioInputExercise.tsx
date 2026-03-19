import { useEffect, useRef } from 'react';
import type { Exercise, Word } from '../types';
import { CenteredWordBlock } from './CenteredWordBlock';
import { LessonCard } from './LessonCard';
import { WordImage } from './WordImage';

interface AudioInputExerciseProps {
  exercise: Exercise;
  word: Word;
  value: string;
  isSubmitted: boolean;
  isCorrect?: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onReplayAudio: () => void;
  onNext: () => void;
}

export function AudioInputExercise({
  exercise,
  word,
  value,
  isSubmitted,
  isCorrect,
  onChange,
  onSubmit,
  onReplayAudio,
  onNext,
}: AudioInputExerciseProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isSubmitted) {
      inputRef.current?.focus();
    }
  }, [isSubmitted, exercise.id]);

  return (
    <LessonCard
      className="lesson-exercise-card lesson-input-card"
      header={
        <header className="exercise-header lesson-focus-header">
          <span className="eyebrow">Аудио-ввод</span>
          <h2 className="exercise-title">{exercise.prompt}</h2>
          <CenteredWordBlock title={word.translation} titleClassName="lesson-translation" />
          <div className="audio-panel lesson-audio-panel">
            <button className="audio-button audio-button-prominent" type="button" onClick={onReplayAudio}>
              Повторить аудио
            </button>
            <p className="audio-hint">Введите слово по памяти. Регистр не важен.</p>
          </div>
        </header>
      }
      visual={<WordImage word={word} size="small" className="lesson-word-image" />}
      body={
        <div className="exercise-input-panel">
          <label className="input-label" htmlFor="word-answer">
            Ваш ответ
          </label>
          <input
            id="word-answer"
            ref={inputRef}
            className="text-input"
            value={value}
            disabled={isSubmitted}
            autoComplete="off"
            spellCheck="false"
            placeholder="Напишите слово на французском"
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !isSubmitted && value.trim()) {
                onSubmit();
              }
            }}
          />

          <div className="input-meta">
            <span>Введите слово на французском</span>
          </div>

          {isSubmitted ? (
            <div className={isCorrect ? 'answer-feedback success' : 'answer-feedback error'}>
              <strong>{isCorrect ? 'Верно' : 'Неправильно'}</strong>
              <span>{isCorrect ? `Ответ: ${exercise.correctAnswer}` : `Правильный ответ: ${exercise.correctAnswer}`}</span>
            </div>
          ) : null}
        </div>
      }
      actions={
        <button
          type="button"
          className="primary-button full-width"
          disabled={!isSubmitted && !value.trim()}
          onClick={isSubmitted ? onNext : onSubmit}
        >
          {isSubmitted ? 'Далее' : 'Проверить'}
        </button>
      }
    />
  );
}
