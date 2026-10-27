import { describe, expect, it } from 'vitest';
import { DEFAULT_RETENTION, initialState, intervalForRetention, nextState, retrievability, stateFromLegacy } from '../src/lib/fsrs';

describe('FSRS-6 memory model', () => {
  it('reaches 90 % recall exactly at the stability and schedules there at the default target', () => {
    expect(retrievability(0, 5)).toBeCloseTo(1);
    expect(retrievability(5, 5)).toBeCloseTo(0.9, 6);
    expect(retrievability(50, 5)).toBeLessThan(0.75);
    expect(intervalForRetention(12, DEFAULT_RETENTION)).toBeCloseTo(12, 6);
    expect(intervalForRetention(12, 0.95)).toBeLessThan(12);
    expect(intervalForRetention(12, 0.85)).toBeGreaterThan(12);
  });

  it('starts from the default weights for each first grade', () => {
    expect(initialState(1).stability).toBeCloseTo(0.212);
    expect(initialState(3).stability).toBeCloseTo(2.3065);
    expect(initialState(4).stability).toBeCloseTo(8.2956);
    expect(initialState(3).difficulty).toBeCloseTo(6.4133 - Math.exp(2 * 0.8334) + 1, 6);
    expect(initialState(1).difficulty).toBeCloseTo(6.4133, 4);
    expect(initialState(4).difficulty).toBe(1);
  });

  it('orders the next stability by grade and lowers it after a lapse', () => {
    const state = { stability: 10, difficulty: 5 };
    const [again, hard, good, easy] = ([1, 2, 3, 4] as const).map((grade) => nextState(state, 10, grade));
    expect(again.stability).toBeLessThan(state.stability);
    expect(hard.stability).toBeGreaterThan(state.stability);
    expect(good.stability).toBeGreaterThan(hard.stability);
    expect(easy.stability).toBeGreaterThan(good.stability);
    expect(again.difficulty).toBeGreaterThan(state.difficulty);
    expect(easy.difficulty).toBeLessThan(state.difficulty);
  });

  it('gains more from a review when the word was closer to being forgotten', () => {
    const state = { stability: 10, difficulty: 5 };
    expect(nextState(state, 20, 3).stability).toBeGreaterThan(nextState(state, 5, 3).stability);
  });

  it('derives a state for words scheduled by SM-2', () => {
    expect(stateFromLegacy(30, 2.5, false).stability).toBe(30);
    expect(stateFromLegacy(0, 2.5, false).stability).toBe(0.5);
    expect(stateFromLegacy(10, 1.3, false).difficulty).toBeCloseTo(10);
    expect(stateFromLegacy(10, 3.4, false).difficulty).toBe(1);
    expect(stateFromLegacy(10, 3.4, true).difficulty).toBe(7);
  });
});

describe('calibration to the learner', () => {
  it('shortens intervals for a learner who forgets more than forecast and lengthens them otherwise', async () => {
    const { applyOutcomes, getCalibrationFactor } = await import('../src/lib/storage');
    const { progress, storage, outcome } = await import('./fixtures');
    const reviewAt = new Date(2026, 0, 20, 12);
    const due = (id: string) => progress(id, 'review', {
      stability: 10, difficulty: 5, last_review_at: new Date(2026, 0, 10, 12).toISOString(),
      interval_days: 10, next_review_at: new Date(2026, 0, 20, 0).toISOString(),
    });
    const ids = Array.from({ length: 40 }, (_, i) => `c${i}`);
    const forgetful = applyOutcomes(storage(Object.fromEntries(ids.map((id) => [id, due(id)]))), ids.map((id, i) => outcome(id, i % 2 === 0, 0)), reviewAt);
    const solid = applyOutcomes(storage(Object.fromEntries(ids.map((id) => [id, due(id)]))), ids.map((id) => outcome(id, true, 0)), reviewAt);
    expect(getCalibrationFactor(forgetful.memoryCalibration?.french)).toBeLessThan(0.5);
    expect(getCalibrationFactor(solid.memoryCalibration?.french)).toBeGreaterThan(1.5);
    expect(getCalibrationFactor(undefined)).toBe(1);
  });
});

describe('stored memory data', () => {
  it('keeps FSRS fields and the calibration through save and load', async () => {
    const { loadStorage, saveStorage } = await import('../src/lib/storage');
    const { installStorage, progress, storage } = await import('./fixtures');
    installStorage();
    const state = {
      ...storage({ a: progress('a', 'review', { stability: 12.5, difficulty: 4.2, last_review_at: '2026-01-05T10:00:00.000Z', lapses: 2 }) }),
      desiredRetention: 0.85,
      memoryCalibration: { french: { expectedLapses: 3.2, actualLapses: 5.1, reviews: 40 } },
    };
    saveStorage(state);
    const loaded = loadStorage().storage;
    expect(loaded.progressByWordId.a).toMatchObject({ stability: 12.5, difficulty: 4.2, last_review_at: '2026-01-05T10:00:00.000Z', lapses: 2 });
    expect(loaded.desiredRetention).toBe(0.85);
    expect(loaded.memoryCalibration?.french).toEqual({ expectedLapses: 3.2, actualLapses: 5.1, reviews: 40 });
  });
});
