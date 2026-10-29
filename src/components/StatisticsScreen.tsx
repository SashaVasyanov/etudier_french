import { useMemo, useState } from 'react';
import type { AppStorage, LearningLanguage, Word, WordLevel } from '../types';
import { formatDurationLabel, getTodayDateKey, countRu, pluralRu, RU_REVIEWS, RU_WORDS } from '../lib/utils';
import { getCurrentStreakDays, getMemoryStrength, getRecentRecallRate, getReviewForecast, getWordProgress } from '../lib/storage';
import { getAnswerAccuracy, getRecentWordCounts, summarizeWordStatuses } from '../lib/studyMetrics';
import { getMemoryMilestone, isInMemory } from '../lib/milestones';
import { getPartOfSpeechLabel } from '../lib/wordPresentation';
import { getLevelOptions, getStudyLevel } from '../lib/levels';
import '../styles/statistics.css';

interface StatisticsScreenProps {
  learningLanguage: LearningLanguage;
  storage: AppStorage;
  words: Word[];
}

type ChartMode = 'ahead' | 'past';
type BreakdownMode = 'levels' | 'speech';

interface Share {
  label: string;
  value: number;
  color: string;
}

const LEVEL_LABELS: Record<WordLevel, string> = { A1: 'A1', A2: 'A2', B1: 'B1' };

const SPEECH_COLORS = Array.from({ length: 8 }, (_, index) => `var(--chart-${index + 1})`);

/** One hue for an ordered scale, by strength: faint for the first step, full
 *  accent for the last. Mixed with transparency, so it reads on light and dark glass. */
function scaleColor(index: number, count: number): string {
  return `color-mix(in srgb, var(--accent) ${Math.round(32 + (index / Math.max(1, count - 1)) * 68)}%, transparent)`;
}

function countLevels(words: Word[], language: LearningLanguage): Share[] {
  const levels = getLevelOptions(language).filter((level) => level !== 'none');
  const shares = levels.map((level, index) => ({
    label: language === 'japanese' ? `JLPT ${level}` : LEVEL_LABELS[level as WordLevel],
    value: words.filter((word) => getStudyLevel(word) === level).length,
    color: scaleColor(index, levels.length),
  }));
  const outside = words.filter((word) => getStudyLevel(word) === 'none').length;
  return outside > 0 ? [...shares, { label: 'Вне JLPT', value: outside, color: 'var(--fill-strong)' }] : shares;
}

function countSpeechTypes(words: Word[]): Share[] {
  const counts = new Map<string, number>();
  words.forEach((word) => counts.set(word.part_of_speech, (counts.get(word.part_of_speech) ?? 0) + 1));
  const sorted = [...counts.entries()].sort((left, right) => right[1] - left[1]);
  // Six named parts of speech at most; the tail goes into «другое».
  const head = sorted.slice(0, 5).map(([partOfSpeech, value], index) => ({
    label: getPartOfSpeechLabel(partOfSpeech),
    value,
    color: SPEECH_COLORS[index],
  }));
  const rest = sorted.slice(5).reduce((sum, [, value]) => sum + value, 0);
  return rest > 0 ? [...head, { label: 'другое', value: rest, color: 'var(--chart-8)' }] : head;
}

function getMonthlyLessonCounts(storage: AppStorage, language: LearningLanguage) {
  const formatter = new Intl.DateTimeFormat('ru-RU', { month: 'short' });
  const now = new Date();
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return {
      key: monthKey,
      label: formatter.format(date).replace('.', ''),
      count: storage.studyHistory.filter((entry) => entry.language === language && entry.date.startsWith(monthKey)).length,
    };
  });
}

function forecastLabel(index: number): string {
  if (index === 0) return 'Сегодня';
  if (index === 1) return 'Завтра';
  const day = new Date();
  day.setDate(day.getDate() + index);
  return day.toLocaleDateString('ru-RU', { weekday: 'short' });
}

/** Thin capsule bars on full-height tracks; the value shows only where it is not zero. */
function WeekBars({ items, label }: { items: Array<{ key: string; label: string; count: number; current: boolean }>; label: string }) {
  const max = Math.max(1, ...items.map((item) => item.count));
  return (
    <div className="stats-bars" role="img" aria-label={`${label}: ${items.map((item) => `${item.label} — ${item.count}`).join(', ')}`}>
      {items.map((item) => (
        <div key={item.key} className={item.current ? 'stats-bar current' : 'stats-bar'}>
          <span className="stats-bar-value">{item.count > 0 ? item.count : ''}</span>
          <span className="stats-bar-track">
            <span className="stats-bar-fill" style={{ height: item.count === 0 ? 0 : `${Math.max(6, (item.count / max) * 100)}%` }} />
          </span>
          <span className="stats-bar-label">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

/** One stacked bar instead of a pie: parts of a whole, read left to right. */
function ShareBar({ items, emptyText }: { items: Share[]; emptyText: string }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return <p className="stats-empty">{emptyText}</p>;
  const visible = items.filter((item) => item.value > 0);
  return (
    <>
      <div className="stats-share-bar" role="img" aria-label={visible.map((item) => `${item.label} — ${item.value}`).join(', ')}>
        {visible.map((item) => (
          <span key={item.label} style={{ flexGrow: item.value, background: item.color }} />
        ))}
      </div>
      <ul className="stats-legend">
        {visible.map((item) => (
          <li key={item.label}>
            <strong>{item.value}</strong>
            <span><i style={{ background: item.color }} aria-hidden="true" />{item.label}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="stats-segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          className={value === option.value ? 'active' : undefined}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default function StatisticsScreen({ learningLanguage, storage, words }: StatisticsScreenProps) {
  const [chartMode, setChartMode] = useState<ChartMode>('ahead');
  const [breakdownMode, setBreakdownMode] = useState<BreakdownMode>('levels');
  const [showDetails, setShowDetails] = useState(false);

  const progressList = useMemo(() => words.map((word) => getWordProgress(storage, word.id)), [storage, words]);
  const inMemoryWords = useMemo(
    () => words.filter((word) => isInMemory(storage.progressByWordId[word.id])).length,
    [storage.progressByWordId, words],
  );
  const learnedWordList = useMemo(
    () => words.filter((word) => {
      const status = storage.progressByWordId[word.id]?.status;
      return status === 'mastered' || status === 'known';
    }),
    [storage.progressByWordId, words],
  );
  const wordStats = useMemo(() => summarizeWordStatuses(progressList), [progressList]);
  const forecast = useMemo(() => getReviewForecast(progressList), [progressList]);
  const strength = useMemo(() => getMemoryStrength(progressList), [progressList]);
  const breakdown = useMemo(
    () => (breakdownMode === 'levels' ? countLevels(learnedWordList, learningLanguage) : countSpeechTypes(learnedWordList)),
    [breakdownMode, learnedWordList, learningLanguage],
  );
  const monthly = useMemo(() => getMonthlyLessonCounts(storage, learningLanguage), [learningLanguage, storage]);

  const languageHistory = storage.studyHistory.filter((entry) => entry.language === learningLanguage);
  const recallRate = getRecentRecallRate(storage.memoryCalibration?.[learningLanguage]);
  const streak = getCurrentStreakDays(storage);
  const { totalAnswers, accuracy } = getAnswerAccuracy(storage.dailyStats, learningLanguage);
  const studySeconds = languageHistory.reduce((sum, item) => sum + item.timeSpentSeconds, 0);
  const completedLessons = Math.max(storage.lessonTotals[learningLanguage], languageHistory.length);
  const milestone = getMemoryMilestone(inMemoryWords);

  const forecastTotal = forecast.reduce((sum, count) => sum + count, 0);
  const pastWeek = getRecentWordCounts(storage.dailyStats, learningLanguage);
  const pastTotal = pastWeek.reduce((sum, item) => sum + item.count, 0);
  const today = getTodayDateKey();
  const chartItems = chartMode === 'ahead'
    ? forecast.map((count, index) => ({ key: `d${index}`, label: forecastLabel(index), count, current: index === 0 }))
    : pastWeek.map((item) => ({ ...item, current: item.key === today }));
  const chartTotal = chartMode === 'ahead' ? forecastTotal : pastTotal;
  const chartSummary = chartMode === 'ahead'
    ? forecastTotal > 0
      ? `Сегодня ${countRu(forecast[0], RU_REVIEWS)}, за неделю — ${forecastTotal}`
      : 'Повторений на неделе нет'
    : pastTotal > 0
      ? `За неделю выучено ${countRu(pastTotal, RU_WORDS)}`
      : 'На этой неделе новых слов пока нет';
  const strengthShares: Share[] = [
    { label: 'меньше недели', value: strength.fresh },
    { label: 'до месяца', value: strength.weeks },
    { label: 'до трёх месяцев', value: strength.months },
    { label: 'дольше', value: strength.long },
  ].map((item, index) => ({ ...item, color: scaleColor(index, 4) }));
  const monthlyMax = Math.max(1, ...monthly.map((item) => item.count));

  return (
    <section className="stats-page">
      <div className="stats-ambient" aria-hidden="true" />

      <header className="stats-head">
        <h1>Прогресс</h1>
        <p>{learningLanguage === 'japanese' ? 'Японский' : 'Французский'} · {countRu(words.length, RU_WORDS)} в словаре</p>
      </header>

      <section className="stats-glass stats-hero" aria-label="Главное">
        <div className="stats-hero-main">
          <span className="stats-caption">В памяти</span>
          <strong className="stats-number-xl">{inMemoryWords}</strong>
          <span className="stats-hero-sub">
            {milestone.next !== null
              ? `до ${milestone.next} — ещё ${countRu(milestone.next - inMemoryWords, RU_WORDS)}`
              : pluralRu(inMemoryWords, ['слово', 'слова', 'слов'])}
          </span>
          {milestone.next !== null ? (
            <span className="stats-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(milestone.progress * 100)} aria-label="До следующей отметки">
              <span style={{ width: `${Math.max(2, milestone.progress * 100)}%` }} />
            </span>
          ) : null}
        </div>
        <dl className="stats-hero-side">
          <div>
            <dt>Точность</dt>
            <dd>{totalAnswers > 0 ? `${accuracy}%` : '—'}</dd>
          </div>
          <div>
            <dt>Серия</dt>
            <dd>{streak} <small>{pluralRu(streak, ['день', 'дня', 'дней'])}</small></dd>
          </div>
          <div>
            <dt>Время</dt>
            <dd>{formatDurationLabel(studySeconds)}</dd>
          </div>
        </dl>
      </section>

      <section className="stats-glass stats-chart-card" aria-label="Неделя">
        <div className="stats-card-head">
          <div>
            <h2>{chartMode === 'ahead' ? 'Повторения' : 'Новые слова'}</h2>
            <p>{chartSummary}</p>
          </div>
          <Segmented
            label="Какую неделю показать"
            value={chartMode}
            onChange={setChartMode}
            options={[{ value: 'ahead', label: 'Впереди' }, { value: 'past', label: 'Позади' }]}
          />
        </div>
        <WeekBars items={chartItems} label={chartMode === 'ahead' ? 'Повторения по дням' : 'Выучено по дням'} />
        {chartTotal === 0 && chartMode === 'past' ? <p className="stats-empty stats-chart-empty">Пройдите урок — здесь появится неделя</p> : null}
      </section>

      <button
        type="button"
        className="stats-more"
        aria-expanded={showDetails}
        aria-controls="stats-details"
        onClick={() => setShowDetails((open) => !open)}
      >
        {showDetails ? 'Скрыть подробности' : 'Подробнее'}
        <span className={showDetails ? 'stats-chevron open' : 'stats-chevron'} aria-hidden="true" />
      </button>

      {showDetails ? (
        <div id="stats-details" className="stats-details">
          <section className="stats-glass stats-detail-card">
            <div className="stats-card-head">
              <div>
                <h2>Сколько держится в памяти</h2>
                <p>
                  {recallRate !== null
                    ? `На повторениях вспоминаете ${Math.round(recallRate * 100)}%`
                    : 'Срок, через который слово начнёт забываться'}
                </p>
              </div>
            </div>
            <ShareBar items={strengthShares} emptyText="Появится после первых повторений." />
          </section>

          <section className="stats-glass stats-detail-card">
            <div className="stats-card-head">
              <div>
                <h2>Освоенные слова</h2>
                <p>
                  {countRu(learnedWordList.length, RU_WORDS)}
                  {wordStats.inProgress > 0 ? ` · в работе ${wordStats.inProgress}` : ''}
                  {wordStats.difficult > 0 ? ` · сложных ${wordStats.difficult}` : ''}
                </p>
              </div>
              <Segmented
                label="Разбивка освоенных слов"
                value={breakdownMode}
                onChange={setBreakdownMode}
                options={[{ value: 'levels', label: 'Уровни' }, { value: 'speech', label: 'Части речи' }]}
              />
            </div>
            <ShareBar items={breakdown} emptyText="Появится, когда первые слова будут освоены." />
          </section>

          <section className="stats-glass stats-detail-card stats-detail-wide">
            <div className="stats-card-head">
              <div>
                <h2>Уроки за год</h2>
                <p>{completedLessons} {pluralRu(completedLessons, ['урок', 'урока', 'уроков'])} всего</p>
              </div>
            </div>
            <div className="stats-months" role="img" aria-label={monthly.map((item) => `${item.label} — ${item.count}`).join(', ')}>
              {monthly.map((item) => (
                <div key={item.key} className="stats-month">
                  <span className="stats-month-track">
                    <span style={{ height: item.count === 0 ? 0 : `${Math.max(8, (item.count / monthlyMax) * 100)}%` }} />
                  </span>
                  <small>{item.label}</small>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
