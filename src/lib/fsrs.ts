/**
 * FSRS-6 memory model (Free Spaced Repetition Scheduler, open-spaced-repetition).
 *
 * Each word has a stability S (days until the chance of recalling it falls to
 * 90 %) and a difficulty D (1–10). After every graded review both are updated,
 * and the next review is set for the day the chance of recall reaches the
 * learner's target retention. Formulas and default weights follow the
 * reference implementations (fsrs-rs, py-fsrs, ts-fsrs), FSRS-6.
 */

/** 1 — забыл, 2 — с трудом, 3 — вспомнил, 4 — легко. */
export type Grade = 1 | 2 | 3 | 4;

export interface MemoryState {
  stability: number;
  difficulty: number;
}

/** FSRS-6 default weights w0…w20 (w20 is the forgetting-curve decay). */
export const FSRS_WEIGHTS: readonly number[] = [
  0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666,
  0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542,
];

export const DEFAULT_RETENTION = 0.9;
export const MIN_RETENTION = 0.8;
export const MAX_RETENTION = 0.97;

const w = FSRS_WEIGHTS;
const S_MIN = 0.001;
const S_MAX = 36500;
const DECAY = -w[20];
// Chosen so that R(t = S) = 90 %.
const FACTOR = Math.pow(0.9, 1 / DECAY) - 1;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Chance of recalling the word `elapsedDays` after the last review. */
export function retrievability(elapsedDays: number, stability: number): number {
  if (stability <= 0) return 0;
  return Math.pow(1 + (FACTOR * Math.max(0, elapsedDays)) / stability, DECAY);
}

/** Days until retrievability falls to `retention` (not rounded). */
export function intervalForRetention(stability: number, retention = DEFAULT_RETENTION): number {
  const r = clamp(retention, MIN_RETENTION, MAX_RETENTION);
  return (stability / FACTOR) * (Math.pow(r, 1 / DECAY) - 1);
}

function initialDifficulty(grade: Grade): number {
  return w[4] - Math.exp(w[5] * (grade - 1)) + 1;
}

/** Memory after the very first graded session with a word. */
export function initialState(grade: Grade): MemoryState {
  return {
    stability: clamp(w[grade - 1], S_MIN, S_MAX),
    difficulty: clamp(initialDifficulty(grade), 1, 10),
  };
}

function nextDifficulty(difficulty: number, grade: Grade): number {
  const delta = -w[6] * (grade - 3);
  const damped = difficulty + (delta * (10 - difficulty)) / 9;
  // Mean reversion towards the difficulty of an «easy» first answer.
  return clamp(w[7] * initialDifficulty(4) + (1 - w[7]) * damped, 1, 10);
}

function recallStability(difficulty: number, stability: number, r: number, grade: Grade): number {
  const hardPenalty = grade === 2 ? w[15] : 1;
  const easyBonus = grade === 4 ? w[16] : 1;
  const growth =
    Math.exp(w[8]) * (11 - difficulty) * Math.pow(stability, -w[9]) * (Math.exp((1 - r) * w[10]) - 1) * hardPenalty * easyBonus;
  return clamp(stability * (1 + growth), S_MIN, S_MAX);
}

function forgetStability(difficulty: number, stability: number, r: number): number {
  const longTerm = w[11] * Math.pow(difficulty, -w[12]) * (Math.pow(stability + 1, w[13]) - 1) * Math.exp((1 - r) * w[14]);
  const shortTerm = stability / Math.exp(w[17] * w[18]);
  return clamp(Math.min(longTerm, shortTerm), S_MIN, S_MAX);
}

function shortTermStability(stability: number, grade: Grade): number {
  let increase = Math.pow(stability, -w[19]) * Math.exp(w[17] * (grade - 3 + w[18]));
  if (grade >= 2) increase = Math.max(increase, 1);
  return clamp(stability * increase, S_MIN, S_MAX);
}

/** Memory after a review `elapsedDays` after the previous one. */
export function nextState(state: MemoryState, elapsedDays: number, grade: Grade): MemoryState {
  const difficulty = nextDifficulty(state.difficulty, grade);
  if (elapsedDays < 1) {
    return { stability: shortTermStability(state.stability, grade), difficulty };
  }
  const r = retrievability(elapsedDays, state.stability);
  const stability = grade === 1
    ? forgetStability(state.difficulty, state.stability, r)
    : recallStability(state.difficulty, state.stability, r, grade);
  return { stability, difficulty };
}

/**
 * A memory state for a word scheduled by the earlier SM-2 rules: the last
 * interval stands in for stability (at a 90 % target an interval and the
 * stability coincide) and the ease factor for difficulty.
 */
export function stateFromLegacy(intervalDays: number, easeFactor: number, wasDifficult: boolean): MemoryState {
  const stability = clamp(Math.max(intervalDays, 0.5), S_MIN, S_MAX);
  // Ease 1.3 (hardest) … 3.4 (easiest) → difficulty 10 … 1.
  const fromEase = 1 + ((3.4 - clamp(easeFactor, 1.3, 3.4)) / 2.1) * 9;
  return { stability, difficulty: clamp(wasDifficult ? Math.max(fromEase, 7) : fromEase, 1, 10) };
}
