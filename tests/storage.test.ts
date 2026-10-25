import { describe, expect, it, beforeEach } from 'vitest';
import { completeDailyLesson, getCompletedDailyLesson, getCurrentStreakDays, loadStorage, recordStudyHistory, saveStorage, setLessonDurationPreference, setLessonWordTargetPreference } from '../src/lib/storage';
import type { DailyLessonRecord, StudyHistoryEntry } from '../src/types';
import { installStorage, storage, progress, now, localDateKey, word } from './fixtures';

const envelope = (payload: unknown, version = 2) => JSON.stringify({ version, savedAt: now.toISOString(), payload });

const historyEntry = (overrides: Partial<StudyHistoryEntry> = {}): StudyHistoryEntry => ({
  id: 'daily-history', date: localDateKey(now), language: 'french', completedAt: now.toISOString(),
  sessionId: 'daily', mode: 'default', durationMinutes: 20, moduleTitles: ['Знакомство', 'Проверка'],
  modulesCompleted: 5, wordsLearned: 2, mistakesMade: 1, correctAnswers: 7, totalAnswers: 8,
  timeSpentSeconds: 120, activePackIds: ['plants'], ...overrides,
});

const dailyRecord = (overrides: Partial<DailyLessonRecord> = {}): DailyLessonRecord => ({
  date: localDateKey(now), language: 'french', completedAt: now.toISOString(), sessionId: 'daily',
  totalModules: 5, completedModules: 5, totalSteps: 10, completedSteps: 10,
  correctAnswers: 7, totalAnswers: 8, newWords: 2, reviewWords: 1, reinforcementWords: 2,
  knownWords: 0, difficultWordIds: ['difficult'], timeSpentSeconds: 120, ...overrides,
});

beforeEach(() => installStorage());

describe('storage migration', () => {
  it('migrates legacy raw state to a v2-compatible normalized state', () => {
    const raw = storage({ known: progress('known', 'known'), missing: progress('missing', 'learning') });
    delete (raw as Partial<typeof raw>).profile;
    window.localStorage.setItem('anki-plus-storage', JSON.stringify(raw));
    const result = loadStorage();
    expect(result.error).toBeNull();
    expect(result.storage.progressByWordId.known.status).toBe('known');
    expect(result.storage.progressByWordId.missing.successful_review_dates).toEqual([]);
    expect(result.storage.profile.displayName).toBeTruthy();
  });

  it('preserves explicit known, maps deterministic old manual-mastered, and leaves ambiguous mastered', () => {
    const raw = storage({
      explicit: progress('explicit', 'known'),
      manual: progress('manual', 'mastered', { shown_count: 1, correct_count: 1, repetition_step: 6, interval_days: 14, learned_at: '2025-01-01T00:00:00.000Z' }),
      ambiguous: progress('ambiguous', 'mastered', { shown_count: 8, correct_count: 7, repetition_step: 6, interval_days: 10, learned_at: '2025-01-01T00:00:00.000Z', next_review_at: '2026-01-11T00:00:00.000Z' }),
    });
    window.localStorage.setItem('anki-plus-storage', JSON.stringify(raw));
    const loaded = loadStorage().storage;
    expect(loaded.progressByWordId.explicit.status).toBe('known');
    expect(loaded.progressByWordId.manual.status).toBe('known');
    expect(loaded.progressByWordId.ambiguous.status).toBe('mastered');
  });

  it('fills missing review metadata and blocks invalid/future versions without overwriting', () => {
    const payload = storage({ a: { ...progress('a', 'learning'), successful_review_dates: undefined } as never });
    window.localStorage.setItem('anki-plus-storage', envelope(payload, 99));
    const result = loadStorage();
    expect(result.error?.kind).toBe('unsupported_version');
    expect(result.error?.blocksSave).toBe(true);
    expect(window.localStorage.getItem('anki-plus-storage')).toContain('"version":99');

    window.localStorage.setItem('anki-plus-storage', '{invalid');
    const corrupt = loadStorage();
    expect(corrupt.error?.kind).toBe('corrupt');
    expect(window.localStorage.getItem('anki-plus-storage-quarantine')).toContain('{invalid');
    expect(corrupt.storage.progressByWordId).toEqual({});
  });
});

describe('stored data validation', () => {
  it('repairs malformed history and profile fields without discarding valid progress', () => {
    const valid = historyEntry();
    const payload = {
      ...storage({ kept: progress('kept', 'learning') }),
      streakDays: '7', lastLessonDate: '2026-02-30',
      profile: { displayName: '  Анна  ', createdAt: 'invalid', updatedAt: {}, lastStudiedAt: 'invalid' },
      studyHistory: [
        { ...valid, id: 'invalid-date', date: '2026-02-30' },
        { ...valid, id: 'invalid-timestamp', completedAt: {} },
        { ...valid, id: 'invalid-mode', mode: 'unsupported' },
        { ...valid, moduleTitles: 'not an array', activePackIds: [null, {}, 'plants'], wordsLearned: '2',
          modulesCompleted: -4, mistakesMade: -1, correctAnswers: 99, timeSpentSeconds: -10, durationMinutes: 999 },
      ],
      dailyStats: [{ date: 'invalid' }, { date: valid.date, correctAnswers: 99, totalAnswers: 2 }],
    };
    window.localStorage.setItem('anki-plus-storage', envelope(payload));

    const result = loadStorage();
    expect(result.error).toBeNull();
    expect(result.storage.progressByWordId.kept.status).toBe('learning');
    expect(result.storage.profile.displayName).toBe('Анна');
    expect(result.storage.profile.lastStudiedAt).toBeNull();
    expect(Number.isFinite(Date.parse(result.storage.profile.createdAt))).toBe(true);
    expect(result.storage.lastLessonDate).toBeNull();
    expect(getCurrentStreakDays(result.storage, now)).toBe(0);
    expect(result.storage.studyHistory).toHaveLength(1);
    expect(result.storage.studyHistory[0]).toMatchObject({
      moduleTitles: [], activePackIds: ['plants'], wordsLearned: 0, modulesCompleted: 0,
      mistakesMade: 0, correctAnswers: 8, totalAnswers: 8, timeSpentSeconds: 0, durationMinutes: 20,
    });
    expect(result.storage.dailyStats).toHaveLength(1);
    expect(result.storage.dailyStats[0].correctAnswers).toBe(2);
  });

  it('normalizes daily completion fields and rejects impossible review dates', () => {
    const payload = {
      ...storage({ a: progress('a', 'review', { successful_review_dates: ['2026-02-30', '2026-01-01', '2026-01-01', '2026-13-01'] }) }),
      completedDailyLessons: [
        { ...dailyRecord(), date: 'invalid' },
        { ...dailyRecord(), difficultWordIds: {}, totalModules: 5, completedModules: 99, newWords: -4 },
      ],
    };
    window.localStorage.setItem('anki-plus-storage', envelope(payload));

    const loaded = loadStorage().storage;
    expect(loaded.progressByWordId.a.successful_review_dates).toEqual(['2026-01-01']);
    expect(loaded.completedDailyLessons).toHaveLength(1);
    expect(getCompletedDailyLesson(loaded, localDateKey(now))).toMatchObject({
      difficultWordIds: [], completedModules: 5, newWords: 0,
    });
  });

  it('keeps Japanese pack words in their pack language and handles malformed pack entries', () => {
    const payload = {
      ...storage(),
      customPacks: [{ id: 'japanese-pack', title: 'Японский', language: 'japanese', words: [
        { ...word('jp'), language: undefined, original: '水', transcription: '[みず · mizu]' },
        { id: 'broken', original: 7, translation: {} }, null,
      ] }],
      packStates: { 'japanese-pack': { status: 'added', addedAt: now.toISOString() }, broken: { status: {}, addedAt: {} } },
      radicalStudyHistory: [{ id: 'radicals', date: localDateKey(now), completedAt: now.toISOString(), radicalIds: ['water'], correctAnswers: 1, totalAnswers: 1 }],
    };
    window.localStorage.setItem('anki-plus-storage', envelope(payload));

    const result = loadStorage();
    expect(result.error).toBeNull();
    expect(result.storage.customPacks[0].words).toHaveLength(1);
    expect(result.storage.customPacks[0].words[0]).toMatchObject({
      language: 'japanese', transcription: '[みず · mizu]', packIds: ['japanese-pack'], source: 'pack',
    });
    expect(result.storage.packStates.broken).toMatchObject({ status: 'not_added', addedAt: null });
    expect(result.storage.radicalStudyHistory).toHaveLength(1);
  });
});

describe('durable lesson history', () => {
  it('preserves daily completion per day and language while recording extra practice separately', () => {
    let state = completeDailyLesson(storage({ known: progress('known', 'known') }), { record: dailyRecord(), historyEntry: historyEntry() });
    state = completeDailyLesson(state, {
      record: dailyRecord({ language: 'japanese', sessionId: 'japanese-daily' }),
      historyEntry: historyEntry({ id: 'japanese-history', sessionId: 'japanese-daily', language: 'japanese' }),
    });
    state = recordStudyHistory(state, historyEntry({ id: 'extra-history', sessionId: 'extra', mode: 'extra' }));
    state = { ...state, lessonDurationMinutes: 30, lessonWordTarget: 30 };
    expect(saveStorage(state)).toEqual({ ok: true });

    const loaded = loadStorage().storage;
    expect(loaded).toEqual(state);
    expect(loaded.studyHistory).toHaveLength(3);
    expect(getCompletedDailyLesson(loaded, localDateKey(now))?.sessionId).toBe('daily');
    expect(getCompletedDailyLesson({ ...loaded, learningLanguage: 'japanese' }, localDateKey(now))?.sessionId).toBe('japanese-daily');
    expect(getCompletedDailyLesson(loaded, '2026-01-11')).toBeNull();
  });
});

describe('storage envelope and failure behavior', () => {
  it('recovers valid backup when primary is corrupt and quarantines primary', () => {
    const backup = storage({ backup: progress('backup', 'learning') });
    window.localStorage.setItem('anki-plus-storage-backup', envelope(backup));
    window.localStorage.setItem('anki-plus-storage', 'not-json');
    const result = loadStorage();
    expect(result.error?.kind).toBe('corrupt');
    expect(result.storage.progressByWordId.backup.status).toBe('learning');
    expect(window.localStorage.getItem('anki-plus-storage-quarantine')).toContain('not-json');
  });

  it('returns visible typed write error on quota failure', () => {
    const fake = installStorage();
    fake.failWrites = true;
    const result = saveStorage(storage());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('write');
      expect(result.error.message).toContain('сохранить');
    }
  });

  it('writes v2 envelope and preserves valid primary as backup before replacement', () => {
    const fake = installStorage();
    const first = storage({ old: progress('old', 'learning') });
    expect(saveStorage(first)).toEqual({ ok: true });
    const firstRaw = fake.getItem('anki-plus-storage');
    const second = storage({ newer: progress('newer', 'learning') });
    expect(saveStorage(second)).toEqual({ ok: true });
    expect(JSON.parse(fake.getItem('anki-plus-storage')!).version).toBe(2);
    expect(JSON.parse(fake.getItem('anki-plus-storage-backup')!).payload.progressByWordId.old.status).toBe('learning');
    expect(fake.getItem('anki-plus-storage-backup')).toBe(firstRaw);
  });
});

describe('lesson size preferences', () => {
  it('keeps duration and word target consistent in both directions', () => {
    const base = storage();
    expect(setLessonDurationPreference(base, 10).lessonWordTarget).toBe(10);
    expect(setLessonWordTargetPreference(base, 50).lessonDurationMinutes).toBe(30);
    expect(setLessonWordTargetPreference(base, 15).lessonDurationMinutes).toBe(10);
    expect(setLessonWordTargetPreference(base, 25).lessonDurationMinutes).toBe(20);
  });
});

describe('backup and storage budget', () => {
  beforeEach(() => { installStorage(); });

  it('round-trips a backup copy and rejects foreign text', async () => {
    const { exportStorageSnapshot, importStorageSnapshot } = await import('../src/lib/storage');
    const state = storage({ a: progress('a', 'review', { shown_count: 3 }) });
    const restored = importStorageSnapshot(exportStorageSnapshot(state));
    expect(restored.progressByWordId.a.status).toBe('review');
    let message = '';
    try { importStorageSnapshot('hello'); } catch (error) { message = (error as Error).message; }
    expect(message).toContain('резервная копия');
    message = '';
    try { importStorageSnapshot('{}'); } catch (error) { message = (error as Error).message; }
    expect(message).toContain('резервная копия');
  });

  it('keeps one backup snapshot per day instead of overwriting it on every save', () => {
    const yesterday = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();
    window.localStorage.setItem('anki-plus-storage', JSON.stringify({ version: 2, savedAt: yesterday, payload: storage({ a: progress('a', 'learning') }) }));
    saveStorage(storage({ a: progress('a', 'review') }));
    saveStorage(storage({ a: progress('a', 'mastered') }));
    const backup = JSON.parse(window.localStorage.getItem('anki-plus-storage-backup')!);
    expect(backup.payload.progressByWordId.a.status).toBe('learning');
  });

  it('refuses an import that would overflow local storage and can remove an imported pack', async () => {
    const { addCustomPack, removeCustomPack } = await import('../src/lib/storage');
    const words = Array.from({ length: 2000 }, (_, index) => ({ ...word(`big-${index}`), example_original: 'x'.repeat(1000), source: 'custom' as const }));
    let message = '';
    try { addCustomPack(storage(), { id: 'big', language: 'french', title: 'Big', description: '', accent: '#fff', words }); } catch (error) { message = (error as Error).message; }
    expect(message).toContain('почти заполнено');
    const small = addCustomPack(storage(), { id: 'small', language: 'french', title: 'Small', description: '', accent: '#fff', words: [word('s1')] });
    expect(small.customPacks).toHaveLength(1);
    const removed = removeCustomPack(small, 'small');
    expect(removed.customPacks).toHaveLength(0);
    expect(removed.packStates.small).toBeUndefined();
  });
});

describe('history per language', () => {
  it('keeps each language its own window and counts lessons beyond it', async () => {
    const entry = (index: number, language: 'french' | 'japanese') => historyEntry({
      id: `${language}-${index}`, language, sessionId: `s-${language}-${index}`,
      completedAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
    });
    let state = storage();
    for (let index = 0; index < 400; index += 1) state = recordStudyHistory(state, entry(index, 'french'));
    state = recordStudyHistory(state, entry(0, 'japanese'));
    state = recordStudyHistory(state, entry(0, 'japanese'));
    expect(state.studyHistory.filter((item) => item.language === 'japanese')).toHaveLength(1);
    expect(state.studyHistory.filter((item) => item.language === 'french')).toHaveLength(365);
    expect(state.lessonTotals).toEqual({ french: 400, japanese: 1 });
  });
});

describe('katakana practice', () => {
  it('learns a sign after three right answers in a row and resets on a mistake', async () => {
    const { recordKanaSession, getKanaStatus, loadStorage } = await import('../src/lib/storage');
    let state = storage();
    expect(getKanaStatus(state.kanaProgress['シ'])).toBe('new');
    state = recordKanaSession(state, [{ kana: 'シ', isCorrect: true }, { kana: 'シ', isCorrect: true }]);
    expect(getKanaStatus(state.kanaProgress['シ'])).toBe('learning');
    state = recordKanaSession(state, [{ kana: 'シ', isCorrect: false }, { kana: 'ツ', isCorrect: true }]);
    expect(state.kanaProgress['シ']).toMatchObject({ correct: 2, wrong: 1, streak: 0 });
    state = recordKanaSession(state, [1, 2, 3].map(() => ({ kana: 'シ', isCorrect: true })));
    expect(getKanaStatus(state.kanaProgress['シ'])).toBe('learned');
    saveStorage(state);
    expect(loadStorage().storage.kanaProgress['シ'].streak).toBe(3);
  });
});
