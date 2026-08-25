import type { AppStorage, ExerciseOutcome, Word, WordProgress } from '../src/types';

export const now = new Date(2026, 0, 10, 12, 0, 0, 0);

export function localDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function word(id: string): Word {
  return {
    id, language: 'french', original: `mot-${id}`, translation: `word-${id}`, transcription: `mot`,
    audio_original: '', example_original: `Je dis mot-${id}.`, example_translation: `I say word-${id}.`,
    part_of_speech: 'nom', level: 'A1', tags: [], packIds: [], source: 'core',
  };
}

export function progress(wordId: string, status: WordProgress['status'] = 'new', overrides: Partial<WordProgress> = {}): WordProgress {
  return {
    word_id: wordId, shown_count: 0, correct_count: 0, wrong_count: 0, last_seen_at: null,
    next_review_at: null, ease_factor: 2.5, interval_days: 0, repetition_step: 0,
    status, learned_at: null, successful_review_dates: [], ...overrides,
  };
}

export function storage(entries: Record<string, WordProgress> = {}): AppStorage {
  return {
    learningLanguage: 'french', progressByWordId: entries, dailyStats: [], completedDailyLessons: [],
    streakDays: 0, lastLessonDate: null, lessonDurationEnabled: true, lessonDurationMinutes: 20,
    lessonWordTarget: 20, lessonSourcePackId: null,
    profile: { displayName: 'Test', createdAt: now.toISOString(), updatedAt: now.toISOString(), lastStudiedAt: null },
    studyHistory: [], packStates: {}, customWords: [], customPacks: [], radicalProgressById: {}, radicalStudyHistory: [],
  };
}

export function outcome(wordId: string, isCorrect = true, index = 0): ExerciseOutcome {
  return {
    exerciseId: `${wordId}-${index}`, wordId, type: 'translation_to_original_input',
    userAnswer: isCorrect ? `mot-${wordId}` : 'wrong', correctAnswer: `mot-${wordId}`, isCorrect,
  };
}

export class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  failWrites = false;
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { if (this.failWrites) throw new Error('quota'); this.values.set(key, String(value)); }
}

export function installStorage(storage = new MemoryStorage()): MemoryStorage {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage } });
  return storage;
}
