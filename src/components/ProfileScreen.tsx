import { useMemo } from 'react';
import { LEARNING_LANGUAGE_OPTIONS, getLearningLanguageMenuLabel } from '../lib/languages';
import { getCurrentStreakDays } from '../lib/storage';
import { summarizeStudyHistory, summarizeWordStatuses } from '../lib/studyMetrics';
import { formatDateTimeLabel, formatDurationLabel, formatLongDateLabel, countRu, pluralRu, RU_LESSONS, RU_MISTAKES, RU_MODULES, RU_WORDS } from '../lib/utils';
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
import { AppIcon } from './AppIcon';
import { BackupPanel } from './BackupPanel';

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
  onExportBackup: () => string;
  onImportBackup: (raw: string) => string | null;
}

const DURATION_OPTIONS: LessonDurationMinutes[] = [10, 20, 30];
const WORD_TARGET_OPTIONS: LessonWordTarget[] = [10, 15, 20, 25, 30, 35, 40, 45, 50];

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
  onExportBackup,
  onImportBackup,
}: ProfileScreenProps) {
  const stats = useMemo(() => summarizeWordStatuses(progressList), [progressList]);
  const languageHistory = useMemo(
    () => storage.studyHistory.filter((entry) => entry.language === learningLanguage),
    [learningLanguage, storage.studyHistory],
  );
  const history = useMemo(() => [...languageHistory].reverse(), [languageHistory]);
  const summary = summarizeStudyHistory(languageHistory);
  const lessonsCompleted = Math.max(storage.lessonTotals[learningLanguage], languageHistory.length);
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
          <span className="settings-overview-icon violet"><AppIcon name="book-open" size={22} /></span>
          <div><strong>{stats.seen}</strong><small>{pluralRu(stats.seen, ['слово встречалось', 'слова встречалось', 'слов встречалось'])}</small></div>
        </article>
        <article>
          <span className="settings-overview-icon green"><AppIcon name="check-circle" size={22} /></span>
          <div><strong>{stats.learned}</strong><small>{pluralRu(stats.learned, ['слово освоено', 'слова освоено', 'слов освоено'])}</small></div>
        </article>
        <article>
          <span className="settings-overview-icon orange"><AppIcon name="flame" size={22} /></span>
          <div><strong>{getCurrentStreakDays(storage)}</strong><small>{pluralRu(getCurrentStreakDays(storage), ['день в серии', 'дня в серии', 'дней в серии'])}</small></div>
        </article>
        <article>
          <span className="settings-overview-icon blue"><AppIcon name="calendar" size={22} /></span>
          <div><strong>{lessonsCompleted}</strong><small>{pluralRu(lessonsCompleted, ['урок завершён', 'урока завершено', 'уроков завершено'])}</small></div>
        </article>
      </section>

      <div className="settings-grid">
        <section className="settings-panel settings-profile-panel">
          <div className="settings-section-title">
            <span className="settings-icon"><AppIcon name="user" size={21} /></span>
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
              maxLength={80}
              onChange={(event) => onProfileNameChange(event.target.value)}
              placeholder="Введите имя"
            />
          </label>
          <div className="settings-mini-grid">
            <span>
              <strong>{stats.learned}</strong>
              Освоено
            </span>
            <span>
              <strong>{stats.inProgress}</strong>
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
            <span className="settings-icon"><AppIcon name="settings" size={21} /></span>
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
                  : 'Без лимита: все запланированные повторения сразу, новые слова — по дневной норме.'}
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
              <small>Задаёт объём урока и дневную норму новых слов. Длительность подстроится сама.</small>
            </span>
            <select
              className="settings-select"
              value={lessonWordTarget}
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
            <span className="settings-icon"><AppIcon name="trend-up" size={21} /></span>
            <div>
              <h2>Сводка</h2>
              <p>Короткий срез по выбранному языку.</p>
            </div>
          </div>
          <div className="settings-summary-list">
            <span>
              <strong>{summary.weeklyLessons}</strong>
              {pluralRu(summary.weeklyLessons, RU_LESSONS)} за 7 дней
            </span>
            <span>
              <strong>{summary.totalWeeklyWords}</strong>
              {pluralRu(summary.totalWeeklyWords, RU_WORDS)} за 7 дней
            </span>
            <span>
              <strong>{summary.weeklyAccuracy}%</strong>
              точность за 7 дней
            </span>
            <span>
              <strong>{summary.monthlyLessons}</strong>
              {pluralRu(summary.monthlyLessons, RU_LESSONS)} за 30 дней
            </span>
            <span>
              <strong>{summary.totalMonthlyWords}</strong>
              {pluralRu(summary.totalMonthlyWords, RU_WORDS)} за 30 дней
            </span>
            <span>
              <strong>{summary.monthlyAccuracy}%</strong>
              точность за 30 дней
            </span>
          </div>
        </section>

        <BackupPanel onExport={onExportBackup} onImport={onImportBackup} />

        <section className="settings-panel settings-history-panel">
          <div className="settings-section-title">
            <span className="settings-icon"><AppIcon name="clock" size={21} /></span>
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
                    {countRu(entry.wordsLearned, RU_WORDS)} · {countRu(entry.mistakesMade, RU_MISTAKES)} · {countRu(entry.modulesCompleted, RU_MODULES)} ·{' '}
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
