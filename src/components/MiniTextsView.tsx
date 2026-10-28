import { useMemo, useState } from 'react';
import { MINI_TEXTS, type MiniText, type MiniTextWord } from '../data/miniTexts';
import { playTextAudio } from '../lib/audio';
import { findDictionaryWord, getMiniWordState, indexWords, rankMiniTexts, segmentSentence, type MiniWordState } from '../lib/miniTexts';
import type { AppStorage, LearningLanguage, Word } from '../types';
import { pluralRu } from '../lib/utils';
import { AppIcon } from './AppIcon';
import { SentenceAudioButton } from './SentenceAudioButton';

interface MiniTextsViewProps {
  language: LearningLanguage;
  words: Word[];
  storage: AppStorage;
}

const STATE_LABELS: Record<MiniWordState, string> = {
  known: 'знакомое слово',
  learning: 'вы его учите',
  new: 'новое слово',
  outside: 'нет в словаре',
};

/** Short texts: list ranked by how familiar they are, then one text to read. */
export function MiniTextsView({ language, words, storage }: MiniTextsViewProps) {
  const index = useMemo(() => indexWords(words), [words]);
  const ranked = useMemo(
    () => rankMiniTexts(MINI_TEXTS.filter((text) => text.language === language), index, storage),
    [index, language, storage],
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const open = ranked.find((item) => item.text.id === openId)?.text ?? null;

  if (open) {
    return <MiniTextReader text={open} index={index} storage={storage} onBack={() => setOpenId(null)} />;
  }

  return (
    <div className="mini-text-list">
      {ranked.map(({ text, stats }) => (
        <button key={text.id} type="button" className="mini-text-card" onClick={() => setOpenId(text.id)}>
          <span className="mini-text-level">{language === 'japanese' ? (text.level === 'A1' ? 'N5' : 'N4') : text.level}</span>
          <strong>{text.title}</strong>
          <span lang={language === 'japanese' ? 'ja' : 'fr'} className="mini-text-preview">{text.sentences[0].original}</span>
          <span className="mini-text-meta">
            {stats.inDictionary > 0 ? `знакомо ${stats.met} из ${stats.inDictionary} ${pluralRu(stats.inDictionary, ['слова', 'слов', 'слов'])}` : `${text.sentences.length} предложения`}
          </span>
        </button>
      ))}
    </div>
  );
}

interface MiniTextReaderProps {
  text: MiniText;
  index: Map<string, Word>;
  storage: AppStorage;
  onBack: () => void;
}

function MiniTextReader({ text, index, storage, onBack }: MiniTextReaderProps) {
  const [selected, setSelected] = useState<MiniTextWord | null>(null);
  const [shown, setShown] = useState<Set<number>>(new Set());
  const lang = text.language === 'japanese' ? 'ja' : 'fr';
  const allShown = shown.size === text.sentences.length;
  const selectedState = selected ? getMiniWordState(selected, text, index, storage) : null;
  const selectedEntry = selected ? findDictionaryWord(selected, text, index) : null;

  function toggle(position: number) {
    setShown((current) => {
      const next = new Set(current);
      if (next.has(position)) next.delete(position);
      else next.add(position);
      return next;
    });
  }

  return (
    <article className="mini-text-reader">
      <header className="mini-text-reader-head">
        <button type="button" className="radical-back-button" onClick={onBack}>
          <AppIcon name="arrow-left" size={18} /> Все тексты
        </button>
        <h2>{text.title}</h2>
        <div className="mini-text-reader-actions">
          <button
            type="button"
            className="radical-secondary-button"
            onClick={() => void playTextAudio(text.sentences.map((sentence) => sentence.original).join(' '), text.language)}
          >
            Прослушать текст
          </button>
          <button
            type="button"
            className="radical-secondary-button"
            onClick={() => setShown(allShown ? new Set() : new Set(text.sentences.map((_, position) => position)))}
          >
            {allShown ? 'Скрыть перевод' : 'Перевод всего текста'}
          </button>
        </div>
      </header>

      <p className="mini-text-hint">Нажмите на слово, чтобы увидеть перевод. Подчёркнуты слова, которых вы ещё не учили.</p>

      <ol className="mini-text-sentences">
        {text.sentences.map((sentence, position) => (
          <li key={position} className="mini-text-sentence">
            <div className="example-line">
              <p lang={lang} className="mini-text-original">
                {segmentSentence(sentence.original, text).map((segment, segmentIndex) => {
                  if (!segment.word) return <span key={segmentIndex}>{segment.text}</span>;
                  const word = segment.word;
                  const state = getMiniWordState(word, text, index, storage);
                  return (
                    <button
                      key={segmentIndex}
                      type="button"
                      className={['mini-word', `mini-word-${state}`, selected === word ? 'selected' : ''].filter(Boolean).join(' ')}
                      onClick={() => setSelected(selected === word ? null : word)}
                    >
                      {segment.text}
                    </button>
                  );
                })}
              </p>
              <SentenceAudioButton text={sentence.original} language={text.language} />
            </div>
            {shown.has(position) ? (
              <>
                {sentence.reading ? <p className="reading-kana" lang="ja">{sentence.reading}</p> : null}
                <p className="reading-translation">{sentence.translation}</p>
              </>
            ) : (
              <button type="button" className="text-action-button reading-reveal" onClick={() => toggle(position)}>
                {sentence.reading ? 'Показать чтение и перевод' : 'Показать перевод'}
              </button>
            )}
          </li>
        ))}
      </ol>

      <div className={selected ? 'mini-word-panel' : 'mini-word-panel empty'} aria-live="polite">
        {selected ? (
          <>
            <strong lang={lang}>{selected.form}</strong>
            {selected.reading ? <span lang="ja" className="mini-word-reading">{selected.reading}</span> : null}
            <span className="mini-word-translation">{selected.translation}</span>
            <span className={`mini-word-state mini-word-state-${selectedState}`}>
              {selectedEntry && selectedEntry.original !== selected.form ? `${selectedEntry.original} · ` : ''}
              {selectedState ? STATE_LABELS[selectedState] : ''}
            </span>
          </>
        ) : (
          <span>Выберите слово в тексте.</span>
        )}
      </div>
    </article>
  );
}
