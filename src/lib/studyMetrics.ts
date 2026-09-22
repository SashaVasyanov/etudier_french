import type { DailyStats, LearningLanguage, StudyHistoryEntry } from '../types';
import { percentage } from './utils';

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function recentHistory(history: StudyHistoryEntry[], days: number, now: Date): StudyHistoryEntry[] {
  const firstDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1);
  const firstKey = dateKey(firstDay);
  const lastKey = dateKey(now);

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
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - index));
    const key = dateKey(date);
    const daily = dailyStats.find((entry) => entry.language === language && entry.date === key);

    return { key, label: weekdayLabels[date.getDay()], count: daily?.wordsLearned ?? 0 };
  });
}
