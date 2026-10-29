import { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import type { ContentIssue, Word } from '../types';
import { CONTENT_ISSUE_LABELS } from '../lib/contentReports';

interface ReportContextValue {
  report: (word: Word, issue: ContentIssue, note: string) => void;
  isReported: (wordId: string) => boolean;
}

/** Provided by the app; without it the report button is not shown. */
export const ReportContext = createContext<ReportContextValue | null>(null);

const ISSUES: ContentIssue[] = ['translation', 'example', 'image', 'sound', 'other'];

/**
 * «Сообщить об ошибке»: pick what is wrong, add a note if you like. The report
 * stays on this computer and is listed in the profile, ready to be copied.
 */
export function ReportIssueButton({ word, className }: { word: Word; className?: string }) {
  const context = useContext(ReportContext);
  const [open, setOpen] = useState(false);
  const [issue, setIssue] = useState<ContentIssue>('translation');
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
      }
    }
    function onPointerDown(event: PointerEvent) {
      if (panelRef.current && event.target instanceof Node && !panelRef.current.contains(event.target)) setOpen(false);
    }
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  if (!context) return null;
  const reported = sent || context.isReported(word.id);

  return (
    <div className={['report-issue', className].filter(Boolean).join(' ')} ref={panelRef}>
      <button
        type="button"
        className="word-card-link report-issue-toggle"
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value);
          setSent(false);
        }}
      >
        <span className="report-issue-mark" aria-hidden="true">!</span>
        {reported ? 'Ошибка отмечена' : 'Сообщить об ошибке'}
      </button>
      {open ? (
        <div className="report-issue-panel" role="dialog" aria-labelledby={titleId}>
          <strong id={titleId}>Что не так со словом «{word.original}»?</strong>
          <div className="report-issue-options" role="radiogroup" aria-label="Что не так">
            {ISSUES.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={issue === value}
                className={issue === value ? 'active' : undefined}
                onClick={() => setIssue(value)}
              >
                {CONTENT_ISSUE_LABELS[value]}
              </button>
            ))}
          </div>
          <textarea
            className="report-issue-note"
            rows={2}
            maxLength={500}
            placeholder="Как правильно? (необязательно)"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            onKeyDown={(event) => event.stopPropagation()}
          />
          <div className="report-issue-actions">
            <button type="button" className="secondary-button" onClick={() => setOpen(false)}>Отмена</button>
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                context.report(word, issue, note);
                setNote('');
                setSent(true);
                setOpen(false);
              }}
            >
              Отметить
            </button>
          </div>
          <small>Сообщение остаётся на этом компьютере; список — в профиле.</small>
        </div>
      ) : null}
    </div>
  );
}
