import { useMemo } from 'react';
import { getTodayDateKey, countRu, RU_ANSWERS, RU_DAYS, RU_PACKS, RU_REVIEWS, RU_WORDS } from '../lib/utils';
import { getCurrentStreakDays } from '../lib/storage';
import type { DailyBalance } from '../lib/exercises';
import { getPackCompletionRatio } from '../lib/packs';
import { getCurrentLevel, getLevelProgress, getMemoryMilestone, isInMemory } from '../lib/milestones';
import { getLessonProgress } from '../lib/lessonSession';
import { getAnswerAccuracy, summarizeWordStatuses } from '../lib/studyMetrics';
import type { LessonDraft } from '../lib/lessonDraft';
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
import { AppIcon } from './AppIcon';

interface HomeDashboardProps {
  totalWords: Word[];
  dailyDraft: LessonDraft | null;
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
  onStartQuickReview: () => void;
  dailyBalance: DailyBalance;
  onStartFlashcards: () => void;
  onLessonDurationChange: (value: LessonDurationMinutes) => void;
  onOpenStatistics: () => void;
  onOpenProfile: () => void;
  onOpenPacks: () => void;
  onOpenRadicals: () => void;
}

const DAILY_MODULES = [
  { number: '1', title: 'Новые слова', tone: 'blue' },
  { number: '2', title: 'Первая практика', tone: 'violet' },
  { number: '3', title: 'Повторение', tone: 'orange' },
  { number: '4', title: 'Закрепление', tone: 'green' },
  { number: '5', title: 'Мини-проверка', tone: 'pink' },
];

const DURATION_OPTIONS: LessonDurationMinutes[] = [10, 20, 30];

export function HomeDashboard({
  totalWords,
  dailyDraft,
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
  onStartQuickReview,
  dailyBalance,
  onStartFlashcards,
  onLessonDurationChange,
  onOpenStatistics,
  onOpenProfile,
  onOpenPacks,
  onOpenRadicals,
}: HomeDashboardProps) {
  const today = storage.dailyStats.find(
    (item) => item.date === getTodayDateKey() && item.language === learningLanguage,
  );
  const todayAccuracy = getAnswerAccuracy(storage.dailyStats, learningLanguage, getTodayDateKey()).accuracy;
  const wordStats = summarizeWordStatuses(progressList);
  const wordsInProcess = wordStats.inProgress;
  const hasStudiedWords = wordsInProcess + wordStats.difficult + wordStats.learned > 0;
  const selectedLessonPack = packs.find((pack) => pack.id === lessonSourcePackId) ?? null;
  const lessonPackLabel = selectedLessonPack ? selectedLessonPack.title : 'Все слова';
  const displayName = storage.profile.displayName.trim() || 'Ученик';
  const activePack = useMemo(
    () =>
      selectedLessonPack ?? [...packs]
        .filter((pack) => storage.packStates[pack.id]?.status && storage.packStates[pack.id].status !== 'not_added')
        .sort((left, right) => getPackCompletionRatio(right, storage) - getPackCompletionRatio(left, storage))[0] ?? null,
    [packs, selectedLessonPack, storage],
  );
  const levels = useMemo(() => getLevelProgress(totalWords, storage), [totalWords, storage]);
  const currentLevel = getCurrentLevel(levels);
  const milestone = getMemoryMilestone(progressList.filter((progress) => isInMemory(progress)).length);
  const isDailyComplete = Boolean(dailyCompletion);
  const draftProgress = dailyDraft ? getLessonProgress(dailyDraft.session, dailyDraft.stepIndex) : null;
  const completedModuleCount = dailyCompletion?.completedModules ?? draftProgress?.completedModules ?? 0;
  const currentStreak = getCurrentStreakDays(storage);
  const durationMeta = lessonDurationEnabled
    ? `${lessonDurationMinutes} минут · до ${lessonWordTarget} слов`
    : 'В своём темпе · без лимита';
  const packCompletion = activePack ? getPackCompletionRatio(activePack, storage) : 0;
  const difficultCount = wordStats.difficult;
  const learningLanguageLabel = learningLanguage === 'japanese' ? 'Японский' : 'Французский';
  const learningLanguageChip = learningLanguage === 'japanese' ? 'JP · японский' : 'FR · французский';
  const radicalProgress = Object.values(storage.radicalProgressById);
  const masteredRadicals = radicalProgress.filter((progress) => progress.status === 'mastered').length;
  const learningRadicals = radicalProgress.filter((progress) => progress.status === 'learning').length;

  return (
    <section className="learning-home">
      <header className="learning-home-head">
        <div className="learning-home-greeting">
          <span className="home-language-chip">{learningLanguageChip}</span>
          <h1>{isDailyComplete ? 'Классная работа, ' : 'Привет, '}{displayName}!</h1>
          <p>{isDailyComplete ? 'Дневная цель закрыта — можно закрепить результат в комфортном темпе.' : 'Сегодня достаточно одного короткого шага к уверенной речи.'}</p>
        </div>
        <div className="home-head-actions">
          {currentStreak > 0 ? (
            <span className="streak-chip" aria-label={`Серия: ${countRu(currentStreak, RU_DAYS)}`}><AppIcon name="flame" size={18} /> {countRu(currentStreak, RU_DAYS)}</span>
          ) : null}
          <button type="button" className="home-avatar-button" aria-label="Открыть профиль" onClick={onOpenProfile}>
            {displayName.slice(0, 1).toUpperCase()}
          </button>
        </div>
      </header>

      <section className={isDailyComplete ? 'daily-journey-card is-complete' : 'daily-journey-card'}>
        <div className="daily-journey-copy">
          <span className="daily-card-kicker">Твоя программа на сегодня</span>
          <h2>{isDailyComplete ? 'На сегодня заданий нет' : `${learningLanguageLabel} — по чуть-чуть, но каждый день`}</h2>
          <p>{isDailyComplete ? 'Все 5 модулей завершены. Выбирай лёгкую дополнительную практику или возвращайся к словам.' : dailyDraft ? `Урок сохранён · выполнено ${draftProgress?.completedSteps} из ${dailyDraft.session.steps.length} шагов · осталось модулей: ${draftProgress?.remainingModules}` : `${durationMeta} · тема: ${lessonPackLabel}`}</p>
          {!isDailyComplete && !dailyDraft && dailyBalance.deferredNewWords > 0 ? (
            <p className="daily-backlog-note">
              {`Накопилось ${countRu(dailyBalance.dueCount, RU_REVIEWS)} — ${dailyBalance.newWords === 0 ? 'сегодня без новых слов' : 'новых слов сегодня меньше'}, сначала самое забываемое.`}
            </p>
          ) : null}
        </div>

        <div className="daily-route" aria-label={`Прогресс дня: ${completedModuleCount} из 5 модулей`}>
          {DAILY_MODULES.map((module, index) => {
            const isDone = isDailyComplete || index < completedModuleCount;

            return (
              <div key={module.number} className={isDone ? 'daily-route-step done' : `daily-route-step ${module.tone}`}>
                <span>{isDone ? <AppIcon name="check" size={15} /> : module.number}</span>
                <strong>{module.title}</strong>
              </div>
            );
          })}
        </div>

        {!isDailyComplete ? (
          <div className="daily-journey-footer">
            <div className="duration-switch" role="group" aria-label="Выбор длительности урока">
              {DURATION_OPTIONS.map((duration) => {
                const isActive = duration === (dailyDraft?.session.durationMinutes ?? lessonDurationMinutes);

                return (
                  <button
                    key={duration}
                    type="button"
                    className={isActive ? 'active' : ''}
                    aria-pressed={isActive}
                    disabled={Boolean(dailyDraft)}
                    title={dailyDraft ? 'Длительность текущего урока уже выбрана' : undefined}
                    onClick={() => onLessonDurationChange(duration)}
                  >
                    {duration} мин
                  </button>
                );
              })}
            </div>
            <button type="button" className="daily-start-button" onClick={onStartLesson}>
              {dailyDraft ? 'Продолжить урок' : 'Начать урок'} <AppIcon name="arrow-right" size={19} />
            </button>
          </div>
        ) : (
          <div className="daily-journey-footer">
            <span className="daily-complete-meta"><AppIcon name="check-circle" size={18} /> {completedModuleCount || 5} из 5 модулей · {countRu(dailyCompletion?.totalAnswers ?? 0, RU_ANSWERS)}</span>
            <button type="button" className="daily-start-button" onClick={onStartExtraLesson}>
              Продолжить практику <AppIcon name="arrow-right" size={19} />
            </button>
          </div>
        )}
      </section>

      <div className="learning-home-grid">
        <section className="home-bento-card progress-bento-card">
          <div className="bento-heading">
            <span className="bento-icon blue"><AppIcon name="trend-up" size={23} /></span>
            <div>
              <span>Твой прогресс</span>
              <h2>{countRu(milestone.count, RU_WORDS)} в памяти</h2>
            </div>
          </div>
          <div
            className="home-progress-track"
            role="progressbar"
            aria-label={milestone.next ? `До ${milestone.next} слов: ${Math.round(milestone.progress * 100)}%` : 'Все вехи пройдены'}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(milestone.progress * 100)}
          >
            <span style={{ width: `${Math.round(milestone.progress * 100)}%` }} />
          </div>
          <p className="milestone-note">
            {milestone.next
              ? `До отметки ${milestone.next} — ещё ${countRu(milestone.next - milestone.count, RU_WORDS)}${milestone.reached ? ` · ${milestone.reached} уже позади` : ''}`
              : 'Все отметки пройдены — дальше только вперёд.'}
          </p>
          <div className="progress-bento-stats">
            {currentLevel ? (
              <span title="Слова уровня, которые вы вспомнили на повторении">
                <strong>{currentLevel.inMemory} из {currentLevel.total}</strong> уровень {currentLevel.label}
              </span>
            ) : null}
            <span><strong>{wordsInProcess}</strong> в работе</span>
            <span><strong>{difficultCount}</strong> требуют внимания</span>
          </div>
          <button type="button" className="text-action-button" onClick={onOpenStatistics}>Смотреть статистику <AppIcon name="arrow-right" size={17} /></button>
        </section>

        <section className="home-bento-card practice-bento-card">
          <span className="bento-icon yellow"><AppIcon name="sparkles" size={23} /></span>
          <div>
            <span>Когда есть пара минут</span>
            <h2>Быстрая практика</h2>
            <p className="practice-quick-note">
              {dailyBalance.dueCount > 0
                ? `Ждут ${countRu(dailyBalance.dueCount, RU_REVIEWS)} — за 5 минут самые срочные.`
                : hasStudiedWords
                  ? 'Повторений сейчас нет — 5 минут на самые трудные слова.'
                  : 'Повторять пока нечего — начните с урока дня.'}
            </p>
          </div>
          <div className="practice-bento-actions">
            <button type="button" className="practice-quick-button" disabled={!hasStudiedWords} onClick={onStartQuickReview}><AppIcon name="play" size={18} /> 5 минут</button>
            <button type="button" onClick={onStartFlashcards}><AppIcon name="cards" size={18} /> Карточки</button>
            <button type="button" onClick={onStartExtraLesson}><AppIcon name="sparkles" size={18} /> Микс</button>
          </div>
        </section>

        <section className="home-bento-card pack-bento-card">
          <div className="bento-heading">
            <span className="bento-icon pink"><AppIcon name="layers" size={23} /></span>
            <div>
              <span>Словари по темам</span>
              <h2>{activePack?.title ?? 'Выбери пак'}</h2>
            </div>
          </div>
          <p>{activePack ? `${countRu(activePack.words.length, RU_WORDS)} · ${packCompletion}% освоено` : addedPacksCount > 0 ? `Добавлено: ${countRu(addedPacksCount, RU_PACKS)}` : 'Паки ещё не добавлены'}</p>
          <div className="pack-bento-progress"><span style={{ width: `${packCompletion}%` }} /></div>
          <button type="button" className="text-action-button" onClick={onOpenPacks}>Открыть паки <AppIcon name="arrow-right" size={17} /></button>
        </section>

        <section className="home-bento-card today-bento-card">
          <span className="bento-icon green"><AppIcon name="leaf" size={23} /></span>
          <div>
            <span>Сегодняшний ритм</span>
            <h2>{today && today.totalAnswers > 0 ? `${todayAccuracy}% точность сегодня` : 'Первый шаг ждёт'}</h2>
            <p>{today ? `Освоено: ${countRu(today.wordsLearned, RU_WORDS)} · ${countRu(today.totalAnswers, RU_ANSWERS)}` : 'Начни короткий урок — и появится твоя статистика.'}</p>
          </div>
        </section>

        {learningLanguage === 'japanese' ? (
          <section className="home-bento-card radicals-bento-card">
            <span className="radicals-bento-glyph" aria-hidden="true">部</span>
            <div>
              <span>Отдельно от слов</span>
              <h2>Ключи кандзи</h2>
              <p>{masteredRadicals > 0 || learningRadicals > 0
                ? `${masteredRadicals} освоено · ${learningRadicals} в работе`
                : 'Значения, формы и примеры в коротких тренировках.'}</p>
            </div>
            <button type="button" className="text-action-button" onClick={onOpenRadicals}>
              Открыть ключи <AppIcon name="arrow-right" size={17} />
            </button>
          </section>
        ) : null}
      </div>
    </section>
  );
}
