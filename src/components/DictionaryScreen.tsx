import { useDeferredValue, useMemo, useState } from 'react';
import { playWordAudio } from '../lib/audio';
import { getPackByWord } from '../lib/packs';
import { getWordProgress } from '../lib/storage';
import type { AppStorage, DictionaryTab, Word, WordLevel, WordPack } from '../types';
import { AppCard } from './AppCard';
import { PackWordRow } from './PackWordRow';
import { StatusBadge } from './StatusBadge';
import { WordImage } from './WordImage';

interface DictionaryScreenProps {
  words: Word[];
  storage: AppStorage;
  packs: WordPack[];
  onAddWord: (word: Omit<Word, 'id' | 'audio_original' | 'packIds' | 'source'>) => void;
}

const TABS: Array<{ id: DictionaryTab; label: string }> = [
  { id: 'all', label: 'Все слова' },
  { id: 'learning', label: 'Изучаемые' },
  { id: 'known', label: 'Уже известные' },
  { id: 'mastered', label: 'Выученные' },
  { id: 'difficult', label: 'Сложные' },
];

export default function DictionaryScreen({ words, storage, packs, onAddWord }: DictionaryScreenProps) {
  const [tab, setTab] = useState<DictionaryTab>('all');
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<'all' | WordLevel>('all');
  const [packFilter, setPackFilter] = useState<'all' | 'core' | string>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newWord, setNewWord] = useState({
    original: '',
    translation: '',
    transcription: '',
    example_original: '',
    example_translation: '',
    part_of_speech: 'word',
    level: 'A1' as WordLevel,
    tags: '',
  });
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
          : [word.original, word.translation, word.example_original, ...word.tags].join(' ').toLocaleLowerCase().includes(normalizedQuery);

      return matchesTab && matchesLevel && matchesPack && matchesQuery;
    });
  }, [deferredQuery, level, packFilter, storage, tab, words]);

  function resetNewWordForm() {
    setNewWord({
      original: '',
      translation: '',
      transcription: '',
      example_original: '',
      example_translation: '',
      part_of_speech: 'word',
      level: 'A1',
      tags: '',
    });
  }

  return (
    <section className="dashboard-shell">
      <AppCard as="header" tone="hero" className="dictionary-hero">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Словарь</span>
            <h1 className="hero-title compact-title">Карточки слов с изображениями</h1>
          </div>
          <div className="dictionary-hero-actions">
            <button type="button" className="primary-button" onClick={() => setShowAddForm((current) => !current)}>
              {showAddForm ? 'Скрыть форму' : 'Добавить слово'}
            </button>
            <p className="hero-text">Фильтруйте по статусу, ищите по французскому и переводу, слушайте произношение и быстро просматривайте активные паки.</p>
          </div>
        </div>

        {showAddForm ? (
          <form
            className="custom-word-form"
            onSubmit={(event) => {
              event.preventDefault();
              onAddWord({
                original: newWord.original,
                translation: newWord.translation,
                transcription: newWord.transcription,
                example_original: newWord.example_original || newWord.original,
                example_translation: newWord.example_translation || newWord.translation,
                part_of_speech: newWord.part_of_speech,
                level: newWord.level,
                tags: newWord.tags
                  .split(',')
                  .map((tag) => tag.trim())
                  .filter(Boolean),
                imageAlt: '',
                imagePackCategory: undefined,
                imagePath: undefined,
                imageUrl: undefined,
                illustrationType: undefined,
              });
              resetNewWordForm();
              setShowAddForm(false);
            }}
          >
            <input
              className="text-input"
              value={newWord.original}
              placeholder="Французское слово"
              required
              onChange={(event) => setNewWord((current) => ({ ...current, original: event.target.value }))}
            />
            <input
              className="text-input"
              value={newWord.translation}
              placeholder="Перевод"
              required
              onChange={(event) => setNewWord((current) => ({ ...current, translation: event.target.value }))}
            />
            <input
              className="text-input"
              value={newWord.transcription}
              placeholder="Транскрипция"
              onChange={(event) => setNewWord((current) => ({ ...current, transcription: event.target.value }))}
            />
            <input
              className="text-input"
              value={newWord.example_original}
              placeholder="Пример на французском"
              onChange={(event) => setNewWord((current) => ({ ...current, example_original: event.target.value }))}
            />
            <input
              className="text-input"
              value={newWord.example_translation}
              placeholder="Перевод примера"
              onChange={(event) => setNewWord((current) => ({ ...current, example_translation: event.target.value }))}
            />
            <input
              className="text-input"
              value={newWord.part_of_speech}
              placeholder="Часть речи"
              onChange={(event) => setNewWord((current) => ({ ...current, part_of_speech: event.target.value }))}
            />
            <select
              className="level-select"
              value={newWord.level}
              onChange={(event) => setNewWord((current) => ({ ...current, level: event.target.value as WordLevel }))}
            >
              <option value="A1">A1</option>
              <option value="A2">A2</option>
              <option value="B1">B1</option>
            </select>
            <input
              className="text-input"
              value={newWord.tags}
              placeholder="Теги через запятую"
              onChange={(event) => setNewWord((current) => ({ ...current, tags: event.target.value }))}
            />
            <div className="custom-word-actions">
              <button type="submit" className="primary-button">
                Сохранить слово
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  resetNewWordForm();
                  setShowAddForm(false);
                }}
              >
                Отмена
              </button>
            </div>
          </form>
        ) : null}

        <div className="dictionary-toolbar dictionary-toolbar-wide">
          <input
            className="text-input"
            value={query}
            placeholder="Поиск по слову, переводу или тегам"
            onChange={(event) => setQuery(event.target.value)}
          />
          <select className="level-select" value={level} onChange={(event) => setLevel(event.target.value as 'all' | WordLevel)}>
            <option value="all">Все уровни</option>
            <option value="A1">A1</option>
            <option value="A2">A2</option>
            <option value="B1">B1</option>
          </select>
          <select className="level-select" value={packFilter} onChange={(event) => setPackFilter(event.target.value)}>
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
          <span>{level !== 'all' ? `Уровень ${level}` : 'Все уровни'} · {packFilter === 'all' ? 'Все активные источники' : packFilter === 'core' ? 'Базовый курс' : packs.find((pack) => pack.id === packFilter)?.title ?? ''}</span>
        </div>
      </AppCard>

      <section className="dictionary-grid">
        {filteredWords.map((word) => {
          const progress = getWordProgress(storage, word.id);
          const wordPacks = getPackByWord(word, packs);

          return (
            <AppCard key={word.id} as="article" className="word-card">
              <PackWordRow
                media={<WordImage word={word} />}
                title={word.original}
                subtitle={`${word.translation} · ${word.transcription || 'транскрипция не указана'}`}
                action={
                  <button
                    type="button"
                    className="audio-button"
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
                    <span className="tag-badge">{word.level}</span>
                    <span className="tag-badge">{word.part_of_speech}</span>
                    {word.source === 'core' ? (
                      <span className="tag-badge">Базовый курс</span>
                    ) : word.source === 'custom' ? (
                      <span className="tag-badge">Моё слово</span>
                    ) : (
                      wordPacks.map((pack) => (
                        <span key={pack.id} className="tag-badge">
                          {pack.title}
                        </span>
                      ))
                    )}
                  </>
                }
                details={
                  <div className="example-card">
                    <p className="example-original">{word.example_original}</p>
                    <p className="example-translation">{word.example_translation}</p>
                  </div>
                }
              />
            </AppCard>
          );
        })}
      </section>
    </section>
  );
}
