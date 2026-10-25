import { describe, expect, it } from 'vitest';
import { getRecentWordCounts, summarizeStudyHistory } from '../src/lib/studyMetrics';
import type { StudyHistoryEntry } from '../src/types';

function entry(date: string, overrides: Partial<StudyHistoryEntry> = {}): StudyHistoryEntry {
  return {
    id: date, date, language: 'french', completedAt: `${date}T12:00:00.000Z`, sessionId: date,
    mode: 'default', durationMinutes: 10, moduleTitles: [], modulesCompleted: 5,
    wordsLearned: 2, mistakesMade: 1, correctAnswers: 3, totalAnswers: 4,
    timeSpentSeconds: 600, activePackIds: [], ...overrides,
  };
}

describe('calendar study metrics', () => {
  it('includes every session in the last seven calendar days rather than only seven records', () => {
    const history = Array.from({ length: 9 }, (_, index) => entry('2026-09-21', { id: String(index) }));
    history.push(entry('2026-09-15'), entry('2026-09-14'), entry('2026-08-22'), entry('2026-09-22'));
    const summary = summarizeStudyHistory(history, new Date(2026, 8, 21, 8));

    expect(summary.weeklyLessons).toBe(10);
    expect(summary.monthlyLessons).toBe(11);
    expect(summary.totalWeeklyWords).toBe(20);
    expect(summary.weeklyAccuracy).toBe(75);
  });

  it('handles month and year boundaries and weights accuracy by answers', () => {
    const summary = summarizeStudyHistory([
      entry('2025-12-31', { correctAnswers: 9, totalAnswers: 10 }),
      entry('2026-01-01', { correctAnswers: 0, totalAnswers: 1 }),
      entry('2025-12-26'),
      entry('2025-12-25'),
      entry('2025-12-03'),
      entry('2025-12-02'),
    ], new Date(2026, 0, 1));

    expect(summary.weeklyLessons).toBe(3);
    expect(summary.monthlyLessons).toBe(5);
    expect(summary.weeklyAccuracy).toBe(80);
    expect(summarizeStudyHistory([], new Date(2026, 0, 1)).weeklyAccuracy).toBe(0);
  });

  it('labels rolling daily bars with their actual weekdays and separates languages', () => {
    const counts = getRecentWordCounts([
      { date: '2026-09-21', language: 'french', wordsLearned: 4, completedLessons: 1, correctAnswers: 3, totalAnswers: 4, reviewsCompleted: 2 },
      { date: '2026-09-21', language: 'japanese', wordsLearned: 99, completedLessons: 1, correctAnswers: 3, totalAnswers: 4, reviewsCompleted: 2 },
    ], 'french', new Date(2026, 8, 21));

    expect(counts[0]).toEqual({ key: '2026-09-15', label: 'Вт', count: 0 });
    expect(counts[6]).toEqual({ key: '2026-09-21', label: 'Пн', count: 4 });
    expect(counts.map((item) => item.label)).toEqual(['Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс', 'Пн']);
  });
});

describe('shared word counters', () => {
  it('counts known as learned and keeps difficult apart from «в работе»', async () => {
    const { summarizeWordStatuses, getAnswerAccuracy } = await import('../src/lib/studyMetrics');
    const { progress } = await import('./fixtures');
    const result = summarizeWordStatuses([
      progress('a', 'mastered'), progress('b', 'known'), progress('c', 'learning', { shown_count: 2 }),
      progress('d', 'review', { shown_count: 4 }), progress('e', 'difficult', { shown_count: 3 }), progress('f', 'new'),
    ]);
    expect(result).toEqual({ learned: 2, inProgress: 2, difficult: 1, seen: 5 });
    const stats = [
      { date: '2026-10-24', language: 'french' as const, completedLessons: 1, correctAnswers: 6, totalAnswers: 10, wordsLearned: 2, reviewsCompleted: 0 },
      { date: '2026-10-25', language: 'french' as const, completedLessons: 1, correctAnswers: 9, totalAnswers: 10, wordsLearned: 2, reviewsCompleted: 0 },
    ];
    expect(getAnswerAccuracy(stats, 'french').accuracy).toBe(75);
    expect(getAnswerAccuracy(stats, 'french', '2026-10-25').accuracy).toBe(90);
  });
});
