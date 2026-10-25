import { useEffect } from 'react';
import type { Word } from '../types';
import { AudioButton } from './AudioButton';
import { JapaneseExampleReading } from './JapaneseExampleReading';
import { LessonCard } from './LessonCard';
import { WordImage } from './WordImage';
import { getDisplayWord, getLessonWordBadge, getLessonWordNotes, getPartOfSpeechLabel } from '../lib/wordPresentation';

interface LessonWordPreviewProps {
  word: Word;
  current: number;
  total: number;
  onReplayAudio: () => void;
  onMarkKnown?: () => void;
  onIgnoreWord?: () => void;
  onNext: () => void;
}

export function LessonWordPreview({
  word,
  onReplayAudio,
  onMarkKnown,
  onIgnoreWord,
  onNext,
}: LessonWordPreviewProps) {
  const lessonNotes = getLessonWordNotes(word);

  // Enter (or Space) moves on, like the main button.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.key !== 'Enter' && event.key !== ' ') || event.defaultPrevented || event.repeat || event.isComposing) return;
      if (event.target instanceof Element && event.target.closest('button, input, textarea, select, a, [contenteditable="true"]')) return;
      event.preventDefault();
      onNext();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNext]);

  return (
    <LessonCard
      className="lesson-study-view"
      header={<></>}
      body={
        <div className="lesson-preview-shell">
          <div className="lesson-preview-card">
            <WordImage word={word} size="large" className="lesson-word-image lesson-preview-image" />
            <div className="lesson-preview-details">
              <div className="lesson-preview-topline">
                <div className="lesson-preview-copy">
                  <h2 className="lesson-preview-title">{getDisplayWord(word)}</h2>
                  <p className="lesson-preview-translation">{word.translation}</p>
                </div>
                <AudioButton label="Прослушать" onClick={onReplayAudio} />
              </div>
              <p className="lesson-preview-description">{word.transcription || 'Транскрипция уточняется'}</p>
              <span className="lesson-preview-meta">{getPartOfSpeechLabel(word.part_of_speech)} · {word.level}</span>
            </div>
          </div>

          <div className="lesson-preview-content">
            <div className="lesson-preview-badge-row">
              <span className="lesson-preview-badge">{getLessonWordBadge(word)}</span>
            </div>
            <ul className="lesson-preview-note-list">
              {lessonNotes.map((note) => (
                <li key={note} className="lesson-preview-note-item">
                  {note}
                </li>
              ))}
            </ul>
            <div className="lesson-preview-example-card">
              <p className="lesson-preview-example">{word.example_original}</p>
              <JapaneseExampleReading word={word} />
              {word.example_translation ? <p className="lesson-preview-example-translation">{word.example_translation}</p> : null}
            </div>
          </div>

          <div className="lesson-preview-toolbar">
            <button type="button" className="primary-button full-width" onClick={onNext}>
              Понял, дальше
            </button>
            {onMarkKnown ? (
              <button type="button" className="secondary-button full-width" onClick={onMarkKnown}>
                Уже знаю это слово
              </button>
            ) : null}
            {onIgnoreWord ? (
              <button type="button" className="danger-button quiet-danger full-width" onClick={onIgnoreWord}>
                Не хочу учить
              </button>
            ) : null}
          </div>
        </div>
      }
    />
  );
}
