import type { Word } from '../types';
import { createFallbackWordImage } from '../lib/wordImages';

interface WordImageProps {
  word: Word;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export function WordImage({ word, size = 'medium', className = '' }: WordImageProps) {
  const fallback = createFallbackWordImage(word);
  const src = word.imageUrl || fallback.src;
  const alt = word.imageAlt || fallback.alt;

  return (
    <div className={['word-image-frame', `word-image-${size}`, className].filter(Boolean).join(' ')}>
      <img className="word-image" src={src} alt={alt} loading="lazy" />
    </div>
  );
}
