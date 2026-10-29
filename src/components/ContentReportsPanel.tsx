import { useState } from 'react';
import type { ContentIssue, ContentReport } from '../types';
import { CONTENT_ISSUE_LABELS, formatContentReports } from '../lib/contentReports';
import { formatDateTimeLabel } from '../lib/utils';
import { AppIcon } from './AppIcon';

interface ContentReportsPanelProps {
  reports: ContentReport[];
  onRemove: (wordId: string, issue: ContentIssue | null) => void;
}

/**
 * The words the learner marked as wrong. The list can be copied in one go and
 * sent to whoever fixes the dictionary; fixed entries are removed by hand.
 */
export function ContentReportsPanel({ reports, onRemove }: ContentReportsPanelProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [shown, setShown] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  async function copy() {
    const text = formatContentReports(reports);
    try {
      await navigator.clipboard.writeText(text);
      setMessage('Список скопирован в буфер обмена.');
      setShown('');
    } catch {
      setMessage('Выделите текст ниже и скопируйте его.');
      setShown(text);
    }
  }

  return (
    <section className="settings-panel settings-reports-panel">
      <div className="settings-section-title">
        <span className="settings-icon"><AppIcon name="key" size={21} /></span>
        <div>
          <h2>Ошибки в словах</h2>
          <p>
            {reports.length
              ? 'Слова, где вы заметили неверный перевод, пример, картинку или звук. Скопируйте список и пришлите — данные поправят.'
              : 'Заметили неверный перевод или неудачную картинку? Нажмите «Сообщить об ошибке» на карточке слова — оно появится здесь.'}
          </p>
        </div>
      </div>

      {reports.length ? (
        <>
          <ul className="reports-list">
            {reports.map((report) => (
              <li key={`${report.wordId}:${report.issue}`} className="reports-item">
                <div>
                  <strong lang={report.language === 'japanese' ? 'ja' : 'fr'}>{report.original}</strong>
                  <span className="reports-translation">{report.translation}</span>
                  <span className="reports-meta">
                    {CONTENT_ISSUE_LABELS[report.issue]} · {formatDateTimeLabel(report.reportedAt)}
                  </span>
                  {report.note ? <p className="reports-note">{report.note}</p> : null}
                </div>
                <button
                  type="button"
                  className="text-action-button"
                  onClick={() => onRemove(report.wordId, report.issue)}
                  aria-label={`Убрать «${report.original}» из списка`}
                >
                  Убрать
                </button>
              </li>
            ))}
          </ul>
          <div className="backup-actions">
            <button type="button" className="primary-button" onClick={() => void copy()}>
              Скопировать список
            </button>
            <button
              type="button"
              className={confirmClear ? 'danger-button' : 'secondary-button'}
              onClick={() => {
                if (!confirmClear) {
                  setConfirmClear(true);
                  return;
                }
                for (const report of reports) onRemove(report.wordId, null);
                setConfirmClear(false);
                setMessage(null);
                setShown('');
              }}
            >
              {confirmClear ? 'Точно очистить?' : 'Очистить'}
            </button>
          </div>
          {message ? <p className="backup-message" role="status">{message}</p> : null}
          {shown ? <textarea className="settings-input backup-text" readOnly rows={6} value={shown} onFocus={(event) => event.currentTarget.select()} /> : null}
        </>
      ) : null}
    </section>
  );
}
