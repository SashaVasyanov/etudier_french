import type { Word } from '../types';
import { getJapaneseExampleReading } from '../lib/wordPresentation';
import { hasFurigana } from './JapaneseSentence';

interface JapaneseExampleReadingProps {
  word: Word;
}

export function JapaneseExampleReading({ word }: JapaneseExampleReadingProps) {
  const reading = getJapaneseExampleReading(word);

  // With furigana the reading sits over the sentence itself.
  if (!reading || hasFurigana(word.example_original, reading)) {
    return null;
  }

  return (
    <p className="japanese-example-reading" aria-label={`Чтение примера: ${reading}`}>
      <span className="japanese-example-reading-label">Хирагана</span>
      <span>{reading}</span>
    </p>
  );
}
