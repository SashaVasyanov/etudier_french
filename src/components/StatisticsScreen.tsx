import { useMemo, useState } from 'react';
import type { AppStorage, LearningLanguage, Word, WordLevel } from '../types';
import { formatDurationLabel, getTodayDateKey, countRu, pluralRu, RU_WORDS } from '../lib/utils';
import { getCurrentStreakDays, getWordProgress } from '../lib/storage';
import { getAnswerAccuracy, getRecentWordCounts, summarizeWordStatuses } from '../lib/studyMetrics';
import { isInMemory } from '../lib/milestones';
import { getPartOfSpeechLabel } from '../lib/wordPresentation';
import { AppIcon } from './AppIcon';
import { getLevelOptions, getStudyLevel } from '../lib/levels';

interface StatisticsScreenProps {
  learningLanguage: LearningLanguage;
  storage: AppStorage;
  words: Word[];
}

type DiagramMode = 'levels' | 'speech';

const LEVEL_COLORS: Record<WordLevel, string> = {
  // An ordered scale: one hue, lighter for easier levels.
  A1: 'color-mix(in srgb, var(--accent) 40%, var(--surface))',
  A2: 'color-mix(in srgb, var(--accent) 70%, var(--surface))',
  B1: 'var(--accent)',
};

const LEVEL_LABELS: Record<WordLevel, string> = {
  A1: 'Начальный · A1',
  A2: 'Базовый · A2',
  B1: 'Средний · B1',
};

const SPEECH_COLORS = Array.from({ length: 8 }, (_, index) => `var(--chart-${index + 1})`);

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
    return [{ color: 'var(--fill-strong)', path: describeFullPie(20) }];
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

function countLevels(words: Word[], language: LearningLanguage): Array<{ label: string; value: number; color: string }> {
  const levels = getLevelOptions(language);

  return levels.map((level, index) => ({
    label: language === 'japanese' ? (level === 'none' ? 'Вне JLPT' : `JLPT ${level}`) : LEVEL_LABELS[level as WordLevel],
    value: words.filter((word) => getStudyLevel(word) === level).length,
    // One hue: lighter for easier levels, gray for words outside the scale.
    color: level === 'none' ? 'var(--fill-strong)' : language === 'japanese'
      ? `color-mix(in srgb, var(--accent) ${Math.round(35 + (index / 4) * 65)}%, var(--surface))`
      : LEVEL_COLORS[level as WordLevel],
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
      color: SPEECH_COLORS[index % SPEECH_COLORS.length] ?? 'var(--chart-8)',
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
  const inMemoryWords = useMemo(
    () => words.filter((word) => isInMemory(storage.progressByWordId[word.id])).length,
    [storage.progressByWordId, words],
  );
  const wordStats = useMemo(
    () => summarizeWordStatuses(words.map((word) => getWordProgress(storage, word.id))),
    [storage, words],
  );
  const wordsInProcess = wordStats.inProgress;
  const currentStreak = getCurrentStreakDays(storage);
  const { correctAnswers, totalAnswers, accuracy } = getAnswerAccuracy(storage.dailyStats, learningLanguage);
  const studyTimeSeconds = languageHistory.reduce((sum, item) => sum + item.timeSpentSeconds, 0);
  const weeklyWords = getRecentWordCounts(storage.dailyStats, learningLanguage);
  const monthlyLessons = useMemo(() => getMonthlyLessonCounts(storage, learningLanguage), [learningLanguage, storage]);
  const diagramItems = useMemo(
    () => (diagramMode === 'levels' ? countLevels(learnedWordList, learningLanguage) : countSpeechTypes(learnedWordList)),
    [diagramMode, learnedWordList, learningLanguage],
  );
  const maxWeeklyCount = Math.max(1, ...weeklyWords.map((item) => item.count));
  const maxMonthlyCount = Math.max(1, ...monthlyLessons.map((item) => item.count));
  const diagramSegments = useMemo(() => buildDiagramSegments(diagramItems), [diagramItems]);
  const breakdownTotal = Math.max(1, diagramItems.reduce((sum, item) => sum + item.value, 0));
  const weeklyTotal = weeklyWords.reduce((sum, item) => sum + item.count, 0);
  const completedLessons = Math.max(storage.lessonTotals[learningLanguage], languageHistory.length);
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
          <div><span>Слов в памяти</span><strong>{inMemoryWords}</strong><small>{learnedWords > 0 ? `надолго — ${learnedWords}, ` : ''}из {words.length} в словаре</small></div>
        </article>
        <article className="analytics-kpi-card analytics-kpi-green">
          <span className="analytics-kpi-icon"><AppIcon name="target" size={22} /></span>
          <div><span>Точность</span><strong>{accuracy}%</strong><small>{correctAnswers} из {totalAnswers} ответов за всё время</small></div>
        </article>
        <article className="analytics-kpi-card analytics-kpi-orange">
          <span className="analytics-kpi-icon"><AppIcon name="flame" size={22} /></span>
          <div><span>Серия</span><strong>{currentStreak} дн.</strong><small>{completedLessons} {pluralRu(completedLessons, ['урок завершён', 'урока завершено', 'уроков завершено'])}</small></div>
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
              <p>{wordsInProcess > 0
                ? `В работе сейчас ${countRu(wordsInProcess, RU_WORDS)}${wordStats.difficult > 0 ? ` и ещё ${wordStats.difficult} сложных` : ''}.`
                : wordStats.difficult > 0
                  ? `Сложных слов: ${wordStats.difficult}.`
                  : 'Сейчас нет слов в работе.'}</p>
            </div>
            <span className="analytics-summary-badge">+{countRu(weeklyTotal, RU_WORDS)}</span>
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
                <path key={`${segment.color}-${index}`} d={segment.path} style={{ fill: segment.color }} />
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
