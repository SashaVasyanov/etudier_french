import { describe, expect, it, beforeEach } from 'vitest';
import { loadStorage, saveStorage } from '../src/lib/storage';
import { installStorage, storage, progress, now } from './fixtures';

const envelope = (payload: unknown, version = 2) => JSON.stringify({ version, savedAt: now.toISOString(), payload });

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
