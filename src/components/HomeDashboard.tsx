import { useMemo, useState, type CSSProperties } from 'react';
import { LEARNING_LANGUAGE_OPTIONS, getLearningLanguageMenuLabel } from '../lib/languages';
import { getTodayDateKey, percentage } from '../lib/utils';
import type { AppStorage, LearningLanguage, LessonDurationMinutes, LessonWordTarget, Word, WordPack, WordProgress } from '../types';

interface HomeDashboardProps {
  availableWords: Word[];
  totalWords: Word[];
  storage: AppStorage;
  progressList: WordProgress[];
  packs: WordPack[];
  addedPacksCount: number;
  learningLanguage: LearningLanguage;
  lessonDurationMinutes: LessonDurationMinutes;
  lessonWordTarget: LessonWordTarget;
  lessonSourcePackId: string | null;
  onLearningLanguageChange: (value: LearningLanguage) => void;
  onLessonDurationChange: (value: LessonDurationMinutes) => void;
  onLessonWordTargetChange: (value: LessonWordTarget) => void;
  onLessonSourcePackChange: (packId: string | null) => void;
  onStartLesson: () => void;
  onStartExtraLesson: () => void;
  onStartFlashcards: () => void;
  onOpenDictionary: () => void;
  onOpenStatistics: () => void;
  onOpenProfile: () => void;
  onOpenPacks: () => void;
}

const DURATION_OPTIONS: LessonDurationMinutes[] = [10, 20, 30];
const WORD_TARGET_OPTIONS: LessonWordTarget[] = [10, 15, 20, 25, 30, 35, 40, 45, 50];
const WEEK_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function getPackCompletion(pack: WordPack, storage: AppStorage): number {
  if (pack.words.length === 0) {
    return 0;
  }

  const masteredWords = pack.words.filter((word) => storage.progressByWordId[word.id]?.status === 'mastered').length;
  return Math.round((masteredWords / pack.words.length) * 100);
}

export function HomeDashboard({
  availableWords,
  totalWords,
  storage,
  progressList,
  packs,
  addedPacksCount,
  learningLanguage,
  lessonDurationMinutes,
  lessonWordTarget,
  lessonSourcePackId,
  onLearningLanguageChange,
  onLessonDurationChange,
  onLessonWordTargetChange,
  onLessonSourcePackChange,
  onStartLesson,
  onStartExtraLesson,
  onStartFlashcards,
  onOpenDictionary,
  onOpenStatistics,
  onOpenProfile,
  onOpenPacks,
}: HomeDashboardProps) {
  const [openMenu, setOpenMenu] = useState<'language' | 'duration' | 'target' | 'pack' | null>(null);
  const today = storage.dailyStats.find(
    (item) => item.date === getTodayDateKey() && item.language === learningLanguage,
  );
  const todayAccuracy = today ? percentage(today.correctAnswers, today.totalAnswers) : 0;
  const learnedWordIds = new Set(
    progressList
      .filter((progress) => progress.status === 'mastered')
      .map((progress) => progress.word_id),
  );
  const wordsInProcess = Math.max(0, availableWords.length - learnedWordIds.size);
  const selectedLessonPack = packs.find((pack) => pack.id === lessonSourcePackId) ?? null;
  const lessonPackLabel = selectedLessonPack ? selectedLessonPack.title : 'Все слова';
  const recentPacks = useMemo(
    () =>
      [...packs]
        .sort((left, right) => getPackCompletion(right, storage) - getPackCompletion(left, storage))
        .slice(0, 3),
    [packs, storage],
  );
  const weeklyPoints = WEEK_LABELS.map((label, index) => {
    const value = storage.dailyStats
      .filter((entry) => entry.language === learningLanguage)
      .slice(-7)[index]?.wordsLearned ?? 0;

    return { label, value };
  });
  const maxWeekly = Math.max(1, ...weeklyPoints.map((point) => point.value));
  const overallProgress = percentage(learnedWordIds.size, Math.max(1, totalWords.length));

  return (
    <section className="dashboard-shell dashboard-modern">
      <header className="dashboard-modern-head">
        <div>
          <h1>Доброе утро, {storage.profile.displayName}!</h1>
          <p>Продолжайте обучение: уроки, паки и словарь доступны из одной панели.</p>
        </div>
        <button type="button" className="profile-chip" onClick={onOpenProfile}>
          <span>{storage.profile.displayName.slice(0, 1).toUpperCase()}</span>
          Настройки
        </button>
      </header>

      <div className="dashboard-modern-grid">
        <section className="dashboard-card lesson-summary-card">
          <div className="dashboard-card-icon">□</div>
          <div>
            <span className="dashboard-card-kicker">Сегодняшний урок</span>
            <h2>Начать урок</h2>
            <p>
              {lessonWordTarget} слов · {lessonDurationMinutes} мин · {lessonPackLabel}
            </p>
          </div>

          <div className="lesson-inline-settings" aria-label="Настройки урока">
            <div className={openMenu === 'language' ? 'home-selector open' : 'home-selector'}>
              <button type="button" onClick={() => setOpenMenu(openMenu === 'language' ? null : 'language')}>
                {getLearningLanguageMenuLabel(learningLanguage)}
              </button>
              {openMenu === 'language' ? (
                <div className="home-selector-menu" role="menu">
                  {LEARNING_LANGUAGE_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={option === learningLanguage ? 'active' : ''}
                      onClick={() => {
                        onLearningLanguageChange(option);
                        setOpenMenu(null);
                      }}
                    >
                      {getLearningLanguageMenuLabel(option)}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className={openMenu === 'duration' ? 'home-selector open' : 'home-selector'}>
              <button type="button" onClick={() => setOpenMenu(openMenu === 'duration' ? null : 'duration')}>
                {lessonDurationMinutes} мин
              </button>
              {openMenu === 'duration' ? (
                <div className="home-selector-menu" role="menu">
                  {DURATION_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={option === lessonDurationMinutes ? 'active' : ''}
                      onClick={() => {
                        onLessonDurationChange(option);
                        setOpenMenu(null);
                      }}
                    >
                      {option} минут
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className={openMenu === 'target' ? 'home-selector open' : 'home-selector'}>
              <button type="button" onClick={() => setOpenMenu(openMenu === 'target' ? null : 'target')}>
                {lessonWordTarget} слов
              </button>
              {openMenu === 'target' ? (
                <div className="home-selector-menu" role="menu">
                  {WORD_TARGET_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={option === lessonWordTarget ? 'active' : ''}
                      onClick={() => {
                        onLessonWordTargetChange(option);
                        setOpenMenu(null);
                      }}
                    >
                      {option} слов
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className={openMenu === 'pack' ? 'home-selector open' : 'home-selector'}>
              <button type="button" title={lessonPackLabel} onClick={() => setOpenMenu(openMenu === 'pack' ? null : 'pack')}>
                {lessonPackLabel}
              </button>
              {openMenu === 'pack' ? (
                <div className="home-selector-menu scrollable" role="menu">
                  <button
                    type="button"
                    className={lessonSourcePackId === null ? 'active' : ''}
                    onClick={() => {
                      onLessonSourcePackChange(null);
                      setOpenMenu(null);
                    }}
                  >
                    Все слова
                  </button>
                  {packs.map((pack) => (
                    <button
                      key={pack.id}
                      type="button"
                      className={pack.id === lessonSourcePackId ? 'active' : ''}
                      onClick={() => {
                        onLessonSourcePackChange(pack.id);
                        setOpenMenu(null);
                      }}
                    >
                      {pack.title}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="lesson-progress-line" aria-hidden="true">
            <span style={{ width: `${Math.min(100, Math.max(8, overallProgress))}%` }} />
          </div>
          <button type="button" className="primary-button compact-action" onClick={onStartLesson}>
            Начать урок
          </button>
        </section>

        <section className="dashboard-card progress-summary-card">
          <span className="dashboard-card-kicker">Прогресс</span>
          <div className="progress-ring-card" style={{ '--progress': `${overallProgress * 3.6}deg` } as CSSProperties}>
            <strong>{overallProgress}%</strong>
            <span>освоено</span>
          </div>
          <div className="progress-mini-list">
            <span>{learnedWordIds.size} выучено</span>
            <span>{wordsInProcess} в работе</span>
            <span>{totalWords.length - availableWords.length} вне активного пула</span>
          </div>
        </section>

        <section className="dashboard-card quick-practice-card">
          <span className="dashboard-card-kicker">Быстрая практика</span>
          <h2>Что потренировать?</h2>
          <button type="button" className="quick-row-button" onClick={onStartFlashcards}>
            <span>▣</span>
            <strong>Карточки</strong>
            <small>Повторить слова с картинками</small>
          </button>
          <button type="button" className="quick-row-button" onClick={onStartExtraLesson}>
            <span>✎</span>
            <strong>Смешанная практика</strong>
            <small>Дополнительные упражнения</small>
          </button>
          <button type="button" className="quick-inline-link" onClick={onOpenDictionary}>
            Открыть словарь
          </button>
        </section>

        <section className="dashboard-card recent-packs-card">
          <div className="card-title-row">
            <span className="dashboard-card-kicker">Паки · {addedPacksCount} добавлено</span>
            <button type="button" className="small-link-button" onClick={onOpenPacks}>
              Все паки
            </button>
          </div>
          <div className="recent-pack-list">
            {recentPacks.map((pack) => {
              const completion = getPackCompletion(pack, storage);

              return (
                <button key={pack.id} type="button" className="recent-pack-row" onClick={onOpenPacks}>
                  <span className="recent-pack-icon">▧</span>
                  <strong>{pack.title}</strong>
                  <small>{pack.words.length} слов</small>
                  <i aria-hidden="true">
                    <b style={{ width: `${Math.max(8, completion)}%` }} />
                  </i>
                  <em>{completion}%</em>
                </button>
              );
            })}
          </div>
        </section>

        <section className="dashboard-card weekly-overview-card">
          <div className="card-title-row">
            <span className="dashboard-card-kicker">Неделя</span>
            <button type="button" className="small-link-button" onClick={onOpenStatistics}>
              Статистика
            </button>
          </div>
          <div className="weekly-kpi-grid">
            <span>{availableWords.length} слов</span>
            <span>{todayAccuracy}% точность</span>
            <span>{storage.streakDays} дн. серия</span>
          </div>
          <div className="weekly-mini-chart" aria-label="Слова по дням недели">
            {weeklyPoints.map((point) => (
              <div key={point.label}>
                <span style={{ height: `${Math.max(10, (point.value / maxWeekly) * 100)}%` }} />
                <small>{point.label}</small>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
