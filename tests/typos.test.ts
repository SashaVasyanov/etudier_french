import { describe, expect, it } from 'vitest';
import { diffAnswer, editDistance, isFrenchAnswerMatch, isFrenchNearMiss } from '../src/lib/utils';

describe('typos and answer comparison', () => {
  it('measures edits with swapped letters as one', () => {
    expect(editDistance('maison', 'maison')).toBe(0);
    expect(editDistance('maisn', 'maison')).toBe(1);
    expect(editDistance('miason', 'maison')).toBe(1);
    expect(editDistance('maisonx', 'maison')).toBe(1);
    expect(editDistance('mason', 'maisons')).toBe(2);
  });

  it('forgives one letter in longer words only, with or without the article', () => {
    expect(isFrenchNearMiss('maisn', 'la maison')).toBe(true);
    expect(isFrenchNearMiss('la miason', 'la maison')).toBe(true);
    expect(isFrenchNearMiss('mason', 'maisons')).toBe(false);
    expect(isFrenchNearMiss('chat', 'chut')).toBe(false);
    expect(isFrenchNearMiss('vin', 'vent')).toBe(false);
    expect(isFrenchNearMiss('', 'maison')).toBe(false);
    // Accents never count as a typo: they are accepted as correct already.
    expect(isFrenchAnswerMatch('ecole', "l'école")).toBe(true);
  });

  it('marks the letters that differ on both sides', () => {
    const diff = diffAnswer('maisn', 'maison');
    expect(diff.user).toEqual([{ text: 'maisn', kind: 'same' }]);
    expect(diff.correct).toEqual([{ text: 'mais', kind: 'same' }, { text: 'o', kind: 'changed' }, { text: 'n', kind: 'same' }]);
    const accent = diffAnswer('ecole', 'école');
    expect(accent.correct[0]).toEqual({ text: 'é', kind: 'changed' });
    expect(accent.user[0]).toEqual({ text: 'e', kind: 'changed' });
    expect(diffAnswer('Paris', 'paris').correct).toEqual([{ text: 'paris', kind: 'same' }]);
  });
});

describe('dictionary search', () => {
  it('ignores case, accents and ё and ranks whole words first', async () => {
    const { getSearchRank, normalizeSearchText } = await import('../src/lib/utils');
    const entry = (primary: string, secondary = '') => ({ primary: normalizeSearchText(primary), secondary: normalizeSearchText(secondary) });
    expect(normalizeSearchText('École Œuf Ёлка')).toBe('ecole oeuf елка');
    expect(getSearchRank(entry("l'école | школа"), 'ecole')).toBe(0);
    expect(getSearchRank(entry('maison | дом'), 'mai')).toBe(1);
    expect(getSearchRank(entry('demain | завтра'), 'mai')).toBe(2);
    expect(getSearchRank(entry('chat | кот', 'Il fait beau en mai.'), 'mai')).toBe(3);
    expect(getSearchRank(entry('chat | кот'), 'mai')).toBeNull();
    expect(getSearchRank(entry('ёлка | ель'), 'елка')).toBe(0);
  });
});
