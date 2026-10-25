import { describe, expect, it } from 'vitest';
import { derivePackStatus, getActiveWords, getPackCompletionRatio } from '../src/lib/packs';
import type { WordPack } from '../src/types';
import { progress, storage, word } from './fixtures';

describe('pack progress', () => {
  const pack: WordPack = { id: 'test-pack', language: 'french', title: 'Пак', description: 'Проверка', accent: '#fff', words: [word('a'), word('b')] };

  it('counts explicitly known words along with mastered words toward pack completion', () => {
    const state = storage({ a: progress('a', 'known'), b: progress('b', 'new') });
    state.packStates[pack.id] = { packId: pack.id, status: 'added', addedAt: null, completedAt: null };
    expect(getPackCompletionRatio(pack, state)).toBe(50);
    expect(derivePackStatus(pack, state)).toBe('in_progress');
    state.progressByWordId.b = progress('b', 'mastered');
    expect(getPackCompletionRatio(pack, state)).toBe(100);
    expect(derivePackStatus(pack, state)).toBe('completed');
  });

  it('does not mark an unadded or empty pack complete', () => {
    const state = storage({ a: progress('a', 'known'), b: progress('b', 'mastered') });
    expect(derivePackStatus(pack, state)).toBe('not_added');
    state.packStates[pack.id] = { packId: pack.id, status: 'added', addedAt: null, completedAt: null };
    expect(derivePackStatus({ ...pack, words: [] }, state)).toBe('added');
    expect(getPackCompletionRatio({ ...pack, words: [] }, state)).toBe(0);
  });
});

describe('active dictionary words', () => {
  it('keeps pack membership when a core word takes precedence over a duplicate', () => {
    const core = { ...word('core'), original: 'arbre' };
    const packed = { ...word('packed'), original: 'Arbre', source: 'pack' as const, packIds: ['plants'] };
    const active = getActiveWords([core, packed], ['plants']);

    expect(active).toHaveLength(1);
    expect(active[0].id).toBe('core');
    expect(active[0].packIds).toEqual(['plants']);
    expect(core.packIds).toEqual([]);
    expect(getActiveWords([packed, core], ['plants'])).toEqual(active);
    expect(getActiveWords([core, packed], [])).toEqual([core]);
  });

  it('preserves words distinguished by French accents and language while normalizing Unicode', () => {
    const words = [
      { ...word('or'), original: 'ou' },
      { ...word('where'), original: 'où' },
      { ...word('tea'), original: 'thé' },
      { ...word('tea-unicode'), original: 'the\u0301' },
      { ...word('other-language'), language: 'japanese' as const, original: 'ou' },
    ];

    expect(getActiveWords(words, []).map((item) => item.id)).toEqual(['or', 'where', 'tea', 'other-language']);
  });
});

describe('Japanese starter packs', () => {
  it('offers five themed packs of twenty words with readings and examples that contain the word', async () => {
    const { getStarterPacks } = await import('../src/data/words');
    const packs = getStarterPacks('japanese');
    expect(packs).toHaveLength(5);
    for (const pack of packs) {
      expect(pack.words).toHaveLength(20);
      for (const item of pack.words) {
        expect(item.language).toBe('japanese');
        expect(item.example_original).toContain(item.original);
        expect(Boolean(item.example_reading)).toBe(true);
        expect(item.transcription).toContain(' · ');
      }
    }
    expect(new Set(packs.flatMap((pack) => pack.words.map((item) => item.id))).size).toBe(100);
  });
});
