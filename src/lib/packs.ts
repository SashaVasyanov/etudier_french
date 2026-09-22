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
    const key = `${word.language}:${normalizeWordKey(word.original)}`;
    const current = bestByOriginal.get(key);

    if (!current) {
      bestByOriginal.set(key, word);
      return;
    }

    const currentPriority = current.source === 'core' ? 0 : current.source === 'custom' ? 1 : 2;
    const nextPriority = word.source === 'core' ? 0 : word.source === 'custom' ? 1 : 2;

    const preferred = nextPriority < currentPriority ? word : current;
    bestByOriginal.set(key, {
      ...preferred,
      packIds: [...new Set([...current.packIds, ...word.packIds])],
    });
  });

  return Array.from(bestByOriginal.values());
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
