import type { ContentIssue, ContentReport } from '../types';

export const CONTENT_ISSUE_LABELS: Record<ContentIssue, string> = {
  translation: 'Перевод',
  example: 'Пример',
  image: 'Картинка',
  sound: 'Произношение',
  other: 'Другое',
};

/** The reports as plain text, to paste into a message: one line per mistake. */
export function formatContentReports(reports: ContentReport[]): string {
  const lines = reports.map((report) => {
    const note = report.note ? `: ${report.note}` : '';
    return `- ${report.original} — ${report.translation} [${report.wordId}] · ${CONTENT_ISSUE_LABELS[report.issue].toLowerCase()}${note}`;
  });
  return [`Ошибки в словах étudier (${reports.length}):`, ...lines].join('\n');
}
