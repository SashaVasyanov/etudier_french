import { countWordsByStatus } from '../lib/exercises';
import { getTodayDateKey, percentage } from '../lib/utils';
import type { AppStorage, DailyLessonRecord, LessonDurationMinutes, Word, WordProgress } from '../types';
import { LessonDurationSelector } from './LessonDurationSelector';

interface HomeDashboardProps {
  availableWords: Word[];
  totalWords: Word[];
  storage: AppStorage;
  progressList: WordProgress[];
  addedPacksCount: number;
  lessonDurationMinutes: LessonDurationMinutes;
  onLessonDurationChange: (value: LessonDurationMinutes) => void;
  onStartLesson: () => void;
  onStartExtraLesson: () => void;
  onOpenCompletion: () => void;
  onOpenDictionary: () => void;
  onOpenProfile: () => void;
  onOpenPacks: () => void;
}

function getDueReviewCount(progressList: WordProgress[]): number {
  const now = new Date().getTime();

  return progressList.filter((progress) => {
    if (!progress.next_review_at) {
      return false;
    }

    return new Date(progress.next_review_at).getTime() <= now;
  }).length;
}

function formatDailyStatus(todayCompletion: DailyLessonRecord | null, completedLessons: number | undefined): string {
  if (todayCompletion) {
    return 'Завершён';
  }

  if (completedLessons) {
    return `${completedLessons} урок(а)`;
  }

  return 'Не начат';
}

export function HomeDashboard({
  availableWords,
  totalWords,
  storage,
  progressList,
  addedPacksCount,
  lessonDurationMinutes,
  onLessonDurationChange,
  onStartLesson,
  onStartExtraLesson,
  onOpenCompletion,
  onOpenDictionary,
  onOpenProfile,
  onOpenPacks,
}: HomeDashboardProps) {
  const today = storage.dailyStats.find((item) => item.date === getTodayDateKey());
  const todayCompletion = storage.completedDailyLessons.find((item) => item.date === getTodayDateKey());
  const todayAccuracy = today ? percentage(today.correctAnswers, today.totalAnswers) : 0;
  const masteredCount = countWordsByStatus(progressList, 'mastered');
  const reviewCount = getDueReviewCount(progressList);
  const learnedToday = today?.wordsLearned ?? 0;
  const progressPercent = availableWords.length > 0 ? Math.round((masteredCount / availableWords.length) * 100) : 0;
  const activeWords =
    countWordsByStatus(progressList, 'learning') +
    countWordsByStatus(progressList, 'review') +
    countWordsByStatus(progressList, 'difficult');
  const difficultCount = countWordsByStatus(progressList, 'difficult');

  return (
    <section className="dashboard-shell">
      <header className="hero-card home-hero">
        <div className="hero-copy">
          <span className="eyebrow">Главная</span>
          <h1 className="hero-title">Французский на сегодня</h1>
          <p className="hero-text">
            {todayCompletion
              ? 'Ежедневный урок уже закрыт, но обучение не заканчивается: продолжайте в свободном режиме, откройте сложные слова или изучайте паки.'
              : 'Сначала пройдите ежедневный урок, затем продолжайте обучение в дополнительном режиме без сброса дневного прогресса.'}
          </p>
        </div>

        <div className="hero-actions home-actions">
          <button
            type="button"
            className="primary-button hero-button"
            onClick={todayCompletion ? onOpenCompletion : onStartLesson}
          >
            {todayCompletion ? 'Открыть итог дня' : 'Начать ежедневный урок'}
          </button>
          <button type="button" className="secondary-button" onClick={onStartExtraLesson}>
            Продолжить обучение
          </button>
          <button type="button" className="ghost-button" onClick={onOpenDictionary}>
            Открыть словарь
          </button>
          <button type="button" className="ghost-button" onClick={onOpenPacks}>
            Открыть паки
          </button>
          <button type="button" className="ghost-button" onClick={onOpenProfile}>
            Открыть профиль
          </button>
        </div>
      </header>

      <LessonDurationSelector value={lessonDurationMinutes} onChange={onLessonDurationChange} />

      <section className="stats-grid">
        <article className="info-card accent-card">
          <span className="info-label">Ежедневный урок</span>
          <strong className="info-value">{formatDailyStatus(todayCompletion ?? null, today?.completedLessons)}</strong>
          <p className="info-subtle">
            {todayCompletion ? `Пройдено модулей: ${todayCompletion.completedModules}` : `Выучено сегодня: ${learnedToday}`}
          </p>
        </article>

        <article className="info-card">
          <span className="info-label">Активная база</span>
          <strong className="info-value">{availableWords.length}</strong>
          <p className="info-subtle">Слов доступно сейчас из {totalWords.length} в общей базе</p>
        </article>

        <article className="info-card">
          <span className="info-label">Повторение</span>
          <strong className="info-value">{reviewCount}</strong>
          <p className="info-subtle">Слов готово к повторению прямо сейчас</p>
        </article>

        <article className="info-card">
          <span className="info-label">Серия дней</span>
          <strong className="info-value">{storage.streakDays}</strong>
          <p className="info-subtle">Точность за сегодня: {todayAccuracy}%</p>
        </article>
      </section>

      <section className="home-path-grid">
        <article className="dashboard-panel">
          <div className="chart-header">
            <div>
              <span className="eyebrow">Маршрут 1</span>
              <h2 className="section-title">Ежедневный урок</h2>
            </div>
            <span className="info-subtle">Обязательный дневной поток с модулями и прогрессом</span>
          </div>
          <p className="hero-text">
            Новые слова, тренировка, повторение и закрепление идут отдельными блоками. Прогресс сохраняется как итог дня.
          </p>
          <div className="badge-row wrap-row">
            <span className="tag-badge">Текущая длительность: {lessonDurationMinutes} мин</span>
            <span className="tag-badge">{todayCompletion ? 'На сегодня закрыт' : 'Готов к запуску'}</span>
          </div>
          <button
            type="button"
            className="primary-button full-width"
            onClick={todayCompletion ? onOpenCompletion : onStartLesson}
          >
            {todayCompletion ? 'Посмотреть экран завершения' : 'Запустить ежедневный урок'}
          </button>
        </article>

        <article className="dashboard-panel">
          <div className="chart-header">
            <div>
              <span className="eyebrow">Маршрут 2</span>
              <h2 className="section-title">Дополнительное обучение</h2>
            </div>
            <span className="info-subtle">Свободный режим после дневного лимита</span>
          </div>
          <p className="hero-text">
            Берёт сложные, изучаемые и оставшиеся новые слова. Этот режим не меняет статус ежедневного урока и доступен всегда.
          </p>
          <div className="badge-row wrap-row">
            <span className="tag-badge">Сложных слов: {difficultCount}</span>
            <span className="tag-badge">Активно изучаются: {activeWords}</span>
          </div>
          <button type="button" className="secondary-button full-width" onClick={onStartExtraLesson}>
            Продолжить обучение
          </button>
        </article>
      </section>

      <section className="dashboard-feature-grid">
        <article className="dashboard-panel">
          <div className="progress-meta">
            <span className="progress-caption">Прогресс по активному словарю</span>
            <span className="progress-count">{progressPercent}%</span>
          </div>
          <div className="progress-track" aria-hidden="true">
            <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <p className="info-subtle">
            Учится: {activeWords} · Уже известные: {countWordsByStatus(progressList, 'known')} · Выученные: {masteredCount}
          </p>
        </article>

        <article className="dashboard-panel">
          <div className="chart-header">
            <h2 className="section-title">Что делать дальше</h2>
            <span className="info-subtle">Все основные разделы доступны без тупиков</span>
          </div>
          <div className="next-actions-list">
            <button type="button" className="secondary-button full-width" onClick={onStartExtraLesson}>
              Дополнительная практика
            </button>
            <button type="button" className="ghost-button full-width" onClick={onOpenDictionary}>
              Проверить словарь и фильтры
            </button>
            <button type="button" className="ghost-button full-width" onClick={onOpenPacks}>
              Открыть паки и посмотреть слова
            </button>
          </div>
        </article>
      </section>

      <section className="quick-grid quick-grid-wide" aria-label="Ключевые разделы">
        <article className="quick-card">
          <strong>Ежедневный урок</strong>
          <span>Модульный путь с явным прогрессом дня и отдельным экраном завершения.</span>
        </article>
        <article className="quick-card">
          <strong>Свободный режим</strong>
          <span>Продолжает обучение после закрытия дневного урока на той же базе слов.</span>
        </article>
        <article className="quick-card">
          <strong>Паки</strong>
          <span>Добавлено паков: {addedPacksCount}. Теперь каждый пак можно открыть и просмотреть целиком.</span>
        </article>
        <article className="quick-card">
          <strong>Профиль и история</strong>
          <span>Серия дней, история уроков, ошибки и локально сохранённый прогресс.</span>
        </article>
      </section>
    </section>
  );
}
