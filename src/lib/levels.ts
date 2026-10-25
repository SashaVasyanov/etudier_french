import type { JlptLevel, LearningLanguage, Word, WordLevel } from '../types';

/**
 * French words are graded A1–B1; Japanese words by the JLPT (N5 easiest).
 * Everything that shows, filters or sorts by level goes through here.
 */
export const JLPT_LEVELS: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];
export const CEFR_LEVELS: WordLevel[] = ['A1', 'A2', 'B1'];
export const NO_JLPT = 'none';

export type StudyLevel = WordLevel | JlptLevel | typeof NO_JLPT;

export function getStudyLevel(word: Pick<Word, 'language' | 'level' | 'jlpt'>): StudyLevel {
  return word.language === 'japanese' ? word.jlpt ?? NO_JLPT : word.level;
}

export function getStudyLevelLabel(level: StudyLevel): string {
  return level === NO_JLPT ? 'вне JLPT' : level;
}

export function getWordLevelLabel(word: Pick<Word, 'language' | 'level' | 'jlpt'>): string {
  return getStudyLevelLabel(getStudyLevel(word));
}

/** Smaller = earlier in the course. */
export function getStudyLevelRank(word: Pick<Word, 'language' | 'level' | 'jlpt'>): number {
  const level = getStudyLevel(word);
  if (level === NO_JLPT) return JLPT_LEVELS.length;
  const jlpt = JLPT_LEVELS.indexOf(level as JlptLevel);
  return jlpt >= 0 ? jlpt : CEFR_LEVELS.indexOf(level as WordLevel);
}

export function getLevelOptions(language: LearningLanguage): StudyLevel[] {
  return language === 'japanese' ? [...JLPT_LEVELS, NO_JLPT] : CEFR_LEVELS;
}
