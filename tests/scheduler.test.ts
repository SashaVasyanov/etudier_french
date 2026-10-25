import { describe, expect, it } from 'vitest';
import { applyOutcomes, markWordAsKnown, markWordAsIgnored, restoreWordProgress, restoreWordToLearning } from '../src/lib/storage';
import { isWordDueForReview } from '../src/lib/storage';
import { localDateKey, outcome, progress, storage, now } from './fixtures';

const correct = (id: string, n = 0) => outcome(id, true, n);
const wrong = (id: string, n = 0) => outcome(id, false, n);

describe('scheduler unit invariants', () => {
  it('aggregates repeated outcomes for one word into one transition while counting all answers', () => {
    const before = storage({ a: progress('a') });
    const after = applyOutcomes(before, [correct('a', 1), wrong('a', 2), correct('a', 3)], now);
    const p = after.progressByWordId.a;
    expect(p.shown_count).toBe(3);
    expect(p.correct_count).toBe(2);
    expect(p.wrong_count).toBe(1);
    expect(p.repetition_step).toBe(1);
    expect(p.status).toBe('learning');
    expect(p.next_review_at).toBeTruthy();
  });

  it('records answers before due date without advancing scheduler interval or step', () => {
    const before = storage({ a: progress('a', 'review', {
      shown_count: 4, correct_count: 4, repetition_step: 4, interval_days: 7,
      next_review_at: '2026-01-20T00:00:00.000Z', successful_review_dates: ['2026-01-01'],
    }) });
    const after = applyOutcomes(before, [correct('a')], now);
    expect(after.progressByWordId.a.interval_days).toBe(7);
    expect(after.progressByWordId.a.repetition_step).toBe(4);
    expect(after.progressByWordId.a.successful_review_dates).toEqual(['2026-01-01']);
  });

  it.each(['known', 'ignored'] as const)('%s words are inert', (status) => {
    const before = storage({ a: progress('a', status, { shown_count: 2, correct_count: 2, interval_days: 8, next_review_at: null }) });
    const after = applyOutcomes(before, [correct('a'), wrong('a', 1)], now);
    expect(after.progressByWordId.a).toEqual(before.progressByWordId.a);
    expect(isWordDueForReview(after.progressByWordId.a, now)).toBe(false);
  });

  it('uses exact due predicate boundaries and never schedules known words', () => {
    const boundary = now.toISOString();
    expect(isWordDueForReview(progress('a', 'learning', { next_review_at: boundary }), now)).toBe(true);
    expect(isWordDueForReview(progress('a', 'learning', { next_review_at: new Date(now.getTime() + 1).toISOString() }), now)).toBe(false);
    expect(isWordDueForReview(progress('a', 'new'), now)).toBe(false);
    expect(isWordDueForReview(progress('a', 'known', { next_review_at: '2020-01-01T00:00:00.000Z' }), now)).toBe(false);
  });

  it('manual known and ignored actions are scheduler-inert', () => {
    const base = storage();
    const known = markWordAsKnown(base, 'a');
    const ignored = markWordAsIgnored(base, 'b');
    expect(known.progressByWordId.a.status).toBe('known');
    expect(known.progressByWordId.a.next_review_at).toBeNull();
    expect(ignored.progressByWordId.b.status).toBe('ignored');
    expect(ignored.progressByWordId.b.next_review_at).toBeNull();
  });
});

describe('scheduler properties', () => {
  it('preserves input storage, has monotonic counters, one transition and bounded intervals', () => {
    const combinations = Array.from({ length: 96 }, (_, i) => ({
      correct: (i * 7) % 5,
      wrong: (i * 11) % 4,
    }));
    for (const [index, combo] of combinations.entries()) {
      const before = storage({ a: progress('a', index % 3 === 0 ? 'learning' : 'new', { next_review_at: new Date(now.getTime() - 86_400_000).toISOString() }) });
      const snapshot = structuredClone(before);
      const outcomes = [...Array(combo.correct)].map((_, n) => correct('a', n));
      outcomes.push(...[...Array(combo.wrong)].map((_, n) => wrong('a', n + combo.correct)));
      const after = applyOutcomes(before, outcomes, now);
      expect(before).toEqual(snapshot);
      const p = after.progressByWordId.a;
      expect(p.shown_count).toBeGreaterThanOrEqual(snapshot.progressByWordId.a.shown_count);
      expect(p.correct_count).toBeGreaterThanOrEqual(snapshot.progressByWordId.a.correct_count);
      expect(p.wrong_count).toBeGreaterThanOrEqual(snapshot.progressByWordId.a.wrong_count);
      expect(p.interval_days).toBeGreaterThanOrEqual(0);
      expect(p.interval_days).toBeLessThanOrEqual(180);
      expect(new Set(p.successful_review_dates).size).toBe(p.successful_review_dates.length);
      if (snapshot.progressByWordId.a.status === 'known') expect(p.status).toBe('known');
    }
  });

  it('does not duplicate a successful review date or master in one same-day batch', () => {
    const today = localDateKey(now);
    const yesterday = localDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12));
    const before = storage({ a: progress('a', 'review', {
      shown_count: 7, correct_count: 7, repetition_step: 5, interval_days: 4,
      next_review_at: new Date(now.getTime() - 86_400_000).toISOString(), successful_review_dates: [yesterday, today],
    }) });
    const after = applyOutcomes(before, [...Array(8)].map((_, i) => correct('a', i)), now);
    const p = after.progressByWordId.a;
    expect(p.successful_review_dates).toEqual([yesterday, today]);
    expect(p.status).not.toBe('mastered');
  });
});

describe('scheduler lapses and grading', () => {
  const due = () => new Date(now.getTime() - 86_400_000).toISOString();
  const dayKey = (offset: number) => localDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, 12));

  it('a failed review resets the mastery ladder so the next success is not mastery', () => {
    const before = storage({ a: progress('a', 'review', {
      repetition_step: 3, interval_days: 4, next_review_at: due(), successful_review_dates: [dayKey(-8), dayKey(-6)],
    }) });
    const failed = applyOutcomes(before, [wrong('a'), wrong('a', 1)], now).progressByWordId.a;
    expect(failed.successful_review_dates).toEqual([]);
    expect(failed.interval_days).toBe(1);
    expect(failed.status).toBe('difficult');

    const nextDay = new Date(now.getTime() + 86_400_000);
    const recovered = applyOutcomes(storage({ a: failed }), [correct('a')], nextDay).progressByWordId.a;
    expect(recovered.status).toBe('review');
    expect(recovered.interval_days).toBe(2);
  });

  it('a forgotten mastered word becomes difficult and returns on a short interval', () => {
    const before = storage({ a: progress('a', 'mastered', {
      repetition_step: 6, interval_days: 28, ease_factor: 3, next_review_at: due(),
      successful_review_dates: [dayKey(-60), dayKey(-40), dayKey(-30)],
    }) });
    const p = applyOutcomes(before, [wrong('a')], now).progressByWordId.a;
    expect(p.status).toBe('difficult');
    expect(p.interval_days).toBe(1);
    expect(p.ease_factor).toBeLessThan(3);
    expect(p.successful_review_dates).toEqual([]);
  });

  it('grades by the first answer: one later slip among several correct answers still passes', () => {
    const before = storage({ a: progress('a', 'learning', { repetition_step: 1, interval_days: 1, next_review_at: due() }) });
    const p = applyOutcomes(before, [correct('a'), correct('a', 1), wrong('a', 2), correct('a', 3)], now).progressByWordId.a;
    expect(p.status).toBe('review');
    expect(p.successful_review_dates).toEqual([localDateKey(now)]);
  });

  it('a wrong first answer fails the review even if later answers are correct', () => {
    const before = storage({ a: progress('a', 'learning', { repetition_step: 1, interval_days: 1, next_review_at: due() }) });
    const p = applyOutcomes(before, [wrong('a'), correct('a', 1), correct('a', 2)], now).progressByWordId.a;
    expect(p.status).toBe('learning');
    expect(p.interval_days).toBe(1);
  });

  it('lifetime mistakes alone do not make a word difficult', () => {
    const before = storage({ a: progress('a', 'review', { wrong_count: 9, repetition_step: 2, interval_days: 2, next_review_at: due(), successful_review_dates: [dayKey(-3)] }) });
    const p = applyOutcomes(before, [wrong('a'), correct('a', 1), correct('a', 2)], now).progressByWordId.a;
    expect(p.status).toBe('learning');
  });
});

describe('undo and restore of excluded words', () => {
  it('restores the exact previous progress after an accidental exclusion', () => {
    const previous = progress('a', 'review', { shown_count: 4, interval_days: 4 });
    const excluded = markWordAsIgnored(storage({ a: previous }), 'a');
    expect(restoreWordProgress(excluded, 'a', previous).progressByWordId.a).toEqual(previous);
    const fresh = markWordAsKnown(storage(), 'b');
    expect(restoreWordProgress(fresh, 'b', undefined).progressByWordId.b).toBeUndefined();
  });

  it('brings a known or excluded word back into study from the dictionary', () => {
    const studied = markWordAsIgnored(storage({ a: progress('a', 'review', { shown_count: 3, repetition_step: 2 }) }), 'a');
    const restored = restoreWordToLearning(studied, 'a', now).progressByWordId.a;
    expect(restored.status).toBe('learning');
    expect(isWordDueForReview(restored, now)).toBe(true);
    const neverSeen = restoreWordToLearning(markWordAsKnown(storage(), 'b'), 'b', now).progressByWordId.b;
    expect(neverSeen.status).toBe('new');
  });
});

describe('streak with answers settled after the fact', () => {
  it('does not move the streak backwards when an earlier day is applied later', () => {
    const today = localDateKey(now);
    const before = { ...storage(), lastLessonDate: today, streakDays: 5 };
    const yesterday = new Date(now.getTime() - 86_400_000);
    const after = applyOutcomes(before, [correct('a')], yesterday);
    expect(after.lastLessonDate).toBe(today);
    expect(after.streakDays).toBe(5);
  });
});

describe('custom start of the study day', () => {
  it('counts a lesson after midnight for the evening before and schedules reviews from that hour', async () => {
    const { setDayStartHour, getTodayDateKey, startOfDay } = await import('../src/lib/utils');
    const { getCurrentStreakDays } = await import('../src/lib/storage');
    try {
      setDayStartHour(4);
      const lateNight = new Date(2026, 9, 25, 1, 30);
      expect(getTodayDateKey(lateNight)).toBe('2026-10-24');
      expect(getTodayDateKey(new Date(2026, 9, 25, 4, 0))).toBe('2026-10-25');
      const start = startOfDay(lateNight);
      expect([start.getDate(), start.getHours()]).toEqual([24, 4]);
      const state = { ...storage(), streakDays: 3, lastLessonDate: '2026-10-23' };
      expect(getCurrentStreakDays(state, lateNight)).toBe(3);
    } finally {
      setDayStartHour(0);
    }
  });
});

describe('SM-2 grading and long intervals', () => {
  const dayKey = (offset: number) => localDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, 12));
  const choice = (id: string, ok: boolean, n: number) => ({ ...outcome(id, ok, n), type: 'original_to_translation_choice' as const });

  it('grades a session from the first answer, slips and the kind of exercise', async () => {
    const { gradeSession, nextEaseFactor } = await import('../src/lib/storage');
    expect(gradeSession([correct('a', 0), correct('a', 1)])).toBe(5);
    expect(gradeSession([choice('a', true, 0), choice('a', true, 1)])).toBe(4);
    expect(gradeSession([correct('a', 0), correct('a', 1), correct('a', 2), wrong('a', 3)])).toBe(3);
    expect(gradeSession([correct('a', 0), wrong('a', 1)])).toBe(2);
    expect(gradeSession([wrong('a', 0), correct('a', 1), correct('a', 2)])).toBe(2);
    expect(gradeSession([wrong('a', 0), wrong('a', 1), correct('a', 2)])).toBe(1);
    expect(nextEaseFactor(2.5, 5)).toBeCloseTo(2.6);
    expect(nextEaseFactor(2.5, 4)).toBeCloseTo(2.5);
    expect(nextEaseFactor(2.5, 3)).toBeCloseTo(2.36);
    expect(nextEaseFactor(1.35, 1)).toBe(1.3);
  });

  it('grows a mastered word past two months by interval × ease, spread by a few days', () => {
    const before = storage({ a: progress('a', 'mastered', {
      repetition_step: 6, interval_days: 30, ease_factor: 2.5,
      next_review_at: new Date(now.getTime() - 60_000).toISOString(),
      successful_review_dates: [dayKey(-60), dayKey(-50), dayKey(-30)],
    }) });
    const p = applyOutcomes(before, [correct('a', 0), correct('a', 1)], now).progressByWordId.a;
    expect(p.ease_factor).toBeCloseTo(2.6);
    expect(p.interval_days).toBeGreaterThanOrEqual(70);
    expect(p.interval_days).toBeLessThanOrEqual(86);
    expect(p.status).toBe('mastered');
  });

  it('credits half of an overdue gap and never schedules beyond half a year', () => {
    const overdue = storage({ a: progress('a', 'mastered', {
      repetition_step: 9, interval_days: 150, ease_factor: 3,
      next_review_at: new Date(now.getTime() - 40 * 86_400_000).toISOString(),
      successful_review_dates: [dayKey(-400), dayKey(-300), dayKey(-190)],
    }) });
    expect(applyOutcomes(overdue, [correct('a', 0)], now).progressByWordId.a.interval_days).toBe(180);
  });
});
