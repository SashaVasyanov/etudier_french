import { useDeferredValue, useMemo, useState } from 'react';
import { playWordAudio } from '../lib/audio';
import { getPackByWord } from '../lib/packs';
import { getWordProgress } from '../lib/storage';
import type { AppStorage, DictionaryTab, Word, WordLevel, WordPack } from '../types';

interface DictionaryScreenProps {
  words: Word[];
  storage: AppStorage;
  packs: WordPack[];
}

const TABS: Array<{ id: DictionaryTab; label: string }> = [
  { id: 'all', label: 'Все слова' },
  { id: 'learning', label: 'Изучаемые' },
  { id: 'known', label: 'Уже известные' },
  { id: 'mastered', label: 'Выученные' },
  { id: 'difficult', label: 'Сложные' },
];

function getBadgeLabel(status: ReturnType<typeof getWordProgress>['status']): string {
  if (status === 'known') {
    return 'уже известно';
  }

  if (status === 'mastered') {
    return 'выучено';
  }

  if (status === 'difficult') {
    return 'сложное';
  }

  if (status === 'learning' || status === 'review') {
    return 'изучается';
  }

  return 'новое';
}

export default function DictionaryScreen({ words, storage, packs }: DictionaryScreenProps) {
  const [tab, setTab] = useState<DictionaryTab>('all');
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<'all' | WordLevel>('all');
  const [packFilter, setPackFilter] = useState<'all' | 'core' | string>('all');
  const deferredQuery = useDeferredValue(query);

  const activePackOptions = useMemo(
    () => packs.filter((pack) => storage.packStates[pack.id]?.status && storage.packStates[pack.id]?.status !== 'not_added'),
    [packs, storage.packStates],
  );

  const filteredWords = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLocaleLowerCase();

    return words.filter((word) => {
      const progress = getWordProgress(storage, word.id);
      const matchesTab =
        tab === 'all'
          ? true
          : tab === 'learning'
            ? progress.status === 'learning' || progress.status === 'review'
            : tab === 'known'
              ? progress.status === 'known'
              : tab === 'mastered'
                ? progress.status === 'mastered'
                : progress.status === 'difficult';
      const matchesLevel = level === 'all' ? true : word.level === level;
      const matchesPack =
        packFilter === 'all' ? true : packFilter === 'core' ? word.source === 'core' : word.packIds.includes(packFilter);
      const matchesQuery =
        normalizedQuery.length === 0
          ? true
          : [word.original, word.translation, word.example_original, ...word.tags]
              .join(' ')
              .toLocaleLowerCase()
              .includes(normalizedQuery);

      return matchesTab && matchesLevel && matchesPack && matchesQuery;
    });
  }, [deferredQuery, level, packFilter, storage, tab, words]);

  return (
    <section className="dashboard-shell">
      <header className="hero-card compact-card">
        <div className="screen-header">
          <div>
            <span className="eyebrow">Словарь</span>
            <h1 className="section-title">Активный словарь</h1>
            <p className="hero-text">Поиск, фильтры по статусам и пакам, быстрый аудио-повтор и чистые карточки слов.</p>
          </div>
        </div>

        <div className="dictionary-toolbar dictionary-toolbar-wide">
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
          <select
            className="level-select"
            value={packFilter}
            onChange={(event) => setPackFilter(event.target.value)}
          >
            <option value="all">Все активные паки</option>
            <option value="core">Базовый курс</option>
            {activePackOptions.map((pack) => (
              <option key={pack.id} value={pack.id}>
                {pack.title}
              </option>
            ))}
          </select>
        </div>

        <div className="tab-row tab-row-wide">
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

        <div className="dictionary-summary">
          <span>Найдено карточек: {filteredWords.length}</span>
          <span>
            {TABS.find((item) => item.id === tab)?.label}
            {level !== 'all' ? ` · ${level}` : ''}
            {packFilter !== 'all'
              ? ` · ${packFilter === 'core' ? 'Базовый курс' : packs.find((pack) => pack.id === packFilter)?.title ?? ''}`
              : ''}
          </span>
        </div>
      </header>

      <section className="dictionary-grid">
        {filteredWords.map((word) => {
          const progress = getWordProgress(storage, word.id);
          const badgeLabel = getBadgeLabel(progress.status);
          const wordPacks = getPackByWord(word, packs);

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

              <div className="badge-row wrap-row">
                <span className={`status-badge ${progress.status}`}>{badgeLabel}</span>
                <span className="tag-badge">{word.level}</span>
                <span className="tag-badge">{word.part_of_speech}</span>
                {word.source === 'core' ? (
                  <span className="tag-badge">Базовый курс</span>
                ) : (
                  wordPacks.map((pack) => (
                    <span key={pack.id} className="tag-badge">
                      {pack.title}
                    </span>
                  ))
                )}
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
