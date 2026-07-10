import type { LearningLanguage, Word } from '../types';

export function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

export function normalizeAnswer(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function normalizeFrenchAnswerToken(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’`]/g, "'")
    .replace(/[^a-z\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripFrenchLeadingArticle(value: string): string {
  return value
    .replace(/^(l'|le |la |les |un |une |des |du |de la |de l')/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getFrenchAnswerVariants(value: string): Set<string> {
  const normalized = normalizeFrenchAnswerToken(value);
  const withoutArticle = stripFrenchLeadingArticle(normalized);

  return new Set([normalized, withoutArticle].filter(Boolean));
}

export function isFrenchAnswerMatch(userAnswer: string, correctAnswer: string): boolean {
  const userVariants = getFrenchAnswerVariants(userAnswer);
  const correctVariants = getFrenchAnswerVariants(correctAnswer);

  return [...userVariants].some((variant) => correctVariants.has(variant));
}

function normalizeJapaneseAnswerToken(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\u3000\s]+/g, ' ')
    .trim();
}

function katakanaToHiragana(value: string): string {
  return [...value]
    .map((char) => {
      const code = char.charCodeAt(0);
      return code >= 0x30a1 && code <= 0x30f6 ? String.fromCharCode(code - 0x60) : char;
    })
    .join('');
}

function normalizeJapaneseRomaji(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[āâ]/g, 'aa')
    .replace(/[īî]/g, 'ii')
    .replace(/[ūû]/g, 'uu')
    .replace(/[ēê]/g, 'ee')
    .replace(/[ōô]/g, 'ou')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '');
}

function getJapaneseRomajiVariants(value: string): Set<string> {
  const normalized = normalizeJapaneseRomaji(value);

  if (!normalized) {
    return new Set();
  }

  const alternateSpellings = normalized
    .replace(/shi/g, 'si')
    .replace(/chi/g, 'ti')
    .replace(/tsu/g, 'tu')
    .replace(/fu/g, 'hu')
    .replace(/sha/g, 'sya')
    .replace(/shu/g, 'syu')
    .replace(/sho/g, 'syo')
    .replace(/ja/g, 'zya')
    .replace(/ju/g, 'zyu')
    .replace(/jo/g, 'zyo');
  const shortenLongVowels = (romaji: string) =>
    romaji
      .replace(/ou/g, 'o')
      .replace(/oo/g, 'o')
      .replace(/uu/g, 'u')
      .replace(/ii/g, 'i')
      .replace(/ee/g, 'e');

  return new Set([
    normalized,
    alternateSpellings,
    shortenLongVowels(normalized),
    shortenLongVowels(alternateSpellings),
  ]);
}

const JAPANESE_KANA_ROMAJI: Record<string, string> = {
  きゃ: 'kya', きゅ: 'kyu', きょ: 'kyo',
  ぎゃ: 'gya', ぎゅ: 'gyu', ぎょ: 'gyo',
  しゃ: 'sha', しゅ: 'shu', しょ: 'sho', しぇ: 'she',
  じゃ: 'ja', じゅ: 'ju', じょ: 'jo', じぇ: 'je',
  ちゃ: 'cha', ちゅ: 'chu', ちょ: 'cho', ちぇ: 'che',
  にゃ: 'nya', にゅ: 'nyu', にょ: 'nyo',
  ひゃ: 'hya', ひゅ: 'hyu', ひょ: 'hyo',
  びゃ: 'bya', びゅ: 'byu', びょ: 'byo',
  ぴゃ: 'pya', ぴゅ: 'pyu', ぴょ: 'pyo',
  みゃ: 'mya', みゅ: 'myu', みょ: 'myo',
  りゃ: 'rya', りゅ: 'ryu', りょ: 'ryo',
  ふぁ: 'fa', ふぃ: 'fi', ふぇ: 'fe', ふぉ: 'fo',
  てぃ: 'ti', でぃ: 'di', とぅ: 'tu', どぅ: 'du',
  うぃ: 'wi', うぇ: 'we', うぉ: 'wo', ゔぁ: 'va', ゔぃ: 'vi', ゔぇ: 've', ゔぉ: 'vo',
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
  ゔ: 'vu', ゕ: 'ka', ゖ: 'ke',
  ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o', ゃ: 'ya', ゅ: 'yu', ょ: 'yo',
};

function getGeminatedPrefix(syllable: string): string {
  if (syllable.startsWith('ch') || syllable.startsWith('ts')) {
    return 't';
  }

  if (syllable.startsWith('sh')) {
    return 's';
  }

  return /^[aeiou]/.test(syllable) ? '' : syllable.slice(0, 1);
}

function getLastRomajiVowel(value: string): string {
  return [...value].reverse().find((char) => /[aeiou]/.test(char)) ?? '';
}

function kanaToRomaji(value: string): string {
  const kana = katakanaToHiragana(normalizeJapaneseAnswerToken(value));
  let result = '';
  let isGeminated = false;

  for (let index = 0; index < kana.length; index += 1) {
    const character = kana[index];

    if (character === 'っ') {
      isGeminated = true;
      continue;
    }

    if (character === 'ー') {
      result += getLastRomajiVowel(result);
      continue;
    }

    const pair = kana.slice(index, index + 2);
    const syllable = JAPANESE_KANA_ROMAJI[pair] ?? JAPANESE_KANA_ROMAJI[character];

    if (!syllable) {
      continue;
    }

    if (JAPANESE_KANA_ROMAJI[pair]) {
      index += 1;
    }

    result += `${isGeminated ? getGeminatedPrefix(syllable) : ''}${syllable}`;
    isGeminated = false;
  }

  return result;
}

function extractJapaneseReadingParts(word?: Word): { kana: string | null; romaji: string | null } {
  if (!word?.transcription) {
    return { kana: null, romaji: null };
  }

  const bracketContent = word.transcription.match(/\[([^\]]+)\]/)?.[1] ?? word.transcription;
  const parts = bracketContent.split(/[·・]/).map((part) => part.trim()).filter(Boolean);
  const kana = parts.find((part) => /[\u3040-\u30ff]/.test(part)) ?? null;
  const romaji = parts.find((part) => /[a-z]/i.test(part)) ?? null;

  return { kana, romaji };
}

// Some kanji have more than one common standalone reading. The speech engine
// can choose either one when it is asked to pronounce an isolated character,
// so those readings must be accepted in an audio exercise as well.
const JAPANESE_READING_ALIASES: Record<string, string[]> = {
  何: ['なん', 'nan'],
};

function getJapaneseAnswerVariants(correctAnswer: string, word?: Word): Set<string> {
  const { kana, romaji } = extractJapaneseReadingParts(word);
  const readingAliases = word ? JAPANESE_READING_ALIASES[word.original] ?? [] : [];
  const writingValues = [correctAnswer, word?.original, kana, ...readingAliases].filter((value): value is string => Boolean(value));
  const variants = writingValues.flatMap((value) => {
    const normalized = normalizeJapaneseAnswerToken(value);
    return [normalized, katakanaToHiragana(normalized)];
  });

  const romajiValues = [romaji, kana ? kanaToRomaji(kana) : null, ...readingAliases].filter(
    (value): value is string => Boolean(value),
  );

  return new Set([
    ...variants.filter(Boolean),
    ...romajiValues.flatMap((value) => [...getJapaneseRomajiVariants(value)]),
  ]);
}

export function isAnswerMatch(userAnswer: string, correctAnswer: string, language: LearningLanguage, word?: Word): boolean {
  if (language === 'french') {
    return isFrenchAnswerMatch(userAnswer, correctAnswer);
  }

  const normalizedUserAnswer = katakanaToHiragana(normalizeJapaneseAnswerToken(userAnswer));
  const answerVariants = getJapaneseAnswerVariants(correctAnswer, word);

  return answerVariants.has(normalizedUserAnswer) || [...getJapaneseRomajiVariants(userAnswer)].some((variant) => answerVariants.has(variant));
}

function normalizeComparableText(value: string): string {
  return value
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, "'")
    .replace(/[^a-z\s'-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const TRANSCRIPTION_CHAR_MAP: Record<string, string> = {
  а: 'a',
  е: 'e',
  ё: 'eu',
  и: 'i',
  й: 'y',
  к: 'k',
  н: 'n',
  о: 'o',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ш: 'sh',
  щ: 'shch',
  э: 'e',
  ю: 'yu',
  я: 'ya',
  ж: 'zh',
  ч: 'ch',
  ь: '',
  ъ: '',
  А: 'A',
  Е: 'E',
  Ё: 'Eu',
  И: 'I',
  Й: 'Y',
  К: 'K',
  Н: 'N',
  О: 'O',
  С: 'S',
  Т: 'T',
  У: 'U',
  Ф: 'F',
  Х: 'Kh',
  Ш: 'Sh',
  Щ: 'Shch',
  Э: 'E',
  Ю: 'Yu',
  Я: 'Ya',
  Ж: 'Zh',
  Ч: 'Ch',
  Ь: '',
  Ъ: '',
  'œ': 'oe',
  'Œ': 'Oe',
  'æ': 'ae',
  'Æ': 'Ae',
  'ə': 'e',
  'ɛ': 'e',
  'ɜ': 'e',
  'ɐ': 'a',
  'ɑ': 'a',
  'ɔ': 'o',
  'ø': 'oe',
  'ɶ': 'oe',
  'ʊ': 'u',
  'ɪ': 'i',
  'ʏ': 'u',
  'ɥ': 'u',
  'ʁ': 'r',
  'ʀ': 'r',
  'ɾ': 'r',
  'ɹ': 'r',
  'ʃ': 'sh',
  'ʒ': 'zh',
  'ɲ': 'gn',
  'ŋ': 'ng',
  'ç': 's',
  'ð': 'd',
  'θ': 't',
  'ː': '',
  '̃': '',
};

export function normalizeTranscription(value: string): string {
  return [...value]
    .map((char) => TRANSCRIPTION_CHAR_MAP[char] ?? char)
    .join('')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/уа/g, 'wa')
    .replace(/Уа/g, 'Wa')
    .replace(/уо/g, 'wo')
    .replace(/Уо/g, 'Wo')
    .replace(/ои/g, 'oi')
    .replace(/Ои/g, 'Oi')
    .replace(/yu/g, 'u')
    .replace(/eu(?=x\b)/g, 'eu')
    .replace(/[^A-Za-z[\]\s'.,;:!?()/-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTranscriptionBrackets(value: string): string {
  return value.trim().replace(/^\[/, '').replace(/\]$/, '').trim();
}

function hasUsefulFallbackTranscription(original: string, fallback: string): boolean {
  const normalizedFallback = normalizeComparableText(stripTranscriptionBrackets(fallback));
  const normalizedOriginal = normalizeComparableText(original);

  if (!normalizedFallback) {
    return false;
  }

  if (normalizedFallback === normalizedOriginal) {
    return false;
  }

  return true;
}

const FRENCH_TRANSCRIPTION_EXCEPTIONS: Record<string, string> = {
  'bonjour': 'bonzhur',
  'salut': 'saly',
  'merci': 'mersi',
  'oui': 'wi',
  'non': 'non',
  'beaucoup': 'boku',
  'eau': 'o',
  'oeil': 'oey',
  'yeux': 'yeu',
  'pain': 'pen',
  'femme': 'fam',
  'ville': 'vil',
  'travail': 'travay',
  'restaurant': 'restoran',
  'soeur': 'ser',
  'sœur': 'ser',
  'heure': 'er',
  'heures': 'er',
  'monsieur': 'mesye',
  'question': 'kestyon',
  'chercher': 'shershe',
  'fils': 'fis',
  'fille': 'fiy',
  'famille': 'famiy',
  'comment': 'koman',
  'ca': 'sa',
  'ça': 'sa',
  'plait': 'ple',
  'plaît': 'ple',
  'revoir': 'revwar',
  "au revoir": 'orvwar',
  "s'il vous plaît": 'sil vu ple',
  'ça va': 'sa va',
  'comment ça va': 'koman sa va',
  'je ne sais pas': 'zh ne se pa',
  'daccord': 'dakor',
  "d'accord": 'dakor',
  'il y a': 'il i a',
  'bus': 'bus',
};

const NORMALIZED_FRENCH_TRANSCRIPTION_EXCEPTIONS = Object.fromEntries(
  Object.entries(FRENCH_TRANSCRIPTION_EXCEPTIONS).map(([key, value]) => [normalizeComparableText(key), value]),
);

function getFrenchTranscriptionException(value: string): string | undefined {
  return NORMALIZED_FRENCH_TRANSCRIPTION_EXCEPTIONS[normalizeComparableText(value)];
}

function transliterateFrenchToken(token: string): string {
  const exact = getFrenchTranscriptionException(token);

  if (exact) {
    return exact;
  }

  let value = token
    .toLowerCase()
    .replace(/[’]/g, "'")
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae');

  value = value
    .replace(/\bh/g, '')
    .replace(/eux\b/g, 'eu')
    .replace(/eur\b/g, 'er')
    .replace(/eaux/g, 'o')
    .replace(/eau/g, 'o')
    .replace(/aux/g, 'o')
    .replace(/au/g, 'o')
    .replace(/oy/g, 'way')
    .replace(/oi/g, 'wa')
    .replace(/ou/g, 'u')
    .replace(/oeu/g, 'eu')
    .replace(/ph/g, 'f')
    .replace(/th/g, 't')
    .replace(/ch/g, 'sh')
    .replace(/gn/g, 'ny')
    .replace(/qu/g, 'k')
    .replace(/que\b/g, 'k')
    .replace(/gu(?=[ei])/g, 'g')
    .replace(/ge(?=[aou])/g, 'j')
    .replace(/g(?=[eiy])/g, 'j')
    .replace(/ç/g, 's')
    .replace(/c(?=[eiy])/g, 's')
    .replace(/c/g, 'k')
    .replace(/stion/g, 'styon')
    .replace(/tion/g, 'syon')
    .replace(/sion/g, 'zyon')
    .replace(/([aeou])ill/g, '$1y')
    .replace(/ill/g, 'il')
    .replace(/eill/g, 'ey')
    .replace(/ail\b/g, 'ay')
    .replace(/eil\b/g, 'ey')
    .replace(/euil\b/g, 'euy')
    .replace(/(ein|aim|ain|eim)(?=[b-df-hj-np-tv-z]|$)/g, 'en')
    .replace(/(in|im|yn|ym)(?=[b-df-hj-np-tv-z]|$)/g, 'en')
    .replace(/(on|om)(?=[b-df-hj-np-tv-z]|$)/g, 'on')
    .replace(/(an|am|en|em)(?=[b-df-hj-np-tv-z]|$)/g, 'an')
    .replace(/(un|um)(?=[b-df-hj-np-tv-z]|$)/g, 'en')
    .replace(/eu/g, 'eu')
    .replace(/ai/g, 'e')
    .replace(/ei/g, 'e')
    .replace(/ien/g, 'yen')
    .replace(/ein/g, 'en')
    .replace(/oin/g, 'wan')
    .replace(/ui/g, 'ui')
    .replace(/er\b/g, 'e')
    .replace(/ez\b/g, 'e')
    .replace(/et\b/g, 'e')
    .replace(/ment\b/g, 'man')
    .replace(/ure\b/g, 'yur')
    .replace(/j/g, 'zh')
    .replace(/y(?=[aeiou])/g, 'i');

  value = value
    .replace(/e\b/g, '')
    .replace(/es\b/g, '')
    .replace(/[dptxz]\b/g, '')
    .replace(/t\b/g, '')
    .replace(/ss/g, 's')
    .replace(/mm/g, 'm')
    .replace(/nn/g, 'n')
    .replace(/tt/g, 't')
    .replace(/rr/g, 'r')
    .replace(/aa/g, 'a')
    .replace(/ee/g, 'e')
    .replace(/ii/g, 'i')
    .replace(/oo/g, 'o')
    .replace(/uu/g, 'u');

  return value;
}

export function deriveFrenchLatinTranscription(original: string, fallback = ''): string {
  const cleanedFallback = normalizeTranscription(fallback);
  const source = original.trim();

  if (!source) {
    return cleanedFallback;
  }

  const exact = getFrenchTranscriptionException(source);

  if (exact) {
    return `[${exact}]`;
  }

  if (hasUsefulFallbackTranscription(source, cleanedFallback)) {
    return `[${stripTranscriptionBrackets(cleanedFallback)}]`;
  }

  const parts = source
    .replace(/[’]/g, "'")
    .split(/(\s+|-|')/)
    .map((part) => {
      if (!part || /^\s+$/.test(part) || part === '-' || part === "'") {
        return part;
      }

      return transliterateFrenchToken(part);
    })
    .join('')
    .replace(/'/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return `[${parts || cleanedFallback.replace(/^\[|\]$/g, '')}]`;
}

export function percentage(value: number, total: number): number {
  if (total === 0) {
    return 0;
  }

  return Math.round((value / total) * 100);
}

export function getTodayDateKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function formatRussianPercent(value: number): string {
  return `${value}%`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function isReviewDue(date: string | null, now = new Date()): boolean {
  if (!date) {
    return false;
  }

  return new Date(date).getTime() <= now.getTime();
}

export function startOfDay(date = new Date()): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function formatShortDateLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00`);

  return new Intl.DateTimeFormat('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date);
}

export function formatLongDateLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00`);

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatDateTimeLabel(dateIso: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateIso));
}

export function formatDurationLabel(totalSeconds: number): string {
  if (totalSeconds <= 0) {
    return '0 мин';
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.max(1, Math.round((totalSeconds % 3600) / 60));

  if (hours === 0) {
    return `${minutes} мин`;
  }

  return `${hours} ч ${minutes} мин`;
}
