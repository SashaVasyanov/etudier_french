import { useMemo } from 'react';
import { formatDateTimeLabel, formatDurationLabel, formatLongDateLabel, percentage } from '../lib/utils';
import type { AppStorage, StudyHistoryEntry, UserProfile, WordProgress } from '../types';

interface ProfileScreenProps {
  profile: UserProfile;
  storage: AppStorage;
  progressList: WordProgress[];
  onProfileNameChange: (value: string) => void;
}

function countStatuses(progressList: WordProgress[]) {
  return {
    learned: progressList.filter((item) => item.shown_count > 0 || item.status === 'known' || item.status === 'mastered').length,
    known: progressList.filter((item) => item.status === 'known').length,
    mastered: progressList.filter((item) => item.status === 'mastered').length,
    difficult: progressList.filter((item) => item.status === 'difficult').length,
  };
}

function summarizeHistory(history: StudyHistoryEntry[]) {
  const weekly = history.slice(-7);
  const monthly = history.slice(-30);

  const totalWeeklyWords = weekly.reduce((sum, item) => sum + item.wordsLearned, 0);
  const totalMonthlyWords = monthly.reduce((sum, item) => sum + item.wordsLearned, 0);
  const weeklyAccuracy = percentage(
    weekly.reduce((sum, item) => sum + item.correctAnswers, 0),
    weekly.reduce((sum, item) => sum + item.totalAnswers, 0),
  );
  const monthlyAccuracy = percentage(
    monthly.reduce((sum, item) => sum + item.correctAnswers, 0),
    monthly.reduce((sum, item) => sum + item.totalAnswers, 0),
  );

  return {
    weeklyLessons: weekly.length,
    monthlyLessons: monthly.length,
    totalWeeklyWords,
    totalMonthlyWords,
    weeklyAccuracy,
    monthlyAccuracy,
  };
}

export default function ProfileScreen({
  profile,
  storage,
  progressList,
  onProfileNameChange,
}: ProfileScreenProps) {
  const stats = useMemo(() => countStatuses(progressList), [progressList]);
  const history = useMemo(() => [...storage.studyHistory].reverse(), [storage.studyHistory]);
  const summary = useMemo(() => summarizeHistory(storage.studyHistory), [storage.studyHistory]);

  function getModeLabel(mode: StudyHistoryEntry['mode']): string {
    if (mode === 'default') {
      return 'ежедневный урок';
    }

    if (mode === 'extra') {
      return 'дополнительное обучение';
    }

    if (mode === 'pack') {
      return 'практика пака';
    }

    return 'повтор ошибок';
  }

  return (
    <section className="dashboard-shell">
      <header className="hero-card profile-hero">
        <div className="profile-copy">
          <span className="eyebrow">Профиль</span>
          <h1 className="hero-title compact-title">Личный прогресс</h1>
          <p className="hero-text">
            История уроков, серия дней и сводка по словарю хранятся локально и сохраняются между перезапусками.
          </p>
        </div>

        <div className="profile-name-card">
          <label className="input-label" htmlFor="profile-name">
            Имя профиля
          </label>
          <input
            id="profile-name"
            className="text-input"
            value={profile.displayName}
            onChange={(event) => onProfileNameChange(event.target.value)}
            placeholder="Введите имя"
          />
          <p className="info-subtle">
            Последнее занятие:{' '}
            {profile.lastStudiedAt ? formatDateTimeLabel(profile.lastStudiedAt) : 'пока нет завершённых уроков'}
          </p>
        </div>
      </header>

      <section className="stats-grid profile-stats-grid">
        <article className="info-card accent-card">
          <span className="info-label">Всего изучено</span>
          <strong className="info-value">{stats.learned}</strong>
          <p className="info-subtle">Слова, которые уже попадали в обучение</p>
        </article>
        <article className="info-card">
          <span className="info-label">Уже известные</span>
          <strong className="info-value">{stats.known}</strong>
          <p className="info-subtle">Отмечены действием «Уже знаю»</p>
        </article>
        <article className="info-card">
          <span className="info-label">Выученные</span>
          <strong className="info-value">{stats.mastered}</strong>
          <p className="info-subtle">Уверенно закреплены</p>
        </article>
        <article className="info-card">
          <span className="info-label">Сложные слова</span>
          <strong className="info-value">{stats.difficult}</strong>
          <p className="info-subtle">Требуют внимания в повторении</p>
        </article>
        <article className="info-card">
          <span className="info-label">Серия дней</span>
          <strong className="info-value">{storage.streakDays}</strong>
          <p className="info-subtle">Текущий streak</p>
        </article>
        <article className="info-card">
          <span className="info-label">Завершено уроков</span>
          <strong className="info-value">{storage.studyHistory.length}</strong>
          <p className="info-subtle">Всего записей в истории</p>
        </article>
      </section>

      <section className="stats-grid profile-summary-grid">
        <article className="info-card">
          <span className="info-label">За 7 дней</span>
          <strong className="info-value">{summary.weeklyLessons}</strong>
          <p className="info-subtle">
            Уроков: слов выучено {summary.totalWeeklyWords}, точность {summary.weeklyAccuracy}%
          </p>
        </article>
        <article className="info-card">
          <span className="info-label">За 30 дней</span>
          <strong className="info-value">{summary.monthlyLessons}</strong>
          <p className="info-subtle">
            Уроков: слов выучено {summary.totalMonthlyWords}, точность {summary.monthlyAccuracy}%
          </p>
        </article>
      </section>

      <section className="timeline-card">
        <div className="chart-header">
          <div>
            <span className="eyebrow">История</span>
            <h2 className="section-title">Лента занятий по дням</h2>
          </div>
          <span className="info-subtle">Сохраняется локально после каждого завершённого урока</span>
        </div>

        {history.length === 0 ? (
          <p className="mistake-empty">История пока пустая. Завершите ежедневный урок, чтобы появилась первая запись.</p>
        ) : (
          <div className="timeline-list">
            {history.map((entry) => (
              <article key={entry.id} className="timeline-item">
                <div className="timeline-item-head">
                  <div>
                    <strong>{formatLongDateLabel(entry.date)}</strong>
                    <p className="info-subtle">{formatDateTimeLabel(entry.completedAt)}</p>
                  </div>
                  <span className="status-badge review">{getModeLabel(entry.mode)}</span>
                </div>

                <div className="timeline-stats">
                  <span>Модулей: {entry.modulesCompleted}</span>
                  <span>Слов выучено: {entry.wordsLearned}</span>
                  <span>Ошибок: {entry.mistakesMade}</span>
                  <span>Формат: {entry.durationMinutes} мин</span>
                  <span>Время: {formatDurationLabel(entry.timeSpentSeconds)}</span>
                </div>

                <div className="badge-row wrap-row">
                  {entry.moduleTitles.map((title) => (
                    <span key={`${entry.id}-${title}`} className="tag-badge">
                      {title}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
