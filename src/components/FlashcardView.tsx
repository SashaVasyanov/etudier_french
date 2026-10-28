import { useEffect, useState } from 'react';
import type { Word } from '../types';
import { AudioButton } from './AudioButton';
import { CenteredWordBlock } from './CenteredWordBlock';
import { LessonCard } from './LessonCard';
import { WordDetailsPanel } from './WordDetailsPanel';
import { WordImage } from './WordImage';
import { getDisplayWord, getPartOfSpeechLabel } from '../lib/wordPresentation';
import { getWordLevelLabel } from '../lib/levels';
import { formatTranscription } from '../lib/readingPrefs';

interface FlashcardViewProps {
  word: Word;
  current: number;
  total: number;
  onReplayAudio: () => void;
  onMarkKnown?: () => void;
  onIgnoreWord?: () => void;
  onDefer: () => void;
  onNext: () => void;
}

export function FlashcardView({
  word,
  current,
  total,
  onReplayAudio,
  onMarkKnown,
  onIgnoreWord,
  onDefer,
  onNext,
}: FlashcardViewProps) {
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    setIsRevealed(false);
  }, [word.id]);

  // Space shows the translation, Enter moves on once it is shown.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.closest('button, input, textarea, select, a'))) return;
      if (event.key === ' ') {
        event.preventDefault();
        setIsRevealed((value) => !value);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (isRevealed) onNext();
        else setIsRevealed(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isRevealed, onNext]);

  return (
    <LessonCard
      className="flashcard-view"
      header={
        <header className="exercise-header lesson-focus-header">
          <span className="eyebrow">
            Карточка слова · {current} / {total}
          </span>
          <CenteredWordBlock
            title={getDisplayWord(word)}
            subtitle={isRevealed ? word.translation : 'Попробуйте вспомнить перевод'}
            meta={`${getPartOfSpeechLabel(word.part_of_speech)} · ${getWordLevelLabel(word)}`}
            titleClassName="exercise-title lesson-word-title"
            subtitleClassName="lesson-translation"
          />
        </header>
      }
      body={
        <div className="flashcard-body">
          <WordImage word={word} size="large" className="lesson-word-image flashcard-image" />

          <div className="flashcard-primary-actions">
            <AudioButton label="Прослушать" onClick={onReplayAudio} />
            <button
              type="button"
              className={isRevealed ? 'ghost-button full-width' : 'primary-button full-width'}
              onClick={() => setIsRevealed((value) => !value)}
            >
              {isRevealed ? 'Скрыть детали' : <>Показать перевод <kbd className="key-hint" aria-hidden="true">Пробел</kbd></>}
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
                    <strong>{formatTranscription(word.transcription, word.language) || '—'}</strong>
                  </div>
                </div>
                <WordDetailsPanel word={word} />
              </>
            ) : (
              <p className="flashcard-hint">Сначала попробуйте вспомнить перевод и произношение, затем откройте детали карточки.</p>
            )}
          </div>
        </div>
      }
      actions={
        isRevealed ? (
          <>
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
            <button type="button" className="ghost-button full-width" onClick={onDefer}>
              Повторить позже
            </button>
            <button type="button" className="primary-button full-width" onClick={onNext}>
              Дальше <kbd className="key-hint" aria-hidden="true">Enter</kbd>
            </button>
          </>
        ) : (
          <>
            <button type="button" className="ghost-button full-width" onClick={onDefer}>
              Вернуться позже
            </button>
            {onIgnoreWord ? (
              <button type="button" className="danger-button quiet-danger full-width" onClick={onIgnoreWord}>
                Не хочу учить
              </button>
            ) : null}
          </>
        )
      }
    />
  );
}
