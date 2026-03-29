import { useEffect, useState } from 'react';
import type { Word } from '../types';
import { createFallbackWordImage } from '../lib/wordImages';

interface WordImageProps {
  word: Word;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export function WordImage({ word, size = 'medium', className = '' }: WordImageProps) {
  const fallback = createFallbackWordImage(word);
  const primarySrc = word.imagePath || word.imageUrl || fallback.src;
  const srcWithVersion =
    primarySrc.startsWith('/generated-word-images/')
      ? `${primarySrc}${primarySrc.includes('?') ? '&' : '?'}v=${encodeURIComponent(word.imageSource ?? word.id)}`
      : primarySrc;
  const [src, setSrc] = useState(srcWithVersion);
  const alt = word.imageAlt || fallback.alt;

  useEffect(() => {
    setSrc(srcWithVersion);
  }, [srcWithVersion]);

  return (
    <div className={['word-image-frame', `word-image-${size}`, className].filter(Boolean).join(' ')}>
      <img
        className="word-image"
        src={src}
        alt={alt}
        loading="lazy"
        onError={() => {
          if (src !== fallback.src) {
            setSrc(fallback.src);
          }
        }}
      />
    </div>
  );
}
