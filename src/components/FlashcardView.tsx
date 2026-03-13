import { useEffect, useState } from 'react';
import type { Word } from '../types';
import { AudioButton } from './AudioButton';
import { CenteredWordBlock } from './CenteredWordBlock';
import { LessonCard } from './LessonCard';
import { WordImage } from './WordImage';

interface FlashcardViewProps {
  word: Word;
  current: number;
  total: number;
  onReplayAudio: () => void;
  onMarkKnown?: () => void;
  onDefer: () => void;
  onNext: () => void;
}

export function FlashcardView({
  word,
  current,
  total,
  onReplayAudio,
  onMarkKnown,
  onDefer,
  onNext,
}: FlashcardViewProps) {
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    setIsRevealed(false);
  }, [word.id]);

  return (
    <LessonCard
      className="flashcard-view"
      header={
        <header className="exercise-header lesson-focus-header">
          <span className="eyebrow">Карточка слова</span>
          <CenteredWordBlock
            title={word.original}
            subtitle={isRevealed ? word.translation : 'Попробуйте вспомнить перевод'}
            meta={`${word.transcription} · ${word.part_of_speech} · ${current} / ${total}`}
            titleClassName="exercise-title lesson-word-title"
            subtitleClassName="lesson-translation"
          />
        </header>
      }
      visual={<WordImage word={word} size="large" className="lesson-word-image flashcard-image" />}
      body={
        <div className="flashcard-body">
          <div className="flashcard-controls">
            <AudioButton label="Прослушать" onClick={onReplayAudio} />
            <button type="button" className="ghost-button" onClick={() => setIsRevealed((value) => !value)}>
              {isRevealed ? 'Скрыть детали' : 'Показать перевод'}
            </button>
          </div>

          <div className={isRevealed ? 'flashcard-panel revealed' : 'flashcard-panel'}>
            {isRevealed ? (
              <>
                <div className="flashcard-meta-grid">
                  <div className="flashcard-meta-item">
                    <span className="eyebrow">Перевод</span>
                    <strong>{word.translation}</strong>
                  </div>
                  <div className="flashcard-meta-item">
                    <span className="eyebrow">Транскрипция</span>
                    <strong>{word.transcription || '—'}</strong>
                  </div>
                </div>
                <div className="example-card">
                  <p className="example-original">{word.example_original}</p>
                  <p className="example-translation">{word.example_translation}</p>
                </div>
              </>
            ) : (
              <p className="flashcard-hint">Сначала попробуйте вспомнить перевод и произношение, затем откройте детали карточки.</p>
            )}
          </div>
        </div>
      }
      actions={
        <>
          {onMarkKnown ? (
            <button type="button" className="secondary-button" onClick={onMarkKnown}>
              Уже знаю
            </button>
          ) : null}
          <button type="button" className="ghost-button" onClick={onDefer}>
            Повторить позже
          </button>
          <button type="button" className="primary-button" onClick={onNext}>
            Дальше
          </button>
        </>
      }
    />
  );
}
