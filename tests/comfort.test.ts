import { describe, expect, it } from 'vitest';
import { getNextReminderAt, getReminderText } from '../src/lib/desktop';
import { DEFAULT_COMFORT, getComfort, importStorageSnapshot, exportStorageSnapshot, setComfortPreference } from '../src/lib/storage';
import { parseClipboardWord } from '../src/lib/utils';
import { storage } from './fixtures';

describe('comfort settings', () => {
  it('defaults until changed, and is dropped again when back to defaults', () => {
    const base = storage();
    expect(getComfort(base)).toEqual(DEFAULT_COMFORT);
    const changed = setComfortPreference(base, { textSize: 'large', reminderTime: '08:30' });
    expect(getComfort(changed).textSize).toBe('large');
    expect(getComfort(changed).reminderTime).toBe('08:30');
    expect(getComfort(changed).autoplay).toBe(true);
    const back = setComfortPreference(changed, { textSize: 'normal', reminderTime: null });
    expect(back.comfort).toBeUndefined();
  });

  it('rejects malformed values', () => {
    const changed = setComfortPreference(storage(), { reminderTime: '25:00', textSize: 'huge' as never, autoplay: false });
    expect(getComfort(changed).reminderTime).toBeNull();
    expect(getComfort(changed).textSize).toBe('normal');
    expect(getComfort(changed).autoplay).toBe(false);
  });

  it('survives a backup round trip', () => {
    const changed = setComfortPreference(storage(), { reduceMotion: true, dockBadge: false });
    const restored = importStorageSnapshot(exportStorageSnapshot(changed));
    expect(getComfort(restored).reduceMotion).toBe(true);
    expect(getComfort(restored).dockBadge).toBe(false);
  });
});

describe('reminder timing', () => {
  const from = new Date(2026, 0, 10, 12, 0, 0, 0);

  it('fires later today, or tomorrow once the time has passed or the lesson is done', () => {
    expect(getNextReminderAt('19:00', from, false).getTime()).toBe(new Date(2026, 0, 10, 19, 0).getTime());
    expect(getNextReminderAt('09:15', from, false).getTime()).toBe(new Date(2026, 0, 11, 9, 15).getTime());
    expect(getNextReminderAt('19:00', from, true).getTime()).toBe(new Date(2026, 0, 11, 19, 0).getTime());
  });

  it('says how many words wait', () => {
    expect(getReminderText(3, 0).body).toContain('3 слова ждут');
    expect(getReminderText(0, 5).title).toContain('5 дней');
  });
});

describe('word from the clipboard', () => {
  it('splits a word from its translation', () => {
    expect(parseClipboardWord('bonjour — привет')).toEqual({ original: 'bonjour', translation: 'привет' });
    expect(parseClipboardWord('la maison\tдом')).toEqual({ original: 'la maison', translation: 'дом' });
    expect(parseClipboardWord('  « chat »\nкошка\n')).toEqual({ original: 'chat', translation: 'кошка' });
    expect(parseClipboardWord('peut-être')).toEqual({ original: 'peut-être', translation: '' });
    expect(parseClipboardWord('食べる - есть')).toEqual({ original: '食べる', translation: 'есть' });
    expect(parseClipboardWord('   \n ')).toBeNull();
  });
});
