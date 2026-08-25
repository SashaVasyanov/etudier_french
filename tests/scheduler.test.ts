import { describe, expect, it } from 'vitest';
import { applyOutcomes, markWordAsKnown, markWordAsIgnored } from '../src/lib/storage';
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
      expect(p.interval_days).toBeLessThanOrEqual(60);
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
