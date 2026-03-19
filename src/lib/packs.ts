import type { AppStorage, PackStatus, Word, WordPack } from '../types';
import { getWordProgress } from './storage';

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
  return words.filter((word) => isWordAvailable(word, enabledPackIds));
}

export function getPackByWord(word: Word, packs: WordPack[]): WordPack[] {
  return packs.filter((pack) => word.packIds.includes(pack.id));
}

export function derivePackStatus(pack: WordPack, storage: AppStorage): PackStatus {
  const storedState = storage.packStates[pack.id];

  if (!storedState || storedState.status === 'not_added') {
    return 'not_added';
  }

  const wordsStarted = pack.words.filter((word) => getWordProgress(storage, word.id).shown_count > 0).length;
  const wordsCompleted = pack.words.filter((word) => {
    const status = getWordProgress(storage, word.id).status;
    return status === 'known' || status === 'mastered';
  }).length;

  if (wordsCompleted === pack.words.length) {
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
    return status === 'known' || status === 'mastered';
  }).length;

  return Math.round((completed / pack.words.length) * 100);
}
