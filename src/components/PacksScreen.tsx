import { useMemo, useState } from 'react';
import { derivePackStatus, getPackCompletionRatio } from '../lib/packs';
import { getLearningLanguageMenuLabel } from '../lib/languages';
import { IMPORT_LIMITS } from '../lib/importPacks';
import type { AppStorage, LearningLanguage, WordPack } from '../types';
import { AppCard } from './AppCard';
import { PackCard } from './PackCard';
import { StatCard } from './StatCard';

type ImportPackResult =
  | { ok: true; importedWords: number }
  | { ok: false; reason: string };

type ImportFeedback =
  | { tone: 'success'; message: string }
  | { tone: 'error'; message: string };

interface PacksScreenProps {
  learningLanguage: LearningLanguage;
  packs: WordPack[];
  storage: AppStorage;
  onAddPack: (packId: string) => void;
  onImportPack: (title: string, rawText: string) => ImportPackResult;
  onOpenPack: (packId: string) => void;
}

export default function PacksScreen({ learningLanguage, packs, storage, onAddPack, onImportPack, onOpenPack }: PacksScreenProps) {
  const [importTitle, setImportTitle] = useState('');
  // The import form is rarely needed, so it opens on request instead of
  // pushing the packs below the first screen.
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importFeedback, setImportFeedback] = useState<ImportFeedback | null>(null);
  const addedCount = packs.filter((pack) => derivePackStatus(pack, storage) !== 'not_added').length;
  const importLineCount = useMemo(
    () => importText.split(/\r?\n/).filter((line) => line.trim() && !line.trim().startsWith('#')).length,
    [importText],
  );

  function submitImport() {
    const result = onImportPack(importTitle, importText);

    if (!result.ok) {
      setImportFeedback({ tone: 'error', message: result.reason });
      return;
    }

    setImportTitle('');
    setImportText('');
    setImportFeedback({
      tone: 'success',
      message: `Пак добавлен: ${result.importedWords} ${result.importedWords === 1 ? 'слово' : 'слов'}.`,
    });
  }

  return (
    <section className="dashboard-shell">
      <AppCard as="header" tone="hero">
        <div className="section-heading">
          <div>
            <h1 className="hero-title compact-title">Темы</h1>
            <p className="hero-text">Наборы слов по темам. Добавленные темы попадают в словарь и уроки, любую можно открыть и потренировать отдельно.</p>
          </div>
          <button type="button" className="secondary-button" aria-expanded={showImport} onClick={() => setShowImport((value) => !value)}>
            {showImport ? 'Скрыть импорт' : 'Импорт из Anki или Quizlet'}
          </button>
        </div>

        <section className="stats-grid compact-stats">
          <StatCard label="Тем" value={packs.length} hint="Доступны сразу" />
          <StatCard label="Добавлено в уроки" value={addedCount} hint="Слова из них идут в уроки и словарь" tone="accent" />
        </section>
      </AppCard>

      {showImport ? (
        <AppCard as="section" className="pack-import-card">
          <div className="section-heading">
            <div>
              <h2>Импорт из Anki или Quizlet</h2>
            </div>
            <p className="hero-text">
              Текущий язык: {getLearningLanguageMenuLabel(learningLanguage)}. Поддерживаются строки «слово TAB перевод»,
              «слово; перевод» и «слово - перевод».
            </p>
          </div>
          <div className="pack-import-form">
            <label className="form-field-label" htmlFor="pack-import-title">Название пака</label>
            <input
              id="pack-import-title"
              className="text-input"
              value={importTitle}
              maxLength={IMPORT_LIMITS.titleLength}
              placeholder={learningLanguage === 'french' ? 'Например, Поездка во Францию' : 'Например, Поездка в Японию'}
              aria-describedby={importFeedback ? 'pack-import-message' : undefined}
              onChange={(event) => {
                setImportTitle(event.target.value);
                setImportFeedback(null);
              }}
            />
            <label className="form-field-label" htmlFor="pack-import-text">Слова и переводы</label>
            <textarea
              id="pack-import-text"
              className="text-input pack-import-textarea"
              value={importText}
              maxLength={IMPORT_LIMITS.rawTextLength}
              placeholder={learningLanguage === 'french'
                ? 'bonjour\tпривет\nmerci\tспасибо\nau revoir\tдо свидания'
                : 'こんにちは\tздравствуйте\nありがとう\tспасибо\nさようなら\tдо свидания'}
              aria-describedby={importFeedback ? 'pack-import-line-count pack-import-message' : 'pack-import-line-count'}
              onChange={(event) => {
                setImportText(event.target.value);
                setImportFeedback(null);
              }}
            />
            <div className="pack-import-footer">
              <small id="pack-import-line-count">
                {importLineCount > 0 ? `Непустых строк без комментариев: ${importLineCount}.` : 'Вставьте список слов из экспорта.'}
              </small>
              <button
                type="button"
                className="primary-button"
                disabled={!importTitle.trim() || !importText.trim()}
                onClick={submitImport}
              >
                Импортировать пак
              </button>
            </div>
            {importFeedback ? (
              <p
                id="pack-import-message"
                className="form-inline-message"
                role={importFeedback.tone === 'error' ? 'alert' : 'status'}
                aria-live={importFeedback.tone === 'error' ? 'assertive' : 'polite'}
              >
                {importFeedback.message}
              </p>
            ) : null}
          </div>
        </AppCard>
      ) : null}

      <section className="packs-grid">
        {packs.map((pack) => {
          const status = derivePackStatus(pack, storage);
          const completion = getPackCompletionRatio(pack, storage);

          return (
            <PackCard
              key={pack.id}
              pack={pack}
              status={status}
              completion={completion}
              onAdd={() => onAddPack(pack.id)}
              onOpen={() => onOpenPack(pack.id)}
            />
          );
        })}
      </section>
    </section>
  );
}
