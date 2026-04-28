import { useMemo, type CSSProperties } from 'react';
import { getTodayDateKey, percentage } from '../lib/utils';
import type { AppStorage, LearningLanguage, LessonDurationMinutes, LessonWordTarget, Word, WordPack, WordProgress } from '../types';

interface HomeDashboardProps {
  availableWords: Word[];
  totalWords: Word[];
  storage: AppStorage;
  progressList: WordProgress[];
  packs: WordPack[];
  addedPacksCount: number;
  learningLanguage: LearningLanguage;
  lessonDurationMinutes: LessonDurationMinutes;
  lessonWordTarget: LessonWordTarget;
  lessonSourcePackId: string | null;
  onStartLesson: () => void;
  onStartExtraLesson: () => void;
  onStartFlashcards: () => void;
  onOpenStatistics: () => void;
  onOpenProfile: () => void;
  onOpenPacks: () => void;
}

const WEEK_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function getPackCompletion(pack: WordPack, storage: AppStorage): number {
  if (pack.words.length === 0) {
    return 0;
  }

  const masteredWords = pack.words.filter((word) => storage.progressByWordId[word.id]?.status === 'mastered').length;
  return Math.round((masteredWords / pack.words.length) * 100);
}

export function HomeDashboard({
  availableWords,
  totalWords,
  storage,
  progressList,
  packs,
  addedPacksCount,
  learningLanguage,
  lessonDurationMinutes,
  lessonWordTarget,
  lessonSourcePackId,
  onStartLesson,
  onStartExtraLesson,
  onStartFlashcards,
  onOpenStatistics,
  onOpenProfile,
  onOpenPacks,
}: HomeDashboardProps) {
  const today = storage.dailyStats.find(
    (item) => item.date === getTodayDateKey() && item.language === learningLanguage,
  );
  const todayAccuracy = today ? percentage(today.correctAnswers, today.totalAnswers) : 0;
  const learnedWordIds = new Set(
    progressList
      .filter((progress) => progress.status === 'mastered')
      .map((progress) => progress.word_id),
  );
  const wordsInProcess = Math.max(0, availableWords.length - learnedWordIds.size);
  const selectedLessonPack = packs.find((pack) => pack.id === lessonSourcePackId) ?? null;
  const lessonPackLabel = selectedLessonPack ? selectedLessonPack.title : 'Все слова';
  const recentPacks = useMemo(
    () =>
      [...packs]
        .sort((left, right) => getPackCompletion(right, storage) - getPackCompletion(left, storage))
        .slice(0, 3),
    [packs, storage],
  );
  const weeklyPoints = WEEK_LABELS.map((label, index) => {
    const value = storage.dailyStats
      .filter((entry) => entry.language === learningLanguage)
      .slice(-7)[index]?.wordsLearned ?? 0;

    return { label, value };
  });
  const maxWeekly = Math.max(1, ...weeklyPoints.map((point) => point.value));
  const weeklyChartPoints = weeklyPoints.map((point, index) => {
    const x = 24 + index * 98;
    const y = 118 - (point.value / maxWeekly) * 82;

    return { ...point, x, y };
  });
  const weeklyLinePath = weeklyChartPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const weeklyAreaPath =
    weeklyChartPoints.length > 0
      ? `${weeklyLinePath} L ${weeklyChartPoints[weeklyChartPoints.length - 1].x} 130 L ${weeklyChartPoints[0].x} 130 Z`
      : '';
  const overallProgress = percentage(learnedWordIds.size, Math.max(1, totalWords.length));

  return (
    <section className="dashboard-shell dashboard-modern">
      <header className="dashboard-modern-head">
        <div>
          <h1>Доброе утро, {storage.profile.displayName}!</h1>
          <p>Продолжайте обучение: уроки, паки и словарь доступны из одной панели.</p>
        </div>
        <button type="button" className="profile-chip" onClick={onOpenProfile}>
          Профиль
        </button>
      </header>

      <div className="dashboard-modern-grid">
        <button type="button" className="dashboard-card lesson-summary-card" onClick={onStartLesson}>
          <div className="dashboard-card-icon">□</div>
          <div>
            <span className="dashboard-card-kicker">Сегодняшний урок</span>
            <h2>Начать урок</h2>
            <p>
              {lessonWordTarget} слов · {lessonDurationMinutes} мин · {lessonPackLabel}
            </p>
          </div>

          <div className="lesson-progress-line" aria-hidden="true">
            <span style={{ width: `${Math.min(100, Math.max(8, overallProgress))}%` }} />
          </div>
        </button>

        <section className="dashboard-card progress-summary-card">
          <span className="dashboard-card-kicker">Прогресс</span>
          <div className="progress-ring-card" style={{ '--progress': `${overallProgress * 3.6}deg` } as CSSProperties}>
            <strong>{overallProgress}%</strong>
            <span>освоено</span>
          </div>
          <div className="progress-mini-list">
            <span>{learnedWordIds.size} выучено</span>
            <span>{wordsInProcess} в работе</span>
            <span>{totalWords.length - availableWords.length} вне активного пула</span>
          </div>
        </section>

        <section className="dashboard-card quick-practice-card">
          <span className="dashboard-card-kicker">Быстрая практика</span>
          <h2>Что потренировать?</h2>
          <button type="button" className="quick-row-button" onClick={onStartFlashcards}>
            <span>▣</span>
            <strong>Карточки</strong>
            <small>Повторить слова с картинками</small>
          </button>
          <button type="button" className="quick-row-button" onClick={onStartExtraLesson}>
            <span>✎</span>
            <strong>Смешанная практика</strong>
            <small>Дополнительные упражнения</small>
          </button>
        </section>

        <section className="dashboard-card recent-packs-card">
          <div className="card-title-row">
            <span className="dashboard-card-kicker">Паки · {addedPacksCount} добавлено</span>
            <button type="button" className="small-link-button" onClick={onOpenPacks}>
              Все паки
            </button>
          </div>
          <div className="recent-pack-list">
            {recentPacks.map((pack) => {
              const completion = getPackCompletion(pack, storage);

              return (
                <button key={pack.id} type="button" className="recent-pack-row" onClick={onOpenPacks}>
                  <span className="recent-pack-icon">▧</span>
                  <strong>{pack.title}</strong>
                  <small>{pack.words.length} слов</small>
                  <i aria-hidden="true">
                    <b style={{ width: `${Math.max(8, completion)}%` }} />
                  </i>
                  <em>{completion}%</em>
                </button>
              );
            })}
          </div>
        </section>

        <section className="dashboard-card weekly-overview-card">
          <div className="card-title-row">
            <span className="dashboard-card-kicker">Неделя</span>
            <button type="button" className="small-link-button" onClick={onOpenStatistics}>
              Статистика
            </button>
          </div>
          <div className="weekly-kpi-grid">
            <span>{availableWords.length} слов</span>
            <span>{todayAccuracy}% точность</span>
            <span>{storage.streakDays} дн. серия</span>
          </div>
          <div className="weekly-mini-chart" aria-label="Слова по дням недели">
            <svg className="weekly-line-svg" viewBox="0 0 640 150" preserveAspectRatio="none" role="img">
              <path className="weekly-line-area" d={weeklyAreaPath} />
              <path className="weekly-line-path" d={weeklyLinePath} />
              {weeklyChartPoints.map((point) => (
                <circle key={point.label} className="weekly-line-dot" cx={point.x} cy={point.y} r="4" />
              ))}
            </svg>
            <div className="weekly-line-labels" aria-hidden="true">
              {weeklyPoints.map((point) => (
                <small key={point.label}>{point.label}</small>
              ))}
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
