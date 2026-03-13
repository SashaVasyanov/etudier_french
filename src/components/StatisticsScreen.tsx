import { countWordsByStatus } from '../lib/exercises';
import { formatShortDateLabel, percentage } from '../lib/utils';
import type { AppStorage, WordProgress } from '../types';

interface StatisticsScreenProps {
  storage: AppStorage;
  progressList: WordProgress[];
  onBack: () => void;
}

function getWeeklyActivity(storage: AppStorage) {
  return [...storage.dailyStats].slice(-7);
}

export default function StatisticsScreen({
  storage,
  progressList,
  onBack,
}: StatisticsScreenProps) {
  const totalAnswers = storage.dailyStats.reduce((sum, item) => sum + item.totalAnswers, 0);
  const correctAnswers = storage.dailyStats.reduce((sum, item) => sum + item.correctAnswers, 0);
  const weeklyActivity = getWeeklyActivity(storage);
  const maxWeeklyValue = Math.max(...weeklyActivity.map((item) => item.totalAnswers), 1);
  const accuracy = percentage(correctAnswers, totalAnswers);

  return (
    <section className="dashboard-shell">
      <header className="hero-card compact-card">
        <div className="screen-header">
          <div>
            <span className="eyebrow">Статистика</span>
            <h1 className="section-title">Прогресс обучения</h1>
            <p className="hero-text">Еженедельная активность, точность и текущие статусы слов.</p>
          </div>
          <button type="button" className="ghost-button" onClick={onBack}>
            На главную
          </button>
        </div>
      </header>

      <section className="stats-grid">
        <article className="info-card accent-card">
          <span className="info-label">Всего выучено</span>
          <strong className="info-value">{countWordsByStatus(progressList, 'mastered')}</strong>
          <p className="info-subtle">Слова, которые дошли до статуса «выучено»</p>
        </article>
        <article className="info-card">
          <span className="info-label">Сейчас изучаются</span>
          <strong className="info-value">
            {countWordsByStatus(progressList, 'learning') + countWordsByStatus(progressList, 'review')}
          </strong>
          <p className="info-subtle">Активные слова в процессе повторения</p>
        </article>
        <article className="info-card">
          <span className="info-label">Освоенные слова</span>
          <strong className="info-value">{countWordsByStatus(progressList, 'mastered')}</strong>
          <p className="info-subtle">Закреплены на длинном интервале</p>
        </article>
        <article className="info-card">
          <span className="info-label">Точность ответов</span>
          <strong className="info-value">{accuracy}%</strong>
          <p className="info-subtle">По всем завершённым урокам</p>
        </article>
      </section>

      <section className="chart-card">
        <div className="chart-header">
          <h2 className="section-title">Недельная активность</h2>
          <span className="info-subtle">Последние 7 дней</span>
        </div>
        <div className="weekly-chart">
          {weeklyActivity.map((item) => {
            const height = Math.max(20, Math.round((item.totalAnswers / maxWeeklyValue) * 100));

            return (
              <div key={item.date} className="chart-column">
                <div className="chart-bar-wrap">
                  <div className="chart-bar" style={{ height: `${height}%` }} />
                </div>
                <strong>{item.totalAnswers}</strong>
                <span>{formatShortDateLabel(item.date)}</span>
              </div>
            );
          })}
        </div>
      </section>
    </section>
  );
}
