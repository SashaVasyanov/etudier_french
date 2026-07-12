import type { ExerciseType, LearningLanguage, Word } from '../types';

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
  word: 'слово',
};

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
  return /^[aeiouyhàâæéèêëîïôœùûü]/i.test(value.trim());
}

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

  const normalizedOriginal = normalizeKey(original);
  const explicitArticle = ARTICLE_EXCEPTIONS[normalizedOriginal] ?? getArticleFromExample(word);

  if (explicitArticle) {
    return explicitArticle;
  }

  if (isLikelyPluralNoun(original)) {
    return 'les';
  }

  if (startsWithVowelSound(original)) {
    return "l'";
  }

  return isLikelyFeminineNoun(original) ? 'la' : 'le';
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

export function getLessonWordBadge(word: Word): string {
  if (word.language === 'japanese') {
    return word.part_of_speech === 'expression' ? 'Базовое японское выражение' : 'Базовое японское слово';
  }

  return word.part_of_speech === 'expression' ? 'Распространённое выражение' : 'Распространённое слово';
}

export function getLessonWordNotes(word: Word): string[] {
  const notes = [
    word.transcription ? `${word.transcription} · ${getPartOfSpeechLabel(word.part_of_speech)}` : getPartOfSpeechLabel(word.part_of_speech),
    getWordDescription(word),
    word.example_translation,
  ].filter(Boolean);

  return Array.from(new Set(notes)).slice(0, 3);
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
