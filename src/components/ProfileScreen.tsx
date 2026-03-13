import { useMemo } from 'react';
import { formatDateTimeLabel, formatDurationLabel, formatLongDateLabel, percentage } from '../lib/utils';
import type { AppStorage, StudyHistoryEntry, UserProfile, WordProgress } from '../types';
import { AppCard } from './AppCard';
import { StatCard } from './StatCard';

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

  return {
    weeklyLessons: weekly.length,
    monthlyLessons: monthly.length,
    totalWeeklyWords: weekly.reduce((sum, item) => sum + item.wordsLearned, 0),
    totalMonthlyWords: monthly.reduce((sum, item) => sum + item.wordsLearned, 0),
    weeklyAccuracy: percentage(
      weekly.reduce((sum, item) => sum + item.correctAnswers, 0),
      weekly.reduce((sum, item) => sum + item.totalAnswers, 0),
    ),
    monthlyAccuracy: percentage(
      monthly.reduce((sum, item) => sum + item.correctAnswers, 0),
      monthly.reduce((sum, item) => sum + item.totalAnswers, 0),
    ),
  };
}

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

export default function ProfileScreen({
  profile,
  storage,
  progressList,
  onProfileNameChange,
}: ProfileScreenProps) {
  const stats = useMemo(() => countStatuses(progressList), [progressList]);
  const history = useMemo(() => [...storage.studyHistory].reverse(), [storage.studyHistory]);
  const summary = useMemo(() => summarizeHistory(storage.studyHistory), [storage.studyHistory]);

  return (
    <section className="dashboard-shell">
      <AppCard as="header" tone="hero" className="profile-hero">
        <div className="profile-copy">
          <span className="eyebrow">Профиль</span>
          <h1 className="hero-title compact-title">Личный кабинет обучения</h1>
          <p className="hero-text">Здесь сохраняются имя, серия дней, статистика по словам и лента завершённых занятий.</p>
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
            Последнее занятие: {profile.lastStudiedAt ? formatDateTimeLabel(profile.lastStudiedAt) : 'пока нет завершённых уроков'}
          </p>
        </div>
      </AppCard>

      <section className="stats-grid profile-stats-grid">
        <StatCard label="Всего изучено" value={stats.learned} hint="Слова уже попадали в обучение" tone="accent" />
        <StatCard label="Уже известные" value={stats.known} hint="Отмечены как знакомые" />
        <StatCard label="Выученные" value={stats.mastered} hint="Уверенно закреплены" />
        <StatCard label="Сложные слова" value={stats.difficult} hint="Требуют дополнительного повтора" />
        <StatCard label="Серия дней" value={storage.streakDays} hint="Текущий streak" />
        <StatCard label="Завершено уроков" value={storage.studyHistory.length} hint="Всего записей в истории" />
      </section>

      <section className="stats-grid profile-summary-grid">
        <StatCard label="За 7 дней" value={summary.weeklyLessons} hint={`Слов: ${summary.totalWeeklyWords} · Точность ${summary.weeklyAccuracy}%`} tone="soft" />
        <StatCard label="За 30 дней" value={summary.monthlyLessons} hint={`Слов: ${summary.totalMonthlyWords} · Точность ${summary.monthlyAccuracy}%`} tone="soft" />
      </section>

      <AppCard as="section" className="timeline-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">История</span>
            <h2 className="section-title">Лента занятий</h2>
          </div>
          <p className="hero-text">Каждая завершённая сессия сохраняется локально вместе с модулями, ошибками и длительностью.</p>
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
                  <span className="tag-badge">{getModeLabel(entry.mode)}</span>
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
      </AppCard>
    </section>
  );
}
