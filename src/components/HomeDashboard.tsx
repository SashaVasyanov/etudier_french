import { countWordsByStatus } from '../lib/exercises';
import { getTodayDateKey, percentage } from '../lib/utils';
import type { AppStorage, Word, WordProgress } from '../types';

interface HomeDashboardProps {
  words: Word[];
  storage: AppStorage;
  progressList: WordProgress[];
  onStartLesson: () => void;
  onOpenDictionary: () => void;
  onOpenStatistics: () => void;
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
  words,
  storage,
  progressList,
  onStartLesson,
  onOpenDictionary,
  onOpenStatistics,
}: HomeDashboardProps) {
  const today = storage.dailyStats.find((item) => item.date === getTodayDateKey());
  const todayAccuracy = today ? percentage(today.correctAnswers, today.totalAnswers) : 0;
  const masteredCount = countWordsByStatus(progressList, 'mastered');
  const reviewCount = getDueReviewCount(progressList);
  const learnedToday = today?.wordsLearned ?? 0;
  const progressPercent = words.length > 0 ? Math.round((masteredCount / words.length) * 100) : 0;

  return (
    <section className="dashboard-shell">
      <header className="hero-card">
        <div className="hero-copy">
          <span className="eyebrow">Сегодняшний урок</span>
          <h1 className="hero-title">Anki Plus</h1>
          <p className="hero-text">
            Французский словарь, модульные уроки и повторение по интервальному принципу.
          </p>
        </div>

        <div className="hero-actions">
          <button type="button" className="primary-button hero-button" onClick={onStartLesson}>
            Начать урок
          </button>
          <button type="button" className="secondary-button" onClick={onOpenDictionary}>
            Словарь
          </button>
          <button type="button" className="ghost-button" onClick={onOpenStatistics}>
            Статистика
          </button>
        </div>
      </header>

      <section className="stats-grid">
        <article className="info-card accent-card">
          <span className="info-label">Сегодняшний урок</span>
          <strong className="info-value">
            {today ? `${today.completedLessons} урок(а)` : '0 уроков'}
          </strong>
          <p className="info-subtle">Выучено сегодня: {learnedToday}</p>
        </article>

        <article className="info-card">
          <span className="info-label">Повторение</span>
          <strong className="info-value">{reviewCount}</strong>
          <p className="info-subtle">Слов готово к повторению прямо сейчас</p>
        </article>

        <article className="info-card">
          <span className="info-label">Выученные слова</span>
          <strong className="info-value">{masteredCount}</strong>
          <p className="info-subtle">Из {words.length} слов в общей базе</p>
        </article>

        <article className="info-card">
          <span className="info-label">Серия дней</span>
          <strong className="info-value">{storage.streakDays}</strong>
          <p className="info-subtle">Точность за сегодня: {todayAccuracy}%</p>
        </article>
      </section>

      <section className="progress-panel">
        <div className="progress-meta">
          <span className="progress-caption">Общий прогресс</span>
          <span className="progress-count">{progressPercent}%</span>
        </div>
        <div className="progress-track" aria-hidden="true">
          <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
        <p className="info-subtle">
          Учится: {countWordsByStatus(progressList, 'learning') + countWordsByStatus(progressList, 'review')} ·
          Новых в очереди: {Math.max(words.length - progressList.length, 0)}
        </p>
      </section>

      <section className="quick-grid" aria-label="Быстрая навигация">
        <article className="quick-card">
          <strong>Модульный урок</strong>
          <span>Новые слова, тренировка, повторение и закрепление в одном проходе.</span>
        </article>
        <article className="quick-card">
          <strong>Личный словарь</strong>
          <span>Поиск по 1000 французских слов, статусы и быстрый аудио-повтор.</span>
        </article>
        <article className="quick-card">
          <strong>Умное повторение</strong>
          <span>Ошибки возвращают слово в изучение, правильные ответы растят интервал.</span>
        </article>
        <article className="quick-card">
          <strong>Недельная статистика</strong>
          <span>Смотрите точность, активность и накопленный прогресс по дням.</span>
        </article>
      </section>
    </section>
  );
}
