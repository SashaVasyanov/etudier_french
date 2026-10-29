import type { WordFrequency } from '../types';
import { FREQUENCY_LABELS } from '../lib/wordPresentation';
import '../styles/word-card.css';

const LEVEL: Record<WordFrequency, number> = { high: 3, mid: 2, low: 1 };

/** Three bars, as many filled as the word is common. */
export function WordFrequencyBadge({ frequency }: { frequency?: WordFrequency }) {
  if (!frequency) return null;
  const filled = LEVEL[frequency];
  return (
    <span className={`word-frequency word-frequency-${frequency}`}>
      <span className="word-frequency-bars" aria-hidden="true">
        {[3, 2, 1].map((bar) => <i key={bar} className={bar <= filled ? 'on' : undefined} />)}
      </span>
      {FREQUENCY_LABELS[frequency]}
    </span>
  );
}
