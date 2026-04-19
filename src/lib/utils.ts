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
