import { useEffect, useRef } from 'react';
import type { Exercise, Word } from '../types';
import { getDisplayWord, getExerciseCopy } from '../lib/wordPresentation';
import { LessonCard } from './LessonCard';

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
  const copy = getExerciseCopy(exercise.type);

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
          <span className="eyebrow">{copy.eyebrow}</span>
          <h2 className="exercise-title">{copy.title}</h2>
          <p className="audio-hint">{copy.hint}</p>
          <div className="audio-panel lesson-audio-panel">
            <button className="audio-button audio-button-prominent" type="button" onClick={onReplayAudio}>
              Повторить аудио
            </button>
            <p className="audio-hint">Введите слово по памяти. Артикль не нужен, регистр не важен.</p>
          </div>
        </header>
      }
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
            <span>Ответ должен быть на французском</span>
          </div>

          {isSubmitted ? (
            <div className={isCorrect ? 'answer-feedback success' : 'answer-feedback error'}>
              <strong>{isCorrect ? 'Верно' : 'Неправильно'}</strong>
              <span>{getDisplayWord(word)}</span>
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
