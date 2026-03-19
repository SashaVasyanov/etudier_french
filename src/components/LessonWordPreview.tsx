import type { Word } from '../types';
import { AudioButton } from './AudioButton';
import { CenteredWordBlock } from './CenteredWordBlock';
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
      className="lesson-study-view"
      header={
        <header className="exercise-header lesson-focus-header">
          <span className="eyebrow">
            Изучение слова · {current} / {total}
          </span>
          <CenteredWordBlock
            title={word.original}
            subtitle={word.translation}
            meta={word.part_of_speech}
            titleClassName="exercise-title lesson-word-title"
            subtitleClassName="lesson-translation"
          />
        </header>
      }
      body={
        <div className="study-word-body">
          <WordImage word={word} size="large" className="lesson-word-image study-word-image" />

          <div className="study-word-actions">
            <AudioButton label="Прослушать слово" onClick={onReplayAudio} />
            <button type="button" className="primary-button full-width" onClick={onNext}>
              Понял, дальше
            </button>
          </div>

          <div className="study-word-panel">
            <div className="study-word-meta">
              <div className="flashcard-meta-item">
                <span className="eyebrow">Пример</span>
                <strong>{word.example_original}</strong>
              </div>
              <div className="flashcard-meta-item">
                <span className="eyebrow">Перевод примера</span>
                <strong>{word.example_translation}</strong>
              </div>
            </div>
          </div>
        </div>
      }
      actions={
        onMarkKnown ? (
          <button type="button" className="secondary-button full-width" onClick={onMarkKnown}>
            Уже знаю
          </button>
        ) : null
      }
    />
  );
}
