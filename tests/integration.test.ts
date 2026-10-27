import { describe, expect, it } from 'vitest';
import { createLessonSession } from '../src/lib/exercises';
import { applyOutcomes } from '../src/lib/storage';
import { now, outcome, progress, storage, word } from './fixtures';

const pool = Array.from({ length: 24 }, (_, i) => word(String(i + 1)));

describe('lesson integration', () => {
  it('due-gates daily reviews while allowing voluntary practice and excluding known words', () => {
    const words = [word('due'), word('future'), word('known'), word('new')];
    const state = storage({
      due: progress('due', 'learning', { next_review_at: new Date(now.getTime() - 86_400_000).toISOString() }),
      future: progress('future', 'learning', { next_review_at: '2099-01-20T00:00:00.000Z' }),
      known: progress('known', 'known'),
    });
    const session = createLessonSession({ mode: 'mistakes', words, storage: state, durationMinutes: 10, wordIds: ['due', 'future', 'known'] });
    expect(session?.sourceWordIds).toEqual(['due', 'future']);
    expect(session?.sourceWordIds).not.toContain('known');

    const daily = createLessonSession({ mode: 'default', words, storage: state, durationMinutes: 10 });
    expect(daily?.sourceWordIds).toContain('due');
    expect(daily?.sourceWordIds).toContain('new');
    expect(daily?.sourceWordIds).not.toContain('future');
    expect(daily?.sourceWordIds).not.toContain('known');

    const extra = createLessonSession({ mode: 'extra', words, storage: state, durationMinutes: 10 });
    expect(extra?.sourceWordIds).toContain('due');
    expect(extra?.sourceWordIds).toContain('new');
    expect(extra?.sourceWordIds).toContain('future');
    expect(extra?.sourceWordIds).not.toContain('known');
  });

  it('creates exactly five meaningful modules for a normal mixed pool and null for no eligible pool', () => {
    const session = createLessonSession({ mode: 'default', words: pool, storage: storage(), durationMinutes: 20, useFullPool: true, wordTarget: 20 });
    expect(session).not.toBeNull();
    expect(session!.modules).toHaveLength(5);
    expect(session!.modules.every((module) => module.wordIds.length > 0 && module.stepIds.length > 0)).toBe(true);

    const allKnown = storage(Object.fromEntries(pool.map((item) => [item.id, progress(item.id, 'known')])));
    expect(createLessonSession({ mode: 'default', words: pool, storage: allKnown, durationMinutes: 20, useFullPool: true, wordTarget: 20 })).toBeNull();
  });

  it('uses active recall instead of a one-answer choice for a single-word daily lesson', () => {
    const session = createLessonSession({ mode: 'default', words: [word('only')], storage: storage(), durationMinutes: 10 });

    expect(session?.modules).toHaveLength(5);
    expect(session?.exercises.filter((exercise) => exercise.options)).toHaveLength(0);
    expect(session?.exercises.every((exercise) => exercise.type.endsWith('_input'))).toBe(true);
  });

  it('reaches mastered only after a recall across a gap of three weeks or more', () => {
    let state = storage({ a: progress('a', 'learning', { next_review_at: new Date(2026, 0, 9, 12).toISOString() }) });
    let reviewAt = new Date(2026, 0, 10, 12);
    const intervals: number[] = [];
    // Review on each due date: 2 → 4 → 10 → ~25 days; three good days in the
    // first week are not enough, the recall after the long gap is.
    for (let review = 1; review <= 5; review += 1) {
      const before = state.progressByWordId.a;
      state = applyOutcomes(state, [outcome('a')], reviewAt);
      const after = state.progressByWordId.a;
      intervals.push(after.interval_days);
      expect(after.status).toBe(review === 5 ? 'mastered' : 'review');
      if (review === 5) expect(before.interval_days).toBeGreaterThanOrEqual(21);
      const due = new Date(after.next_review_at as string);
      reviewAt = new Date(due.getFullYear(), due.getMonth(), due.getDate(), 12);
    }
    expect(intervals.slice(0, 3)).toEqual([2, 4, 10]);
    expect(state.progressByWordId.a.successful_review_dates).toHaveLength(5);
  });

  it('does not master after eight correct answers in one session/date', () => {
    const state = storage({ a: progress('a', 'new') });
    const after = applyOutcomes(state, Array.from({ length: 8 }, (_, i) => outcome('a', true, i)), now);
    const updated = after.progressByWordId.a;

    expect(updated.status).toBe('learning');
    expect(updated.status).not.toBe('mastered');
    expect(updated.shown_count).toBe(8);
    expect(updated.correct_count).toBe(8);
    expect(updated.successful_review_dates).toEqual([]);
  });
});
