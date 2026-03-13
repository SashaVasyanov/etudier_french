import { useDeferredValue, useMemo, useState } from 'react';
import { playWordAudio } from '../lib/audio';
import { getWordProgress } from '../lib/storage';
import type { AppStorage, DictionaryTab, Word, WordLevel } from '../types';

interface DictionaryScreenProps {
  words: Word[];
  storage: AppStorage;
  onBack: () => void;
}

const TABS: Array<{ id: DictionaryTab; label: string }> = [
  { id: 'all', label: 'Все слова' },
  { id: 'learning', label: 'Изучаемые' },
  { id: 'mastered', label: 'Выученные' },
  { id: 'hard', label: 'Сложные' },
];

function getBadgeLabel(status: ReturnType<typeof getWordProgress>['status']): string {
  if (status === 'mastered') {
    return 'выучено';
  }

  if (status === 'learning' || status === 'review') {
    return 'учится';
  }

  return 'новое';
}

export default function DictionaryScreen({ words, storage, onBack }: DictionaryScreenProps) {
  const [tab, setTab] = useState<DictionaryTab>('all');
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<'all' | WordLevel>('all');
  const deferredQuery = useDeferredValue(query);

  const filteredWords = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLocaleLowerCase();

    return words.filter((word) => {
      const progress = getWordProgress(storage, word.id);
      const matchesTab =
        tab === 'all'
          ? true
          : tab === 'learning'
            ? progress.status === 'learning' || progress.status === 'review'
            : tab === 'mastered'
              ? progress.status === 'mastered'
              : progress.wrong_count >= 3 || progress.ease_factor <= 1.8;
      const matchesLevel = level === 'all' ? true : word.level === level;
      const matchesQuery =
        normalizedQuery.length === 0
          ? true
          : [word.original, word.translation, word.example_original, ...word.tags]
              .join(' ')
              .toLocaleLowerCase()
              .includes(normalizedQuery);

      return matchesTab && matchesLevel && matchesQuery;
    });
  }, [deferredQuery, level, storage, tab, words]);

  return (
    <section className="dashboard-shell">
      <header className="hero-card compact-card">
        <div className="screen-header">
          <div>
            <span className="eyebrow">Словарь</span>
            <h1 className="section-title">Личный словарь</h1>
            <p className="hero-text">Поиск, фильтры по уровню и быстрый аудио-повтор.</p>
          </div>
          <button type="button" className="ghost-button" onClick={onBack}>
            На главную
          </button>
        </div>

        <div className="dictionary-toolbar">
          <input
            className="text-input"
            value={query}
            placeholder="Поиск по французскому, переводу или тегам"
            onChange={(event) => setQuery(event.target.value)}
          />
          <select
            className="level-select"
            value={level}
            onChange={(event) => setLevel(event.target.value as 'all' | WordLevel)}
          >
            <option value="all">Все уровни</option>
            <option value="A1">A1</option>
            <option value="A2">A2</option>
            <option value="B1">B1</option>
          </select>
        </div>

        <div className="tab-row">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === tab ? 'tab-button active' : 'tab-button'}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      <section className="dictionary-grid">
        {filteredWords.map((word) => {
          const progress = getWordProgress(storage, word.id);
          const badgeLabel = getBadgeLabel(progress.status);

          return (
            <article key={word.id} className="word-card">
              <div className="word-card-header">
                <div>
                  <h2 className="word-title">{word.original}</h2>
                  <p className="word-subtitle">
                    {word.translation} · {word.transcription}
                  </p>
                </div>
                <button
                  type="button"
                  className="audio-button"
                  onClick={() => {
                    void playWordAudio(word);
                  }}
                >
                  Аудио
                </button>
              </div>

              <div className="badge-row">
                <span className={`status-badge ${progress.status}`}>{badgeLabel}</span>
                <span className="tag-badge">{word.level}</span>
                <span className="tag-badge">{word.part_of_speech}</span>
              </div>

              <p className="example-original">{word.example_original}</p>
              <p className="example-translation">{word.example_translation}</p>
            </article>
          );
        })}
      </section>
    </section>
  );
}
