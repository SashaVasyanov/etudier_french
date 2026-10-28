import { useMemo, useState } from 'react';
import { playTextAudio } from '../lib/audio';
import { pickReadingSentences } from '../lib/reading';
import type { AppStorage, Word } from '../types';
import { AppIcon } from './AppIcon';
import { MiniTextsView } from './MiniTextsView';
import { hasFurigana, JapaneseSentence } from './JapaneseSentence';
import { SentenceAudioButton } from './SentenceAudioButton';

const SENTENCES = 6;

interface ReadingScreenProps {
  words: Word[];
  /** Every dictionary word, also from packs that are switched off (for texts). */
  dictionaryWords: Word[];
  storage: AppStorage;
  onClose: () => void;
}

/** Where the studied word sits in its sentence (case-insensitive, as written). */
function findWord(text: string, word: string): { start: number; end: number } | null {
  const at = word ? text.toLocaleLowerCase().indexOf(word.toLocaleLowerCase()) : -1;
  return at < 0 ? null : { start: at, end: at + word.length };
}

/**
 * «Чтение»: a few sentences built from words already met. Read first, check
 * the translation per sentence, listen to one or to all of them.
 */
export default function ReadingScreen({ words, dictionaryWords, storage, onClose }: ReadingScreenProps) {
  const [mode, setMode] = useState<'phrases' | 'texts'>('phrases');
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1_000_000));
  const [shown, setShown] = useState<Set<string>>(new Set());
  const sentences = useMemo(() => pickReadingSentences(words, storage, SENTENCES, seed), [seed, storage, words]);
  const language = words[0]?.language ?? 'french';
  const lang = language === 'japanese' ? 'ja' : 'fr';
  const textWords = useMemo(() => dictionaryWords.filter((word) => word.language === language), [dictionaryWords, language]);

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
          <h1>{mode === 'texts' ? 'Короткие тексты' : 'Фразы из ваших слов'}</h1>
          {mode === 'texts' ? (
            <p>Несколько предложений подряд. Сначала самые знакомые: в них больше слов, которые вы уже учили.</p>
          ) : (
          <p>Прочитайте фразу, попробуйте понять её сами — потом откройте перевод{language === 'japanese' ? ' и чтение' : ''}. Выделено слово, которое вы учите.</p>
          )}
          <div className="tab-row reading-mode" role="group" aria-label="Что читать">
            <button type="button" aria-pressed={mode === 'phrases'} className={mode === 'phrases' ? 'tab-button active' : 'tab-button'} onClick={() => setMode('phrases')}>Фразы</button>
            <button type="button" aria-pressed={mode === 'texts'} className={mode === 'texts' ? 'tab-button active' : 'tab-button'} onClick={() => setMode('texts')}>Тексты</button>
          </div>
        </div>
        {mode === 'phrases' ? (
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
        ) : (
          <div className="reading-actions">
            <button type="button" className="radical-secondary-button" onClick={onClose}>На главную</button>
          </div>
        )}
      </header>

      {mode === 'texts' ? <MiniTextsView language={language} words={textWords} storage={storage} /> : null}
      {mode === 'phrases' ? (
      <ol className="reading-list">
        {sentences.map((sentence) => (
          <li key={sentence.wordId} className="reading-item">
            <div className="example-line">
              <p className="reading-original" lang={lang}><JapaneseSentence text={sentence.original} reading={sentence.reading} highlight={findWord(sentence.original, sentence.word)} /></p>
              <SentenceAudioButton text={sentence.original} language={language} />
            </div>
            {shown.has(sentence.wordId) ? (
              <>
                {sentence.reading && !hasFurigana(sentence.original, sentence.reading) ? (
                  <p className="reading-kana" lang="ja">{sentence.reading}</p>
                ) : null}
                <p className="reading-translation">{sentence.translation}</p>
              </>
            ) : (
              <button type="button" className="text-action-button reading-reveal" onClick={() => toggle(sentence.wordId)}>
                {sentence.reading && !hasFurigana(sentence.original, sentence.reading) ? 'Показать чтение и перевод' : 'Показать перевод'}
              </button>
            )}
          </li>
        ))}
      </ol>
      ) : null}
      {mode === 'phrases' && sentences.length === 0 ? <p className="analytics-empty-copy">Фразы появятся после первого урока.</p> : null}
    </section>
  );
}
