import type { AppStorage, Word, WordProgress } from '../types';
import { getLevelOptions, getStudyLevel, getStudyLevelLabel, NO_JLPT, type StudyLevel } from './levels';

/** Round numbers of words in memory worth celebrating. */
export const MEMORY_MILESTONES = [25, 50, 100, 250, 500, 750, 1000, 1500, 2000, 3000];

/**
 * A word is «в памяти» once it was recalled at a spaced review (or marked
 * as already known): seen-and-practised words do not count yet.
 */
export function isInMemory(progress: WordProgress | undefined): boolean {
  return progress?.status === 'review' || progress?.status === 'mastered' || progress?.status === 'known';
}

export interface MemoryMilestone {
  count: number;
  /** The last milestone reached, or null before the first one. */
  reached: number | null;
  /** The next milestone, or null after the last one. */
  next: number | null;
  /** Share of the way from the previous milestone to the next, 0–1. */
  progress: number;
}

export function getMemoryMilestone(count: number): MemoryMilestone {
  const next = MEMORY_MILESTONES.find((milestone) => milestone > count) ?? null;
  const reachedList = MEMORY_MILESTONES.filter((milestone) => milestone <= count);
  const reached = reachedList.length > 0 ? reachedList[reachedList.length - 1] : null;
  const from = reached ?? 0;
  const progress = next === null ? 1 : (count - from) / (next - from);
  return { count, reached, next, progress: Math.min(1, Math.max(0, progress)) };
}

export interface LevelProgress {
  level: StudyLevel;
  label: string;
  inMemory: number;
  total: number;
}

/** Words in memory per level (A1–B1 or N5–N1) among the given words. */
export function getLevelProgress(words: Word[], storage: AppStorage): LevelProgress[] {
  if (words.length === 0) return [];
  const language = words[0].language;
  const rows = new Map<StudyLevel, LevelProgress>(
    getLevelOptions(language).map((level) => [level, { level, label: getStudyLevelLabel(level), inMemory: 0, total: 0 }]),
  );
  for (const word of words) {
    const row = rows.get(getStudyLevel(word));
    if (!row) continue;
    row.total += 1;
    if (isInMemory(storage.progressByWordId[word.id])) row.inMemory += 1;
  }
  return [...rows.values()].filter((row) => row.total > 0 && row.level !== NO_JLPT);
}

/** The level being worked on: the first one that is less than 90 % done. */
export function getCurrentLevel(levels: LevelProgress[]): LevelProgress | null {
  return levels.find((row) => row.inMemory < row.total * 0.9) ?? levels[levels.length - 1] ?? null;
}
