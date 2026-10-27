import { useMemo, useState } from 'react';
import { playTextAudio } from '../lib/audio';
import { pickReadingSentences } from '../lib/reading';
import type { AppStorage, Word } from '../types';
import { AppIcon } from './AppIcon';
import { SentenceAudioButton } from './SentenceAudioButton';

const SENTENCES = 6;

interface ReadingScreenProps {
  words: Word[];
  storage: AppStorage;
  onClose: () => void;
}

/** Marks the studied word inside its sentence (case-insensitive, as written). */
function Highlighted({ text, word }: { text: string; word: string }) {
  const at = word ? text.toLocaleLowerCase().indexOf(word.toLocaleLowerCase()) : -1;
  if (at < 0) return <>{text}</>;
  return <>{text.slice(0, at)}<mark>{text.slice(at, at + word.length)}</mark>{text.slice(at + word.length)}</>;
}

/**
 * «Чтение»: a few sentences built from words already met. Read first, check
 * the translation per sentence, listen to one or to all of them.
 */
export default function ReadingScreen({ words, storage, onClose }: ReadingScreenProps) {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1_000_000));
  const [shown, setShown] = useState<Set<string>>(new Set());
  const sentences = useMemo(() => pickReadingSentences(words, storage, SENTENCES, seed), [seed, storage, words]);
  const language = words[0]?.language ?? 'french';
  const lang = language === 'japanese' ? 'ja' : 'fr';

  function toggle(id: string) {
    setShown((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <section className="radicals-page reading-page">
      <header className="radicals-hero">
        <div>
          <span className="radical-question-kicker">Чтение</span>
          <h1>Фразы из ваших слов</h1>
          <p>Прочитайте фразу, попробуйте понять её сами — потом откройте перевод. Выделено слово, которое вы учите.</p>
        </div>
        <div className="reading-actions">
          <button type="button" className="radical-secondary-button" onClick={onClose}>На главную</button>
          <button
            type="button"
            className="radical-secondary-button"
            onClick={() => void playTextAudio(sentences.map((sentence) => sentence.original).join(' '), language)}
          >
            Прослушать всё
          </button>
          <button type="button" className="radical-primary-button" onClick={() => { setSeed((value) => value + 1); setShown(new Set()); }}>
            Другие фразы <AppIcon name="arrow-right" size={18} />
          </button>
        </div>
      </header>

      <ol className="reading-list">
        {sentences.map((sentence) => (
          <li key={sentence.wordId} className="reading-item">
            <div className="example-line">
              <p className="reading-original" lang={lang}><Highlighted text={sentence.original} word={sentence.word} /></p>
              <SentenceAudioButton text={sentence.original} language={language} />
            </div>
            {shown.has(sentence.wordId) ? (
              <p className="reading-translation">{sentence.translation}</p>
            ) : (
              <button type="button" className="text-action-button reading-reveal" onClick={() => toggle(sentence.wordId)}>
                Показать перевод
              </button>
            )}
          </li>
        ))}
      </ol>
      {sentences.length === 0 ? <p className="analytics-empty-copy">Фразы появятся после первого урока.</p> : null}
    </section>
  );
}
