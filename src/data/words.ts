import type { Word, WordLevel } from '../types';

const DATASET_URLS = ['/data/words_a1.json', '/data/words_a2.json', '/data/words_b1.json'] as const;
const LEVEL_ORDER: Record<WordLevel, number> = {
  A1: 0,
  A2: 1,
  B1: 2,
};

let wordsPromise: Promise<Word[]> | null = null;

function normalizeWord(word: Word): Word {
  return {
    ...word,
    audio_original: word.audio_original ?? '',
    tags: Array.isArray(word.tags) ? word.tags : [],
  };
}

export async function loadWords(): Promise<Word[]> {
  if (!wordsPromise) {
    wordsPromise = Promise.all(
      DATASET_URLS.map(async (url) => {
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`Failed to load dataset: ${url}`);
        }

        return (await response.json()) as Word[];
      }),
    ).then((parts) =>
      parts
        .flat()
        .map(normalizeWord)
        .sort((left, right) => {
          const levelDiff = LEVEL_ORDER[left.level] - LEVEL_ORDER[right.level];

          if (levelDiff !== 0) {
            return levelDiff;
          }

          return left.original.localeCompare(right.original, 'fr');
        }),
    );
  }

  return wordsPromise;
}

export function getWordById(words: Word[], wordId: string): Word {
  const word = words.find((item) => item.id === wordId);

  if (!word) {
    throw new Error(`Word not found: ${wordId}`);
  }

  return word;
}
