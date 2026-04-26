import { useEffect, useRef } from 'react';
import { getLearningLanguageAdverb, getLearningLanguageTitle } from '../lib/languages';
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
  const copy = getExerciseCopy(exercise.type, word.language);
  const languageAdverb = getLearningLanguageAdverb(word.language);
  const languageTitle = getLearningLanguageTitle(word.language);

  useEffect(() => {
    if (!isSubmitted) {
      inputRef.current?.focus();
      return undefined;
    }

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
  }, [isSubmitted, exercise.id, onNext]);

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
            <p className="audio-hint">
              {word.language === 'french'
                ? 'Введите слово по памяти. Артикль не нужен, регистр не важен.'
                : 'Введите слово по памяти. Можно писать в японской записи, регистр не важен.'}
            </p>
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
            placeholder={`Напишите слово ${languageAdverb}`}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') {
                return;
              }

              event.preventDefault();

              if (isSubmitted) {
                onNext();
                return;
              }

              if (value.trim()) {
                onSubmit();
              }
            }}
          />

          <div className="input-meta">
            <span>{`Ответ должен быть на ${languageTitle} языке`}</span>
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
