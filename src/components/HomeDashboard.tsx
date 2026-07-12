import { useMemo } from 'react';
import { getTodayDateKey, percentage } from '../lib/utils';
import type {
  AppStorage,
  DailyLessonRecord,
  LearningLanguage,
  LessonDurationMinutes,
  LessonWordTarget,
  Word,
  WordPack,
  WordProgress,
} from '../types';

interface HomeDashboardProps {
  totalWords: Word[];
  storage: AppStorage;
  progressList: WordProgress[];
  packs: WordPack[];
  addedPacksCount: number;
  learningLanguage: LearningLanguage;
  lessonDurationEnabled: boolean;
  lessonDurationMinutes: LessonDurationMinutes;
  lessonWordTarget: LessonWordTarget;
  lessonSourcePackId: string | null;
  dailyCompletion: DailyLessonRecord | null;
  onStartLesson: () => void;
  onStartExtraLesson: () => void;
  onStartFlashcards: () => void;
  onLessonDurationChange: (value: LessonDurationMinutes) => void;
  onOpenStatistics: () => void;
  onOpenProfile: () => void;
  onOpenPacks: () => void;
}

const DAILY_MODULES = [
  { number: '1', title: 'Новые слова', tone: 'blue' },
  { number: '2', title: 'Первая практика', tone: 'violet' },
  { number: '3', title: 'Повторение', tone: 'orange' },
  { number: '4', title: 'Закрепление', tone: 'green' },
  { number: '5', title: 'Мини-проверка', tone: 'pink' },
];

const DURATION_OPTIONS: LessonDurationMinutes[] = [10, 20, 30];

function getPackCompletion(pack: WordPack, storage: AppStorage): number {
  if (pack.words.length === 0) {
    return 0;
  }

  const masteredWords = pack.words.filter((word) => storage.progressByWordId[word.id]?.status === 'mastered').length;
  return Math.round((masteredWords / pack.words.length) * 100);
}

export function HomeDashboard({
  totalWords,
  storage,
  progressList,
  packs,
  addedPacksCount,
  learningLanguage,
  lessonDurationEnabled,
  lessonDurationMinutes,
  lessonWordTarget,
  lessonSourcePackId,
  dailyCompletion,
  onStartLesson,
  onStartExtraLesson,
  onStartFlashcards,
  onLessonDurationChange,
  onOpenStatistics,
  onOpenProfile,
  onOpenPacks,
}: HomeDashboardProps) {
  const today = storage.dailyStats.find(
    (item) => item.date === getTodayDateKey() && item.language === learningLanguage,
  );
  const todayAccuracy = today ? percentage(today.correctAnswers, today.totalAnswers) : 0;
  const learnedWordIds = new Set(
    progressList
      .filter((progress) => progress.status === 'mastered')
      .map((progress) => progress.word_id),
  );
  const wordsInProcess = progressList.filter((progress) => progress.status === 'learning' || progress.status === 'review').length;
  const selectedLessonPack = packs.find((pack) => pack.id === lessonSourcePackId) ?? null;
  const lessonPackLabel = selectedLessonPack ? selectedLessonPack.title : 'Все слова';
  const displayName = storage.profile.displayName.trim() || 'Ученик';
  const activePack = useMemo(
    () =>
      [...packs]
        .sort((left, right) => getPackCompletion(right, storage) - getPackCompletion(left, storage))
        .find((pack) => pack.id === selectedLessonPack?.id) ?? packs[0] ?? null,
    [packs, selectedLessonPack?.id, storage],
  );
  const overallProgress = percentage(learnedWordIds.size, Math.max(1, totalWords.length));
  const isDailyComplete = Boolean(dailyCompletion);
  const completedModuleCount = dailyCompletion?.completedModules ?? 0;
  const durationMeta = lessonDurationEnabled
    ? `${lessonDurationMinutes} минут · до ${lessonWordTarget} слов`
    : 'В своём темпе · без лимита';
  const packCompletion = activePack ? getPackCompletion(activePack, storage) : 0;
  const difficultCount = progressList.filter((progress) => progress.status === 'difficult').length;
  const learningLanguageLabel = learningLanguage === 'japanese' ? 'Японский' : 'Французский';
  const learningLanguageChip = learningLanguage === 'japanese' ? 'JP · японский' : 'FR · французский';

  return (
    <section className="learning-home">
      <header className="learning-home-head">
        <div className="learning-home-greeting">
          <span className="home-language-chip">{learningLanguageChip}</span>
          <h1>{isDailyComplete ? 'Классная работа, ' : 'Привет, '}{displayName}!</h1>
          <p>{isDailyComplete ? 'Дневная цель закрыта — можно закрепить результат в комфортном темпе.' : 'Сегодня достаточно одного короткого шага к уверенной речи.'}</p>
        </div>
        <div className="home-head-actions">
          <span className="streak-chip" aria-label={`Серия: ${storage.streakDays} дней`}>🔥 {storage.streakDays || '—'} дн.</span>
          <button type="button" className="home-avatar-button" aria-label="Открыть профиль" onClick={onOpenProfile}>
            {displayName.slice(0, 1).toUpperCase()}
          </button>
        </div>
      </header>

      <section className={isDailyComplete ? 'daily-journey-card is-complete' : 'daily-journey-card'}>
        <div className="daily-journey-copy">
          <span className="daily-card-kicker">Твоя программа на сегодня</span>
          <h2>{isDailyComplete ? 'На сегодня заданий нет' : `${learningLanguageLabel} — по чуть-чуть, но каждый день`}</h2>
          <p>{isDailyComplete ? 'Все 5 модулей завершены. Выбирай лёгкую дополнительную практику или возвращайся к словам.' : `${durationMeta} · тема: ${lessonPackLabel}`}</p>
        </div>

        <div className="daily-route" aria-label={`Прогресс дня: ${completedModuleCount} из 5 модулей`}>
          {DAILY_MODULES.map((module, index) => {
            const isDone = isDailyComplete || index < completedModuleCount;

            return (
              <div key={module.number} className={isDone ? 'daily-route-step done' : `daily-route-step ${module.tone}`}>
                <span>{isDone ? '✓' : module.number}</span>
                <strong>{module.title}</strong>
              </div>
            );
          })}
        </div>

        {!isDailyComplete ? (
          <div className="daily-journey-footer">
            <div className="duration-switch" role="radiogroup" aria-label="Выбор длительности урока">
              {DURATION_OPTIONS.map((duration) => {
                const isActive = duration === lessonDurationMinutes;

                return (
                  <button
                    key={duration}
                    type="button"
                    className={isActive ? 'active' : ''}
                    aria-pressed={isActive}
                    onClick={() => onLessonDurationChange(duration)}
                  >
                    {duration} мин
                  </button>
                );
              })}
            </div>
            <button type="button" className="daily-start-button" onClick={onStartLesson}>
              Начать урок <span aria-hidden="true">→</span>
            </button>
          </div>
        ) : (
          <div className="daily-journey-footer">
            <span className="daily-complete-meta">✓ {completedModuleCount || 5} из 5 модулей · {dailyCompletion?.totalAnswers ?? 0} ответов</span>
            <button type="button" className="daily-start-button" onClick={onStartExtraLesson}>
              Продолжить практику <span aria-hidden="true">→</span>
            </button>
          </div>
        )}
      </section>

      <div className="learning-home-grid">
        <section className="home-bento-card progress-bento-card">
          <div className="bento-heading">
            <span className="bento-icon blue">↗</span>
            <div>
              <span>Твой прогресс</span>
              <h2>{overallProgress}% пути</h2>
            </div>
          </div>
          <div className="home-progress-track" aria-label={`Освоено ${overallProgress}%`}>
            <span style={{ width: `${overallProgress}%` }} />
          </div>
          <div className="progress-bento-stats">
            <span><strong>{learnedWordIds.size}</strong> освоено</span>
            <span><strong>{wordsInProcess}</strong> в работе</span>
            <span><strong>{difficultCount}</strong> требуют внимания</span>
          </div>
          <button type="button" className="text-action-button" onClick={onOpenStatistics}>Смотреть статистику <span aria-hidden="true">→</span></button>
        </section>

        <section className="home-bento-card practice-bento-card">
          <span className="bento-icon yellow">⚡</span>
          <div>
            <span>Когда есть пара минут</span>
            <h2>Быстрая практика</h2>
          </div>
          <div className="practice-bento-actions">
            <button type="button" onClick={onStartFlashcards}><span>◈</span> Карточки</button>
            <button type="button" onClick={onStartExtraLesson}><span>✦</span> Микс заданий</button>
          </div>
        </section>

        <section className="home-bento-card pack-bento-card">
          <div className="bento-heading">
            <span className="bento-icon pink">✿</span>
            <div>
              <span>Словари по темам</span>
              <h2>{activePack?.title ?? 'Выбери пак'}</h2>
            </div>
          </div>
          <p>{activePack ? `${activePack.words.length} слов · ${packCompletion}% освоено` : `${addedPacksCount} паков уже добавлено`}</p>
          <div className="pack-bento-progress"><span style={{ width: `${packCompletion}%` }} /></div>
          <button type="button" className="text-action-button" onClick={onOpenPacks}>Открыть паки <span aria-hidden="true">→</span></button>
        </section>

        <section className="home-bento-card today-bento-card">
          <span className="bento-icon green">☘</span>
          <div>
            <span>Сегодняшний ритм</span>
            <h2>{todayAccuracy > 0 ? `${todayAccuracy}% точность` : 'Первый шаг ждёт'}</h2>
            <p>{today ? `${today.wordsLearned} слов в активном повторении` : 'Начни короткий урок — и появится твоя статистика.'}</p>
          </div>
        </section>
      </div>
    </section>
  );
}
