import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Word } from '../src/types';

// Data checks that run with `npm test` (and so before every build): a broken
// dataset fails the build instead of reaching a lesson.

const publicDir = join(process.cwd(), 'public');
const originalFetch = globalThis.fetch;

function stripAccents(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/’/g, "'");
}

/** Verbs appear conjugated in examples: 確認する → 確認しました, 教える → 教えて. */
function japaneseStem(original: string): string {
  if (original.endsWith('する')) return original.slice(0, -2);
  return /[ぁ-ゟ]$/.test(original) && original.length > 1 ? original.slice(0, -1) : original;
}

async function loadAll(): Promise<{ french: Word[]; japanese: Word[] }> {
  const { loadWords } = await import('../src/data/words');
  return { french: await loadWords('french'), japanese: await loadWords('japanese') };
}

describe('dictionary data quality', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: globalThis });
    globalThis.fetch = (async (url: string) => ({
      ok: true,
      json: async () => JSON.parse(readFileSync(join(publicDir, url), 'utf8')),
    })) as unknown as typeof fetch;
  });
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('gives every word a Russian translation and a unique id', async () => {
    const { french, japanese } = await loadAll();
    const all = [...french, ...japanese];
    expect(all.filter((item) => !/[а-яё]/i.test(item.translation)).map((item) => item.original)).toEqual([]);
    const seen = new Set<string>();
    const duplicates = all.filter((item) => (seen.has(item.id) ? true : (seen.add(item.id), false)));
    expect(duplicates.map((item) => item.id)).toEqual([]);
  });

  it('uses the studied word in every example sentence', async () => {
    const { french, japanese } = await loadAll();
    const frenchMisses = french.filter((item) => {
      const word = stripAccents(item.original).replace(/^(le|la|les|l')\s*/, '');
      const stem = word.slice(0, Math.max(3, word.length - 2));
      return !stripAccents(item.example_original).includes(stem);
    });
    expect(frenchMisses.map((item) => `${item.original}: ${item.example_original}`)).toEqual([]);
    const japaneseMisses = japanese.filter((item) => !item.example_original.includes(japaneseStem(item.original)));
    expect(japaneseMisses.map((item) => `${item.original}: ${item.example_original}`)).toEqual([]);
  });

  it('knows the gender of every French noun instead of guessing it', async () => {
    const { french } = await loadAll();
    const { FRENCH_NOUN_GENDERS } = await import('../src/data/frenchNounGenders');
    const unknown = french.filter((item) =>
      item.part_of_speech === 'noun'
      && !/\s/.test(item.original)
      && !/^(le|la|les|l')/i.test(item.original)
      && !FRENCH_NOUN_GENDERS[item.original.toLowerCase()]);
    expect(unknown.map((item) => item.original)).toEqual([]);
  });

  it('gives Japanese words a kana reading', async () => {
    const { japanese } = await loadAll();
    expect(japanese.filter((item) => !/[぀-ヿ]/.test(item.transcription)).map((item) => item.original)).toEqual([]);
  });

  it('keeps at least 20 words in every starter pack of both languages', async () => {
    const { getStarterPacks } = await import('../src/data/words');
    const small = (['french', 'japanese'] as const)
      .flatMap((language) => getStarterPacks(language))
      .filter((pack) => pack.words.length < 20)
      .map((pack) => `${pack.language}:${pack.title} (${pack.words.length})`);
    expect(small).toEqual([]);
  });
});
