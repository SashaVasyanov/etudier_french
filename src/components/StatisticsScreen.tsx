import { useMemo, useState } from 'react';
import type { AppStorage, Word, WordLevel } from '../types';
import { getTodayDateKey } from '../lib/utils';
import { getPartOfSpeechLabel } from '../lib/wordPresentation';

interface StatisticsScreenProps {
  storage: AppStorage;
  words: Word[];
}

type DiagramMode = 'levels' | 'speech';

const LEVEL_COLORS: Record<WordLevel, string> = {
  A1: '#009b3a',
  A2: '#f2b705',
  B1: '#ef4b2f',
};

const LEVEL_LABELS: Record<WordLevel, string> = {
  A1: 'Beginner · A1',
  A2: 'Elementary · A2',
  B1: 'Intermediate · B1',
};

const SPEECH_COLORS = ['#009b3a', '#f2b705', '#ef4b2f', '#2a8bda', '#8b5cf6', '#111827', '#f97316', '#64748b'];

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
    return [{ color: '#d9d9d9', path: describeFullPie(20) }];
  }

  if (visibleItems.length === 1) {
    return [{ color: visibleItems[0].color, path: describeFullPie(20) }];
  }

  const gapDegrees = 0;
  let cursor = 0;

  return visibleItems.map((item) => {
    const share = (item.value / total) * 360;
    const shouldKeepTinySlice = share < gapDegrees * 2;
    const startAngle = shouldKeepTinySlice ? cursor : cursor + gapDegrees / 2;
    const endAngle = shouldKeepTinySlice ? cursor + share : cursor + share - gapDegrees / 2;
    const segment = {
      color: item.color,
      path: describePieSlice(startAngle, Math.max(startAngle + 0.01, endAngle), 20),
    };

    cursor += share;
    return segment;
  });
}

function getMonthlyLessonCounts(storage: AppStorage): Array<{ key: string; label: string; count: number }> {
  const formatter = new Intl.DateTimeFormat('ru-RU', { month: 'short', year: '2-digit' });
  const now = new Date();

  return Array.from({ length: 18 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (17 - index), 1);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const count = storage.studyHistory.filter((entry) => entry.date.startsWith(monthKey)).length;

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
      color: SPEECH_COLORS[index % SPEECH_COLORS.length] ?? '#d9d9d9',
    }));
}

export default function StatisticsScreen({ storage, words }: StatisticsScreenProps) {
  const [diagramMode, setDiagramMode] = useState<DiagramMode>('levels');
  const learnedWordList = useMemo(
    () =>
      words.filter((word) => {
        const status = storage.progressByWordId[word.id]?.status;
        return status === 'known' || status === 'mastered';
      }),
    [storage.progressByWordId, words],
  );
  const learnedWords = learnedWordList.length;
  const wordsInProcess = Math.max(0, words.length - learnedWords);
  const currentStreak = storage.lastLessonDate === getTodayDateKey() ? storage.streakDays : 0;
  const monthlyLessons = useMemo(() => getMonthlyLessonCounts(storage), [storage]);
  const diagramItems = useMemo(
    () => (diagramMode === 'levels' ? countLevels(learnedWordList) : countSpeechTypes(learnedWordList)),
    [diagramMode, learnedWordList],
  );
  const maxMonthlyCount = Math.max(1, ...monthlyLessons.map((item) => item.count));
  const diagramSegments = useMemo(() => buildDiagramSegments(diagramItems), [diagramItems]);

  return (
    <section className="statistics-screen">
      <div className="statistics-layout">
        <div className="statistics-left-column">
          <article className="statistics-green-card">
            <span>Серия</span>
            <strong>{currentStreak} дн.</strong>
          </article>

          <article className="statistics-green-card">
            <span>Изучено слов</span>
            <strong>{learnedWords}</strong>
          </article>
        </div>

        <div className="statistics-center">
          <div className="statistics-diagram">
            <svg className="statistics-diagram-svg" viewBox="0 0 42 42" role="img" aria-label="Разбивка выученных слов">
              <circle className="statistics-diagram-track" cx="21" cy="21" r="20" />
              {diagramSegments.map((segment, index) => (
                <path
                  key={`${segment.color}-${index}`}
                  className="statistics-diagram-segment"
                  d={segment.path}
                  fill={segment.color}
                />
              ))}
            </svg>
            <div className="statistics-diagram-inner">
              <strong>{diagramItems.reduce((sum, item) => sum + item.value, 0)}</strong>
            </div>
          </div>

          <button
            type="button"
            className="statistics-toggle"
            onClick={() => setDiagramMode((mode) => (mode === 'levels' ? 'speech' : 'levels'))}
          >
            {diagramMode === 'levels' ? 'Показать части речи' : 'Показать уровни слов'}
          </button>
        </div>

        <div className="statistics-right-column">
          <article className="statistics-green-card">
            <span>Слов в процессе</span>
            <strong>{wordsInProcess}</strong>
          </article>

          <article className="statistics-month-card">
            <h2>Уроки по месяцам</h2>
            <div className="statistics-month-chart" aria-label="Количество завершённых уроков по месяцам">
              {monthlyLessons.map((item) => (
                <div key={item.key} className="statistics-month-bar-row">
                  <span>{item.label}</span>
                  <div className="statistics-month-bar-track">
                    <div
                      className="statistics-month-bar"
                      style={{ width: `${Math.max(8, (item.count / maxMonthlyCount) * 100)}%` }}
                    />
                  </div>
                  <strong>{item.count}</strong>
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>

      <div className="statistics-legend" aria-label="Легенда диаграммы">
        {diagramItems.map((item) => (
          <span key={item.label} className="statistics-legend-item">
            <i style={{ background: item.color }} />
            {item.label}: {item.value}
          </span>
        ))}
      </div>
    </section>
  );
}
