import { useMemo, useState } from 'react';
import type { WordPack } from '../types';

/**
 * The pack's photo cover; without one, the first real picture among its
 * words, and the drawn cover only as the last resort.
 */
export function PackCover({ pack, className }: { pack: WordPack; className?: string }) {
  const sources = useMemo(() => {
    // Only pictures made for the app: stock photos are too hit-and-miss for a cover.
    const wordPhoto = pack.words.find((word) => word.imageProvider === 'openai-imagegen' && word.imageUrl)?.imageUrl;
    return [pack.coverPhotoUrl, wordPhoto, pack.coverImageUrl].filter((value): value is string => Boolean(value));
  }, [pack]);
  const [index, setIndex] = useState(0);
  const src = sources[index];
  if (!src) return <div className={['pack-cover', 'empty', className].filter(Boolean).join(' ')} aria-hidden="true" />;
  return (
    <div className={['pack-cover', src.startsWith('data:') ? 'drawn' : '', className].filter(Boolean).join(' ')}>
      <img src={src} alt={pack.coverImageAlt ?? ''} loading="lazy" decoding="async" onError={() => setIndex((value) => value + 1)} />
    </div>
  );
}
