import { useEffect } from 'react';
import type { Word } from '../types';
import { AppIcon } from './AppIcon';
import { LessonCard } from './LessonCard';
import { WordImage } from './WordImage';
import { WordExamplesList } from './WordExamplesList';
import { WordFrequencyBadge } from './WordFrequencyBadge';
import { JapaneseSentence } from './JapaneseSentence';
import { ReportIssueButton } from './ReportIssue';
import { FRENCH_GENDER_LABELS, getDisplayWord, getFrenchGender, getLessonWordNotes, getPartOfSpeechLabel } from '../lib/wordPresentation';
import { getWordLevelLabel } from '../lib/levels';
import { formatTranscription } from '../lib/readingPrefs';
import '../styles/word-card.css';

interface LessonWordPreviewProps {
  word: Word;
  current: number;
  total: number;
  onReplayAudio: () => void;
  onMarkKnown?: () => void;
  onIgnoreWord?: () => void;
  onNext: () => void;
}

/**
 * A new word, the way a learner's dictionary shows it: the picture, the word
 * with its translation and sound, pronunciation and how common it is, a short
 * definition in the studied language and two examples with the word marked.
 */
export function LessonWordPreview({
  word,
  onReplayAudio,
  onMarkKnown,
  onIgnoreWord,
  onNext,
}: LessonWordPreviewProps) {
  const gender = getFrenchGender(word);
  const transcription = formatTranscription(word.transcription, word.language);
  const lang = word.language === 'japanese' ? 'ja' : 'fr';

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
      className="lesson-study-view word-card-view"
      header={<></>}
      body={
        <article className="word-card">
          <div className="word-card-hero">
            <WordImage word={word} size="large" className="word-card-image" />
            <div className="word-card-banner">
              <div className="word-card-title-row">
                <h2 className="word-card-word" lang={lang}>{getDisplayWord(word)}</h2>
                <button type="button" className="word-card-sound" onClick={onReplayAudio} aria-label="Прослушать слово" title="Прослушать слово">
                  <AppIcon name="volume" size={22} />
                </button>
              </div>
              <p className="word-card-translation">{word.translation}</p>
            </div>
          </div>

          <div className="word-card-meta">
            <WordFrequencyBadge frequency={word.frequency} />
            <span className="word-card-facts">
              {transcription ? <span className="word-card-ipa" lang={lang}>{transcription}</span> : null}
              <span>{getPartOfSpeechLabel(word.part_of_speech)}</span>
              {gender ? <span className={`gender-mark gender-${gender}`}>{FRENCH_GENDER_LABELS[gender]}</span> : null}
              <span>{getWordLevelLabel(word)}</span>
            </span>
          </div>

          {word.definition ? (
            <div className="word-card-definition">
              <p className="word-card-definition-text" lang={lang}>
                <JapaneseSentence text={word.definition} reading={word.definition_reading} />
              </p>
              {word.definition_translation ? <p className="word-card-definition-translation" lang="ru">{word.definition_translation}</p> : null}
            </div>
          ) : (
            getLessonWordNotes(word).map((note) => <p key={note} className="word-card-note">{note}</p>)
          )}

          <WordExamplesList word={word} />

          <div className="word-card-actions">
            <div className="word-card-secondary">
              {onMarkKnown ? (
                <button type="button" className="word-card-link word-card-known" onClick={onMarkKnown}>
                  <AppIcon name="check" size={18} /> Уже знаю это слово
                </button>
              ) : null}
              {onIgnoreWord ? (
                <button type="button" className="word-card-link word-card-ignore" onClick={onIgnoreWord}>
                  <AppIcon name="close" size={18} /> Не хочу учить
                </button>
              ) : null}
              <ReportIssueButton word={word} />
            </div>
            <button type="button" className="primary-button word-card-next" onClick={onNext}>
              Далее
            </button>
          </div>
        </article>
      }
    />
  );
}
