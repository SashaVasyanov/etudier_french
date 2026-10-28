import { Fragment, type ReactNode } from 'react';
import { alignFurigana } from '../lib/furigana';
import { getReadingPreferences } from '../lib/readingPrefs';

interface JapaneseSentenceProps {
  text: string;
  /** Full hiragana reading; furigana only when it lines up with the text. */
  reading?: string | null;
  /** The part to mark (the studied word), as a character range of `text`. */
  highlight?: { start: number; end: number } | null;
}

/** Whether the sentence will carry furigana (then no separate reading line). */
export function hasFurigana(text: string, reading?: string | null): boolean {
  return Boolean(reading && getReadingPreferences().furigana && alignFurigana(text, reading));
}

function marked(text: string, from: number, highlight: JapaneseSentenceProps['highlight']): ReactNode {
  if (!highlight) return text;
  const start = Math.max(highlight.start - from, 0);
  const end = Math.min(highlight.end - from, text.length);
  if (end <= 0 || start >= text.length || start >= end) return text;
  return <>{text.slice(0, start)}<mark>{text.slice(start, end)}</mark>{text.slice(end)}</>;
}

/**
 * A sentence with the studied word marked, and with furigana over its kanji
 * when that setting is on. Works for French text too (no reading).
 */
export function JapaneseSentence({ text, reading, highlight = null }: JapaneseSentenceProps) {
  const parts = reading && getReadingPreferences().furigana ? alignFurigana(text, reading) : null;
  if (!parts) return <>{marked(text, 0, highlight)}</>;
  let offset = 0;
  return (
    <>
      {parts.map((part, index) => {
        const from = offset;
        offset += part.text.length;
        if (part.reading === undefined) return <Fragment key={index}>{marked(part.text, from, highlight)}</Fragment>;
        const ruby = <ruby>{part.text}<rt>{part.reading}</rt></ruby>;
        const inMark = highlight && from < highlight.end && offset > highlight.start;
        return <Fragment key={index}>{inMark ? <mark>{ruby}</mark> : ruby}</Fragment>;
      })}
    </>
  );
}
