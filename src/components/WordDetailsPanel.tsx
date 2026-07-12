import type { Word } from '../types';
import { JapaneseExampleReading } from './JapaneseExampleReading';
import {
  getPartOfSpeechLabel,
  getWordDescription,
  getWordExampleLabel,
} from '../lib/wordPresentation';

interface WordDetailsPanelProps {
  word: Word;
}

export function WordDetailsPanel({ word }: WordDetailsPanelProps) {
  return (
    <div className="word-details-grid">
      <div className="flashcard-meta-item">
        <span className="eyebrow">Что это</span>
        <strong>{getPartOfSpeechLabel(word.part_of_speech)}</strong>
        <p className="detail-copy">{getWordDescription(word)}</p>
      </div>
      <div className="flashcard-meta-item">
        <span className="eyebrow">{getWordExampleLabel(word)}</span>
        <strong>{word.example_original}</strong>
        <JapaneseExampleReading word={word} />
        {word.example_translation ? <p className="detail-copy word-example-translation">{word.example_translation}</p> : null}
      </div>
    </div>
  );
}
