import { useEffect, useRef } from 'react';
import type { Exercise, Word } from '../types';
import { getDisplayWord, getExerciseCopy } from '../lib/wordPresentation';
import { CenteredWordBlock } from './CenteredWordBlock';
import { LessonCard } from './LessonCard';
import { LessonChoiceButton } from './LessonChoiceButton';
import { WordImage } from './WordImage';

interface MultipleChoiceExerciseProps {
  exercise: Exercise;
  word: Word;
  selectedAnswer: string | null;
  isSubmitted: boolean;
  onSelect: (answer: string) => void;
  onNext: () => void;
  onReplayAudio?: () => void;
  onMarkKnown?: () => void;
  onIgnoreWord?: () => void;
}

export function MultipleChoiceExercise({
  exercise,
  word,
  selectedAnswer,
  isSubmitted,
  onSelect,
  onNext,
  onReplayAudio,
  onMarkKnown,
  onIgnoreWord,
}: MultipleChoiceExerciseProps) {
  const nextButtonRef = useRef<HTMLButtonElement | null>(null);
  const isAudioExercise = exercise.type === 'audio_to_translation_choice';
  const isOriginalExercise = exercise.type === 'original_to_translation_choice';
  const isTranslationExercise = exercise.type === 'translation_to_original_choice';
  const copy = getExerciseCopy(exercise.type, word.language);
  const feedbackLabel = getDisplayWord(word);
  const cardClassName = [
    'lesson-exercise-card',
    isTranslationExercise ? 'lesson-image-choice-card' : '',
    isOriginalExercise ? 'lesson-translation-choice-card' : '',
    isAudioExercise ? 'lesson-audio-choice-card' : '',
  ]
    .filter(Boolean)
    .join(' ');

  useEffect(() => {
    if (!isSubmitted) {
      return undefined;
    }

    nextButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Enter') {
        return;
      }

      const target = event.target;

      if (
        target instanceof HTMLButtonElement ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement
      ) {
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
      className={cardClassName}
      header={
        <header className="exercise-header lesson-prototype-header">
          <span className="eyebrow">{copy.eyebrow}</span>
          {isOriginalExercise ? (
            <CenteredWordBlock
              title={getDisplayWord(word)}
              subtitle={word.transcription || copy.hint}
              titleClassName="lesson-prompt-title lesson-word-title"
            />
          ) : null}
          {isTranslationExercise ? (
            <CenteredWordBlock
              title={word.translation}
              subtitle={copy.hint}
              titleClassName="lesson-prompt-title lesson-translation"
              subtitleClassName="lesson-prompt-copy"
            />
          ) : null}
          {isAudioExercise ? (
            <div className="audio-panel lesson-audio-panel">
              <button className="audio-button audio-button-prominent" type="button" onClick={onReplayAudio}>
                Повторить аудио
              </button>
              <p className="lesson-prompt-copy">{copy.hint}</p>
            </div>
          ) : null}
        </header>
      }
      visual={
        (isOriginalExercise || isTranslationExercise) && isSubmitted ? (
          <WordImage word={word} size="large" className="lesson-word-image lesson-choice-image" />
        ) : null
      }
      body={
        <>
          <div
            className={[
              'choice-list',
              isTranslationExercise ? 'lesson-choice-grid' : 'lesson-choice-stack',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {exercise.options?.map((option) => {
              const isCorrect = option.label === exercise.correctAnswer;
              const isSelected = option.label === selectedAnswer;
              const state = isSubmitted
                ? isCorrect
                  ? 'correct'
                  : isSelected
                    ? 'incorrect'
                    : 'muted'
                : isSelected
                  ? 'selected'
                  : 'default';

              return (
                <LessonChoiceButton
                  key={option.id + option.label}
                  state={state}
                  disabled={isSubmitted}
                  onClick={() => onSelect(option.label)}
                >
                  {option.label}
                </LessonChoiceButton>
              );
            })}
          </div>
          {isSubmitted ? (
            <div className={selectedAnswer === exercise.correctAnswer ? 'answer-feedback success' : 'answer-feedback error'}>
              <div>
                <strong>{selectedAnswer === exercise.correctAnswer ? 'Верно' : 'Неправильно'}</strong>
                <span>{feedbackLabel}</span>
              </div>
              {onReplayAudio ? (
                <button type="button" className="feedback-replay-button" onClick={onReplayAudio}>
                  Прослушать ещё раз
                </button>
              ) : null}
            </div>
          ) : null}
        </>
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
