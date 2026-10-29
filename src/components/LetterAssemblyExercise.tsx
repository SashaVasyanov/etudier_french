import { useEffect, useMemo, useRef, useState } from 'react';
import type { Exercise, Word } from '../types';
import { getDisplayWord, getExerciseCopy } from '../lib/wordPresentation';
import { AnswerContext } from './AnswerContext';
import { CenteredWordBlock } from './CenteredWordBlock';
import { HintButton } from './HintButton';
import { LessonCard } from './LessonCard';
import { WordImage } from './WordImage';

interface LetterAssemblyExerciseProps {
  exercise: Exercise;
  word: Word;
  isSubmitted: boolean;
  selectedAnswer: string | null;
  hintsUsed?: number;
  onHint?: () => void;
  onSubmit: (answer: string) => void;
  onNext: () => void;
  onMarkKnown?: () => void;
  onIgnoreWord?: () => void;
}

const plain = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase();

/**
 * «Соберите слово»: the letters (or kana) of the answer as tiles, each shown
 * once with how many are left. Click or type them in order; Backspace takes
 * the last one back. The answer is checked as soon as it is complete.
 */
export function LetterAssemblyExercise({
  exercise,
  word,
  isSubmitted,
  selectedAnswer,
  hintsUsed = 0,
  onHint,
  onSubmit,
  onNext,
  onMarkKnown,
  onIgnoreWord,
}: LetterAssemblyExerciseProps) {
  const copy = getExerciseCopy(exercise.type, word.language);
  const answer = exercise.correctAnswer;
  const letters = useMemo(() => [...answer], [answer]);
  const [typed, setTyped] = useState<string[]>([]);
  const nextButtonRef = useRef<HTMLButtonElement | null>(null);
  const lang = word.language === 'japanese' ? 'ja' : 'fr';

  // Unique tiles in the shuffled order of the options, with what is left.
  const tiles = useMemo(() => {
    const order: string[] = [];
    for (const option of exercise.options ?? []) if (!order.includes(option.label)) order.push(option.label);
    return order;
  }, [exercise.options]);
  const left = (letter: string) => letters.filter((item) => item === letter).length - typed.filter((item) => item === letter).length;
  const wrongAt = typed.findIndex((letter, index) => letter !== letters[index]);
  const isCorrect = isSubmitted && selectedAnswer === answer;

  function add(letter: string) {
    if (isSubmitted || left(letter) <= 0) return;
    const next = [...typed, letter];
    setTyped(next);
    if (next.length === letters.length) onSubmit(next.join(''));
  }

  function takeHint() {
    if (isSubmitted) return;
    // Drop a wrong tail first, then place the next right letter.
    const kept = wrongAt >= 0 ? typed.slice(0, wrongAt) : typed;
    const next = [...kept, letters[kept.length]];
    setTyped(next);
    onHint?.();
    if (next.length === letters.length) onSubmit(next.join(''));
  }

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
      if (event.key === 'Backspace') {
        event.preventDefault();
        setTyped((current) => current.slice(0, -1));
        return;
      }
      if (event.key.length !== 1 || event.repeat) return;
      // A plain «e» picks «é» when only the accented letter is left.
      const exact = tiles.find((tile) => tile === event.key.toLocaleLowerCase() && left(tile) > 0);
      const loose = exact ?? tiles.find((tile) => plain(tile) === plain(event.key) && left(tile) > 0);
      if (loose) {
        event.preventDefault();
        add(loose);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    <LessonCard
      className="lesson-exercise-card lesson-letters-card"
      header={
        <header className="exercise-header lesson-prototype-header">
          <span className="eyebrow">{copy.eyebrow}</span>
          <CenteredWordBlock
            title={exercise.prompt}
            subtitle={copy.hint}
            titleClassName="lesson-prompt-title lesson-translation"
            subtitleClassName="lesson-prompt-copy"
          />
        </header>
      }
      visual={<WordImage word={word} size="large" className="lesson-word-image lesson-choice-image" />}
      body={
        <div className="letters">
          <div
            className={['letters-slots', isSubmitted ? (isCorrect ? 'correct' : 'incorrect') : ''].filter(Boolean).join(' ')}
            lang={lang}
            aria-label={`Собрано: ${typed.join('')}`}
          >
            {letters.map((letter, index) => {
              const value = typed[index];
              const wrong = value !== undefined && value !== letter;
              return (
                <span
                  key={index}
                  className={['letters-slot', value !== undefined ? 'filled' : '', wrong ? 'wrong' : '', letter === ' ' ? 'space' : ''].filter(Boolean).join(' ')}
                >
                  {isSubmitted && !isCorrect ? letter : value ?? ''}
                </span>
              );
            })}
            {!isSubmitted && onHint ? (
              <HintButton label="Подсказка: следующая буква" onClick={takeHint} />
            ) : null}
          </div>

          {isSubmitted ? (
            <div className={isCorrect ? 'answer-feedback success' : 'answer-feedback error'}>
              <div>
                <strong>{isCorrect ? (hintsUsed ? 'Верно, с подсказкой' : 'Верно') : 'Правильно так:'}</strong>
                <span lang={lang}>{getDisplayWord(word)}</span>
                <span className="answer-feedback-translation" lang="ru">{word.translation}</span>
                <AnswerContext word={word} />
              </div>
            </div>
          ) : (
            <div className="letters-bank" lang={lang}>
              {tiles.map((tile) => {
                const count = left(tile);
                return (
                  <button
                    key={tile}
                    type="button"
                    className="letter-tile"
                    disabled={count <= 0}
                    onClick={() => add(tile)}
                    aria-label={`${tile === ' ' ? 'пробел' : tile}${count > 1 ? `, осталось ${count}` : ''}`}
                  >
                    {tile === ' ' ? '␣' : tile}
                    {count > 1 ? <span className="letter-tile-count">{count}</span> : null}
                  </button>
                );
              })}
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
          ) : null}
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
