import { countWordsByStatus } from '../lib/exercises';
import { getTodayDateKey, percentage } from '../lib/utils';
import type { AppStorage, DailyLessonRecord, LessonDurationMinutes, Word, WordProgress } from '../types';
import { AppCard } from './AppCard';
import { LessonDurationSelector } from './LessonDurationSelector';
import { StatCard } from './StatCard';

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
  onStartFlashcards: () => void;
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
    return 'Урок завершён';
  }

  if (completedLessons) {
    return `${completedLessons} занятие сегодня`;
  }

  return 'Готов к старту';
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
  onStartFlashcards,
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
  const currentPlan = todayCompletion ? 'Ежедневный урок закрыт' : 'Следующий шаг: пройти 5 модулей';

  return (
    <section className="dashboard-shell">
      <section className="home-overview-grid">
        <AppCard as="header" tone="hero" className="home-hero">
          <div className="hero-copy">
            <span className="eyebrow">Сегодня</span>
            <h1 className="hero-title">Ежедневный маршрут по французскому</h1>
            <p className="hero-text">
              {todayCompletion
                ? 'Дневной поток уже завершён. Продолжайте в дополнительном режиме, повторяйте сложные слова и открывайте тематические паки.'
                : 'Один понятный поток на день: 5 модулей, видимый прогресс по шагам и быстрый переход в свободную практику после завершения.'}
            </p>
            <div className="badge-row wrap-row">
              <span className="tag-badge">{formatDailyStatus(todayCompletion ?? null, today?.completedLessons)}</span>
              <span className="tag-badge">{currentPlan}</span>
              <span className="tag-badge">Длительность: {lessonDurationMinutes} мин</span>
            </div>
          </div>

          <div className="hero-actions home-actions">
            <button
              type="button"
              className="primary-button hero-button"
              onClick={todayCompletion ? onOpenCompletion : onStartLesson}
            >
              {todayCompletion ? 'Открыть итог дня' : 'Стартовать ежедневный урок'}
            </button>
            <button type="button" className="secondary-button" onClick={onStartExtraLesson}>
              Дополнительное обучение
            </button>
            <button type="button" className="ghost-button" onClick={onStartFlashcards}>
              Карточки слов
            </button>
          </div>
        </AppCard>

        <AppCard as="section" className="daily-state-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Панель дня</span>
              <h2 className="section-title">Что важно сейчас</h2>
            </div>
            <span className="inline-note">{todayCompletion ? 'День закрыт' : 'Урок доступен'}</span>
          </div>
          <div className="feature-list">
            <span>Ежедневный урок: {todayCompletion ? '5 из 5 модулей завершены' : 'ещё не завершён'}</span>
            <span>Активных слов в работе: {activeWords}</span>
            <span>Сложных слов для повтора: {difficultCount}</span>
            <span>Подключено паков: {addedPacksCount}</span>
          </div>
          <div className="quick-action-list">
            <button type="button" className="ghost-button full-width" onClick={onOpenDictionary}>
              Открыть словарь
            </button>
            <button type="button" className="ghost-button full-width" onClick={onOpenPacks}>
              Смотреть паки
            </button>
            <button type="button" className="ghost-button full-width" onClick={onOpenProfile}>
              Перейти в профиль
            </button>
          </div>
        </AppCard>
      </section>

      <section className="stats-grid">
        <StatCard label="Ежедневный урок" value={todayCompletion ? '5/5' : '0/5'} hint={todayCompletion ? 'Дневной поток завершён' : 'Нужно пройти все 5 модулей'} tone="accent" />
        <StatCard label="Доступных слов" value={availableWords.length} hint={`Всего в базе ${totalWords.length}`} />
        <StatCard label="На повторении" value={reviewCount} hint="Готовы к повтору прямо сейчас" />
        <StatCard label="Серия дней" value={storage.streakDays} hint={`Точность сегодня ${todayAccuracy}%`} />
      </section>

      <section className="dashboard-feature-grid dashboard-feature-grid-wide">
        <LessonDurationSelector value={lessonDurationMinutes} onChange={onLessonDurationChange} />

        <AppCard as="article" className="route-card route-card-primary">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Основной путь</span>
              <h2 className="section-title">Ежедневный урок</h2>
            </div>
            <span className="inline-note">{todayCompletion ? 'Сегодня уже закрыт' : 'Главный фокус дня'}</span>
          </div>
          <p className="hero-text">
            Структура всегда одна и та же: новые слова, первая практика, повторение, смешанное закрепление и финальная мини-проверка.
          </p>
          <div className="feature-list">
            <span>Новых слов сегодня: {learnedToday}</span>
            <span>Отдельный дневной прогресс по модулям и шагам</span>
            <span>После завершения появляется экран «На сегодня заданий нет»</span>
          </div>
          <button
            type="button"
            className="primary-button full-width"
            onClick={todayCompletion ? onOpenCompletion : onStartLesson}
          >
            {todayCompletion ? 'Открыть итог дня' : `Учиться ${lessonDurationMinutes} минут`}
          </button>
        </AppCard>

        <AppCard as="article" tone="soft" className="route-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">После урока</span>
              <h2 className="section-title">Свободная практика</h2>
            </div>
            <span className="inline-note">Не ломает дневной прогресс</span>
          </div>
          <p className="hero-text">
            Используйте дополнительный режим для сложных слов, текущих слов в изучении, паков и быстрой тренировки без ограничений по дню.
          </p>
          <div className="feature-list">
            <span>Сложных слов: {difficultCount}</span>
            <span>В активном изучении: {activeWords}</span>
            <span>Карточки запускаются отдельно для лёгкого повтора</span>
          </div>
          <div className="launch-actions">
            <button type="button" className="secondary-button full-width" onClick={onStartExtraLesson}>
              Открыть свободный режим
            </button>
            <button type="button" className="ghost-button full-width" onClick={onStartFlashcards}>
              Запустить карточки
            </button>
          </div>
        </AppCard>
      </section>

      <section className="dashboard-feature-grid">
        <AppCard as="article" className="progress-highlight">
          <div className="progress-meta">
            <div>
              <span className="progress-caption">Прогресс по активному словарю</span>
              <strong className="progress-count">{progressPercent}%</strong>
            </div>
            <span className="inline-note">Выучено {masteredCount} слов</span>
          </div>
          <div className="progress-track" aria-hidden="true">
            <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <p className="info-subtle">
            Изучается: {activeWords} · Уже известно: {countWordsByStatus(progressList, 'known')} · Выучено: {masteredCount}
          </p>
        </AppCard>

        <AppCard as="article" className="launch-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Практический режим</span>
              <h2 className="section-title">Размер занятия под ваш ритм</h2>
            </div>
            <span className="inline-note">Сохраняется локально</span>
          </div>
          <div className="feature-list">
            <span>{lessonDurationMinutes === 10 ? 'Короткая сессия: быстрый заход и лёгкий ритм.' : lessonDurationMinutes === 20 ? 'Сбалансированная сессия: основной режим на каждый день.' : 'Длинная сессия: больше слов, больше закрепления.'}</span>
            <span>Выбранная длительность применяется к ежедневному и дополнительному обучению.</span>
          </div>
          <div className="quick-action-list">
            <button type="button" className="ghost-button full-width" onClick={onOpenCompletion}>
              Итог дня
            </button>
            <button type="button" className="ghost-button full-width" onClick={onOpenPacks}>
              Тематические паки
            </button>
          </div>
        </AppCard>
      </section>
    </section>
  );
}
