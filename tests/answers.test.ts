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

describe('Japanese romaji answers', () => {
  const jp = (original: string, kana: string, romaji: string) => ({
    ...word(original), language: 'japanese' as const, original, transcription: `[${kana} · ${romaji}]`,
  });

  it.each([
    [jp('勇気', 'ゆうき', 'yuuki'), 'yuki'],
    [jp('高校', 'こうこう', 'koukou'), 'koko'],
    [jp('思う', 'おもう', 'omou'), 'omo'],
    [jp('囚人', 'しゅうじん', 'shuujin'), 'shujin'],
    [jp('お祖父さん', 'おじいさん', 'ojiisan'), 'ojisan'],
    [jp('ビール', 'ビール', 'biiru'), 'biru'],
  ])('does not accept a dropped long vowel for %s: %s', (target, answer) => {
    expect(isAnswerMatch(answer, target.original, 'japanese', target)).toBe(false);
  });

  it.each([
    [jp('勇気', 'ゆうき', 'yuuki'), 'yūki'],
    [jp('高校', 'こうこう', 'koukou'), 'kōkō'],
    [jp('高校', 'こうこう', 'koukou'), 'kookoo'],
    [jp('お茶', 'おちゃ', 'ocha'), 'otya'],
    [jp('辞書', 'じしょ', 'jisho'), 'zisyo'],
    [jp('辞書', 'じしょ', 'jisho'), 'zisho'],
    [jp('新聞', 'しんぶん', 'shinbun'), 'shimbun'],
    [jp('抹茶', 'まっちゃ', 'maccha'), 'matcha'],
    [jp('抹茶', 'まっちゃ', 'maccha'), 'mattya'],
    [jp('続く', 'つづく', 'tsuzuku'), 'tuzuku'],
    [jp('ビール', 'ビール', 'biiru'), 'bīru'],
    [jp('こんにちは', 'こんにちは', 'konnichiha'), 'konnichiwa'],
    [jp('富士', 'ふじ', 'fuji'), 'huzi'],
  ])('accepts a spelling variant for %s: %s', (target, answer) => {
    expect(isAnswerMatch(answer, target.original, 'japanese', target)).toBe(true);
  });
});

describe('Japanese particle は', () => {
  const jp = (original: string, kana: string, romaji: string) => ({
    ...word(original), language: 'japanese' as const, original, transcription: `[${kana} · ${romaji}]`,
  });

  it.each([
    [jp('電話', 'でんわ', 'denwa'), 'denha'],
    [jp('母', 'はは', 'haha'), 'hawa'],
    [jp('平和', 'へいわ', 'heiwa'), 'heiha'],
  ])('does not swap ha/wa inside ordinary words: %s %s', (target, answer) => {
    expect(isAnswerMatch(answer, target.original, 'japanese', target)).toBe(false);
  });

  it('accepts "wa" for a final particle は in expressions', () => {
    const target = jp('あるいは', 'あるいは', 'aruiha');
    expect(isAnswerMatch('aruiwa', target.original, 'japanese', target)).toBe(true);
    expect(isAnswerMatch('aruiha', target.original, 'japanese', target)).toBe(true);
  });
});

describe('French transcription', () => {
  it('keeps nasal vowels and the IPA g', async () => {
    const { deriveFrenchLatinTranscription } = await import('../src/lib/utils');
    expect(deriveFrenchLatinTranscription('lapin', '[lapɛ̃]')).toBe('[lapen]');
    expect(deriveFrenchLatinTranscription('branche', '[bʁɑ̃ʃ]')).toBe('[bransh]');
    expect(deriveFrenchLatinTranscription('collègue', '[kɔlɛɡ]')).toBe('[koleg]');
  });
});

describe('katakana word reading', () => {
  it('accepts romaji with long vowels and kana, rejects a short vowel', async () => {
    const { isKanaWordReadingMatch } = await import('../src/lib/utils');
    expect(isKanaWordReadingMatch('koohii', 'コーヒー', 'koohii')).toBe(true);
    expect(isKanaWordReadingMatch('こーひー', 'コーヒー', 'koohii')).toBe(true);
    expect(isKanaWordReadingMatch('コーヒー', 'コーヒー', 'koohii')).toBe(true);
    expect(isKanaWordReadingMatch('menyuu', 'メニュー', 'menyuu')).toBe(true);
    expect(isKanaWordReadingMatch('sakka', 'サッカー', 'sakkaa')).toBe(false);
  });
});
