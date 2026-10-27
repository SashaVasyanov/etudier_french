import type { AppStorage, Word } from '../types';
import { getWordProgress } from './storage';
import { hasTranslatedExample } from './utils';

export interface ReadingSentence {
  wordId: string;
  original: string;
  translation: string;
  /** The studied word, to mark it in the sentence. */
  word: string;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return hash;
}

function usableSentence(word: Word): boolean {
  const original = word.example_original.trim();
  return original !== word.original.trim() && hasTranslatedExample(word);
}

function toSentence(word: Word): ReadingSentence {
  return { wordId: word.id, original: word.example_original.trim(), translation: word.example_translation.trim(), word: word.original };
}

/** Words the learner has met (not new, not excluded), with an example. */
function metWords(words: Word[], storage: AppStorage): Word[] {
  return words.filter((word) => {
    const status = getWordProgress(storage, word.id).status;
    return status !== 'new' && status !== 'ignored' && usableSentence(word);
  });
}

/**
 * A short reading: example sentences of words already met, in a stable
 * pseudo-random order for the given seed, without repeating a sentence.
 * Before any study the first words of the course are used.
 */
export function pickReadingSentences(words: Word[], storage: AppStorage, count: number, seed: number): ReadingSentence[] {
  const met = metWords(words, storage);
  const pool = met.length >= count ? met : [...met, ...words.filter((word) => usableSentence(word) && !met.includes(word)).slice(0, count * 3)];
  const seen = new Set<string>();
  return [...pool]
    .sort((left, right) => hashString(`${seed}:${left.id}`) - hashString(`${seed}:${right.id}`))
    .filter((word) => {
      const key = word.example_original.trim().toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, count)
    .map(toSentence);
}

/** One sentence for the day, the same all day: from words already met when possible. */
export function getPhraseOfTheDay(words: Word[], storage: AppStorage, dateKey: string): ReadingSentence | null {
  const met = metWords(words, storage);
  const pool = met.length > 0 ? met : words.filter(usableSentence).slice(0, 60);
  if (pool.length === 0) return null;
  const sorted = [...pool].sort((left, right) => left.id.localeCompare(right.id));
  return toSentence(sorted[hashString(dateKey) % sorted.length]);
}
