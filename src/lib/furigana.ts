/**
 * Furigana: the reading of each run of kanji, worked out by lining a
 * sentence up with its full hiragana reading. Kana between the kanji must
 * appear in the reading as they are; the kanji runs take what lies between.
 */

export interface FuriganaPart {
  text: string;
  /** Hiragana over this part; only kanji runs get one. */
  reading?: string;
}

const KANJI_RUN = /[\p{Script=Han}々〆ヶ]+/gu;
// Numbers and Latin letters are read in ways the reading cannot be lined up
// with letter by letter; such sentences keep a separate reading line.
const UNALIGNABLE = /[0-9０-９A-Za-zＡ-Ｚａ-ｚ]/;

function toHiragana(value: string): string {
  return [...value]
    .map((character) => {
      const code = character.charCodeAt(0);
      return code >= 0x30a1 && code <= 0x30f6 ? String.fromCharCode(code - 0x60) : character;
    })
    .join('');
}

// Punctuation and spacing differ between a sentence and its reading
// («、» vs «,», full-width spaces); they are compared loosely.
function looseKey(value: string): string {
  return toHiragana(value).replace(/[\s、。，．,.!?！？「」『』（）()・…〜~―-]/g, '');
}

/**
 * Splits `text` into plain parts and kanji runs with their readings, or
 * returns null when the reading does not line up (then show it separately).
 */
export function alignFurigana(text: string, reading: string): FuriganaPart[] | null {
  if (!text || !reading || UNALIGNABLE.test(text)) return null;
  const parts: FuriganaPart[] = [];
  let last = 0;
  for (const match of text.matchAll(KANJI_RUN)) {
    const at = match.index ?? 0;
    if (at > last) parts.push({ text: text.slice(last, at) });
    parts.push({ text: match[0], reading: '' });
    last = at + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  if (!parts.some((part) => part.reading !== undefined && /\p{Script=Han}/u.test(part.text))) return null;

  // Two kanji runs with only punctuation between them cannot be told apart.
  for (let index = 1; index < parts.length - 1; index += 1) {
    if (parts[index].reading === undefined && !looseKey(parts[index].text) && parts[index - 1].reading !== undefined && parts[index + 1].reading !== undefined) {
      return null;
    }
  }
  // Several splits can fit (母は / ははは: は|はは or はは|は). Try them all
  // and keep the one where every kanji gets about two kana, the usual length.
  const key = looseKey(reading);
  const literals = parts.map((part) => (part.reading === undefined ? looseKey(part.text) : null));
  const kanjiCounts = parts.map((part) => [...part.text].length);
  const saneReading = (value: string) => /^[\u3041-\u3096ー]+$/.test(value) && !/^[ぁぃぅぇぉっゃゅょゎんー]/.test(value);
  let best: { score: number; readings: string[] } | null = null;
  let tried = 0;
  const walk = (index: number, at: number, readings: string[], score: number) => {
    if (tried > 5000) return;
    if (index === parts.length) {
      tried += 1;
      if (at === key.length && (!best || score < best.score)) best = { score, readings: [...readings] };
      return;
    }
    const literal = literals[index];
    if (literal !== null) {
      if (key.startsWith(literal, at)) walk(index + 1, at + literal.length, readings, score);
      return;
    }
    for (let end = at + 1; end <= key.length; end += 1) {
      const value = key.slice(at, end);
      if (!saneReading(value)) {
        if (!/^[\u3041-\u3096ー]+$/.test(value)) break;
        continue;
      }
      const perKanji = value.length / kanjiCounts[index];
      readings.push(value);
      walk(index + 1, end, readings, score + (perKanji - 2) ** 2);
      readings.pop();
    }
  };
  walk(0, 0, [], 0);
  const chosen = best as { score: number; readings: string[] } | null;
  if (!chosen) return null;
  let group = 0;
  for (const part of parts) {
    if (part.reading !== undefined) {
      part.reading = chosen.readings[group];
      group += 1;
    }
  }
  return parts;
}
