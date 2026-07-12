import type { Word } from '../types';
import { getJapaneseExampleReading } from '../lib/wordPresentation';

interface JapaneseExampleReadingProps {
  word: Word;
}

export function JapaneseExampleReading({ word }: JapaneseExampleReadingProps) {
  const reading = getJapaneseExampleReading(word);

  if (!reading) {
    return null;
  }

  return (
    <p className="japanese-example-reading" aria-label={`Чтение примера: ${reading}`}>
      <span className="japanese-example-reading-label">Хирагана</span>
      <span>{reading}</span>
    </p>
  );
}
