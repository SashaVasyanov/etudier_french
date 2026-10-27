import { useEffect, useRef, useState } from 'react';
import type { Exercise, Word } from '../types';
import { getExerciseCopy } from '../lib/wordPresentation';
import { CenteredWordBlock } from './CenteredWordBlock';
import { LessonCard } from './LessonCard';
import { SentenceAudioButton } from './SentenceAudioButton';

interface SentenceOrderExerciseProps {
  exercise: Exercise;
  word: Word;
  isSubmitted: boolean;
  /** The submitted sentence, while feedback is shown. */
  selectedAnswer: string | null;
  onSubmit: (answer: string) => void;
  onNext: () => void;
  onMarkKnown?: () => void;
  onIgnoreWord?: () => void;
}

/**
 * «Соберите фразу»: the words of the example sentence are shuffled; the
 * learner taps them in order (or presses their numbers), Backspace takes the
 * last one back, Enter checks.
 */
export function SentenceOrderExercise({
  exercise,
  word,
  isSubmitted,
  selectedAnswer,
  onSubmit,
  onNext,
  onMarkKnown,
  onIgnoreWord,
}: SentenceOrderExerciseProps) {
  const copy = getExerciseCopy(exercise.type, word.language);
  const tiles = exercise.options ?? [];
  const [picked, setPicked] = useState<string[]>([]);
  const nextButtonRef = useRef<HTMLButtonElement | null>(null);
  const remaining = tiles.filter((tile) => !picked.includes(tile.id));
  const assembled = picked.map((id) => tiles.find((tile) => tile.id === id)?.label ?? '').join(' ');
  const isCorrect = isSubmitted && selectedAnswer === exercise.correctAnswer;
  const complete = picked.length === tiles.length;

  useEffect(() => {
    if (isSubmitted) nextButtonRef.current?.focus();
  }, [isSubmitted]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.isComposing) return;
      if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (isSubmitted) {
        if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) {
          event.preventDefault();
          onNext();
        }
        return;
      }
      if (event.key === 'Enter' && complete) {
        event.preventDefault();
        onSubmit(assembled);
        return;
      }
      if (event.key === 'Backspace' && picked.length > 0) {
        event.preventDefault();
        setPicked((current) => current.slice(0, -1));
        return;
      }
      const index = Number(event.key) - 1;
      if (!event.repeat && Number.isInteger(index) && index >= 0 && index < remaining.length) {
        event.preventDefault();
        setPicked((current) => [...current, remaining[index].id]);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [assembled, complete, isSubmitted, onNext, onSubmit, picked.length, remaining]);

  return (
    <LessonCard
      className="lesson-exercise-card lesson-sentence-order-card"
      header={
        <header className="exercise-header lesson-prototype-header">
          <span className="eyebrow">{copy.eyebrow}</span>
          <CenteredWordBlock
            title={exercise.prompt}
            subtitle={copy.hint}
            titleClassName="lesson-prompt-title lesson-sentence-prompt"
            subtitleClassName="lesson-prompt-copy"
          />
        </header>
      }
      body={
        <div className="sentence-order">
          <div
            className={['sentence-order-answer', isSubmitted ? (isCorrect ? 'correct' : 'incorrect') : ''].filter(Boolean).join(' ')}
            aria-label="Собранная фраза"
            lang="fr"
          >
            {picked.length === 0 ? <span className="sentence-order-placeholder">Нажмите на первое слово</span> : null}
            {picked.map((id, position) => (
              <button
                key={id}
                type="button"
                className="sentence-tile placed"
                disabled={isSubmitted}
                title="Вернуть слово"
                onClick={() => setPicked((current) => current.filter((_, index) => index !== position))}
              >
                {tiles.find((tile) => tile.id === id)?.label}
              </button>
            ))}
          </div>
          {!isSubmitted ? (
            <div className="sentence-order-bank" lang="fr">
              {remaining.map((tile, index) => (
                <button key={tile.id} type="button" className="sentence-tile" onClick={() => setPicked((current) => [...current, tile.id])}>
                  {remaining.length <= 9 ? <span className="choice-key" aria-hidden="true">{index + 1}</span> : null}
                  {tile.label}
                </button>
              ))}
            </div>
          ) : (
            <div className={isCorrect ? 'answer-feedback success' : 'answer-feedback error'}>
              <div>
                <strong>{isCorrect ? 'Верно' : 'Правильный порядок:'}</strong>
                <div className="feedback-example example-line">
                  <span lang="fr">{exercise.correctAnswer}</span>
                  <SentenceAudioButton text={word.example_original} language={word.language} />
                </div>
                <p className="detail-copy">{exercise.prompt}</p>
              </div>
            </div>
          )}
        </div>
      }
      actions={
        <>
          {isSubmitted ? (
            <button ref={nextButtonRef} type="button" className="primary-button full-width" onClick={onNext}>
              Дальше <kbd className="key-hint" aria-hidden="true">Enter</kbd>
            </button>
          ) : (
            <button type="button" className="primary-button full-width" disabled={!complete} onClick={() => onSubmit(assembled)}>
              Проверить <kbd className="key-hint" aria-hidden="true">Enter</kbd>
            </button>
          )}
          {onMarkKnown || onIgnoreWord ? (
            <div className="lesson-word-action-row">
              {onMarkKnown ? (
                <button type="button" className="secondary-button full-width" onClick={onMarkKnown}>
                  Уже знаю
                </button>
              ) : null}
              {onIgnoreWord ? (
                <button type="button" className="danger-button quiet-danger full-width" onClick={onIgnoreWord}>
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
