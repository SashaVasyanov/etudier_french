import type { Word } from '../types';
import { AudioButton } from './AudioButton';
import { CenteredWordBlock } from './CenteredWordBlock';
import { LessonCard } from './LessonCard';
import { WordDetailsPanel } from './WordDetailsPanel';
import { WordImage } from './WordImage';
import { getDisplayWord, getPartOfSpeechLabel } from '../lib/wordPresentation';

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
            title={getDisplayWord(word)}
            subtitle={word.translation}
            meta={`${getPartOfSpeechLabel(word.part_of_speech)} · ${word.level}`}
            titleClassName="exercise-title lesson-word-title"
            subtitleClassName="lesson-translation"
          />
        </header>
      }
      body={
        <div className="study-word-body">
          <div className="study-word-grid">
            <WordImage word={word} size="large" className="lesson-word-image study-word-image" />

            <div className="study-word-panel">
              <WordDetailsPanel word={word} />
            </div>
          </div>

          <div className="study-word-actions">
            <AudioButton label="Прослушать слово" onClick={onReplayAudio} />
            <button type="button" className="primary-button full-width" onClick={onNext}>
              Понял, дальше
            </button>
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
