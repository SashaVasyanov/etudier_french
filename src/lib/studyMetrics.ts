import type { DailyStats, LearningLanguage, StudyHistoryEntry, WordProgress } from '../types';
import { addDays, getTodayDateKey, percentage, startOfDay } from './utils';

function dayKeyBefore(now: Date, daysBack: number): string {
  return getTodayDateKey(addDays(startOfDay(now), -daysBack));
}

function recentHistory(history: StudyHistoryEntry[], days: number, now: Date): StudyHistoryEntry[] {
  const firstKey = dayKeyBefore(now, days - 1);
  const lastKey = getTodayDateKey(now);

  return history.filter((entry) => entry.date >= firstKey && entry.date <= lastKey);
}

export function summarizeStudyHistory(history: StudyHistoryEntry[], now = new Date()) {
  const weekly = recentHistory(history, 7, now);
  const monthly = recentHistory(history, 30, now);

  return {
    weeklyLessons: weekly.length,
    monthlyLessons: monthly.length,
    totalWeeklyWords: weekly.reduce((sum, item) => sum + item.wordsLearned, 0),
    totalMonthlyWords: monthly.reduce((sum, item) => sum + item.wordsLearned, 0),
    weeklyAccuracy: percentage(
      weekly.reduce((sum, item) => sum + item.correctAnswers, 0),
      weekly.reduce((sum, item) => sum + item.totalAnswers, 0),
    ),
    monthlyAccuracy: percentage(
      monthly.reduce((sum, item) => sum + item.correctAnswers, 0),
      monthly.reduce((sum, item) => sum + item.totalAnswers, 0),
    ),
  };
}

export function getRecentWordCounts(dailyStats: DailyStats[], language: LearningLanguage, now = new Date()) {
  const weekdayLabels = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(startOfDay(now), -(6 - index));
    const key = getTodayDateKey(date);
    const daily = dailyStats.find((entry) => entry.language === language && entry.date === key);

    return { key, label: weekdayLabels[date.getDay()], count: daily?.wordsLearned ?? 0 };
  });
}

/**
 * One definition of the word counters for every screen (home, profile,
 * statistics), so the same number never shows up as two different values.
 * «Освоено» = mastered or marked as known; «в работе» = learning or review;
 * difficult words are counted separately.
 */
export function summarizeWordStatuses(progressList: WordProgress[]) {
  let learned = 0;
  let inProgress = 0;
  let difficult = 0;
  let seen = 0;
  progressList.forEach((progress) => {
    if (progress.status === 'mastered' || progress.status === 'known') learned += 1;
    else if (progress.status === 'learning' || progress.status === 'review') inProgress += 1;
    else if (progress.status === 'difficult') difficult += 1;
    if (progress.shown_count > 0 || progress.status === 'mastered' || progress.status === 'known') seen += 1;
  });
  return { learned, inProgress, difficult, seen };
}

/** Share of correct answers in the daily stats of one language, optionally from a date on. */
export function getAnswerAccuracy(dailyStats: DailyStats[], language: LearningLanguage, fromDateKey?: string) {
  const relevant = dailyStats.filter((entry) => entry.language === language && (!fromDateKey || entry.date >= fromDateKey));
  const correctAnswers = relevant.reduce((sum, entry) => sum + entry.correctAnswers, 0);
  const totalAnswers = relevant.reduce((sum, entry) => sum + entry.totalAnswers, 0);
  return { correctAnswers, totalAnswers, accuracy: percentage(correctAnswers, totalAnswers) };
}
