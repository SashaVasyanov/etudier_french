import { describe, expect, it } from 'vitest';
import { exportStorageSnapshot, importStorageSnapshot, removeContentReport, reportContentIssue } from '../src/lib/storage';
import { formatContentReports } from '../src/lib/contentReports';
import { storage, now } from './fixtures';

const base = {
  wordId: 'fr-chat',
  language: 'french' as const,
  original: 'le chat',
  translation: 'кот',
};

describe('content reports', () => {
  it('records a report, newest first, one per word and issue', () => {
    let current = reportContentIssue(storage({}), { ...base, issue: 'translation', note: '  кошка  ' }, now);
    current = reportContentIssue(current, { ...base, wordId: 'fr-chien', original: 'le chien', translation: 'собака', issue: 'image' }, new Date(now.getTime() + 1000));
    current = reportContentIssue(current, { ...base, issue: 'translation', note: 'кошка, а не кот' }, new Date(now.getTime() + 2000));

    const reports = current.contentReports ?? [];
    expect(reports.length).toBe(2);
    expect(reports[0].wordId).toBe('fr-chat');
    expect(reports[0].note).toBe('кошка, а не кот');
    expect(reports[1].wordId).toBe('fr-chien');
  });

  it('trims notes and drops empty ones', () => {
    const current = reportContentIssue(storage({}), { ...base, issue: 'sound', note: '   ' }, now);
    expect(current.contentReports?.[0].note).toBe(undefined);
  });

  it('removes one issue or every issue of a word', () => {
    let current = reportContentIssue(storage({}), { ...base, issue: 'translation' }, now);
    current = reportContentIssue(current, { ...base, issue: 'example' }, now);
    expect(removeContentReport(current, 'fr-chat', 'example').contentReports?.length).toBe(1);
    expect(removeContentReport(current, 'fr-chat').contentReports).toBe(undefined);
  });

  it('survives a backup round trip and drops broken entries', () => {
    const current = reportContentIssue(storage({}), { ...base, issue: 'other', note: 'не то слово' }, now);
    const restored = importStorageSnapshot(exportStorageSnapshot(current));
    expect(restored.contentReports?.length).toBe(1);
    expect(restored.contentReports?.[0].issue).toBe('other');

    const broken = JSON.parse(exportStorageSnapshot(current));
    const target = broken.payload;
    target.contentReports = [{ wordId: 'x', issue: 'nope' }, 42, null];
    expect(importStorageSnapshot(JSON.stringify(broken)).contentReports).toBe(undefined);
  });

  it('formats a list that is easy to paste into a message', () => {
    const current = reportContentIssue(storage({}), { ...base, issue: 'translation', note: 'кошка' }, now);
    const text = formatContentReports(current.contentReports ?? []);
    expect(text.split('\n')[0]).toBe('Ошибки в словах étudier (1):');
    expect(text.includes('le chat — кот [fr-chat] · перевод: кошка')).toBe(true);
  });
});
