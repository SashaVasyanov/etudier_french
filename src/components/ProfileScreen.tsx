import { useMemo } from 'react';
import { LEARNING_LANGUAGE_OPTIONS, getLearningLanguageMenuLabel } from '../lib/languages';
import { formatDateTimeLabel, formatDurationLabel, formatLongDateLabel, percentage } from '../lib/utils';
import type {
  AppStorage,
  LearningLanguage,
  LessonDurationMinutes,
  LessonWordTarget,
  StudyHistoryEntry,
  UserProfile,
  WordPack,
  WordProgress,
} from '../types';

interface ProfileScreenProps {
  learningLanguage: LearningLanguage;
  profile: UserProfile;
  storage: AppStorage;
  progressList: WordProgress[];
  packs: WordPack[];
  lessonDurationEnabled: boolean;
  lessonDurationMinutes: LessonDurationMinutes;
  lessonWordTarget: LessonWordTarget;
  lessonSourcePackId: string | null;
  onProfileNameChange: (value: string) => void;
  onLearningLanguageChange: (value: LearningLanguage) => void;
  onLessonDurationEnabledChange: (value: boolean) => void;
  onLessonDurationChange: (value: LessonDurationMinutes) => void;
  onLessonWordTargetChange: (value: LessonWordTarget) => void;
  onLessonSourcePackChange: (packId: string | null) => void;
}

const DURATION_OPTIONS: LessonDurationMinutes[] = [10, 20, 30];
const WORD_TARGET_OPTIONS: LessonWordTarget[] = [10, 15, 20, 25, 30, 35, 40, 45, 50];

function countStatuses(progressList: WordProgress[]) {
  return {
    learned: progressList.filter((item) => item.shown_count > 0 || item.status === 'mastered').length,
    mastered: progressList.filter((item) => item.status === 'mastered').length,
    difficult: progressList.filter((item) => item.status === 'difficult').length,
    learning: progressList.filter((item) => item.status === 'learning' || item.status === 'review').length,
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
  learningLanguage,
  profile,
  storage,
  progressList,
  packs,
  lessonDurationEnabled,
  lessonDurationMinutes,
  lessonWordTarget,
  lessonSourcePackId,
  onProfileNameChange,
  onLearningLanguageChange,
  onLessonDurationEnabledChange,
  onLessonDurationChange,
  onLessonWordTargetChange,
  onLessonSourcePackChange,
}: ProfileScreenProps) {
  const stats = useMemo(() => countStatuses(progressList), [progressList]);
  const languageHistory = useMemo(
    () => storage.studyHistory.filter((entry) => entry.language === learningLanguage),
    [learningLanguage, storage.studyHistory],
  );
  const history = useMemo(() => [...languageHistory].reverse(), [languageHistory]);
  const summary = useMemo(() => summarizeHistory(languageHistory), [languageHistory]);
  const selectedPack = packs.find((pack) => pack.id === lessonSourcePackId) ?? null;
  const displayName = profile.displayName.trim() || 'Ученик';

  return (
    <section className="settings-page">
      <header className="settings-head">
        <div>
          <span className="dashboard-card-kicker">Настройки</span>
          <h1>Профиль и обучение</h1>
          <p>Здесь меняются рабочие параметры уроков, язык обучения и локальный профиль.</p>
        </div>
        <div className="settings-user-card" aria-label="Текущий профиль">
          <span>{displayName.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{displayName}</strong>
            <small>{profile.lastStudiedAt ? formatDateTimeLabel(profile.lastStudiedAt) : 'ещё нет завершённых уроков'}</small>
          </div>
        </div>
      </header>

      <section className="settings-profile-overview" aria-label="Сводка профиля">
        <article>
          <span className="settings-overview-icon violet" aria-hidden="true">◆</span>
          <div><strong>{stats.learned}</strong><small>слов встречалось</small></div>
        </article>
        <article>
          <span className="settings-overview-icon green" aria-hidden="true">✓</span>
          <div><strong>{stats.mastered}</strong><small>слов освоено</small></div>
        </article>
        <article>
          <span className="settings-overview-icon orange" aria-hidden="true">🔥</span>
          <div><strong>{storage.streakDays}</strong><small>дней в серии</small></div>
        </article>
        <article>
          <span className="settings-overview-icon blue" aria-hidden="true">◷</span>
          <div><strong>{languageHistory.length}</strong><small>уроков завершено</small></div>
        </article>
      </section>

      <div className="settings-grid">
        <section className="settings-panel settings-profile-panel">
          <div className="settings-section-title">
            <span className="settings-icon">◎</span>
            <div>
              <h2>Аккаунт</h2>
              <p>Имя отображается на главном экране и в локальной истории.</p>
            </div>
          </div>
          <label className="settings-field" htmlFor="profile-name">
            <span>Имя профиля</span>
            <input
              id="profile-name"
              className="settings-input"
              value={profile.displayName}
              onChange={(event) => onProfileNameChange(event.target.value)}
              placeholder="Введите имя"
            />
          </label>
          <div className="settings-mini-grid">
            <span>
              <strong>{stats.mastered}</strong>
              Выучено
            </span>
            <span>
              <strong>{stats.learning}</strong>
              В работе
            </span>
            <span>
              <strong>{stats.difficult}</strong>
              Сложные
            </span>
          </div>
        </section>

        <section className="settings-panel settings-study-panel">
          <div className="settings-section-title">
            <span className="settings-icon">▣</span>
            <div>
              <h2>Учёба</h2>
              <p>Эти значения сразу используются при запуске следующего урока.</p>
            </div>
          </div>

          <label className="settings-row">
            <span>
              Учебный язык
              <small>Словарь и паки переключаются вместе с языком.</small>
            </span>
            <select
              className="settings-select"
              value={learningLanguage}
              onChange={(event) => onLearningLanguageChange(event.target.value as LearningLanguage)}
            >
              {LEARNING_LANGUAGE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {getLearningLanguageMenuLabel(option)}
                </option>
              ))}
            </select>
          </label>

          <div className="settings-row">
            <span>
              Лимит длительности
              <small>
                {lessonDurationEnabled
                  ? 'Урок ограничен выбранными минутами и количеством слов.'
                  : 'Урок идёт без лимита, пока выбранный пул слов не закончится.'}
              </small>
            </span>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={lessonDurationEnabled}
                onChange={(event) => onLessonDurationEnabledChange(event.target.checked)}
              />
              <span>{lessonDurationEnabled ? 'Включён' : 'Выключен'}</span>
            </label>
          </div>

          <label className="settings-row">
            <span>
              Длительность
              <small>Влияет на размер и плотность урока.</small>
            </span>
            <select
              className="settings-select"
              value={lessonDurationMinutes}
              disabled={!lessonDurationEnabled}
              onChange={(event) => onLessonDurationChange(Number(event.target.value) as LessonDurationMinutes)}
            >
              {DURATION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option} минут
                </option>
              ))}
            </select>
          </label>

          <label className="settings-row">
            <span>
              Слов в уроке
              <small>Можно выбрать короткую или плотную сессию.</small>
            </span>
            <select
              className="settings-select"
              value={lessonWordTarget}
              disabled={!lessonDurationEnabled}
              onChange={(event) => onLessonWordTargetChange(Number(event.target.value) as LessonWordTarget)}
            >
              {WORD_TARGET_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option} слов
                </option>
              ))}
            </select>
          </label>

          <label className="settings-row">
            <span>
              Источник слов
              <small>{selectedPack ? `Сейчас выбран пак “${selectedPack.title}”.` : 'Сейчас используются все активные слова.'}</small>
            </span>
            <select
              className="settings-select"
              value={lessonSourcePackId ?? ''}
              onChange={(event) => onLessonSourcePackChange(event.target.value === '' ? null : event.target.value)}
            >
              <option value="">Все слова</option>
              {packs.map((pack) => (
                <option key={pack.id} value={pack.id}>
                  {pack.title}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="settings-panel settings-summary-panel">
          <div className="settings-section-title">
            <span className="settings-icon">↗</span>
            <div>
              <h2>Сводка</h2>
              <p>Короткий срез по выбранному языку.</p>
            </div>
          </div>
          <div className="settings-summary-list">
            <span>
              <strong>{summary.weeklyLessons}</strong>
              уроков за 7 дней
            </span>
            <span>
              <strong>{summary.totalWeeklyWords}</strong>
              слов за 7 дней
            </span>
            <span>
              <strong>{summary.weeklyAccuracy}%</strong>
              точность за 7 дней
            </span>
            <span>
              <strong>{summary.monthlyLessons}</strong>
              уроков за 30 дней
            </span>
            <span>
              <strong>{summary.totalMonthlyWords}</strong>
              слов за 30 дней
            </span>
            <span>
              <strong>{summary.monthlyAccuracy}%</strong>
              точность за 30 дней
            </span>
          </div>
        </section>

        <section className="settings-panel settings-history-panel">
          <div className="settings-section-title">
            <span className="settings-icon">◷</span>
            <div>
              <h2>История</h2>
              <p>Последние завершённые занятия сохраняются локально.</p>
            </div>
          </div>

          {history.length === 0 ? (
            <p className="settings-empty">История пока пустая. Завершите урок, чтобы появилась первая запись.</p>
          ) : (
            <div className="settings-history-list">
              {history.slice(0, 8).map((entry) => (
                <article key={entry.id} className="settings-history-item">
                  <div>
                    <strong>{formatLongDateLabel(entry.date)}</strong>
                    <small>{formatDateTimeLabel(entry.completedAt)}</small>
                  </div>
                  <span>{getModeLabel(entry.mode)}</span>
                  <p>
                    {entry.wordsLearned} слов · {entry.mistakesMade} ошибок · {entry.modulesCompleted} модулей ·{' '}
                    {entry.durationMinutes} мин · {formatDurationLabel(entry.timeSpentSeconds)}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
