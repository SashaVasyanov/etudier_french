import type { Exercise, Word } from '../types';

interface MultipleChoiceExerciseProps {
  exercise: Exercise;
  word: Word;
  selectedAnswer: string | null;
  isSubmitted: boolean;
  onSelect: (answer: string) => void;
  onReplayAudio?: () => void;
}

export function MultipleChoiceExercise({
  exercise,
  word,
  selectedAnswer,
  isSubmitted,
  onSelect,
  onReplayAudio,
}: MultipleChoiceExerciseProps) {
  const isAudioExercise = exercise.type === 'audio_to_translation_choice';
  const isOriginalExercise = exercise.type === 'original_to_translation_choice';

  return (
    <section className="exercise-card">
      <header className="exercise-header">
        <span className="eyebrow">Упражнение</span>
        <h2 className="exercise-title">{exercise.prompt}</h2>
        {isOriginalExercise ? (
          <div className="question-block">
            <p className="question-primary">{word.original}</p>
            <p className="question-secondary">
              {word.transcription} · {word.part_of_speech}
            </p>
          </div>
        ) : null}
        {exercise.type === 'translation_to_original_choice' ? (
          <div className="question-block">
            <p className="question-primary">{word.translation}</p>
            <p className="question-secondary">Выберите слово на французском</p>
          </div>
        ) : null}
        {isAudioExercise ? (
          <div className="audio-panel">
            <button className="audio-button" type="button" onClick={onReplayAudio}>
              Повторить аудио
            </button>
            <p className="audio-hint">Слушайте внимательно и выберите точный перевод</p>
          </div>
        ) : null}
      </header>

      <div className="choice-list">
        {exercise.options?.map((option) => {
          const isCorrect = option.label === exercise.correctAnswer;
          const isSelected = option.label === selectedAnswer;
          const stateClass = isSubmitted
            ? isCorrect
              ? 'choice-button correct'
              : isSelected
                ? 'choice-button incorrect'
                : 'choice-button muted'
            : 'choice-button';

          return (
            <button
              key={option.id + option.label}
              type="button"
              className={stateClass}
              disabled={isSubmitted}
              onClick={() => onSelect(option.label)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
