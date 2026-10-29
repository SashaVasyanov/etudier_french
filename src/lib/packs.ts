import type { AppStorage, PackStatus, Word, WordPack } from '../types';
import { getWordProgress } from './storage';

function normalizeWordKey(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeMeaning(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\(en:[^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitMeanings(translation: string): string[] {
  return translation.split(/\s*[/;,]\s*/).map(normalizeMeaning).filter(Boolean);
}

/**
 * The same spelling can mean different things in different packs (chambre —
 * «номер» in Travel, «спальня» in Home). One card keeps every meaning instead
 * of silently dropping the second one; spelling variants (самолёт/самолет) and
 * meanings already listed are not repeated.
 */
export function mergeTranslations(primary: string, secondary: string): string {
  const known = new Set(splitMeanings(primary));
  const extra = secondary
    .split(/\s*[/;,]\s*/)
    .map((part) => part.replace(/\(en:[^)]*\)/g, '').trim())
    .filter((part) => part && !known.has(normalizeMeaning(part)));
  const unique = [...new Map(extra.map((part) => [normalizeMeaning(part), part])).values()];
  return unique.length > 0 ? `${primary}; ${unique.join(', ')}` : primary;
}

/**
 * Words count as the same card when the spelling matches — and, for Japanese,
 * the reading too: 実 [じつ] «правда» and 実 [み] «плод» are different words.
 */
function getMergeKey(word: Word): string {
  const base = `${word.language}:${normalizeWordKey(word.original)}`;
  if (word.language !== 'japanese') return base;
  const reading = (word.transcription ?? '').replace(/^\[|\]$/g, '').split(/[·・]/)[0]?.trim() ?? '';
  const hiragana = reading.replace(/[\u30a1-\u30f6]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
  return `${base}:${hiragana}`;
}

export function getEnabledPackIds(storage: AppStorage): string[] {
  return Object.values(storage.packStates)
    .filter((packState) => packState.status !== 'not_added')
    .map((packState) => packState.packId);
}

export function isWordAvailable(word: Word, enabledPackIds: string[]): boolean {
  if (word.source === 'core' || word.source === 'custom') {
    return true;
  }

  return word.packIds.some((packId) => enabledPackIds.includes(packId));
}

export function getActiveWords(words: Word[], enabledPackIds: string[]): Word[] {
  const availableWords = words.filter((word) => isWordAvailable(word, enabledPackIds));
  const bestByOriginal = new Map<string, Word>();

  availableWords.forEach((word) => {
    const key = getMergeKey(word);
    const current = bestByOriginal.get(key);

    if (!current) {
      bestByOriginal.set(key, word);
      return;
    }

    const currentPriority = current.source === 'core' ? 0 : current.source === 'custom' ? 1 : 2;
    const nextPriority = word.source === 'core' ? 0 : word.source === 'custom' ? 1 : 2;

    const preferred = nextPriority < currentPriority ? word : current;
    const other = preferred === word ? current : word;
    // Pack examples are written by hand for the level of the pack; the core
    // dictionary's are often generated or long, so the pack's one wins.
    const packExample = preferred.source !== 'pack' && other.source === 'pack' && other.example_original
      ? {
          example_original: other.example_original,
          example_translation: other.example_translation,
          example_reading: other.example_reading,
        }
      : {};
    bestByOriginal.set(key, {
      ...preferred,
      ...packExample,
      translation: mergeTranslations(preferred.translation, other.translation),
      packIds: [...new Set([...current.packIds, ...word.packIds])],
    });
  });

  return Array.from(bestByOriginal.values());
}

const SOURCE_PRIORITY: Record<Word['source'], number> = { core: 0, custom: 1, pack: 2 };

/**
 * Lessons merge duplicates into one word (see getActiveWords) and record
 * progress under that word's id. Pack words get the same id, keeping their own
 * picture and example, so pack progress counts words learned anywhere.
 */
function hasRealImage(word: Word): boolean {
  return Boolean(word.imageUrl && !word.imageUrl.startsWith('data:'));
}

function pickImage(word: Word): Partial<Word> {
  return {
    imageUrl: word.imageUrl,
    imagePath: word.imagePath,
    imageAlt: word.imageAlt,
    imageSource: word.imageSource,
    imageSourceTitle: word.imageSourceTitle,
    imageProvider: word.imageProvider,
    imageAttribution: word.imageAttribution,
    imageLicense: word.imageLicense,
    imageLicenseUrl: word.imageLicenseUrl,
  };
}

function pickWordMedia(word: Word): Partial<Word> {
  return {
    ...(hasRealImage(word) ? pickImage(word) : {}),
    ...(word.definition ? { definition: word.definition, definition_reading: word.definition_reading, definition_translation: word.definition_translation } : {}),
    ...(word.examples?.length ? { examples: word.examples } : {}),
    ...(word.frequency ? { frequency: word.frequency } : {}),
  };
}

export function canonicalizePackWords(packs: WordPack[], words: Word[]): WordPack[] {
  const loadedById = new Map(words.map((word) => [word.id, word]));
  const canonicalIdByKey = new Map<string, Word>();
  words.forEach((word) => {
    const key = getMergeKey(word);
    const current = canonicalIdByKey.get(key);
    if (!current || SOURCE_PRIORITY[word.source] < SOURCE_PRIORITY[current.source]) canonicalIdByKey.set(key, word);
  });
  return packs.map((pack) => {
    let changed = false;
    const packWords = pack.words.map((word) => {
      // The loaded copy of this very word carries the generated picture and
      // dictionary context; the merged word lends its picture when the pack
      // only has a drawn placeholder.
      const loaded = loadedById.get(word.id);
      const own = loaded ? { ...word, ...pickWordMedia(loaded) } : word;
      const canonical = canonicalIdByKey.get(getMergeKey(word));
      if (!canonical || canonical.id === word.id) {
        if (own !== word) changed = true;
        return own;
      }
      changed = true;
      return { ...own, ...(hasRealImage(own) || !hasRealImage(canonical) ? {} : pickImage(canonical)), id: canonical.id };
    });
    return changed ? { ...pack, words: packWords } : pack;
  });
}

export function getPackByWord(word: Word, packs: WordPack[]): WordPack[] {
  return packs.filter((pack) => word.packIds.includes(pack.id));
}

export function derivePackStatus(pack: WordPack, storage: AppStorage): PackStatus {
  const storedState = storage.packStates[pack.id];

  if (!storedState || storedState.status === 'not_added') {
    return 'not_added';
  }

  const wordsStarted = pack.words.filter((word) => {
    const progress = getWordProgress(storage, word.id);
    return progress.shown_count > 0 || progress.status === 'known' || progress.status === 'mastered';
  }).length;
  const wordsCompleted = pack.words.filter((word) => {
    const status = getWordProgress(storage, word.id).status;
    return status === 'mastered' || status === 'known';
  }).length;

  if (pack.words.length > 0 && wordsCompleted === pack.words.length) {
    return 'completed';
  }

  if (wordsStarted > 0) {
    return 'in_progress';
  }

  return 'added';
}

export function getPackCompletionRatio(pack: WordPack, storage: AppStorage): number {
  if (pack.words.length === 0) {
    return 0;
  }

  const completed = pack.words.filter((word) => {
    const status = getWordProgress(storage, word.id).status;
    return status === 'mastered' || status === 'known';
  }).length;

  return Math.round((completed / pack.words.length) * 100);
}
