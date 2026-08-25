import { useMemo, useState } from 'react';
import type { AppStorage, LearningLanguage, Word, WordLevel } from '../types';
import { formatDurationLabel, getTodayDateKey, percentage } from '../lib/utils';
import { getPartOfSpeechLabel } from '../lib/wordPresentation';
import { AppIcon } from './AppIcon';

interface StatisticsScreenProps {
  learningLanguage: LearningLanguage;
  storage: AppStorage;
  words: Word[];
}

type DiagramMode = 'levels' | 'speech';

const LEVEL_COLORS: Record<WordLevel, string> = {
  A1: '#049d41',
  A2: '#1a8ce2',
  B1: '#f97316',
};

const LEVEL_LABELS: Record<WordLevel, string> = {
  A1: 'Beginner · A1',
  A2: 'Elementary · A2',
  B1: 'Intermediate · B1',
};

const SPEECH_COLORS = ['#049d41', '#1a8ce2', '#f97316', '#e11d48', '#7c3aed', '#0f766e', '#ca8a04', '#475569'];
const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function polarToCartesian(center: number, radius: number, angleInDegrees: number): { x: number; y: number } {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;

  return {
    x: center + radius * Math.cos(angleInRadians),
    y: center + radius * Math.sin(angleInRadians),
  };
}

function describePieSlice(startAngle: number, endAngle: number, radius: number): string {
  const start = polarToCartesian(21, radius, endAngle);
  const end = polarToCartesian(21, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;

  return [`M 21 21`, `L ${start.x.toFixed(3)} ${start.y.toFixed(3)}`, `A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`, 'Z'].join(' ');
}

function describeFullPie(radius: number): string {
  return `M 21 21 L 21 ${21 - radius} A ${radius} ${radius} 0 1 1 21 ${21 + radius} A ${radius} ${radius} 0 1 1 21 ${21 - radius} Z`;
}

function buildDiagramSegments(items: Array<{ value: number; color: string }>): Array<{
  color: string;
  path: string;
}> {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const visibleItems = items.filter((item) => item.value > 0);

  if (total <= 0 || visibleItems.length === 0) {
    return [{ color: '#e2e4e9', path: describeFullPie(20) }];
  }

  if (visibleItems.length === 1) {
    return [{ color: visibleItems[0].color, path: describeFullPie(20) }];
  }

  let cursor = 0;

  return visibleItems.map((item) => {
    const share = (item.value / total) * 360;
    const segment = {
      color: item.color,
      path: describePieSlice(cursor, Math.max(cursor + 0.01, cursor + share), 20),
    };

    cursor += share;
    return segment;
  });
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getRecentWordCounts(storage: AppStorage, learningLanguage: LearningLanguage): Array<{ key: string; label: string; count: number }> {
  const now = new Date();

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (6 - index));
    const key = toDateKey(date);
    const daily = storage.dailyStats.find((entry) => entry.language === learningLanguage && entry.date === key);

    return {
      key,
      label: WEEKDAY_LABELS[index] ?? '',
      count: daily?.wordsLearned ?? 0,
    };
  });
}

function getMonthlyLessonCounts(storage: AppStorage, learningLanguage: LearningLanguage): Array<{ key: string; label: string; count: number }> {
  const formatter = new Intl.DateTimeFormat('ru-RU', { month: 'short', year: '2-digit' });
  const now = new Date();

  return Array.from({ length: 18 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (17 - index), 1);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const count = storage.studyHistory.filter(
      (entry) => entry.language === learningLanguage && entry.date.startsWith(monthKey),
    ).length;

    return {
      key: monthKey,
      label: formatter.format(date),
      count,
    };
  });
}

function countLevels(words: Word[]): Array<{ label: string; value: number; color: string }> {
  const levels: WordLevel[] = ['A1', 'A2', 'B1'];

  return levels.map((level) => ({
    label: LEVEL_LABELS[level],
    value: words.filter((word) => word.level === level).length,
    color: LEVEL_COLORS[level],
  }));
}

function countSpeechTypes(words: Word[]): Array<{ label: string; value: number; color: string }> {
  const counts = new Map<string, number>();

  words.forEach((word) => {
    counts.set(word.part_of_speech, (counts.get(word.part_of_speech) ?? 0) + 1);
  });

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([partOfSpeech, value], index) => ({
      label: getPartOfSpeechLabel(partOfSpeech),
      value,
      color: SPEECH_COLORS[index % SPEECH_COLORS.length] ?? '#475569',
    }));
}

export default function StatisticsScreen({ learningLanguage, storage, words }: StatisticsScreenProps) {
  const [diagramMode, setDiagramMode] = useState<DiagramMode>('levels');
  const languageHistory = useMemo(
    () => storage.studyHistory.filter((entry) => entry.language === learningLanguage),
    [learningLanguage, storage.studyHistory],
  );
  const learnedWordList = useMemo(
    () =>
      words.filter((word) => {
        const status = storage.progressByWordId[word.id]?.status;
        return status === 'mastered' || status === 'known';
      }),
    [storage.progressByWordId, words],
  );
  const learnedWords = learnedWordList.length;
  const wordsInProcess = Math.max(0, words.length - learnedWords);
  const currentStreak = storage.lastLessonDate === getTodayDateKey() ? storage.streakDays : 0;
  const correctAnswers = languageHistory.reduce((sum, item) => sum + item.correctAnswers, 0);
  const totalAnswers = languageHistory.reduce((sum, item) => sum + item.totalAnswers, 0);
  const accuracy = percentage(correctAnswers, totalAnswers);
  const studyTimeSeconds = languageHistory.reduce((sum, item) => sum + item.timeSpentSeconds, 0);
  const weeklyWords = useMemo(() => getRecentWordCounts(storage, learningLanguage), [learningLanguage, storage]);
  const monthlyLessons = useMemo(() => getMonthlyLessonCounts(storage, learningLanguage), [learningLanguage, storage]);
  const diagramItems = useMemo(
    () => (diagramMode === 'levels' ? countLevels(learnedWordList) : countSpeechTypes(learnedWordList)),
    [diagramMode, learnedWordList],
  );
  const maxWeeklyCount = Math.max(1, ...weeklyWords.map((item) => item.count));
  const maxMonthlyCount = Math.max(1, ...monthlyLessons.map((item) => item.count));
  const diagramSegments = useMemo(() => buildDiagramSegments(diagramItems), [diagramItems]);
  const breakdownTotal = Math.max(1, diagramItems.reduce((sum, item) => sum + item.value, 0));
  const weeklyTotal = weeklyWords.reduce((sum, item) => sum + item.count, 0);
  const completedLessons = languageHistory.length;
  const hasDiagramData = diagramItems.some((item) => item.value > 0);

  return (
    <section className="analytics-page">
      <header className="analytics-head">
        <div>
          <span className="dashboard-card-kicker">Статистика</span>
          <h1>Прогресс обучения</h1>
          <p>Сводка строится по локальной истории и выученным словам выбранного языка.</p>
        </div>
      </header>

      <section className="analytics-kpi-grid" aria-label="Ключевые показатели">
        <article className="analytics-kpi-card analytics-kpi-violet">
          <span className="analytics-kpi-icon"><AppIcon name="book-open" size={22} /></span>
          <div><span>Слов выучено</span><strong>{learnedWords}</strong><small>из {words.length} в словаре</small></div>
        </article>
        <article className="analytics-kpi-card analytics-kpi-green">
          <span className="analytics-kpi-icon"><AppIcon name="target" size={22} /></span>
          <div><span>Точность</span><strong>{accuracy}%</strong><small>{correctAnswers} из {totalAnswers} ответов</small></div>
        </article>
        <article className="analytics-kpi-card analytics-kpi-orange">
          <span className="analytics-kpi-icon"><AppIcon name="flame" size={22} /></span>
          <div><span>Серия</span><strong>{currentStreak} дн.</strong><small>{completedLessons} уроков завершено</small></div>
        </article>
        <article className="analytics-kpi-card analytics-kpi-blue">
          <span className="analytics-kpi-icon"><AppIcon name="clock" size={22} /></span>
          <div><span>Время</span><strong>{formatDurationLabel(studyTimeSeconds)}</strong><small>за всё время</small></div>
        </article>
      </section>

      <div className="analytics-grid">
        <section className="analytics-card analytics-chart-card">
          <div className="analytics-card-head">
            <div>
              <h2>Слова за неделю</h2>
              <p>{wordsInProcess} слов остаётся в активном процессе.</p>
            </div>
            <span className="analytics-summary-badge">+{weeklyTotal} слов</span>
          </div>
          <div className={weeklyTotal === 0 ? 'analytics-week-chart is-empty' : 'analytics-week-chart'} aria-label="Количество выученных слов за последние семь дней">
            {weeklyWords.map((item) => (
              <div key={item.key} className={item.key === getTodayDateKey() ? 'analytics-week-bar today' : 'analytics-week-bar'}>
                <span style={{ height: item.count === 0 ? '3px' : `${Math.max(12, (item.count / maxWeeklyCount) * 100)}%` }} />
                <strong>{item.count}</strong>
                <small>{item.label}</small>
              </div>
            ))}
            {weeklyTotal === 0 ? <p className="analytics-chart-empty">Завершите урок — здесь появится динамика недели</p> : null}
          </div>
        </section>

        <section className="analytics-card analytics-donut-card">
          <div className="analytics-card-head">
            <div>
              <h2>{diagramMode === 'levels' ? 'Уровни слов' : 'Части речи'}</h2>
              <p>Разбивка только по выученным словам.</p>
            </div>
          </div>
          <div className="analytics-donut">
            <svg className="analytics-donut-svg" viewBox="0 0 42 42" role="img" aria-label="Разбивка выученных слов">
              {diagramSegments.map((segment, index) => (
                <path key={`${segment.color}-${index}`} d={segment.path} fill={segment.color} />
              ))}
            </svg>
            <div className="analytics-donut-inner">
              <strong>{learnedWords}</strong>
              <small>освоено</small>
            </div>
          </div>
          <button
            type="button"
            className="analytics-toggle"
            onClick={() => setDiagramMode((mode) => (mode === 'levels' ? 'speech' : 'levels'))}
          >
            {diagramMode === 'levels' ? 'Показать части речи' : 'Показать уровни слов'}
          </button>
        </section>

        <section className="analytics-card analytics-breakdown-card">
          <div className="analytics-card-head">
            <div>
              <h2>Разбивка</h2>
              <p>Контрастные цвета соответствуют секторам диаграммы.</p>
            </div>
          </div>
          <div className="analytics-breakdown-list">
            {hasDiagramData ? diagramItems.map((item) => (
              <div key={item.label} className="analytics-breakdown-row">
                <div>
                  <i style={{ background: item.color }} />
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
                <b aria-hidden="true">
                  <em style={{ width: `${Math.max(4, (item.value / breakdownTotal) * 100)}%`, background: item.color }} />
                </b>
              </div>
            )) : <p className="analytics-empty-copy">Разбивка появится после освоения первых слов.</p>}
          </div>
        </section>

        <section className="analytics-card analytics-month-card">
          <div className="analytics-card-head">
            <div>
              <h2>Уроки по месяцам</h2>
              <p>История занятий за последние 18 месяцев.</p>
            </div>
            <span className="analytics-summary-badge">{completedLessons} всего</span>
          </div>
          <div className="analytics-month-strip" aria-label="Количество завершённых уроков по месяцам">
            {monthlyLessons.map((item) => (
              <div key={item.key} className="analytics-month-item">
                <span style={{ height: item.count === 0 ? '3px' : `${Math.max(12, (item.count / maxMonthlyCount) * 100)}%` }} />
                <strong>{item.count}</strong>
                <small>{item.label}</small>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
