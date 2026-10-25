import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const publicDir = join(process.cwd(), 'public');
const originalFetch = globalThis.fetch;

describe('French dictionary data', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: globalThis });
    globalThis.fetch = (async (url: string) => ({
      ok: true,
      json: async () => JSON.parse(readFileSync(join(publicDir, url), 'utf8')),
    })) as unknown as typeof fetch;
  });
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('uses the real grammatical gender and keeps hand-written pack examples', async () => {
    const { loadWords } = await import('../src/data/words');
    const { getDisplayWord } = await import('../src/lib/wordPresentation');
    const words = await loadWords('french');
    const display = (original: string, source = 'core') =>
      getDisplayWord(words.find((item) => item.original === original && item.source === source)!);
    expect(display('forêt')).toBe('la forêt');
    expect(display('jus')).toBe('le jus');
    expect(display('haricot')).toBe('le haricot');
    expect(display('souris')).toBe('la souris');
    expect(display('lunettes')).toBe('les lunettes');
    const packTree = words.find((item) => item.source === 'pack' && item.original === 'arbre')!;
    expect(packTree.example_original).toBe("L'arbre est vieux.");
    expect(words.some((item) => /(^|\s)(à|de) (le|les)\s/.test(item.example_original))).toBe(false);
  });
});
