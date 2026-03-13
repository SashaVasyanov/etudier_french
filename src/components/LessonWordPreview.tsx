import type { Word } from '../types';
import { LessonCard } from './LessonCard';
import { WordImage } from './WordImage';

interface LessonWordPreviewProps {
  word: Word;
  current: number;
  total: number;
  onReplayAudio: () => void;
  onMarkKnown?: () => void;
  onNext: () => void;
}

export function LessonWordPreview({
  word,
  current,
  total,
  onReplayAudio,
  onMarkKnown,
  onNext,
}: LessonWordPreviewProps) {
  return (
    <LessonCard
      className="preview-card"
      header={
        <header className="exercise-header lesson-focus-header">
          <span className="eyebrow">Новые слова</span>
          <h2 className="exercise-title lesson-word-title">{word.original}</h2>
          <div className="question-block lesson-focus-copy">
            <p className="question-primary lesson-translation">{word.translation}</p>
            <p className="question-secondary">
              {word.transcription} · {word.part_of_speech} · {word.level}
            </p>
          </div>
        </header>
      }
      visual={<WordImage word={word} size="large" className="lesson-word-image" />}
      body={
        <>
          <div className="example-card">
            <p className="example-original">{word.example_original}</p>
            <p className="example-translation">{word.example_translation}</p>
          </div>

          <div className="preview-meta">
            <span>
              {current} / {total}
            </span>
            <span>{word.tags.join(' · ')}</span>
          </div>
        </>
      }
      actions={
        <>
          <button type="button" className="ghost-button" onClick={onReplayAudio}>
            Прослушать
          </button>
          {onMarkKnown ? (
            <button type="button" className="secondary-button" onClick={onMarkKnown}>
              Уже знаю
            </button>
          ) : null}
          <button type="button" className="primary-button" onClick={onNext}>
            Далее
          </button>
        </>
      }
    />
  );
}
