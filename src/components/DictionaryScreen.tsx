import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { countRu, getSearchRank, normalizeSearchText, parseClipboardWord, RU_WORDS } from '../lib/utils';
import { playWordAudio } from '../lib/audio';
import { getLearningLanguageLocale, getLearningLanguageTitle } from '../lib/languages';
import { getPackByWord } from '../lib/packs';
import { getDisplayWord, getPartOfSpeechLabel } from '../lib/wordPresentation';
import { getWordProgress } from '../lib/storage';
import type { AppStorage, DictionaryTab, LearningLanguage, Word, WordLevel, WordPack } from '../types';
import { getLevelOptions, getStudyLevel, getStudyLevelLabel, getWordLevelLabel, type StudyLevel } from '../lib/levels';
import { AppCard } from './AppCard';
import { AppIcon } from './AppIcon';
import { PackWordRow } from './PackWordRow';
import { StatusBadge } from './StatusBadge';
import { WordDetailsPanel } from './WordDetailsPanel';
import { WordImage } from './WordImage';
import { formatTranscription } from '../lib/readingPrefs';

interface DictionaryScreenProps {
  learningLanguage: LearningLanguage;
  words: Word[];
  storage: AppStorage;
  packs: WordPack[];
  onMarkWordKnown: (wordId: string) => boolean;
  onRestoreWord: (wordId: string) => void;
  onAddWord: (word: Omit<Word, 'id' | 'language' | 'audio_original' | 'packIds' | 'source'>) => boolean;
}

type DictionaryFilterTab = DictionaryTab | 'known' | 'excluded';

const TABS: Array<{ id: DictionaryFilterTab; label: string }> = [
  { id: 'all', label: 'Все слова' },
  { id: 'learning', label: 'Изучаемые' },
  { id: 'known', label: 'Известные' },
  { id: 'mastered', label: 'Выученные' },
  { id: 'difficult', label: 'Сложные' },
  { id: 'excluded', label: 'Исключённые' },
];
const INITIAL_VISIBLE_WORDS = 40;
const VISIBLE_WORDS_STEP = 80;

export default function DictionaryScreen({ learningLanguage, words, storage, packs, onMarkWordKnown, onRestoreWord, onAddWord }: DictionaryScreenProps) {
  const [tab, setTab] = useState<DictionaryFilterTab>('all');
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<'all' | StudyLevel>('all');
  const [packFilter, setPackFilter] = useState<'all' | 'core' | string>('all');
  const [visibleWordCount, setVisibleWordCount] = useState(INITIAL_VISIBLE_WORDS);
  // Cards are compact by default; details (meaning, context, image source)
  // open per word, so a screen shows a dozen words instead of two.
  const [expandedWordIds, setExpandedWordIds] = useState<ReadonlySet<string>>(() => new Set());
  const toggleExpanded = (wordId: string) => setExpandedWordIds((current) => {
    const next = new Set(current);
    if (next.has(wordId)) next.delete(wordId);
    else next.add(wordId);
    return next;
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [clipboardNotice, setClipboardNotice] = useState<string | null>(null);
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
  // Search ignores case, accents and ё (ecole finds école); the word and its
  // translation are matched first, examples and tags after.
  const searchIndexByWordId = useMemo(
    () =>
      new Map(
        words.map((word) => [
          word.id,
          {
            primary: normalizeSearchText([word.original, word.translation, word.transcription].join(' | ')),
            secondary: normalizeSearchText([word.example_original, word.example_translation, ...word.tags].join(' | ')),
          },
        ]),
      ),
    [words],
  );

  const activePackOptions = useMemo(
    () => packs.filter((pack) => storage.packStates[pack.id]?.status && storage.packStates[pack.id]?.status !== 'not_added'),
    [packs, storage.packStates],
  );

  const filteredWords = useMemo(() => {
    const normalizedQuery = normalizeSearchText(deferredQuery.trim());
    const rank = new Map<string, number>();

    const matches = words.filter((word) => {
      const status = storage.progressByWordId[word.id]?.status ?? 'new';
      const matchesTab =
        tab === 'all'
          ? true
          : tab === 'learning'
            ? status === 'learning' || status === 'review'
            : tab === 'known'
              ? status === 'known'
              : tab === 'mastered'
                ? status === 'mastered'
                : tab === 'excluded'
                  ? status === 'ignored'
                  : status === 'difficult';
      const matchesLevel = level === 'all' ? true : getStudyLevel(word) === level;
      const matchesPack =
        packFilter === 'all' ? true : packFilter === 'core' ? word.source === 'core' : word.packIds.includes(packFilter);
      let matchesQuery = normalizedQuery.length === 0;
      if (!matchesQuery) {
        const entry = searchIndexByWordId.get(word.id);
        const score = entry ? getSearchRank(entry, normalizedQuery) : null;
        matchesQuery = score !== null;
        if (score !== null) rank.set(word.id, score);
      }

      return matchesTab && matchesLevel && matchesPack && matchesQuery;
    });
    return normalizedQuery.length === 0
      ? matches
      : matches
          .map((word, index) => ({ word, index }))
          .sort((left, right) => (rank.get(left.word.id) ?? 9) - (rank.get(right.word.id) ?? 9) || left.index - right.index)
          .map(({ word }) => word);
  }, [deferredQuery, level, packFilter, searchIndexByWordId, storage.progressByWordId, tab, words]);
  const visibleWords = useMemo(
    () => filteredWords.slice(0, visibleWordCount),
    [filteredWords, visibleWordCount],
  );

  useEffect(() => {
    setVisibleWordCount(INITIAL_VISIBLE_WORDS);
  }, [deferredQuery, level, packFilter, tab]);

  function resetFilters() {
    setQuery('');
    setLevel('all');
    setPackFilter('all');
    setTab('all');
  }

  function resetNewWordForm() {
    setFormError(null);
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

  // «bonjour — привет» copied anywhere becomes a filled-in form; a word that
  // is already in the dictionary is shown instead of being added twice.
  async function addFromClipboard() {
    let text = '';
    try {
      text = await navigator.clipboard.readText();
    } catch {
      text = '';
    }
    const parsed = parseClipboardWord(text);
    if (!parsed) {
      setClipboardNotice('В буфере обмена нет текста. Скопируйте слово (можно с переводом через тире) и нажмите ещё раз.');
      return;
    }
    const key = normalizeSearchText(parsed.original);
    const existing = words.find((word) => normalizeSearchText(word.original) === key);
    if (existing) {
      setTab('all');
      setLevel('all');
      setPackFilter('all');
      setQuery(existing.original);
      setShowAddForm(false);
      setClipboardNotice(`«${existing.original}» уже есть в словаре — вот оно.`);
      return;
    }
    setNewWord((current) => ({ ...current, original: parsed.original, translation: parsed.translation || current.translation }));
    setFormError(null);
    setShowAddForm(true);
    setClipboardNotice(parsed.translation ? 'Слово и перевод вставлены — проверьте и добавьте.' : 'Слово вставлено — допишите перевод.');
  }

  return (
    <section className="dashboard-shell">
      <AppCard as="header" tone="hero" className="dictionary-hero">
        <div className="section-heading">
          <div>
            <h1 className="hero-title compact-title">Словарь</h1>
          </div>
          <div className="dictionary-hero-actions">
            <button type="button" className="secondary-button" onClick={() => void addFromClipboard()}>
              Из буфера обмена
            </button>
            <button type="button" className="primary-button" onClick={() => { setShowAddForm((current) => !current); setClipboardNotice(null); }}>
              {showAddForm ? 'Скрыть форму' : 'Добавить слово'}
            </button>
          </div>
        </div>

        {clipboardNotice ? <p className="form-inline-message dictionary-clipboard-notice" role="status">{clipboardNotice}</p> : null}

        {showAddForm ? (
          <form
            className="custom-word-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!newWord.original.trim() || !newWord.translation.trim()) {
                setFormError('Введите слово и перевод: одних пробелов недостаточно.');
                return;
              }
              const added = onAddWord({
                original: newWord.original.trim(),
                translation: newWord.translation.trim(),
                transcription: newWord.transcription.trim(),
                example_original: newWord.example_original.trim() || newWord.original.trim(),
                example_translation: newWord.example_translation.trim() || newWord.translation.trim(),
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
              if (!added) {
                setFormError('Не удалось добавить слово. Проверьте данные и попробуйте ещё раз.');
                return;
              }
              resetNewWordForm();
              setShowAddForm(false);
              setClipboardNotice(null);
            }}
          >
            {formError ? <p className="form-inline-message" role="alert">{formError}</p> : null}
            <label className="form-field">
              <span>Слово</span>
              <input
                className="text-input"
                value={newWord.original}
                maxLength={240}
                placeholder={learningLanguage === 'french' ? 'Например, bonjour' : 'Например, こんにちは'}
                aria-label={learningLanguage === 'french' ? 'Французское слово' : 'Японское слово'}
                required
                onChange={(event) => setNewWord((current) => ({ ...current, original: event.target.value }))}
              />
            </label>
            <label className="form-field">
              <span>Перевод</span>
              <input
                className="text-input"
                value={newWord.translation}
                maxLength={400}
                placeholder="Например, привет"
                aria-label="Перевод"
                required
                onChange={(event) => setNewWord((current) => ({ ...current, translation: event.target.value }))}
              />
            </label>
            <label className="form-field">
              <span>Транскрипция</span>
              <input
                className="text-input"
                value={newWord.transcription}
                maxLength={240}
                placeholder="Например, [bɔ̃ʒuʁ]"
                aria-label="Транскрипция"
                onChange={(event) => setNewWord((current) => ({ ...current, transcription: event.target.value }))}
              />
            </label>
            <label className="form-field">
              <span>Пример</span>
              <input
                className="text-input"
                value={newWord.example_original}
                maxLength={1000}
                placeholder={learningLanguage === 'french' ? 'Например, Bonjour !' : 'Например, こんにちは。'}
                aria-label={learningLanguage === 'french' ? 'Пример на французском' : 'Пример на японском'}
                onChange={(event) => setNewWord((current) => ({ ...current, example_original: event.target.value }))}
              />
            </label>
            <label className="form-field">
              <span>Перевод примера</span>
              <input
                className="text-input"
                value={newWord.example_translation}
                maxLength={1000}
                placeholder="Например, приветствие"
                aria-label="Перевод примера"
                onChange={(event) => setNewWord((current) => ({ ...current, example_translation: event.target.value }))}
              />
            </label>
            <label className="form-field">
              <span>Часть речи</span>
              <input
                className="text-input"
                value={newWord.part_of_speech}
                maxLength={80}
                placeholder="Например, существительное"
                aria-label="Часть речи"
                onChange={(event) => setNewWord((current) => ({ ...current, part_of_speech: event.target.value }))}
              />
            </label>
            {/* JLPT levels come from the official lists, so own Japanese words have none. */}
            {learningLanguage === 'french' ? (
              <label className="form-field">
                <span>Уровень</span>
                <select
                  className="level-select"
                  aria-label="Уровень слова"
                  value={newWord.level}
                  onChange={(event) => setNewWord((current) => ({ ...current, level: event.target.value as WordLevel }))}
                >
                  <option value="A1">A1</option>
                  <option value="A2">A2</option>
                  <option value="B1">B1</option>
                </select>
              </label>
            ) : null}
            <label className="form-field">
              <span>Теги</span>
              <input
                className="text-input"
                value={newWord.tags}
                maxLength={500}
                placeholder="Теги через запятую"
                onChange={(event) => setNewWord((current) => ({ ...current, tags: event.target.value }))}
              />
            </label>
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
            placeholder={learningLanguage === 'french' ? 'Например, bonjour или перевод' : 'Например, こんにちは или перевод'}
            aria-label={`Поиск по слову на ${languageTitle}, переводу или тегам`}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select className="level-select" aria-label="Уровень слов" value={level} onChange={(event) => setLevel(event.target.value as 'all' | StudyLevel)}>
            <option value="all">Все уровни</option>
            {getLevelOptions(learningLanguage).map((option) => (
              <option key={option} value={option}>{getStudyLevelLabel(option)}</option>
            ))}
          </select>
          <select className="level-select" aria-label="Источник слов" value={packFilter} onChange={(event) => setPackFilter(event.target.value)}>
            <option value="all">Все активные паки</option>
            <option value="core">Базовый курс</option>
            {activePackOptions.map((pack) => (
              <option key={pack.id} value={pack.id}>
                {pack.title}
              </option>
            ))}
          </select>
        </div>

        <div className="tab-row tab-row-wide" role="group" aria-label="Статус слов">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === tab ? 'tab-button active' : 'tab-button'}
              aria-pressed={item.id === tab}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="dictionary-summary">
          <span>Найдено: {countRu(filteredWords.length, RU_WORDS)}</span>
        </div>
      </AppCard>

      <section className="dictionary-grid" aria-live="polite">
        {filteredWords.length === 0 ? (
          <div className="contextual-empty-state">
            <h2>Ничего не найдено</h2>
            <p>По текущему поиску и фильтрам нет карточек. Найдено: 0.</p>
            <div className="contextual-empty-actions">
              {query ? <button type="button" className="ghost-button" onClick={() => setQuery('')}>Очистить поиск</button> : null}
              <button type="button" className="secondary-button" onClick={resetFilters}>Сбросить фильтры</button>
            </div>
          </div>
        ) : visibleWords.map((word) => {
          const progress = getWordProgress(storage, word.id);
          const wordPacks = getPackByWord(word, packs);
          const expanded = expandedWordIds.has(word.id);

          return (
            <AppCard key={word.id} as="article" className={expanded ? 'word-card expanded' : 'word-card compact'}>
              <PackWordRow
                media={<WordImage word={word} />}
                title={getDisplayWord(word)}
                titleLang={getLearningLanguageLocale(word.language)}
                subtitle={`${word.translation} · ${formatTranscription(word.transcription, word.language) || 'транскрипция не указана'} · ${getPartOfSpeechLabel(word.part_of_speech)}`}
                action={
                  <div className="word-card-actions">
                    <button
                      type="button"
                      className="audio-button icon-button"
                      title="Прослушать"
                      aria-label={`Прослушать слово ${getDisplayWord(word)}`}
                      onClick={() => {
                        void playWordAudio(word);
                      }}
                    >
                      <AppIcon name="volume" size={18} />
                    </button>
                    <button
                      type="button"
                      className="ghost-button word-details-toggle"
                      aria-expanded={expanded}
                      onClick={() => toggleExpanded(word.id)}
                    >
                      {expanded ? 'Свернуть' : 'Подробнее'}
                    </button>
                    {progress.status === 'known' || progress.status === 'ignored' ? (
                      <button
                        type="button"
                        className="secondary-button word-known-button"
                        aria-label={`Вернуть ${getDisplayWord(word)} в изучение`}
                        onClick={() => onRestoreWord(word.id)}
                      >
                        Вернуть в изучение
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="secondary-button word-known-button"
                        aria-label={`Отметить ${getDisplayWord(word)} как уже известное`}
                        onClick={() => onMarkWordKnown(word.id)}
                      >
                        Уже знаю
                      </button>
                    )}
                  </div>
                }
                badges={
                  <>
                    <StatusBadge status={progress.status} />
                    <span className="tag-badge">{getWordLevelLabel(word)}</span>
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
                details={expanded ? <WordDetailsPanel word={word} progress={progress} /> : undefined}
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
          Показать ещё {countRu(Math.min(VISIBLE_WORDS_STEP, filteredWords.length - visibleWords.length), RU_WORDS)}
        </button>
      ) : null}
    </section>
  );
}
