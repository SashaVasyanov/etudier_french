import { describe, expect, it } from 'vitest';
import { isAnswerMatch, isFrenchAnswerMatch, isJapaneseReadingMatch } from '../src/lib/utils';
import { word } from './fixtures';

describe('French written answers', () => {
  it.each([
    ['coeur', 'cœur'],
    ['oeuf', 'œuf'],
    [' L’ ÉCOLE ', "l'école"],
    ['ecole', "l'école"],
    ['pomme de terre', 'la pomme de terre'],
    ['rendez‑vous', 'rendez-vous'],
  ])('accepts keyboard variant %s for %s', (answer, expected) => {
    expect(isFrenchAnswerMatch(answer, expected)).toBe(true);
  });

  it.each(['c ur', 'coeur猫', 'coeur2', 'coeur неверно', ''])('rejects an incorrect answer: %s', (answer) => {
    expect(isFrenchAnswerMatch(answer, 'cœur')).toBe(false);
  });
});

describe('Japanese written answers', () => {
  const cat = { ...word('cat'), language: 'japanese' as const, original: '猫', transcription: '[ねこ · neko]' };

  it.each(['猫', 'ねこ', 'ネコ', 'ﾈｺ', 'neko', 'ＮＥＫＯ'])('preserves accepted writing and reading %s', (answer) => {
    expect(isAnswerMatch(answer, cat.original, 'japanese', cat)).toBe(true);
  });

  it.each(['neko犬', 'neko123', '犬neko', 'неko', ''])('rejects mixed incorrect writing %s', (answer) => {
    expect(isAnswerMatch(answer, cat.original, 'japanese', cat)).toBe(false);
  });

  it('requires kana for a reading exercise while accepting full and half width katakana', () => {
    expect(isJapaneseReadingMatch('ねこ', 'ねこ', cat)).toBe(true);
    expect(isJapaneseReadingMatch('ネコ', 'ねこ', cat)).toBe(true);
    expect(isJapaneseReadingMatch('ﾈｺ', 'ねこ', cat)).toBe(true);
    expect(isJapaneseReadingMatch('neko', 'ねこ', cat)).toBe(false);
    expect(isJapaneseReadingMatch('猫', 'ねこ', cat)).toBe(false);
  });
});
