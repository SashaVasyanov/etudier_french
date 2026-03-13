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

  return (
    <section className="dashboard-shell">
      <AppCard as="header" tone="hero" className="home-hero">
        <div className="hero-copy">
          <span className="eyebrow">Сегодня</span>
          <h1 className="hero-title">Ваш французский маршрут на день</h1>
          <p className="hero-text">
            {todayCompletion
              ? 'Ежедневный поток уже закрыт. Можно перейти в свободную практику, разобрать сложные слова или пройти тематический пак.'
              : 'Начните с ежедневного урока из 5 модулей, затем продолжайте в дополнительном режиме без потери дневного прогресса.'}
          </p>
          <div className="badge-row wrap-row">
            <span className="tag-badge">{formatDailyStatus(todayCompletion ?? null, today?.completedLessons)}</span>
            <span className="tag-badge">Длительность: {lessonDurationMinutes} мин</span>
            <span className="tag-badge">Паков подключено: {addedPacksCount}</span>
          </div>
        </div>

        <div className="hero-actions home-actions">
          <button
            type="button"
            className="primary-button hero-button"
            onClick={todayCompletion ? onOpenCompletion : onStartLesson}
          >
            {todayCompletion ? 'Открыть итог дня' : 'Продолжить ежедневный урок'}
          </button>
          <button type="button" className="secondary-button" onClick={onStartExtraLesson}>
            Дополнительное обучение
          </button>
          <button type="button" className="ghost-button" onClick={onStartFlashcards}>
            Карточки слов
          </button>
          <div className="cta-grid">
            <button type="button" className="ghost-button" onClick={onOpenDictionary}>
              Словарь
            </button>
            <button type="button" className="ghost-button" onClick={onOpenPacks}>
              Паки
            </button>
            <button type="button" className="ghost-button" onClick={onOpenProfile}>
              Профиль
            </button>
          </div>
        </div>
      </AppCard>

      <section className="stats-grid">
        <StatCard label="Ежедневный урок" value={todayCompletion ? '5/5' : 'В процессе'} hint={todayCompletion ? 'Дневной поток завершён' : 'Пройдите все 5 модулей'} tone="accent" />
        <StatCard label="Доступных слов" value={availableWords.length} hint={`Всего в базе ${totalWords.length}`} />
        <StatCard label="На повторении" value={reviewCount} hint="Готовы к повтору прямо сейчас" />
        <StatCard label="Серия дней" value={storage.streakDays} hint={`Точность сегодня ${todayAccuracy}%`} />
      </section>

      <LessonDurationSelector value={lessonDurationMinutes} onChange={onLessonDurationChange} />

      <AppCard as="section" tone="soft" className="launch-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Старт урока</span>
            <h2 className="section-title">Размер занятия выбираете вы</h2>
          </div>
          <span className="inline-note">Текущий выбор: {lessonDurationMinutes} минут</span>
        </div>
        <div className="launch-grid">
          <div className="feature-list">
            <span>{lessonDurationMinutes === 10 ? 'Короткий урок: меньше слов и быстрый темп' : lessonDurationMinutes === 20 ? 'Сбалансированный урок: оптимум для ежедневной практики' : 'Расширенный урок: больше слов и закрепления'}</span>
            <span>Выбор применяется до нажатия «Стартовать урок» и сохраняется локально</span>
          </div>
          <div className="launch-actions">
            <button type="button" className="primary-button full-width" onClick={todayCompletion ? onOpenCompletion : onStartLesson}>
              {todayCompletion ? 'Открыть итог дня' : `Стартовать урок на ${lessonDurationMinutes} минут`}
            </button>
            <button type="button" className="secondary-button full-width" onClick={onStartFlashcards}>
              Открыть карточки на {lessonDurationMinutes} минут
            </button>
          </div>
        </div>
      </AppCard>

      <section className="home-feature-grid">
        <AppCard as="article" className="route-card route-card-primary">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Основной путь</span>
              <h2 className="section-title">Ежедневный урок</h2>
            </div>
            <span className="inline-note">{todayCompletion ? 'На сегодня закрыт' : 'Следующий лучший шаг'}</span>
          </div>
          <p className="hero-text">
            Чёткий поток из 5 модулей: новые слова, первая практика, повторение, смешанное закрепление и финальная мини-проверка.
          </p>
          <div className="feature-list">
            <span>Новых слов сегодня: {learnedToday}</span>
            <span>Прогресс дня сохраняется отдельно</span>
            <span>После завершения открывается экран «На сегодня заданий нет»</span>
          </div>
          <button
            type="button"
            className="primary-button full-width"
            onClick={todayCompletion ? onOpenCompletion : onStartLesson}
          >
            {todayCompletion ? 'Посмотреть завершение' : 'Стартовать урок'}
          </button>
        </AppCard>

        <AppCard as="article" tone="soft" className="route-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">После урока</span>
              <h2 className="section-title">Дополнительное обучение</h2>
            </div>
            <span className="inline-note">Без влияния на дневной прогресс</span>
          </div>
          <p className="hero-text">
            Продолжайте тренироваться после закрытия дня: сложные слова, текущие слова в изучении, тематические паки и смешанное закрепление.
          </p>
          <div className="feature-list">
            <span>Сложных слов: {difficultCount}</span>
            <span>В активном изучении: {activeWords}</span>
            <span>Можно запускать в любое время</span>
          </div>
          <button type="button" className="secondary-button full-width" onClick={onStartExtraLesson}>
            Открыть свободный режим
          </button>
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

        <AppCard as="article" tone="soft" className="quick-actions-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Быстрые разделы</span>
              <h2 className="section-title">Что открыть дальше</h2>
            </div>
          </div>
          <div className="quick-action-list">
            <button type="button" className="ghost-button full-width" onClick={onOpenDictionary}>
              Смотреть словарь с карточками
            </button>
            <button type="button" className="ghost-button full-width" onClick={onOpenPacks}>
              Открыть тематические паки
            </button>
            <button type="button" className="ghost-button full-width" onClick={onOpenProfile}>
              Перейти в профиль и историю
            </button>
          </div>
        </AppCard>
      </section>
    </section>
  );
}
