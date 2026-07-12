import fs from 'node:fs';

const FREQUENCY_SOURCE = '/tmp/ja_full.txt';
const JMDICT_SOURCE = '/tmp/jmdict-rus-3.6.2.json';
const OUTPUT = 'src/data/japaneseWords.ts';
const TARGET_COUNT = 1000;

// Source files:
// - https://github.com/hermitdave/FrequencyWords/tree/master/content/2018/ja
// - https://github.com/scriptin/jmdict-simplified/releases

const frequencyLines = fs.readFileSync(FREQUENCY_SOURCE, 'utf8').split(/\r?\n/).filter(Boolean);
const jmdict = JSON.parse(fs.readFileSync(JMDICT_SOURCE, 'utf8'));

const KATAKANA_START = 0x30a1;
const KATAKANA_END = 0x30f6;
const HIRAGANA_OFFSET = 0x60;

function katakanaToHiragana(value) {
  return [...value]
    .map((char) => {
      const code = char.charCodeAt(0);
      return code >= KATAKANA_START && code <= KATAKANA_END
        ? String.fromCharCode(code - HIRAGANA_OFFSET)
        : char;
    })
    .join('');
}

const BASIC_ROMAJI = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o',
  か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko',
  が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so',
  ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
  た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
  だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
  な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
  は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
  ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
  や: 'ya', ゆ: 'yu', よ: 'yo',
  ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro',
  わ: 'wa', ゐ: 'wi', ゑ: 'we', を: 'wo', ん: 'n',
  ゔ: 'vu',
  ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o',
};

const DIGRAPH_ROMAJI = {
  きゃ: 'kya', きゅ: 'kyu', きょ: 'kyo',
  ぎゃ: 'gya', ぎゅ: 'gyu', ぎょ: 'gyo',
  しゃ: 'sha', しゅ: 'shu', しょ: 'sho',
  じゃ: 'ja', じゅ: 'ju', じょ: 'jo',
  ちゃ: 'cha', ちゅ: 'chu', ちょ: 'cho',
  ぢゃ: 'ja', ぢゅ: 'ju', ぢょ: 'jo',
  にゃ: 'nya', にゅ: 'nyu', にょ: 'nyo',
  ひゃ: 'hya', ひゅ: 'hyu', ひょ: 'hyo',
  びゃ: 'bya', びゅ: 'byu', びょ: 'byo',
  ぴゃ: 'pya', ぴゅ: 'pyu', ぴょ: 'pyo',
  みゃ: 'mya', みゅ: 'myu', みょ: 'myo',
  りゃ: 'rya', りゅ: 'ryu', りょ: 'ryo',
  ふぁ: 'fa', ふぃ: 'fi', ふぇ: 'fe', ふぉ: 'fo',
  うぃ: 'wi', うぇ: 'we', うぉ: 'wo',
  てぃ: 'ti', でぃ: 'di',
  とぅ: 'tu', どぅ: 'du',
  しぇ: 'she', じぇ: 'je', ちぇ: 'che',
};

function firstConsonant(value) {
  const match = value.match(/^[bcdfghjklmnpqrstvwxyz]+/);
  return match ? match[0][0] : '';
}

function kanaToRomaji(value) {
  const kana = katakanaToHiragana(value);
  let result = '';

  for (let index = 0; index < kana.length; index += 1) {
    const char = kana[index];
    const pair = kana.slice(index, index + 2);

    if (char === 'っ') {
      const nextPair = kana.slice(index + 1, index + 3);
      const next = DIGRAPH_ROMAJI[nextPair] ?? BASIC_ROMAJI[kana[index + 1]] ?? '';
      result += firstConsonant(next);
      continue;
    }

    if (char === 'ー') {
      const lastVowel = [...result].reverse().find((letter) => /[aeiou]/.test(letter));
      result += lastVowel ?? '';
      continue;
    }

    if (DIGRAPH_ROMAJI[pair]) {
      result += DIGRAPH_ROMAJI[pair];
      index += 1;
      continue;
    }

    result += BASIC_ROMAJI[char] ?? char;
  }

  return result;
}

function isKanaOnly(value) {
  return /^[\u3040-\u30ffー]+$/u.test(value);
}

function isUsableSurface(value) {
  return (
    value.length >= 1 &&
    value.length <= 9 &&
    /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(value) &&
    !/[\s、。！？,.!?()[\]{}「」『』・…]/u.test(value)
  );
}

function getPartOfSpeech(posList) {
  const pos = posList.join(' ');

  if (/adj/.test(pos)) return 'adjective';
  if (/\badv\b/.test(pos)) return 'adverb';
  if (/\bv/.test(pos)) return 'verb';
  if (/\bpn\b/.test(pos)) return 'pronoun';
  if (/\bprt\b/.test(pos)) return 'particle';
  if (/\bint\b/.test(pos)) return 'interjection';
  if (/\bconj\b/.test(pos)) return 'conjunction';
  if (/\bpref\b/.test(pos) || /\bsuf\b/.test(pos)) return 'affix';
  if (/\bctr\b/.test(pos)) return 'counter';
  return 'noun';
}

function getLevel(index) {
  if (index < 350) return 'A1';
  if (index < 700) return 'A2';
  return 'B1';
}

function cleanGloss(value) {
  return value
    .replace(/\s+/g, ' ')
    .replace(/^\d+\):?\s*/g, '')
    .replace(/\{[^}]*\}/g, '')
    .replace(/\((?:кн|перен|уст|разг|грубо|вежл|см|межд)\.?\)\s*/gi, '')
    .replace(/\s*;\s*/g, ' / ')
    .replace(/\s*\([^)]{18,}\)/g, '')
    .replace(/^[:/,\s]+/g, '')
    .trim()
    .slice(0, 96);
}

function isBadGloss(value) {
  return (
    value.length < 2 ||
    /^[()[\]{}:;,\s.]+$/.test(value) ||
    /служебн|инфикс|знак|сч[её]тн|в сочет|ср\.|см\./i.test(value)
  );
}

function getBestGloss(entry) {
  const glosses = entry.sense
    .flatMap((sense) => sense.gloss ?? [])
    .filter((item) => item.lang === 'rus' && item.text && !/^\d+$/.test(item.text))
    .map((item) => cleanGloss(item.text))
    .filter((item) => !isBadGloss(item));

  return glosses[0] ?? null;
}

function isCommonEntry(entry) {
  return [...entry.kanji, ...entry.kana].some((item) => item.common);
}

function getReading(entry, surface) {
  const exactKana = entry.kana.find((kana) => kana.text === surface);

  if (exactKana) {
    return katakanaToHiragana(exactKana.text);
  }

  const matchingKanaList = entry.kana.filter((kana) =>
    kana.appliesToKanji.includes('*') || kana.appliesToKanji.includes(surface),
  );
  const matchingKana = matchingKanaList.find((kana) => kana.common) ?? matchingKanaList[0];

  return katakanaToHiragana((matchingKana ?? entry.kana[0])?.text ?? surface);
}

function createCandidate(entry, surface, rank) {
  const gloss = getBestGloss(entry);

  if (!gloss || !isUsableSurface(surface)) {
    return null;
  }

  const partOfSpeech = getPartOfSpeech(entry.sense.flatMap((sense) => sense.partOfSpeech ?? []));

  if (partOfSpeech === 'affix' || (partOfSpeech === 'counter' && surface.length <= 1)) {
    return null;
  }

  const reading = getReading(entry, surface);
  const original = isKanaOnly(surface)
    ? surface
    : surface;

  return {
    original,
    reading,
    translation: gloss,
    transcription: `[${reading} · ${kanaToRomaji(reading)}]`,
    part_of_speech: partOfSpeech,
    tags: ['частотное', isKanaOnly(original) ? 'хирагана' : 'кандзи'],
    rank,
  };
}

const entryIndex = new Map();

for (const entry of jmdict.words) {
  if (!isCommonEntry(entry)) continue;

  for (const surface of [...entry.kanji.map((item) => item.text), ...entry.kana.map((item) => item.text)]) {
    if (!isUsableSurface(surface) || entryIndex.has(surface)) continue;
    const candidate = createCandidate(entry, surface, Number.MAX_SAFE_INTEGER);
    if (candidate) {
      entryIndex.set(surface, candidate);
    }
  }
}

const selected = [];
const seen = new Set();

for (const [rank, line] of frequencyLines.entries()) {
  const surface = line.split(/\s+/)[0];
  const candidate = entryIndex.get(surface);

  if (!candidate || seen.has(candidate.original)) {
    continue;
  }

  selected.push({ ...candidate, rank });
  seen.add(candidate.original);

  if (selected.length >= TARGET_COUNT) {
    break;
  }
}

if (selected.length < TARGET_COUNT) {
  for (const candidate of [...entryIndex.values()].sort((left, right) => left.original.localeCompare(right.original, 'ja'))) {
    if (seen.has(candidate.original)) continue;
    selected.push(candidate);
    seen.add(candidate.original);

    if (selected.length >= TARGET_COUNT) {
      break;
    }
  }
}

if (selected.length < TARGET_COUNT) {
  throw new Error(`Only ${selected.length} Japanese words found`);
}

const header = `import type { Word } from '../types';

type JapaneseWordSeed = Pick<
  Word,
  'id' | 'original' | 'translation' | 'transcription' | 'example_original' | 'example_translation' | 'part_of_speech' | 'tags' | 'level'
>;

function createJapaneseWord(seed: JapaneseWordSeed): Word {
  return {
    ...seed,
    language: 'japanese',
    audio_original: '',
    packIds: [],
    source: 'core',
  };
}

export const JAPANESE_CORE_WORDS: Word[] = [
`;

const body = selected
  .map((word, index) => {
    const id = `ja-${String(index + 1).padStart(4, '0')}`;
    const level = getLevel(index);
    const primaryTranslation = word.translation
      .split(/\s*\/\s*|,\s*/)[0]
      ?.replace(/^\[([^\]]+)]\s*/, '$1 ')
      .replace(/^\([^)]*\)\s*/, '')
      .trim() || word.translation.trim();
    const translatedWord = primaryTranslation
      ? `${primaryTranslation.charAt(0).toLocaleUpperCase('ru-RU')}${primaryTranslation.slice(1)}`
      : word.translation;
    const payload = {
      id,
      original: word.original,
      translation: word.translation,
      transcription: word.transcription,
      example_original: `${word.original}はよく使う言葉です。`,
      example_translation: `«${translatedWord}» — часто употребляемое слово.`,
      part_of_speech: word.part_of_speech,
      level,
      tags: [...word.tags, `top-${index + 1}`],
    };

    return `  createJapaneseWord(${JSON.stringify(payload)}),`;
  })
  .join('\n');

fs.writeFileSync(OUTPUT, `${header}${body}\n];\n`);

console.log(`Generated ${selected.length} Japanese words into ${OUTPUT}`);
