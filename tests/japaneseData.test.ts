import { describe, expect, it } from 'vitest';
import { loadWords } from '../src/data/words';
import { JAPANESE_EXCLUDED_WORDS } from '../src/data/japaneseWordCorrections';

describe('Japanese dictionary data', () => {
  it('has a readable Russian translation for every word and no excluded duplicates', async () => {
    const words = await loadWords('japanese');
    const core = words.filter((item) => item.source === 'core');
    expect(core.length).toBeGreaterThan(900);
    const unreadable = core.filter((item) =>
      !/[а-яё]{2,}/i.test(item.translation) || /[【】～]|англ\.|\(сущ\.\)|^\d\./.test(item.translation));
    expect(unreadable.map((item) => `${item.original}: ${item.translation}`)).toEqual([]);
    expect(core.filter((item) => JAPANESE_EXCLUDED_WORDS.has(item.original))).toHaveLength(0);
  });

  it('shows katakana words with a katakana reading', async () => {
    const words = await loadWords('japanese');
    const door = words.find((item) => item.original === 'ドア' && item.source === 'core');
    expect(door?.transcription.startsWith('[ドア ·')).toBe(true);
  });
});

describe('JLPT levels', () => {
  it('grades the Japanese dictionary by JLPT and teaches N5 words first', async () => {
    const { loadWords } = await import('../src/data/words');
    const { getStudyLevelRank } = await import('../src/lib/levels');
    const words = await loadWords('japanese');
    const byOriginal = (original: string) => words.find((item) => item.original === original && item.source === 'core');
    expect(byOriginal('時間')?.jlpt).toBe('N5');
    expect(byOriginal('世界')?.jlpt).toBe('N4');
    const graded = words.filter((item) => item.jlpt).length;
    expect(graded / words.length).toBeGreaterThan(0.8);
    const ranks = words.map((item) => getStudyLevelRank(item));
    expect(ranks.every((rank, index) => index === 0 || ranks[index - 1] <= rank)).toBe(true);
    expect(words[0].jlpt).toBe('N5');
  });
});
