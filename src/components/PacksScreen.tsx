import { useMemo, useState } from 'react';
import { derivePackStatus, getPackCompletionRatio } from '../lib/packs';
import { getLearningLanguageMenuLabel } from '../lib/languages';
import type { AppStorage, LearningLanguage, WordPack } from '../types';
import { AppCard } from './AppCard';
import { PackCard } from './PackCard';
import { StatCard } from './StatCard';

interface PacksScreenProps {
  learningLanguage: LearningLanguage;
  packs: WordPack[];
  storage: AppStorage;
  onAddPack: (packId: string) => void;
  onImportPack: (title: string, rawText: string) => void;
  onOpenPack: (packId: string) => void;
}

export default function PacksScreen({ learningLanguage, packs, storage, onAddPack, onImportPack, onOpenPack }: PacksScreenProps) {
  const [importTitle, setImportTitle] = useState('');
  const [importText, setImportText] = useState('');
  const addedCount = packs.filter((pack) => derivePackStatus(pack, storage) !== 'not_added').length;
  const importLineCount = useMemo(
    () => importText.split(/\r?\n/).filter((line) => line.trim() && !line.trim().startsWith('#')).length,
    [importText],
  );

  return (
    <section className="dashboard-shell">
      <AppCard as="header" tone="hero">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Паки</span>
            <h1 className="hero-title compact-title">Тематические наборы как коллекция</h1>
          </div>
          <p className="hero-text">Каждый пак можно добавить, открыть, просмотреть слова внутри и запустить отдельную практику по теме.</p>
        </div>

        <section className="stats-grid compact-stats">
          <StatCard label="Стартовых паков" value={packs.length} hint="Темы доступны сразу" />
          <StatCard label="Подключено" value={addedCount} hint="Влияют на словарь и уроки" tone="accent" />
        </section>
      </AppCard>

      <AppCard as="section" className="pack-import-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Импорт</span>
            <h2>Добавить пак из Anki / Quizlet</h2>
          </div>
          <p className="hero-text">
            Текущий язык: {getLearningLanguageMenuLabel(learningLanguage)}. Поддерживаются строки “слово TAB перевод”,
            “слово; перевод” и “слово - перевод”.
          </p>
        </div>
        <div className="pack-import-form">
          <input
            className="text-input"
            value={importTitle}
            placeholder="Название пака"
            onChange={(event) => setImportTitle(event.target.value)}
          />
          <textarea
            className="text-input pack-import-textarea"
            value={importText}
            placeholder={'bonjour\tпривет\nmerci\tспасибо\nau revoir\tдо свидания'}
            onChange={(event) => setImportText(event.target.value)}
          />
          <div className="pack-import-footer">
            <small>{importLineCount > 0 ? `Строк для импорта: ${importLineCount}` : 'Вставьте список слов из экспорта.'}</small>
            <button
              type="button"
              className="primary-button"
              disabled={!importTitle.trim() || !importText.trim()}
              onClick={() => {
                onImportPack(importTitle, importText);
                setImportTitle('');
                setImportText('');
              }}
            >
              Импортировать пак
            </button>
          </div>
        </div>
      </AppCard>

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
