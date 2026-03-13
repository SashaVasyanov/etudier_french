import { useDeferredValue, useMemo, useState } from 'react';
import { playWordAudio } from '../lib/audio';
import { derivePackStatus, getPackCompletionRatio } from '../lib/packs';
import { getWordProgress } from '../lib/storage';
import type { AppStorage, LessonDurationMinutes, WordPack } from '../types';
import { LessonDurationSelector } from './LessonDurationSelector';

interface PackDetailScreenProps {
  pack: WordPack;
  storage: AppStorage;
  lessonDurationMinutes: LessonDurationMinutes;
  onLessonDurationChange: (value: LessonDurationMinutes) => void;
  onBack: () => void;
  onAddPack: (packId: string) => void;
  onStartPackLesson: (packId: string) => void;
}

type PackStatusFilter = 'all' | 'new' | 'learning' | 'known' | 'mastered' | 'difficult';

const FILTERS: Array<{ id: PackStatusFilter; label: string }> = [
  { id: 'all', label: 'Все слова' },
  { id: 'new', label: 'Новые' },
  { id: 'learning', label: 'Изучаемые' },
  { id: 'known', label: 'Уже известные' },
  { id: 'mastered', label: 'Выученные' },
  { id: 'difficult', label: 'Сложные' },
];

function getPackStatusLabel(status: ReturnType<typeof derivePackStatus>): string {
  if (status === 'added') {
    return 'добавлен';
  }

  if (status === 'in_progress') {
    return 'в процессе';
  }

  if (status === 'completed') {
    return 'завершён';
  }

  return 'не добавлен';
}

function getWordStatusLabel(status: ReturnType<typeof getWordProgress>['status']): string {
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

export function PackDetailScreen({
  pack,
  storage,
  lessonDurationMinutes,
  onLessonDurationChange,
  onBack,
  onAddPack,
  onStartPackLesson,
}: PackDetailScreenProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<PackStatusFilter>('all');
  const deferredQuery = useDeferredValue(query);
  const status = derivePackStatus(pack, storage);
  const completion = getPackCompletionRatio(pack, storage);

  const filteredWords = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLocaleLowerCase();

    return pack.words.filter((word) => {
      const progress = getWordProgress(storage, word.id);
      const matchesFilter =
        filter === 'all'
          ? true
          : filter === 'learning'
            ? progress.status === 'learning' || progress.status === 'review'
            : progress.status === filter;
      const matchesQuery =
        normalizedQuery.length === 0
          ? true
          : [word.original, word.translation, word.transcription, ...word.tags].join(' ').toLocaleLowerCase().includes(normalizedQuery);

      return matchesFilter && matchesQuery;
    });
  }, [deferredQuery, filter, pack.words, storage]);

  return (
    <section className="dashboard-shell">
      <header className="hero-card">
        <div className="pack-detail-head">
          <div className="hero-copy">
            <span className="eyebrow">Пак слов</span>
            <h1 className="hero-title compact-title">{pack.title}</h1>
            <p className="hero-text">{pack.description}</p>
          </div>
          <span
            className={`status-badge ${status === 'completed' ? 'mastered' : status === 'in_progress' ? 'review' : status === 'added' ? 'learning' : 'new'}`}
          >
            {getPackStatusLabel(status)}
          </span>
        </div>

        <div className="pack-meta-grid">
          <article className="mini-stat">
            <span className="mini-stat-value">{pack.words.length}</span>
            <span className="mini-stat-label">Слов в паке</span>
          </article>
          <article className="mini-stat">
            <span className="mini-stat-value">{completion}%</span>
            <span className="mini-stat-label">Освоено</span>
          </article>
          <article className="mini-stat">
            <span className="mini-stat-value">{filteredWords.length}</span>
            <span className="mini-stat-label">Сейчас на экране</span>
          </article>
        </div>

        <div className="progress-track" aria-hidden="true">
          <div className="progress-fill" style={{ width: `${completion}%` }} />
        </div>

        <div className="result-actions">
          <button type="button" className="ghost-button" onClick={onBack}>
            Назад к пакам
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={status !== 'not_added'}
            onClick={() => onAddPack(pack.id)}
          >
            {status === 'not_added' ? 'Добавить пак' : 'Пак добавлен'}
          </button>
          <button type="button" className="primary-button" onClick={() => onStartPackLesson(pack.id)}>
            Учить слова из пака
          </button>
        </div>
      </header>

      <LessonDurationSelector
        value={lessonDurationMinutes}
        onChange={onLessonDurationChange}
        title="Размер практики по паку"
        description="Эта длительность используется при запуске дополнительного занятия по выбранному паку."
      />

      <section className="hero-card compact-card">
        <div className="dictionary-toolbar dictionary-toolbar-wide">
          <input
            className="text-input"
            value={query}
            placeholder="Поиск внутри пака"
            onChange={(event) => setQuery(event.target.value)}
          />
          <select className="level-select" value={filter} onChange={(event) => setFilter(event.target.value as PackStatusFilter)}>
            {FILTERS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="pack-detail-summary">
            <span>Статус пака: {getPackStatusLabel(status)}</span>
            <span>Фильтр: {FILTERS.find((item) => item.id === filter)?.label}</span>
          </div>
        </div>
      </section>

      <section className="dictionary-grid">
        {filteredWords.map((word) => {
          const progress = getWordProgress(storage, word.id);

          return (
            <article key={word.id} className="word-card">
              <div className="word-card-header">
                <div>
                  <h2 className="word-title">{word.original}</h2>
                  <p className="word-subtitle">
                    {word.translation} · {word.transcription || 'транскрипция не указана'}
                  </p>
                </div>
                <button
                  type="button"
                  className="audio-button"
                  disabled={!word.audio_original}
                  onClick={() => {
                    void playWordAudio(word);
                  }}
                >
                  {word.audio_original ? 'Аудио' : 'Нет аудио'}
                </button>
              </div>

              <div className="badge-row wrap-row">
                <span className={`status-badge ${progress.status}`}>{getWordStatusLabel(progress.status)}</span>
                <span className="tag-badge">{word.part_of_speech}</span>
                <span className="tag-badge">{word.level}</span>
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
