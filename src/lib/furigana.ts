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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
  const pattern = parts.map((part) => (part.reading !== undefined ? '(.+?)' : escapeRegExp(looseKey(part.text)))).join('');
  const match = new RegExp(`^${pattern}$`, 'u').exec(looseKey(reading));
  if (!match) return null;
  let group = 1;
  for (const part of parts) {
    if (part.reading !== undefined) {
      const value = match[group];
      group += 1;
      // A sane reading is hiragana only (ー for long vowels).
      if (!/^[\u3041-\u3096ー]+$/.test(value) || /^[ぁぃぅぇぉっゃゅょゎんー]/.test(value)) return null;
      part.reading = value;
    }
  }
  return parts;
}
