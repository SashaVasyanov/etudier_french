import { useMemo, useState } from 'react';
import { KANJI_RADICALS, getKanjiRadical } from '../data/kanjiRadicals';
import { getRadicalProgress } from '../lib/storage';
import type {
  AppStorage,
  KanjiRadical,
  RadicalExerciseOutcome,
  RadicalStatus,
} from '../types';
import { AppIcon } from './AppIcon';

interface KanjiRadicalsScreenProps {
  storage: AppStorage;
  onCompleteSession: (outcomes: RadicalExerciseOutcome[]) => void;
}

type RadicalView = 'catalog' | 'detail' | 'study' | 'result';
type RadicalFilter = 'all' | 'featured' | RadicalStatus;
type RadicalQuestionType = 'meaning' | 'symbol' | 'example';

interface RadicalQuestion {
  id: string;
  radicalId: string;
  type: RadicalQuestionType;
  prompt: string;
  focus: string;
  context: string;
  correctAnswer: string;
  options: string[];
}

const FILTERS: Array<{ id: RadicalFilter; label: string }> = [
  { id: 'all', label: 'Все' },
  { id: 'featured', label: 'Основные · 31' },
  { id: 'new', label: 'Новые' },
  { id: 'learning', label: 'В работе' },
  { id: 'mastered', label: 'Освоенные' },
];

const STATUS_LABELS: Record<RadicalStatus, string> = {
  new: 'Новый',
  learning: 'В работе',
  mastered: 'Освоен',
};

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values));
}

function buildOptions(correctAnswer: string, candidates: string[], seed: number): string[] {
  const distractors = uniqueValues(candidates).filter((candidate) => candidate !== correctAnswer);
  const picked = Array.from({ length: 3 }, (_, offset) => distractors[(seed + offset * 7) % distractors.length]);
  const uniquePicked = uniqueValues(picked);

  for (const candidate of distractors) {
    if (uniquePicked.length >= 3) {
      break;
    }

    if (!uniquePicked.includes(candidate)) {
      uniquePicked.push(candidate);
    }
  }

  const options = [correctAnswer, ...uniquePicked.slice(0, 3)];
  const shift = seed % options.length;

  return options.slice(shift).concat(options.slice(0, shift));
}

function buildQuestions(radicals: KanjiRadical[]): RadicalQuestion[] {
  const meaningCandidates = KANJI_RADICALS.map((radical) => radical.meaning);
  const symbolCandidates = KANJI_RADICALS.map((radical) => radical.symbol);

  return radicals.map((radical, index) => {
    const example = radical.examples[index % radical.examples.length];
    const plannedType: RadicalQuestionType = index % 3 === 0 ? 'meaning' : index % 3 === 1 ? 'symbol' : 'example';
    const type: RadicalQuestionType = plannedType === 'example' && example.isReference ? 'symbol' : plannedType;

    if (type === 'meaning') {
      return {
        id: `${radical.id}-meaning-${index}`,
        radicalId: radical.id,
        type,
        prompt: 'Что обычно подсказывает этот ключ?',
        focus: radical.symbol,
        context: `${radical.japaneseReading} · ${radical.strokes} черт.`,
        correctAnswer: radical.meaning,
        options: buildOptions(radical.meaning, meaningCandidates, index * 5 + 2),
      };
    }

    if (type === 'symbol') {
      return {
        id: `${radical.id}-symbol-${index}`,
        radicalId: radical.id,
        type,
        prompt: `Как выглядит ключ со значением «${radical.meaning}»?`,
        focus: radical.meaning,
        context: `${radical.japaneseName} · ${radical.position}`,
        correctAnswer: radical.symbol,
        options: buildOptions(radical.symbol, symbolCandidates, index * 5 + 3),
      };
    }

    return {
      id: `${radical.id}-example-${index}`,
      radicalId: radical.id,
      type,
      prompt: 'Какой ключ является смысловой опорой этого кандзи?',
      focus: example.character,
      context: `${example.reading} · ${example.meaning}`,
      correctAnswer: radical.symbol,
      options: buildOptions(radical.symbol, symbolCandidates, index * 5 + 4),
    };
  });
}

function selectStudyRadicals(storage: AppStorage): KanjiRadical[] {
  const sorted = [...KANJI_RADICALS].sort((left, right) => {
    const leftProgress = getRadicalProgress(storage, left.id);
    const rightProgress = getRadicalProgress(storage, right.id);
    const dateDifference = (leftProgress.lastStudiedAt ?? '').localeCompare(rightProgress.lastStudiedAt ?? '');

    return dateDifference || left.strokes - right.strokes || left.id.localeCompare(right.id);
  });
  const learning = sorted.filter((radical) => getRadicalProgress(storage, radical.id).status === 'learning');
  const fresh = sorted.filter((radical) => getRadicalProgress(storage, radical.id).status === 'new');
  const mastered = sorted.filter((radical) => getRadicalProgress(storage, radical.id).status === 'mastered');
  const selected = [...learning.slice(0, 6), ...fresh.slice(0, 4)];
  const remaining = [...learning.slice(6), ...fresh.slice(4), ...mastered];

  for (const radical of remaining) {
    if (selected.length >= 10) {
      break;
    }

    if (!selected.some((item) => item.id === radical.id)) {
      selected.push(radical);
    }
  }

  return selected;
}

function getOptionClass(
  option: string,
  correctAnswer: string,
  selectedAnswer: string | null,
  isSubmitted: boolean,
): string {
  if (!isSubmitted) {
    return selectedAnswer === option ? 'radical-option selected' : 'radical-option';
  }

  if (option === correctAnswer) {
    return 'radical-option correct';
  }

  if (option === selectedAnswer) {
    return 'radical-option incorrect';
  }

  return 'radical-option muted';
}

export default function KanjiRadicalsScreen({ storage, onCompleteSession }: KanjiRadicalsScreenProps) {
  const [view, setView] = useState<RadicalView>('catalog');
  const [selectedRadicalId, setSelectedRadicalId] = useState<string | null>(null);
  const [filter, setFilter] = useState<RadicalFilter>('all');
  const [search, setSearch] = useState('');
  const [questions, setQuestions] = useState<RadicalQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [outcomes, setOutcomes] = useState<RadicalExerciseOutcome[]>([]);

  const selectedRadical = selectedRadicalId ? getKanjiRadical(selectedRadicalId) : null;
  const summary = useMemo(() => {
    const progress = KANJI_RADICALS.map((radical) => getRadicalProgress(storage, radical.id));
    const totalAttempts = progress.reduce((sum, item) => sum + item.attempts, 0);
    const totalCorrect = progress.reduce((sum, item) => sum + item.correctAnswers, 0);

    return {
      mastered: progress.filter((item) => item.status === 'mastered').length,
      learning: progress.filter((item) => item.status === 'learning').length,
      newCount: progress.filter((item) => item.status === 'new').length,
      accuracy: totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0,
    };
  }, [storage]);
  const filteredRadicals = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ru');

    return KANJI_RADICALS.filter((radical) => {
      const progress = getRadicalProgress(storage, radical.id);
      const matchesFilter = filter === 'all'
        || (filter === 'featured' ? radical.isFeatured : progress.status === filter);
      const haystack = [
        String(radical.number),
        radical.symbol,
        ...radical.variants,
        radical.meaning,
        radical.japaneseName,
        radical.japaneseReading,
        ...radical.examples.flatMap((example) => [example.character, example.reading, example.meaning]),
      ].join(' ').toLocaleLowerCase('ru');

      return matchesFilter && (!query || haystack.includes(query));
    });
  }, [filter, search, storage]);
  const currentQuestion = questions[questionIndex] ?? null;
  const currentQuestionRadical = currentQuestion ? getKanjiRadical(currentQuestion.radicalId) : null;
  const latestHistory = storage.radicalStudyHistory[storage.radicalStudyHistory.length - 1] ?? null;

  function openDetail(radicalId: string) {
    setSelectedRadicalId(radicalId);
    setView('detail');
  }

  function startStudy(radical?: KanjiRadical) {
    const studyRadicals = radical
      ? [radical, radical, radical]
      : selectStudyRadicals(storage);

    setQuestions(buildQuestions(studyRadicals));
    setQuestionIndex(0);
    setSelectedAnswer(null);
    setIsSubmitted(false);
    setOutcomes([]);
    setView('study');
  }

  function submitAnswer(answer: string) {
    if (!currentQuestion || isSubmitted) {
      return;
    }

    setSelectedAnswer(answer);
    setIsSubmitted(true);
    setOutcomes((current) => current.concat({
      radicalId: currentQuestion.radicalId,
      isCorrect: answer === currentQuestion.correctAnswer,
    }));
  }

  function goToNextQuestion() {
    if (!currentQuestion || !isSubmitted) {
      return;
    }

    if (questionIndex >= questions.length - 1) {
      onCompleteSession(outcomes);
      setView('result');
      return;
    }

    setQuestionIndex((current) => current + 1);
    setSelectedAnswer(null);
    setIsSubmitted(false);
  }

  if (view === 'study' && currentQuestion && currentQuestionRadical) {
    const isCorrect = selectedAnswer === currentQuestion.correctAnswer;

    return (
      <section className="radicals-page radical-study-page">
        <header className="radical-study-progress">
          <button type="button" className="radical-back-button" onClick={() => setView('catalog')}>
            <AppIcon name="close" size={20} /> Завершить
          </button>
          <div>
            <span>Тренировка ключей</span>
            <strong>{questionIndex + 1} из {questions.length}</strong>
          </div>
          <div className="radical-progress-track" aria-label={`Задание ${questionIndex + 1} из ${questions.length}`}>
            <span style={{ width: `${((questionIndex + 1) / questions.length) * 100}%` }} />
          </div>
        </header>

        <article className="radical-question-card">
          <span className="radical-question-kicker">
            {currentQuestion.type === 'meaning'
              ? 'Ключ → значение'
              : currentQuestion.type === 'symbol'
                ? 'Значение → ключ'
                : 'Кандзи → ключ'}
          </span>
          <h1>{currentQuestion.prompt}</h1>
          <div className={currentQuestion.type === 'meaning' ? 'radical-question-focus glyph' : 'radical-question-focus'}>
            {currentQuestion.focus}
          </div>
          <p>{currentQuestion.context}</p>

          <div className={currentQuestion.type === 'meaning' ? 'radical-options' : 'radical-options glyph-options'}>
            {currentQuestion.options.map((option) => (
              <button
                key={option}
                type="button"
                className={getOptionClass(option, currentQuestion.correctAnswer, selectedAnswer, isSubmitted)}
                disabled={isSubmitted}
                onClick={() => submitAnswer(option)}
              >
                {option}
              </button>
            ))}
          </div>

          {isSubmitted ? (
            <div className={isCorrect ? 'radical-feedback success' : 'radical-feedback error'} role="status">
              <span>{isCorrect ? <AppIcon name="check-circle" size={23} /> : <AppIcon name="close" size={23} />}</span>
              <div>
                <strong>{isCorrect ? 'Верно' : `Правильный ответ: ${currentQuestion.correctAnswer}`}</strong>
                <p>{currentQuestionRadical.description}</p>
              </div>
              <button type="button" onClick={goToNextQuestion}>
                {questionIndex >= questions.length - 1 ? 'Показать результат' : 'Дальше'}
                <AppIcon name="arrow-right" size={18} />
              </button>
            </div>
          ) : null}
        </article>
      </section>
    );
  }

  if (view === 'result') {
    const correctAnswers = outcomes.filter((outcome) => outcome.isCorrect).length;
    const accuracy = Math.round((correctAnswers / Math.max(1, outcomes.length)) * 100);

    return (
      <section className="radicals-page radical-result-page">
        <article className="radical-result-card">
          <span className="radical-result-mark"><AppIcon name="sparkles" size={32} /></span>
          <span className="radical-question-kicker">Тренировка завершена</span>
          <h1>{accuracy >= 80 ? 'Ключи становятся знакомыми' : 'Хорошее начало'}</h1>
          <p>Прогресс сохранён отдельно от уроков со словами.</p>
          <div className="radical-result-stats">
            <span><strong>{correctAnswers}</strong> верно</span>
            <span><strong>{outcomes.length - correctAnswers}</strong> ошибок</span>
            <span><strong>{accuracy}%</strong> точность</span>
          </div>
          <div className="radical-result-actions">
            <button type="button" className="radical-secondary-button" onClick={() => setView('catalog')}>К каталогу</button>
            <button type="button" className="radical-primary-button" onClick={() => startStudy()}>Ещё тренировка</button>
          </div>
        </article>
      </section>
    );
  }

  if (view === 'detail' && selectedRadical) {
    const progress = getRadicalProgress(storage, selectedRadical.id);
    const accuracy = progress.attempts > 0
      ? Math.round((progress.correctAnswers / progress.attempts) * 100)
      : 0;

    return (
      <section className="radicals-page radical-detail-page">
        <button type="button" className="radical-back-button" onClick={() => setView('catalog')}>
          <AppIcon name="arrow-left" size={19} /> Все ключи
        </button>

        <article className="radical-detail-hero">
          <div className="radical-detail-glyph" aria-label={`Ключ ${selectedRadical.symbol}`}>{selectedRadical.symbol}</div>
          <div className="radical-detail-copy">
            <div className="radical-detail-title-row">
              <div>
                <span className="radical-question-kicker">Ключ кандзи №{selectedRadical.number}</span>
                <h1>{selectedRadical.meaning}</h1>
              </div>
              <span className={`radical-status ${progress.status}`}>{STATUS_LABELS[progress.status]}</span>
            </div>
            <p>{selectedRadical.description}</p>
            <div className="radical-detail-meta">
              <span><small>Японское название</small><strong>{selectedRadical.japaneseName}</strong><em>{selectedRadical.japaneseReading}</em></span>
              <span><small>Черт</small><strong>{selectedRadical.strokes}</strong></span>
              <span><small>Позиция</small><strong>{selectedRadical.position}</strong></span>
              <span><small>Варианты</small><strong>{selectedRadical.variants.join(' · ') || '—'}</strong></span>
            </div>
          </div>
        </article>

        <div className="radical-detail-grid">
          <section className="radical-info-card">
            <span className="radical-info-icon"><AppIcon name="sparkles" size={21} /></span>
            <div>
              <h2>Как запомнить</h2>
              <p>{selectedRadical.mnemonic}</p>
            </div>
          </section>
          <section className="radical-info-card radical-progress-card">
            <span className="radical-info-icon blue"><AppIcon name="chart" size={21} /></span>
            <div>
              <h2>Личный прогресс</h2>
              <p>{progress.attempts > 0 ? `${progress.attempts} ответов · ${accuracy}% точность` : 'Ещё не было ответов по этому ключу.'}</p>
            </div>
          </section>
        </div>

        <section className="radical-examples-section">
          <div className="radical-section-heading">
            <div>
              <span className="radical-question-kicker">{selectedRadical.isFeatured ? 'В контексте' : 'Справка'}</span>
              <h2>{selectedRadical.examples.some((example) => example.isReference)
                ? 'Каноническая форма редкого ключа'
                : 'Примеры кандзи с этим ключом'}</h2>
            </div>
            <button type="button" className="radical-primary-button" onClick={() => startStudy(selectedRadical)}>
              Тренировать ключ <AppIcon name="play" size={18} />
            </button>
          </div>
          <div className="radical-example-grid">
            {selectedRadical.examples.map((example) => (
              <article key={example.character}>
                <span>{example.character}</span>
                <div>
                  <strong>{example.meaning}</strong>
                  <small>{example.reading}</small>
                  {example.isReference ? <em>Справочная форма</em> : null}
                </div>
              </article>
            ))}
          </div>
          <p className="radical-caveat">
            {selectedRadical.examples.some((example) => example.isReference)
              ? 'Этот ключ редко выступает самостоятельным знаком в современной японской письменности, поэтому показана его каноническая справочная форма.'
              : 'Ключ помогает найти кандзи в словаре и иногда намекает на область значения, но не гарантирует точный перевод или чтение.'}
          </p>
        </section>
      </section>
    );
  }

  return (
    <section className="radicals-page">
      <header className="radicals-hero">
        <div>
          <span className="radical-question-kicker">Отдельный режим · 部首</span>
          <h1>Ключи кандзи</h1>
          <p>Все 214 традиционных ключей Канси: значения, формы и примеры. Этот прогресс не смешивается с изучением слов.</p>
        </div>
        <button type="button" className="radical-primary-button" onClick={() => startStudy()}>
          Начать тренировку <AppIcon name="arrow-right" size={19} />
        </button>
      </header>

      <section className="radical-summary-grid" aria-label="Сводка по ключам кандзи">
        <article><span className="violet"><AppIcon name="grid" size={22} /></span><div><strong>{KANJI_RADICALS.length}</strong><small>ключей в наборе</small></div></article>
        <article><span className="orange"><AppIcon name="clock" size={22} /></span><div><strong>{summary.learning}</strong><small>сейчас в работе</small></div></article>
        <article><span className="green"><AppIcon name="check-circle" size={22} /></span><div><strong>{summary.mastered}</strong><small>освоено</small></div></article>
        <article><span className="blue"><AppIcon name="target" size={22} /></span><div><strong>{summary.accuracy || '—'}{summary.accuracy ? '%' : ''}</strong><small>общая точность</small></div></article>
      </section>

      <section className="radical-catalog-panel">
        <div className="radical-catalog-head">
          <div>
            <h2>Каталог ключей</h2>
            <p>214 ключей · 31 основная карточка с расширенными примерами · {summary.newCount} новых.</p>
          </div>
          <label className="radical-search">
            <span className="sr-only">Поиск ключа</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ключ, значение или кандзи"
            />
          </label>
        </div>

        <div className="radical-filters" role="group" aria-label="Фильтр ключей">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={filter === item.id ? 'active' : ''}
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {filteredRadicals.length > 0 ? (
          <div className="radical-card-grid">
            {filteredRadicals.map((radical) => {
              const progress = getRadicalProgress(storage, radical.id);

              return (
                <button key={radical.id} type="button" className="radical-card" onClick={() => openDetail(radical.id)}>
                  <span className="radical-card-number">№ {radical.number}</span>
                  <span className={`radical-status-dot ${progress.status}`} aria-label={STATUS_LABELS[progress.status]} />
                  <span className="radical-card-glyph">{radical.symbol}</span>
                  <strong>{radical.meaning}</strong>
                  <small>{radical.japaneseReading} · {radical.strokes} черт.</small>
                  <em>{radical.examples.map((example) => example.character).join(' · ')}</em>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="radical-empty-state">
            <strong>Ничего не найдено</strong>
            <p>Попробуй другой запрос или сбрось фильтр.</p>
            <button type="button" onClick={() => { setSearch(''); setFilter('all'); }}>Показать все ключи</button>
          </div>
        )}
      </section>

      {latestHistory ? (
        <p className="radical-last-session">
          Последняя тренировка: {latestHistory.correctAnswers} из {latestHistory.totalAnswers} верно · {latestHistory.radicalIds.length} ключей
        </p>
      ) : null}
    </section>
  );
}
