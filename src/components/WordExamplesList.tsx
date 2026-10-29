import type { Word } from '../types';
import { getExampleHighlight, getWordExamples } from '../lib/wordPresentation';
import { hasFurigana, JapaneseSentence } from './JapaneseSentence';
import { SentenceAudioButton } from './SentenceAudioButton';
import '../styles/word-card.css';

interface WordExamplesListProps {
  word: Word;
  /** Show at most this many examples. */
  limit?: number;
  className?: string;
}

/** Examples with the studied word marked, a play button and the translation. */
export function WordExamplesList({ word, limit, className }: WordExamplesListProps) {
  const examples = getWordExamples(word).slice(0, limit);
  if (examples.length === 0) return null;
  const lang = word.language === 'japanese' ? 'ja' : 'fr';

  return (
    <ul className={['word-examples', className].filter(Boolean).join(' ')}>
      {examples.map((example) => {
        const reading = word.language === 'japanese' ? example.reading ?? null : null;
        const separateReading = reading && !hasFurigana(example.original, reading) ? reading : null;
        return (
          <li key={example.original} className="word-example">
            <SentenceAudioButton text={example.original} language={word.language} />
            <div className="word-example-text">
              <p className="word-example-original" lang={lang}>
                <JapaneseSentence text={example.original} reading={reading} highlight={getExampleHighlight(example)} />
              </p>
              {separateReading ? <p className="word-example-reading" lang="ja">{separateReading}</p> : null}
              {example.translation ? <p className="word-example-translation" lang="ru">{example.translation}</p> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
