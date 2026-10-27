/**
 * Dock badge and the daily reminder (macOS). Both go through small commands
 * of the desktop shell; in a browser or in tests everything here is a no-op.
 */
import { getTauriInvoke } from './fileStore';
import { pluralRu } from './utils';

let lastBadge: number | null | undefined;

/** Reviews due now on the Dock icon; 0 or null removes the badge. */
export function setDockBadge(count: number | null): void {
  const value = count && count > 0 ? Math.min(999, Math.round(count)) : null;
  if (value === lastBadge) return;
  const invoke = getTauriInvoke();
  if (!invoke) return;
  lastBadge = value;
  invoke('set_dock_badge', { count: value }).catch(() => {
    lastBadge = undefined;
  });
}

/** The next moment «HH:MM» comes round after `from` (today or tomorrow). */
export function getNextReminderAt(time: string, from: Date, skipToday: boolean): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const at = new Date(from);
  at.setHours(hours, minutes, 0, 0);
  if (skipToday || at.getTime() <= from.getTime()) at.setDate(at.getDate() + 1);
  return at;
}

export function getReminderText(dueCount: number, streakDays: number): { title: string; body: string } {
  const body = dueCount > 0
    ? `${dueCount} ${pluralRu(dueCount, ['слово ждёт', 'слова ждут', 'слов ждут'])} повторения — это пара минут.`
    : 'Короткий урок на сегодня готов.';
  const title = streakDays > 0 ? `étudier · серия ${streakDays} ${pluralRu(streakDays, ['день', 'дня', 'дней'])}` : 'étudier';
  return { title, body };
}

let lastReminderKey: string | undefined;

/**
 * Hands the next reminder to macOS, which shows it at that time even if the
 * app is closed by then. Only one is ever scheduled: each call replaces it,
 * and `null` cancels it.
 */
export function scheduleReminder(reminder: { at: Date; title: string; body: string } | null): void {
  const key = reminder ? `${reminder.at.getTime()}|${reminder.title}|${reminder.body}` : 'off';
  if (key === lastReminderKey) return;
  const invoke = getTauriInvoke();
  if (!invoke) return;
  lastReminderKey = key;
  const args = reminder
    ? { at: reminder.at.getTime() / 1000, title: reminder.title, body: reminder.body }
    : { at: null, title: '', body: '' };
  invoke('schedule_reminder', args).catch(() => {
    lastReminderKey = undefined;
  });
}
