import { useEffect, useState } from 'react';
import { getProgressFileStatus, type ProgressFileStatus } from '../lib/fileStore';
import { AppIcon } from './AppIcon';

const COPY_SHORTCUT = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘C' : 'Ctrl+C';

interface BackupPanelProps {
  /** Serialized copy of all local progress. */
  onExport: () => string;
  /** Restores a copy; returns an error message, or null on success. */
  onImport: (raw: string) => string | null;
}

/**
 * Progress lives only on this computer. The panel lets the learner keep a copy
 * elsewhere (clipboard / a note / a file) and restore it, without any extra
 * native permissions.
 */
export function BackupPanel({ onExport, onImport }: BackupPanelProps) {
  const [exported, setExported] = useState('');
  const [restoreText, setRestoreText] = useState('');
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [fileStatus, setFileStatus] = useState<ProgressFileStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getProgressFileStatus().then((status) => {
      if (!cancelled) setFileStatus(status);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleExport() {
    const snapshot = onExport();
    setExported(snapshot);
    try {
      await navigator.clipboard.writeText(snapshot);
      setMessage({ tone: 'success', text: 'Копия скопирована в буфер обмена. Сохраните её в заметке или файле.' });
    } catch {
      setMessage({ tone: 'success', text: `Копия показана ниже: выделите текст и скопируйте его (${COPY_SHORTCUT}).` });
    }
  }

  function handleRestore() {
    if (!confirmRestore) {
      setConfirmRestore(true);
      return;
    }
    const error = onImport(restoreText);
    setConfirmRestore(false);
    if (error) {
      setMessage({ tone: 'error', text: error });
      return;
    }
    setRestoreText('');
    setMessage({ tone: 'success', text: 'Прогресс восстановлен из копии.' });
  }

  return (
    <section className="settings-panel settings-backup-panel">
      <div className="settings-section-title">
        <span className="settings-icon"><AppIcon name="layers" size={21} /></span>
        <div>
          <h2>Резервная копия</h2>
          <p>Прогресс хранится только на этом компьютере. Сохраните копию, чтобы не потерять его.</p>
          {fileStatus?.path ? (
            <p className="backup-file-status">
              {fileStatus.failed
                ? 'Не удалось обновить файл-копию — попробуем при следующем ответе.'
                : `Приложение само держит копию в файле${fileStatus.lastWriteAt ? `, обновлена в ${fileStatus.lastWriteAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : ''}:`}
              <code>{fileStatus.path.replace(/^\/Users\/[^/]+/, '~')}</code>
            </p>
          ) : null}
        </div>
      </div>

      <div className="backup-actions">
        <button type="button" className="secondary-button" onClick={() => { void handleExport(); }}>
          Скопировать резервную копию
        </button>
      </div>

      {exported ? (
        <textarea
          className="settings-input backup-text"
          readOnly
          value={exported}
          aria-label="Резервная копия прогресса"
          onFocus={(event) => event.currentTarget.select()}
        />
      ) : null}

      <label className="settings-field">
        <span>Восстановить из копии</span>
        <textarea
          className="settings-input backup-text"
          value={restoreText}
          placeholder="Вставьте сюда ранее сохранённую копию"
          onChange={(event) => {
            setRestoreText(event.target.value);
            setConfirmRestore(false);
          }}
        />
      </label>

      <div className="backup-actions">
        <button type="button" className={confirmRestore ? 'danger-button' : 'ghost-button'} disabled={!restoreText.trim()} onClick={handleRestore}>
          {confirmRestore ? 'Да, заменить текущий прогресс' : 'Восстановить'}
        </button>
        {confirmRestore ? (
          <button type="button" className="ghost-button" onClick={() => setConfirmRestore(false)}>Отмена</button>
        ) : null}
      </div>

      {message ? (
        <p className={message.tone === 'error' ? 'backup-message error' : 'backup-message'} role="status">{message.text}</p>
      ) : null}
    </section>
  );
}
