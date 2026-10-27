import { describe, expect, it } from 'vitest';
import { getCurrentLevel, getLevelProgress, getMemoryMilestone, isInMemory } from '../src/lib/milestones';
import { progress, storage, word } from './fixtures';

describe('progress milestones', () => {
  it('finds the reached and the next milestone', () => {
    expect(getMemoryMilestone(0)).toEqual({ count: 0, reached: null, next: 25, progress: 0 });
    expect(getMemoryMilestone(75)).toMatchObject({ reached: 50, next: 100, progress: 0.5 });
    expect(getMemoryMilestone(5000)).toMatchObject({ reached: 3000, next: null, progress: 1 });
  });

  it('counts words recalled at a review or known as in memory', () => {
    expect(isInMemory(progress('a', 'learning'))).toBe(false);
    expect(isInMemory(progress('a', 'review'))).toBe(true);
    expect(isInMemory(progress('a', 'known'))).toBe(true);
    expect(isInMemory(undefined)).toBe(false);
  });

  it('reports progress per level and the level being worked on', () => {
    const words = [
      ...Array.from({ length: 4 }, (_, i) => ({ ...word(`a${i}`), level: 'A1' as const })),
      ...Array.from({ length: 2 }, (_, i) => ({ ...word(`b${i}`), level: 'A2' as const })),
    ];
    const state = storage({ a0: progress('a0', 'review'), a1: progress('a1', 'mastered'), a2: progress('a2', 'learning') });
    const levels = getLevelProgress(words, state);
    expect(levels.map((row) => [row.label, row.inMemory, row.total])).toEqual([['A1', 2, 4], ['A2', 0, 2]]);
    expect(getCurrentLevel(levels)?.label).toBe('A1');
  });
});
