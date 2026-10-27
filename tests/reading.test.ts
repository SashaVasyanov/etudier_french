import { describe, expect, it } from 'vitest';
import { getSentenceTokens } from '../src/lib/exercises';
import { getPhraseOfTheDay, pickReadingSentences } from '../src/lib/reading';
import { hasTranslatedExample } from '../src/lib/utils';
import { progress, storage, word } from './fixtures';

const explained = {
  ...word('tpl'),
  original: 'à demain',
  example_original: 'Dans une conversation naturelle, on peut dire : « à demain ».',
  example_translation: 'Такую фразу используют в живой речи как готовое выражение.',
};

describe('reading and sentence tasks', () => {
  it('tells usage notes apart from real translations', () => {
    expect(hasTranslatedExample(explained)).toBe(false);
    expect(hasTranslatedExample({ example_original: 'Il pleut.', example_translation: 'Идёт дождь.' })).toBe(true);
    expect(hasTranslatedExample({ example_original: 'ラクダ', example_translation: 'Верблюдов часто используют для путешествия по пустыне.' })).toBe(true);
    expect(getSentenceTokens(explained)).toBeNull();
  });

  it('reads sentences of met words only and skips usage notes', () => {
    const words = [word('a'), word('b'), word('c'), explained];
    const state = storage({ a: progress('a', 'learning'), b: progress('b', 'review'), tpl: progress('tpl', 'learning') });
    const picked = pickReadingSentences(words, state, 2, 7);
    expect(picked.map((sentence) => sentence.wordId).sort()).toEqual(['a', 'b']);
    expect(pickReadingSentences(words, state, 2, 7)).toEqual(picked);
  });

  it('keeps the phrase of the day stable within a day', () => {
    const words = [word('a'), word('b'), word('c')];
    const state = storage({ a: progress('a', 'learning'), c: progress('c', 'review') });
    const today = getPhraseOfTheDay(words, state, '2026-01-10');
    expect(today).not.toBeNull();
    expect(getPhraseOfTheDay(words, state, '2026-01-10')).toEqual(today);
    expect(['a', 'c']).toContain(today?.wordId);
  });
});
