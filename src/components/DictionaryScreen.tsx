import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { playWordAudio } from '../lib/audio';
import { getLearningLanguageTitle } from '../lib/languages';
import { getPackByWord } from '../lib/packs';
import { getDisplayWord, getPartOfSpeechLabel } from '../lib/wordPresentation';
import { getWordProgress } from '../lib/storage';
import type { AppStorage, DictionaryTab, LearningLanguage, Word, WordLevel, WordPack } from '../types';
import { AppCard } from './AppCard';
import { PackWordRow } from './PackWordRow';
import { StatusBadge } from './StatusBadge';
import { WordDetailsPanel } from './WordDetailsPanel';
import { WordImage } from './WordImage';

interface DictionaryScreenProps {
  learningLanguage: LearningLanguage;
  words: Word[];
  storage: AppStorage;
  packs: WordPack[];
  onAddWord: (word: Omit<Word, 'id' | 'language' | 'audio_original' | 'packIds' | 'source'>) => void;
}

const TABS: Array<{ id: DictionaryTab; label: string }> = [
  { id: 'all', label: 'Все слова' },
  { id: 'learning', label: 'Изучаемые' },
  { id: 'mastered', label: 'Выученные' },
  { id: 'difficult', label: 'Сложные' },
];
const INITIAL_VISIBLE_WORDS = 80;
const VISIBLE_WORDS_STEP = 80;

export default function DictionaryScreen({ learningLanguage, words, storage, packs, onAddWord }: DictionaryScreenProps) {
  const [tab, setTab] = useState<DictionaryTab>('all');
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<'all' | WordLevel>('all');
  const [packFilter, setPackFilter] = useState<'all' | 'core' | string>('all');
  const [visibleWordCount, setVisibleWordCount] = useState(INITIAL_VISIBLE_WORDS);
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
  const languageTitle = getLearningLanguageTitle(learningLanguage);
  const searchIndexByWordId = useMemo(
    () =>
      new Map(
        words.map((word) => [
          word.id,
          [word.original, word.translation, word.example_original, ...word.tags].join(' ').toLocaleLowerCase(),
        ]),
      ),
    [words],
  );

  const activePackOptions = useMemo(
    () => packs.filter((pack) => storage.packStates[pack.id]?.status && storage.packStates[pack.id]?.status !== 'not_added'),
    [packs, storage.packStates],
  );

  const filteredWords = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLocaleLowerCase();

    return words.filter((word) => {
      const status = storage.progressByWordId[word.id]?.status ?? 'new';
      const matchesTab =
        tab === 'all'
          ? true
          : tab === 'learning'
            ? status === 'learning' || status === 'review'
            : tab === 'mastered'
              ? status === 'mastered'
              : status === 'difficult';
      const matchesLevel = level === 'all' ? true : word.level === level;
      const matchesPack =
        packFilter === 'all' ? true : packFilter === 'core' ? word.source === 'core' : word.packIds.includes(packFilter);
      const matchesQuery =
        normalizedQuery.length === 0
          ? true
          : searchIndexByWordId.get(word.id)?.includes(normalizedQuery) ?? false;

      return matchesTab && matchesLevel && matchesPack && matchesQuery;
    });
  }, [deferredQuery, level, packFilter, searchIndexByWordId, storage.progressByWordId, tab, words]);
  const visibleWords = useMemo(
    () => filteredWords.slice(0, visibleWordCount),
    [filteredWords, visibleWordCount],
  );

  useEffect(() => {
    setVisibleWordCount(INITIAL_VISIBLE_WORDS);
  }, [deferredQuery, level, packFilter, tab]);

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
            <h1 className="hero-title compact-title">Слова, контекст и подсказки по употреблению</h1>
          </div>
          <div className="dictionary-hero-actions">
            <button type="button" className="primary-button" onClick={() => setShowAddForm((current) => !current)}>
              {showAddForm ? 'Скрыть форму' : 'Добавить слово'}
            </button>
            <p className="hero-text">Ищите по слову и переводу, слушайте произношение, смотрите контекст и быстро разбирайте, как слово используется в речи.</p>
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
              maxLength={240}
              placeholder={learningLanguage === 'french' ? 'Французское слово' : 'Японское слово'}
              required
              onChange={(event) => setNewWord((current) => ({ ...current, original: event.target.value }))}
            />
            <input
              className="text-input"
              value={newWord.translation}
              maxLength={400}
              placeholder="Перевод"
              required
              onChange={(event) => setNewWord((current) => ({ ...current, translation: event.target.value }))}
            />
            <input
              className="text-input"
              value={newWord.transcription}
              maxLength={240}
              placeholder="Транскрипция"
              onChange={(event) => setNewWord((current) => ({ ...current, transcription: event.target.value }))}
            />
            <input
              className="text-input"
              value={newWord.example_original}
              maxLength={1000}
              placeholder={learningLanguage === 'french' ? 'Пример на французском' : 'Пример на японском'}
              onChange={(event) => setNewWord((current) => ({ ...current, example_original: event.target.value }))}
            />
            <input
              className="text-input"
              value={newWord.example_translation}
              maxLength={1000}
              placeholder="Перевод примера"
              onChange={(event) => setNewWord((current) => ({ ...current, example_translation: event.target.value }))}
            />
            <input
              className="text-input"
              value={newWord.part_of_speech}
              maxLength={80}
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
              maxLength={500}
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
            placeholder={`Поиск по слову на ${languageTitle}, переводу или тегам`}
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
        {visibleWords.map((word) => {
          const progress = getWordProgress(storage, word.id);
          const wordPacks = getPackByWord(word, packs);

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
                  <WordDetailsPanel word={word} />
                }
              />
            </AppCard>
          );
        })}
      </section>
      {visibleWords.length < filteredWords.length ? (
        <button
          type="button"
          className="secondary-button dictionary-load-more"
          onClick={() => setVisibleWordCount((count) => Math.min(count + VISIBLE_WORDS_STEP, filteredWords.length))}
        >
          Показать ещё {Math.min(VISIBLE_WORDS_STEP, filteredWords.length - visibleWords.length)} слов
        </button>
      ) : null}
    </section>
  );
}
