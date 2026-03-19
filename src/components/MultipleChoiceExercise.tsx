import type { Exercise, Word } from '../types';
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
  onReplayAudio?: () => void;
  onNext: () => void;
}

export function MultipleChoiceExercise({
  exercise,
  word,
  selectedAnswer,
  isSubmitted,
  onSelect,
  onReplayAudio,
  onNext,
}: MultipleChoiceExerciseProps) {
  const isAudioExercise = exercise.type === 'audio_to_translation_choice';
  const isOriginalExercise = exercise.type === 'original_to_translation_choice';
  const shouldShowImage = !isAudioExercise;

  return (
    <LessonCard
      className="lesson-exercise-card"
      header={
        <header className="exercise-header lesson-focus-header">
          <span className="eyebrow">Упражнение</span>
          <h2 className="exercise-title">{exercise.prompt}</h2>
          {isOriginalExercise ? (
            <CenteredWordBlock
              title={word.original}
              meta={word.part_of_speech}
              titleClassName="lesson-word-title"
            />
          ) : null}
          {exercise.type === 'translation_to_original_choice' ? (
            <CenteredWordBlock
              title={word.translation}
              meta="Выберите французское слово"
              titleClassName="lesson-translation"
            />
          ) : null}
          {isAudioExercise ? (
            <div className="audio-panel lesson-audio-panel">
              <button className="audio-button audio-button-prominent" type="button" onClick={onReplayAudio}>
                Повторить аудио
              </button>
              <p className="audio-hint">Слушайте внимательно и выберите точный перевод.</p>
            </div>
          ) : null}
        </header>
      }
      visual={shouldShowImage ? <WordImage word={word} size="small" className="lesson-word-image" /> : null}
      body={
        <div className="choice-list">
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
      }
      actions={
        isSubmitted ? (
          <button type="button" className="primary-button full-width" onClick={onNext}>
            Далее
          </button>
        ) : null
      }
    />
  );
}
