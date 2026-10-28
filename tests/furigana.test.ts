import { afterEach, describe, expect, it } from 'vitest';
import { alignFurigana } from '../src/lib/furigana';
import { formatTranscription, setReadingPreferences } from '../src/lib/readingPrefs';
import { getComfort, setComfortPreference } from '../src/lib/storage';
import { storage } from './fixtures';

const show = (text: string, reading: string) =>
  alignFurigana(text, reading)?.map((part) => (part.reading ? `${part.text}(${part.reading})` : part.text)).join('') ?? null;

describe('furigana', () => {
  it('lines kanji up with their reading', () => {
    expect(show('何を探しているの？', 'なにをさがしているの？')).toBe('何(なに)を探(さが)しているの？');
    expect(show('祖父から面白い話を聞きました。', 'そふからおもしろいはなしをききました。')).toBe('祖父(そふ)から面白(おもしろ)い話(はなし)を聞(き)きました。');
    expect(show('ケンはテニスが好きです。', 'けんはてにすがすきです。')).toBe('ケンはテニスが好(す)きです。');
  });

  it('gives up rather than guess', () => {
    // Numbers are read in ways that cannot be matched letter by letter.
    expect(show('3年前です。', 'さんねんまえです。')).toBeNull();
    // Two kanji runs with only a comma between them are ambiguous.
    expect(show('結局、法案は通った。', 'けっきょく、ほうあんはとおった。')).toBeNull();
    // A reading that does not fit at all.
    expect(show('猫がいます。', 'いぬがいる。')).toBeNull();
    // No kanji: nothing to show.
    expect(show('ありがとう。', 'ありがとう。')).toBeNull();
  });
});

describe('reading preferences', () => {
  afterEach(() => setReadingPreferences({ furigana: false, romaji: true }));

  it('hides romaji when asked', () => {
    expect(formatTranscription('[たべる · taberu]', 'japanese')).toBe('[たべる · taberu]');
    setReadingPreferences({ furigana: false, romaji: false });
    expect(formatTranscription('[たべる · taberu]', 'japanese')).toBe('[たべる]');
    expect(formatTranscription('[bɔ̃ʒuʁ]', 'french')).toBe('[bɔ̃ʒuʁ]');
  });

  it('stores furigana and romaji with the comfort settings', () => {
    const changed = setComfortPreference(storage(), { furigana: true, romaji: false });
    expect(getComfort(changed).furigana).toBe(true);
    expect(getComfort(changed).romaji).toBe(false);
    expect(setComfortPreference(changed, { furigana: false, romaji: true }).comfort).toBeUndefined();
  });
});
