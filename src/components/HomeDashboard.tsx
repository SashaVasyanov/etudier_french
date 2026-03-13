import { countWordsByStatus } from '../lib/exercises';
import { getTodayDateKey, percentage } from '../lib/utils';
import type { AppStorage, Word, WordProgress } from '../types';

interface HomeDashboardProps {
  availableWords: Word[];
  totalWords: Word[];
  storage: AppStorage;
  progressList: WordProgress[];
  addedPacksCount: number;
  onStartLesson: () => void;
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

export function HomeDashboard({
  availableWords,
  totalWords,
  storage,
  progressList,
  addedPacksCount,
  onStartLesson,
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

  return (
    <section className="dashboard-shell">
      <header className="hero-card home-hero">
        <div className="hero-copy">
          <span className="eyebrow">Etudier French</span>
          <h1 className="hero-title">Французский на сегодня</h1>
          <p className="hero-text">
            {todayCompletion
              ? 'Дневной урок завершён. Откройте словарь, профиль или добавьте новый пак для следующего прогресса.'
              : 'Начните модульный урок, продолжите активные слова и управляйте словарём через паки и профиль.'}
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
          <button type="button" className="secondary-button" onClick={onOpenDictionary}>
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

      <section className="stats-grid">
        <article className="info-card accent-card">
          <span className="info-label">Сегодняшний урок</span>
          <strong className="info-value">
            {todayCompletion ? 'Завершён' : today ? `${today.completedLessons} урок(а)` : 'Не начат'}
          </strong>
          <p className="info-subtle">
            {todayCompletion
              ? `Пройдено модулей: ${todayCompletion.completedModules}`
              : `Выучено сегодня: ${learnedToday}`}
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
            Учится: {activeWords} · Уже известные: {countWordsByStatus(progressList, 'known')} · Выученные:{' '}
            {masteredCount}
          </p>
        </article>

        <article className="dashboard-panel">
          <div className="chart-header">
            <h2 className="section-title">Что делать дальше</h2>
            <span className="info-subtle">Ясные следующие действия</span>
          </div>
          <div className="next-actions-list">
            <button type="button" className="secondary-button full-width" onClick={onStartLesson}>
              Продолжить урок
            </button>
            <button type="button" className="ghost-button full-width" onClick={onOpenDictionary}>
              Проверить словарь и фильтры
            </button>
            <button type="button" className="ghost-button full-width" onClick={onOpenPacks}>
              Добавить тематический пак
            </button>
          </div>
        </article>
      </section>

      <section className="quick-grid quick-grid-wide" aria-label="Ключевые разделы">
        <article className="quick-card">
          <strong>Модульный урок</strong>
          <span>Новые слова, тренировка, повторение и закрепление с явным прогрессом по дню.</span>
        </article>
        <article className="quick-card">
          <strong>Словарь</strong>
          <span>Чистые карточки, поиск, фильтры по статусам и по активным пакам.</span>
        </article>
        <article className="quick-card">
          <strong>Паки</strong>
          <span>Добавлено паков: {addedPacksCount}. Активируйте нужные темы, не перегружая ежедневный поток.</span>
        </article>
        <article className="quick-card">
          <strong>Профиль и история</strong>
          <span>Серия дней, история по датам, ошибки, модули и накопленный локальный прогресс.</span>
        </article>
      </section>
    </section>
  );
}
