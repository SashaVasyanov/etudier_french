import type { MiniText, MiniTextWord } from '../data/miniTexts';
import type { AppStorage, Word } from '../types';
import { getWordProgress } from './storage';

export type MiniWordState = 'known' | 'learning' | 'new' | 'outside';

export interface MiniTextSegment {
  text: string;
  word?: MiniTextWord;
}

const LETTER = /[\p{L}\p{M}]/u;

/**
 * Splits a sentence into plain text and the text's glossed words, longest
 * forms first. French forms match whole words only, ignoring case.
 */
export function segmentSentence(sentence: string, text: MiniText): MiniTextSegment[] {
  const french = text.language === 'french';
  const haystack = french ? sentence.toLocaleLowerCase('fr') : sentence;
  const taken = new Array<MiniTextWord | null>(sentence.length).fill(null);
  const starts = new Map<number, MiniTextWord>();
  const forms = [...text.words].sort((left, right) => right.form.length - left.form.length);
  for (const word of forms) {
    const needle = french ? word.form.toLocaleLowerCase('fr') : word.form;
    let from = 0;
    for (;;) {
      const at = haystack.indexOf(needle, from);
      if (at < 0) break;
      from = at + 1;
      const end = at + needle.length;
      if (french && ((at > 0 && LETTER.test(sentence[at - 1])) || (end < sentence.length && LETTER.test(sentence[end])))) continue;
      if (taken.slice(at, end).some(Boolean)) continue;
      for (let index = at; index < end; index += 1) taken[index] = word;
      starts.set(at, word);
    }
  }
  const segments: MiniTextSegment[] = [];
  let plain = '';
  for (let index = 0; index < sentence.length;) {
    const word = starts.get(index);
    if (word) {
      if (plain) segments.push({ text: plain });
      plain = '';
      segments.push({ text: sentence.slice(index, index + word.form.length), word });
      index += word.form.length;
    } else {
      plain += sentence[index];
      index += 1;
    }
  }
  if (plain) segments.push({ text: plain });
  return segments;
}

/** The dictionary words by their written form, for looking up text words. */
export function indexWords(words: Word[]): Map<string, Word> {
  const index = new Map<string, Word>();
  for (const word of words) {
    const key = word.language === 'french' ? word.original.toLocaleLowerCase('fr') : word.original;
    if (!index.has(key)) index.set(key, word);
  }
  return index;
}

export function findDictionaryWord(word: MiniTextWord, text: MiniText, index: Map<string, Word>): Word | null {
  const lemma = word.lemma ?? word.form;
  return index.get(text.language === 'french' ? lemma.toLocaleLowerCase('fr') : lemma) ?? null;
}

export function getMiniWordState(word: MiniTextWord, text: MiniText, index: Map<string, Word>, storage: AppStorage): MiniWordState {
  const entry = findDictionaryWord(word, text, index);
  if (!entry) return 'outside';
  const status = getWordProgress(storage, entry.id).status;
  if (status === 'known' || status === 'mastered') return 'known';
  if (status === 'new' || status === 'ignored') return 'new';
  return 'learning';
}

export interface MiniTextStats {
  /** Words of the text that are in the dictionary (distinct entries). */
  inDictionary: number;
  /** Of those, met in lessons already (studied or known). */
  met: number;
}

export function getMiniTextStats(text: MiniText, index: Map<string, Word>, storage: AppStorage): MiniTextStats {
  const seen = new Map<string, MiniWordState>();
  for (const word of text.words) {
    const entry = findDictionaryWord(word, text, index);
    if (!entry || seen.has(entry.id)) continue;
    seen.set(entry.id, getMiniWordState(word, text, index, storage));
  }
  const states = [...seen.values()];
  return { inDictionary: states.length, met: states.filter((state) => state !== 'new').length };
}

/** Texts of a language, the most familiar first (then in their own order). */
export function rankMiniTexts(texts: readonly MiniText[], index: Map<string, Word>, storage: AppStorage): Array<{ text: MiniText; stats: MiniTextStats }> {
  return texts
    .map((text, order) => ({ text, stats: getMiniTextStats(text, index, storage), order }))
    .sort((left, right) => {
      const share = (stats: MiniTextStats) => (stats.inDictionary ? stats.met / stats.inDictionary : 0);
      return share(right.stats) - share(left.stats) || left.order - right.order;
    })
    .map(({ text, stats }) => ({ text, stats }));
}
