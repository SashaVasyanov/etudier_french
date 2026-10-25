import { useDeferredValue, useMemo, useState } from 'react';
import { playWordAudio } from '../lib/audio';
import { derivePackStatus, getPackCompletionRatio } from '../lib/packs';
import { getDisplayWord, getPartOfSpeechLabel } from '../lib/wordPresentation';
import { getWordProgress } from '../lib/storage';
import type { AppStorage, LessonDurationMinutes, WordPack } from '../types';
import { AppCard } from './AppCard';
import { LessonDurationSelector } from './LessonDurationSelector';
import { PackWordRow } from './PackWordRow';
import { StatusBadge } from './StatusBadge';
import { WordDetailsPanel } from './WordDetailsPanel';
import { WordImage } from './WordImage';

interface PackDetailScreenProps {
  pack: WordPack;
  storage: AppStorage;
  lessonDurationMinutes: LessonDurationMinutes;
  onLessonDurationChange: (value: LessonDurationMinutes) => void;
  onBack: () => void;
  onAddPack: (packId: string) => void;
  onStartPackLesson: (packId: string) => void;
  onStartPackFlashcards: (packId: string) => void;
  /** Only for imported packs: deletes the pack and its progress. */
  onRemovePack?: (packId: string) => void;
}

type PackStatusFilter = 'all' | 'new' | 'learning' | 'known' | 'mastered' | 'difficult';

const FILTERS: Array<{ id: PackStatusFilter; label: string }> = [
  { id: 'all', label: 'Все слова' },
  { id: 'new', label: 'Новые' },
  { id: 'learning', label: 'Изучаемые' },
  { id: 'known', label: 'Известные' },
  { id: 'mastered', label: 'Выученные' },
  { id: 'difficult', label: 'Сложные' },
];

export function PackDetailScreen({
  pack,
  storage,
  lessonDurationMinutes,
  onLessonDurationChange,
  onBack,
  onAddPack,
  onStartPackLesson,
  onStartPackFlashcards,
  onRemovePack,
}: PackDetailScreenProps) {
  const [query, setQuery] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
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

  function resetFilters() {
    setQuery('');
    setFilter('all');
  }

  return (
    <section className="dashboard-shell">
      <AppCard as="header" tone="hero" className="pack-detail-hero">
        <div className="pack-detail-head">
          <div className="hero-copy">
            <span className="eyebrow">Пак слов</span>
            <h1 className="hero-title compact-title">{pack.title}</h1>
            <p className="hero-text">{pack.description}</p>
          </div>
          <StatusBadge status={status} />
        </div>

        <div className="pack-detail-meta">
          <div className="mini-stat">
            <span className="mini-stat-value">{pack.words.length}</span>
            <span className="mini-stat-label">Слов в паке</span>
          </div>
          <div className="mini-stat">
            <span className="mini-stat-value">{completion}%</span>
            <span className="mini-stat-label">Освоено</span>
          </div>
          <div className="mini-stat">
            <span className="mini-stat-value">{filteredWords.length}</span>
            <span className="mini-stat-label">После фильтра</span>
          </div>
        </div>

        <div className="progress-track" aria-hidden="true">
          <div className="progress-fill" style={{ width: `${completion}%` }} />
        </div>

        <div className="result-actions">
          <button type="button" className="ghost-button" onClick={onBack}>
            Назад к пакам
          </button>
          <button type="button" className="secondary-button" disabled={status !== 'not_added'} onClick={() => onAddPack(pack.id)}>
            {status === 'not_added' ? 'Добавить пак' : 'Пак добавлен'}
          </button>
          <button type="button" className="primary-button" onClick={() => onStartPackLesson(pack.id)}>
            Учить этот пак
          </button>
          <button type="button" className="secondary-button" onClick={() => onStartPackFlashcards(pack.id)}>
            Карточки пака
          </button>
          {onRemovePack ? (
            confirmRemove ? (
              <>
                <button type="button" className="danger-button" onClick={() => onRemovePack(pack.id)}>
                  Да, удалить пак и его прогресс
                </button>
                <button type="button" className="ghost-button" onClick={() => setConfirmRemove(false)}>
                  Отмена
                </button>
              </>
            ) : (
              <button type="button" className="danger-button quiet-danger" onClick={() => setConfirmRemove(true)}>
                Удалить пак
              </button>
            )
          ) : null}
        </div>
      </AppCard>

      <LessonDurationSelector
        value={lessonDurationMinutes}
        onChange={onLessonDurationChange}
        title="Длительность практики по паку"
        description="Используется при запуске отдельного занятия по этой теме."
      />

      <AppCard as="section" className="filter-card">
        <div className="dictionary-toolbar dictionary-toolbar-wide">
          <label className="sr-only" htmlFor="pack-word-search">Поиск внутри пака</label>
          <input id="pack-word-search" className="text-input" value={query} placeholder="Например, bonjour" onChange={(event) => setQuery(event.target.value)} />
          <label className="sr-only" htmlFor="pack-status-filter">Статус слов</label>
          <select id="pack-status-filter" className="level-select" value={filter} onChange={(event) => setFilter(event.target.value as PackStatusFilter)}>
            {FILTERS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="pack-detail-summary">
            <span>Статус: {{ not_added: 'не добавлен', added: 'добавлен', in_progress: 'в процессе', completed: 'завершён' }[status]}</span>
            <span>Фильтр: {FILTERS.find((item) => item.id === filter)?.label}</span>
          </div>
        </div>
      </AppCard>

      <section className="dictionary-grid" aria-live="polite">
        {filteredWords.length === 0 ? (
          <div className="contextual-empty-state">
            <h2>В паке нет подходящих слов</h2>
            <p>По текущему поиску и фильтру найдено: 0.</p>
            <div className="contextual-empty-actions">
              {query ? <button type="button" className="ghost-button" onClick={() => setQuery('')}>Очистить поиск</button> : null}
              <button type="button" className="secondary-button" onClick={resetFilters}>Сбросить фильтры</button>
            </div>
          </div>
        ) : filteredWords.map((word) => {
          const progress = getWordProgress(storage, word.id);

          return (
            <AppCard key={word.id} as="article" className="word-card">
              <PackWordRow
                media={<WordImage word={word} />}
                title={getDisplayWord(word)}
                subtitle={`${word.translation} · ${word.transcription || 'транскрипция не указана'} · ${getPartOfSpeechLabel(word.part_of_speech)}`}
                action={
                  <button
                    type="button"
                    className="audio-button"
                    aria-label={`Прослушать слово ${getDisplayWord(word)}`}
                    onClick={() => {
                      void playWordAudio(word);
                    }}
                  >
                    Аудио
                  </button>
                }
                badges={
                  <>
                    <StatusBadge status={progress.status} />
                    <span className="tag-badge">{getPartOfSpeechLabel(word.part_of_speech)}</span>
                    <span className="tag-badge">{word.level}</span>
                  </>
                }
                details={
                  <WordDetailsPanel word={word} />
                }
              />
            </AppCard>
          );
        })}
      </section>
    </section>
  );
}
