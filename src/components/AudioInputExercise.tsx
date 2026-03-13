import { useEffect, useRef } from 'react';
import type { Exercise, Word } from '../types';
import { AppCard } from './AppCard';
import { WordImage } from './WordImage';

interface AudioInputExerciseProps {
  exercise: Exercise;
  word: Word;
  value: string;
  isSubmitted: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onReplayAudio: () => void;
}

export function AudioInputExercise({
  exercise,
  word,
  value,
  isSubmitted,
  onChange,
  onSubmit,
  onReplayAudio,
}: AudioInputExerciseProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isSubmitted) {
      inputRef.current?.focus();
    }
  }, [isSubmitted, exercise.id]);

  return (
    <AppCard as="section" className="exercise-card">
      <header className="exercise-header">
        <span className="eyebrow">Аудио-ввод</span>
        <h2 className="exercise-title">{exercise.prompt}</h2>
        <div className="audio-panel">
          <button className="audio-button audio-button-prominent" type="button" onClick={onReplayAudio}>
            Повторить аудио
          </button>
          <p className="audio-hint">Введите слово по памяти. Регистр не важен.</p>
        </div>
      </header>

      <div className="exercise-input-layout">
        <WordImage word={word} size="small" />

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
            <span>{word.transcription}</span>
            <span>{word.part_of_speech}</span>
          </div>
        </div>
      </div>

      <button type="button" className="primary-button full-width" disabled={isSubmitted || !value.trim()} onClick={onSubmit}>
        Проверить
      </button>
    </AppCard>
  );
}
