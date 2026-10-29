import { FRENCH_H_ASPIRE, FRENCH_NOUN_GENDERS } from '../data/frenchNounGenders';
import type { ExerciseType, LearningLanguage, Word, WordExample, WordFrequency } from '../types';

const PART_OF_SPEECH_LABELS: Record<string, string> = {
  noun: 'существительное',
  verb: 'глагол',
  adjective: 'прилагательное',
  adverb: 'наречие',
  preposition: 'предлог',
  determiner: 'определитель',
  pronoun: 'местоимение',
  conjunction: 'союз',
  expression: 'выражение',
  interjection: 'междометие',
  particle: 'частица',
  counter: 'счётный суффикс',
  word: 'слово',
};

export const FREQUENCY_LABELS: Record<WordFrequency, string> = {
  high: 'Очень частое слово',
  mid: 'Частое слово',
  low: 'Встречается реже',
};

/** The word's examples; a word without written context has its one example. */
export function getWordExamples(word: Word): WordExample[] {
  if (word.examples?.length) return word.examples;
  const original = word.example_original.trim();
  if (!original) return [];
  const match = splitExampleAroundWord(original, word)?.match ?? '';
  return [{ original, reading: word.example_reading, translation: word.example_translation, form: match }];
}

/** Where the studied word sits in an example, for marking it. */
export function getExampleHighlight(example: WordExample): { start: number; end: number } | null {
  if (!example.form) return null;
  const start = example.original.indexOf(example.form);
  return start < 0 ? null : { start, end: start + example.form.length };
}

export function getPartOfSpeechLabel(partOfSpeech: string): string {
  return PART_OF_SPEECH_LABELS[partOfSpeech] ?? partOfSpeech;
}

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function startsWithVowelSound(value: string): boolean {
  const word = value.trim().toLowerCase();
  if (FRENCH_H_ASPIRE.has(word) || FRENCH_H_ASPIRE.has(word.split(/[\s-]/)[0])) return false;
  // y before a vowel is a consonant: le yaourt, le yoga.
  if (/^y[aeiouéèêàâôû]/.test(word)) return false;
  return /^[aeiouyhàâæéèêëîïôœùûü]/.test(word);
}

const WITHOUT_ARTICLE: ReadonlySet<string> = new Set([
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
  'noël', 'monsieur', 'madame', 'mademoiselle', 'maman', 'papa',
]);

const ARTICLE_EXCEPTIONS: Record<string, string> = {
  cafe: 'le',
  the: 'le',
  musee: 'le',
  lycee: 'le',
  eleve: "l'",
  livre: 'le',
  dictionnaire: 'le',
  message: 'le',
  fromage: 'le',
  voyage: 'le',
  village: 'le',
  garage: 'le',
  visage: 'le',
  nuage: 'le',
  journal: 'le',
  bus: 'le',
  cours: 'le',
  pays: 'le',
  temps: 'le',
  prix: 'le',
  bras: 'le',
  nez: 'le',
  choix: 'le',
  voix: 'la',
  fenetre: 'la',
  classe: 'la',
  maison: 'la',
  voiture: 'la',
  gare: 'la',
  plage: 'la',
  carte: 'la',
  chambre: 'la',
  table: 'la',
  porte: 'la',
  chaise: 'la',
  cuisine: 'la',
  ecole: "l'",
  eau: "l'",
  heure: "l'",
  adresse: "l'",
  histoire: "l'",
  idee: "l'",
};

function normalizeArticle(article: string): string | null {
  switch (article.toLowerCase().replace(/[’]/g, "'")) {
    case 'le':
    case 'un':
    case 'du':
      return 'le';
    case 'la':
    case 'une':
      return 'la';
    case 'les':
    case 'des':
      return 'les';
    case "l'":
    case "de l'":
      return "l'";
    default:
      return null;
  }
}

function getArticleFromExample(word: Word): string | null {
  const original = word.original.trim();

  if (!original || !word.example_original) {
    return null;
  }

  const example = normalizeKey(word.example_original);
  const normalizedOriginal = normalizeKey(original);
  const escapedOriginal = escapeRegExp(normalizedOriginal);
  const spacedArticleMatch = example.match(
    new RegExp(`\\b(le|la|les|un|une|des|du)\\s+${escapedOriginal}(?=\\b|\\s|[.,;:!?])`, 'i'),
  );

  if (spacedArticleMatch?.[1]) {
    return normalizeArticle(spacedArticleMatch[1]);
  }

  const elidedArticleMatch = example.match(new RegExp(`\\b(l'|de l')${escapedOriginal}(?=\\b|\\s|[.,;:!?])`, 'i'));

  if (elidedArticleMatch?.[1]) {
    return normalizeArticle(elidedArticleMatch[1]);
  }

  return null;
}

function isLikelyPluralNoun(value: string): boolean {
  const normalized = normalizeKey(value);

  if (normalized.includes(' ')) {
    return false;
  }

  if (['bus', 'cours', 'temps', 'pays', 'prix', 'bras'].includes(normalized)) {
    return false;
  }

  return /(?:s|x)$/.test(normalized);
}

function isLikelyFeminineNoun(value: string): boolean {
  const normalized = normalizeKey(value);

  return /(?:tion|sion|te|tte|ette|ance|ence|ie|ure|euse|eure|aison|esse|iere|erie|ade|eur|e)$/.test(normalized) &&
    !/(?:age|ege|isme|ment|oir|phone|scope|ome|eau)$/.test(normalized);
}

export function getFrenchArticleForWord(word: Word): string | null {
  if (word.part_of_speech !== 'noun') {
    return null;
  }

  const original = word.original.trim();

  if (!original) {
    return null;
  }

  // Months, holidays and forms of address are used without an article.
  if (WITHOUT_ARTICLE.has(original.toLowerCase())) return null;

  // The gender list is the source of truth; examples and endings are only a
  // fallback for words outside it (imported or custom words).
  const gender = FRENCH_NOUN_GENDERS[original.toLowerCase()];
  if (gender) {
    if (gender === 'pl') return 'les';
    if (startsWithVowelSound(original)) return "l'";
    return gender === 'f' ? 'la' : 'le';
  }

  const normalizedOriginal = normalizeKey(original);
  const explicitArticle = ARTICLE_EXCEPTIONS[normalizedOriginal] ?? getArticleFromExample(word);

  if (explicitArticle) {
    // «un ami» in an example still means «l'ami» as a dictionary form.
    return (explicitArticle === 'le' || explicitArticle === 'la') && startsWithVowelSound(original) ? "l'" : explicitArticle;
  }

  if (isLikelyPluralNoun(original)) {
    return 'les';
  }

  if (startsWithVowelSound(original)) {
    return "l'";
  }

  return isLikelyFeminineNoun(original) ? 'la' : 'le';
}

/** Grammatical gender of a French noun from the gender list; null when the
 *  word is not a noun or its gender is not known for sure. */
export function getFrenchGender(word: Word): 'm' | 'f' | 'pl' | null {
  if (word.language !== 'french' || word.part_of_speech !== 'noun') return null;
  return FRENCH_NOUN_GENDERS[word.original.trim().toLowerCase()] ?? null;
}

export const FRENCH_GENDER_LABELS = { m: 'муж. род', f: 'жен. род', pl: 'мн. число' } as const;

/**
 * Splits an example sentence around the studied word so it can be marked.
 * Matching ignores case; when the word is not found as written the sentence
 * comes back whole.
 */
export function splitExampleAroundWord(sentence: string, word: Word): { before: string; match: string; after: string } | null {
  const target = word.original.trim();
  if (!sentence || !target) return null;
  const index = sentence.toLocaleLowerCase().indexOf(target.toLocaleLowerCase());
  if (index < 0) return null;
  return {
    before: sentence.slice(0, index),
    match: sentence.slice(index, index + target.length),
    after: sentence.slice(index + target.length),
  };
}

export function getDisplayWord(word: Word): string {
  if (word.language !== 'french') {
    return word.original;
  }

  const article = getFrenchArticleForWord(word);

  if (!article) {
    return word.original;
  }

  return article.endsWith("'") ? `${article}${word.original}` : `${article} ${word.original}`;
}

export function containsJapaneseKanji(value: string): boolean {
  return /\p{Script=Han}/u.test(value);
}

export function getJapaneseHiraganaReading(word: Word): string | null {
  if (word.language !== 'japanese' || !word.transcription) {
    return null;
  }

  const kana = word.transcription
    .replace(/^\[|]$/g, '')
    .split('·')[0]
    ?.trim();

  if (!kana || !/[\u3040-\u30ff]/.test(kana)) {
    return null;
  }

  return [...kana]
    .map((character) => {
      const code = character.charCodeAt(0);
      return code >= 0x30a1 && code <= 0x30f6 ? String.fromCharCode(code - 0x60) : character;
    })
    .join('');
}

export function getJapaneseExampleReading(word: Word): string | null {
  if (word.language !== 'japanese') {
    return null;
  }

  return word.example_reading?.trim() || null;
}

export function getSpokenWordText(word: Word): string {
  if (word.language === 'japanese') {
    return getJapaneseHiraganaReading(word) ?? word.original;
  }

  if (word.part_of_speech === 'noun') {
    return getDisplayWord(word);
  }

  return word.original;
}

export function isUsageFocusedWord(word: Word): boolean {
  return ['preposition', 'determiner', 'pronoun', 'conjunction', 'adverb'].includes(word.part_of_speech);
}

export function getWordDescription(word: Word): string {
  const translation = word.translation.toLowerCase();

  if (word.language === 'japanese') {
    switch (word.part_of_speech) {
      case 'noun':
        return `Японское существительное со значением «${translation}». Обращайте внимание на кандзи, чтение и типичный контекст употребления.`;
      case 'verb':
        return `Японский глагол со значением «${translation}». Полезно запоминать его сразу в короткой фразе и с типичными частицами.`;
      case 'adjective':
        return `Японское прилагательное со значением «${translation}». Смотрите, как оно описывает предмет, состояние или впечатление в примере.`;
      case 'adverb':
        return `Японское наречие со значением «${translation}». Его лучше учить через ситуацию: когда, как или насколько происходит действие.`;
      case 'determiner':
        return `Базовый японский числительный или определитель со значением «${translation}». Запоминайте форму вместе с примером употребления.`;
      case 'expression':
        return `Готовое японское выражение со значением «${translation}». Его удобнее учить целиком как устойчивую единицу речи.`;
      case 'interjection':
        return `Частотная японская реплика со значением «${translation}». Обычно употребляется как готовая вежливая реакция или ответ.`;
      default:
        return `Японское слово со значением «${translation}». Старайтесь связывать написание, чтение и конкретный жизненный контекст.`;
    }
  }

  const article = getFrenchArticleForWord(word);

  switch (word.part_of_speech) {
    case 'noun':
      return `Существительное со значением «${translation}». Лучше запоминать его как «${article ?? ''} ${word.original}» вместе с артиклем и контекстом.`;
    case 'verb':
      return `Глагол со значением «${translation}». Обращайте внимание, с какими словами и в какой ситуации он употребляется.`;
    case 'adjective':
      return `Прилагательное со значением «${translation}». Оно описывает признак предмета, человека или состояния.`;
    case 'adverb':
      return `Наречие со значением «${translation}». Оно уточняет действие, время, место, степень или частоту.`;
    case 'preposition':
      return `Предлог «${word.original}». Его важно учить через управление и типичные конструкции, а не отдельно.`;
    case 'determiner':
      return `Определитель «${word.original}». Он показывает род, число, принадлежность или указание перед существительным.`;
    case 'pronoun':
      return `Местоимение «${word.original}». Оно заменяет участника речи или объект в предложении.`;
    case 'conjunction':
      return `Союз «${word.original}». Он связывает части высказывания и задаёт смысловую связь между ними.`;
    case 'expression':
      return `Готовое выражение со значением «${translation}». Его лучше запоминать целиком как одну конструкцию.`;
    case 'interjection':
      return `Короткая реплика со значением «${translation}». Обычно используется как готовая реакция в речи.`;
    default:
      return `Слово со значением «${translation}». Запоминайте его через контекст, а не только через прямой перевод.`;
  }
}

export function getWordExampleLabel(word: Word): string {
  return isUsageFocusedWord(word) ? 'Фраза с контекстом' : 'Контекст';
}

export function getLessonWordNotes(word: Word): string[] {
  // Pronunciation and the example translation already have their own places
  // on the introduction card. Notes should add context, not repeat them.
  return [getWordDescription(word)].filter(Boolean);
}

export function getExerciseCopy(
  type: ExerciseType,
  language: LearningLanguage = 'french',
): { eyebrow: string; title: string; hint: string } {
  const targetLanguageLabel = language === 'french' ? 'французском' : 'японском';
  const sourceLanguageLabel = language === 'french' ? 'французское' : 'японское';

  switch (type) {
    case 'audio_to_translation_choice':
      return {
        eyebrow: 'Слушание',
        title: 'Что вы слышите?',
        hint: 'Прослушайте слово и выберите точный перевод.',
      };
    case 'letter_assembly':
      return {
        eyebrow: 'Из букв',
        title: 'Соберите слово',
        hint: language === 'japanese' ? 'Нажимайте знаки каны по порядку.' : 'Нажимайте буквы по порядку или печатайте их.',
      };
    case 'definition_choice':
      return {
        eyebrow: 'Определение',
        title: 'Какое слово подходит?',
        hint: `Прочитайте определение на ${targetLanguageLabel} и выберите слово.`,
      };
    case 'translation_to_original_choice':
      return {
        eyebrow: 'Подбор слова',
        title: `Найдите ${sourceLanguageLabel} слово`,
        hint: `Смотрите на перевод и выберите правильный вариант на ${targetLanguageLabel}.`,
      };
    case 'original_to_translation_choice':
      return {
        eyebrow: 'Подбор перевода',
        title: 'Найдите правильный перевод',
        hint: `Смотрите на слово на ${targetLanguageLabel} и выберите точное значение.`,
      };
    case 'audio_to_original_input':
      return {
        eyebrow: 'Аудио-ввод',
        title: 'Напишите слово',
        hint: `Слушайте внимательно и введите слово ${language === 'french' ? 'по-французски' : 'по-японски'}.`,
      };
    case 'translation_to_original_input':
      return {
        eyebrow: 'Активное вспоминание',
        title: 'Напишите слово',
        hint: 'Вспомните слово по переводу без вариантов ответа.',
      };
    case 'kanji_to_hiragana_input':
      return {
        eyebrow: 'Чтение кандзи',
        title: 'Введите чтение',
        hint: 'Напишите чтение слова хираганой.',
      };
    case 'sentence_cloze_input':
      return {
        eyebrow: 'Слово в контексте',
        title: 'Заполните пропуск',
        hint: 'Вспомните слово по смыслу предложения.',
      };
    case 'sentence_order':
      return {
        eyebrow: 'Фраза целиком',
        title: 'Соберите фразу',
        hint: 'Нажимайте на слова по порядку — или цифры на клавиатуре.',
      };
    case 'audio_sentence_choice':
      return {
        eyebrow: 'Фраза на слух',
        title: 'Что сказано?',
        hint: 'Прослушайте фразу и выберите её перевод.',
      };
    case 'article_choice':
      return {
        eyebrow: 'Род слова',
        title: 'Le или la?',
        hint: 'Выберите артикль: от него зависит форма прилагательных.',
      };
    case 'sentence_dictation':
      return {
        eyebrow: 'Диктант',
        title: 'Запишите фразу',
        hint: 'Прослушайте и напишите фразу целиком. Знаки препинания и заглавные буквы не важны.',
      };
    case 'kanji_reading_choice':
      return {
        eyebrow: 'Чтение кандзи',
        title: 'Как это читается?',
        hint: 'Выберите чтение слова.',
      };
    case 'memory_check':
      return {
        eyebrow: 'Вспоминание',
        title: 'Вспомните слово',
        hint: 'Оцените честно: вспоминается ли слово по контексту прямо сейчас.',
      };
    default:
      return {
        eyebrow: 'Упражнение',
        title: 'Выполните задание',
        hint: 'Сосредоточьтесь на слове и выберите точный ответ.',
      };
  }
}
