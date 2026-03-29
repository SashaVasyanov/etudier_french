import type { ExerciseType, Word } from '../types';

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

function startsWithVowelSound(value: string): boolean {
  return /^[aeiouyhàâæéèêëîïôœùûü]/i.test(value.trim());
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

  if (isLikelyPluralNoun(original)) {
    return 'les';
  }

  if (startsWithVowelSound(original)) {
    return "l'";
  }

  return isLikelyFeminineNoun(original) ? 'la' : 'le';
}

export function getDisplayWord(word: Word): string {
  const article = getFrenchArticleForWord(word);

  if (!article) {
    return word.original;
  }

  return article.endsWith("'") ? `${article}${word.original}` : `${article} ${word.original}`;
}

export function isUsageFocusedWord(word: Word): boolean {
  return ['preposition', 'determiner', 'pronoun', 'conjunction', 'adverb'].includes(word.part_of_speech);
}

export function getWordDescription(word: Word): string {
  const translation = word.translation.toLowerCase();
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

export function getExerciseCopy(type: ExerciseType): { eyebrow: string; title: string; hint: string } {
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
        title: 'Найдите французское слово',
        hint: 'Смотрите на перевод и выберите правильный вариант на французском.',
      };
    case 'original_to_translation_choice':
      return {
        eyebrow: 'Подбор перевода',
        title: 'Найдите правильный перевод',
        hint: 'Смотрите на французское слово и выберите точное значение.',
      };
    case 'audio_to_original_input':
      return {
        eyebrow: 'Аудио-ввод',
        title: 'Напишите слово',
        hint: 'Слушайте внимательно и введите слово по-французски.',
      };
    default:
      return {
        eyebrow: 'Упражнение',
        title: 'Выполните задание',
        hint: 'Сосредоточьтесь на слове и выберите точный ответ.',
      };
  }
}
