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
