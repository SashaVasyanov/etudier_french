import type { Word } from '../types';
import { AudioButton } from './AudioButton';
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
            <p className="lesson-preview-example">{word.example_original}</p>
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
              <button type="button" className="danger-button full-width" onClick={onIgnoreWord}>
                Не хочу учить
              </button>
            ) : null}
          </div>
        </div>
      }
    />
  );
}
