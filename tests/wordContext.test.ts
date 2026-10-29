import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { withWordContext } from '../src/data/words';
import { alignFurigana } from '../src/lib/furigana';
import { getExampleHighlight, getWordExamples } from '../src/lib/wordPresentation';
import { word } from './fixtures';

describe('word context', () => {
  const entry = {
    ipa: 'vɑ̃.døz',
    pos: 'noun',
    frequency: 'mid',
    definition: 'Femme qui travaille dans un magasin.',
    definition_translation: 'Женщина, которая работает в магазине.',
    examples: [
      { original: 'La vendeuse m’aide.', form: 'vendeuse', translation: 'Продавщица мне помогает.' },
      { original: 'Ma sœur est vendeuse.', form: 'vendeuse', translation: 'Моя сестра — продавщица.' },
      { original: 'Broken', form: 'missing', translation: 'Сломано.' },
    ],
  };

  it('adds the definition and examples, and the first example becomes the main one', () => {
    const result = withWordContext({ ...word('v'), original: 'vendeuse', example_original: 'La vendeuse, c’est important.' }, entry);
    expect(result.definition).toBe(entry.definition);
    expect(result.frequency).toBe('mid');
    expect(result.ipa).toBe('vɑ̃.døz');
    expect(result.part_of_speech).toBe('noun');
    // An example whose marked form is not in the sentence is dropped.
    expect(result.examples).toHaveLength(2);
    expect(result.example_original).toBe('La vendeuse m’aide.');
    expect(result.example_translation).toBe('Продавщица мне помогает.');
  });

  it('leaves a word without context as it is', () => {
    const base = word('plain');
    expect(withWordContext(base, undefined)).toBe(base);
    expect(withWordContext(base, { frequency: 'often' }).frequency).toBeUndefined();
  });

  it('marks the studied form inside each example', () => {
    const result = withWordContext({ ...word('v'), original: 'vendeuse' }, entry);
    const [first] = getWordExamples(result);
    expect(getExampleHighlight(first)).toEqual({ start: 3, end: 11 });
  });

  it('falls back to the single example of a word without written context', () => {
    const examples = getWordExamples({ ...word('x'), original: 'chat', example_original: 'Le chat dort.' });
    expect(examples).toHaveLength(1);
    expect(getExampleHighlight(examples[0])).toEqual({ start: 3, end: 7 });
  });
});

describe('shipped word context files', () => {
  for (const code of ['fr', 'ja']) {
    it(`${code}: every example marks its word and Japanese readings line up`, () => {
      const file = JSON.parse(readFileSync(new URL(`../public/data/word_context_${code}.json`, import.meta.url), 'utf8')) as Record<string, {
        definition: string; definition_reading?: string; examples: Array<{ original: string; form: string; reading?: string; translation: string }>;
      }>;
      for (const [id, item] of Object.entries(file)) {
        expect(item.definition, id).toBeTruthy();
        expect(item.examples.length, id).toBeGreaterThanOrEqual(2);
        for (const example of item.examples) {
          expect(example.original.includes(example.form), `${id}: ${example.original}`).toBe(true);
          expect(/[а-яё]/i.test(example.translation), id).toBe(true);
          if (code === 'ja' && /\p{Script=Han}/u.test(example.original)) {
            expect(alignFurigana(example.original, example.reading ?? ''), `${id}: ${example.original}`).not.toBeNull();
          }
        }
      }
    });
  }
});
