import { describe, expect, it } from 'vitest';
import { MINI_TEXTS } from '../src/data/miniTexts';
import { getMiniTextStats, indexWords, rankMiniTexts, segmentSentence } from '../src/lib/miniTexts';
import { progress, storage, word } from './fixtures';

describe('short texts', () => {
  it('are well formed: 3–5 sentences, every listed word occurs, readings for Japanese', () => {
    expect(MINI_TEXTS.length).toBeGreaterThan(15);
    expect(new Set(MINI_TEXTS.map((text) => text.id)).size).toBe(MINI_TEXTS.length);
    for (const text of MINI_TEXTS) {
      expect(text.sentences.length >= 3 && text.sentences.length <= 5).toBe(true);
      for (const listed of text.words) {
        const found = text.sentences.some((sentence) => segmentSentence(sentence.original, text).some((segment) => segment.word === listed));
        if (!found) throw new Error(`${text.id}: «${listed.form}» is not found in the text`);
      }
      if (text.language === 'japanese') expect(text.sentences.every((sentence) => Boolean(sentence.reading))).toBe(true);
    }
  });

  it('matches French words whole and regardless of case', () => {
    const text = { ...MINI_TEXTS[0], words: [{ form: 'mais', translation: 'но' }, { form: 'maison', translation: 'дом' }] };
    const segments = segmentSentence('Mais la maison est grande.', text);
    expect(segments.filter((segment) => segment.word).map((segment) => segment.text)).toEqual(['Mais', 'maison']);
    expect(segments.map((segment) => segment.text).join('')).toBe('Mais la maison est grande.');
  });

  it('counts familiar words and puts the most familiar text first', () => {
    const cafe = { ...word('cafe'), original: 'café' };
    const pain = { ...word('pain'), original: 'pain' };
    const index = indexWords([cafe, pain]);
    const texts = MINI_TEXTS.filter((text) => text.language === 'french');
    const state = storage({ cafe: progress('cafe', 'learning'), pain: progress('pain', 'review') });
    const first = texts.find((text) => text.id === 'fr-ma-journee');
    expect(first && getMiniTextStats(first, index, state)).toEqual({ inDictionary: 2, met: 2 });
    expect(rankMiniTexts(texts, index, state)[0].text.id).toBe('fr-ma-journee');
  });
});
