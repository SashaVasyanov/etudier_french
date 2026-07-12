import type { Word } from '../types';
import { getDisplayWord, getJapaneseHiraganaReading } from '../lib/wordPresentation';

interface AnswerWordDetailsProps {
  word: Word;
}

export function AnswerWordDetails({ word }: AnswerWordDetailsProps) {
  if (word.language !== 'japanese') {
    return <span>{getDisplayWord(word)}</span>;
  }

  const reading = getJapaneseHiraganaReading(word);
  const showReading = Boolean(reading && reading !== word.original);

  return (
    <span className="answer-word-details" lang="ja">
      <span className="answer-feedback-word">{word.original}</span>
      {showReading ? <span className="answer-feedback-reading">{reading}</span> : null}
      <span className="answer-feedback-translation" lang="ru">{word.translation}</span>
    </span>
  );
}
