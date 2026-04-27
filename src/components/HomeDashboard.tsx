import { useState, type KeyboardEvent } from 'react';
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
  onOpenDictionary: () => void;
  onOpenStatistics: () => void;
  onOpenProfile: () => void;
  onOpenPacks: () => void;
}

const DURATION_OPTIONS: LessonDurationMinutes[] = [10, 20, 30];
const WORD_TARGET_OPTIONS: LessonWordTarget[] = [10, 15, 20, 25, 30, 35, 40, 45, 50];

function activateWithKeyboard(event: KeyboardEvent<HTMLElement>, action: () => void) {
  if (event.key !== 'Enter' && event.key !== ' ') {
    return;
  }

  event.preventDefault();
  action();
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
  onOpenDictionary,
  onOpenStatistics,
  onOpenProfile,
  onOpenPacks,
}: HomeDashboardProps) {
  const [isDurationMenuOpen, setIsDurationMenuOpen] = useState(false);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [isWordTargetMenuOpen, setIsWordTargetMenuOpen] = useState(false);
  const [isPackMenuOpen, setIsPackMenuOpen] = useState(false);
  const today = storage.dailyStats.find(
    (item) => item.date === getTodayDateKey() && item.language === learningLanguage,
  );
  const todayAccuracy = today ? percentage(today.correctAnswers, today.totalAnswers) : 0;
  const fallbackStat = `${availableWords.length}/${totalWords.length}`;
  const learnedWordIds = new Set(
    progressList
      .filter((progress) => progress.status === 'mastered')
      .map((progress) => progress.word_id),
  );
  const wordsInProcess = Math.max(0, availableWords.length - learnedWordIds.size);
  const statisticSummary = `Точность сегодня ${todayAccuracy}%. Активная база ${fallbackStat}. Слов в работе ${wordsInProcess}.`;
  const selectedLessonPack = packs.find((pack) => pack.id === lessonSourcePackId) ?? null;
  const lessonPackLabel = selectedLessonPack ? selectedLessonPack.title : 'Все слова';

  return (
    <section className="dashboard-shell home-figma-shell">
      <div className="home-figma-board">
        <section
          className="home-figma-block home-figma-block-lesson"
          role="button"
          tabIndex={0}
          aria-label="Начать урок"
          onClick={onStartLesson}
          onKeyDown={(event) => activateWithKeyboard(event, onStartLesson)}
        >
          <h2 className="home-figma-block-title">Lesson</h2>
        </section>

        <button type="button" className="home-figma-block" onClick={onOpenDictionary}>
          <span className="home-figma-block-title">Dictionary</span>
        </button>

        <section className="home-figma-sidepanel" aria-label="Настройки урока">
          <div className={isLanguageMenuOpen ? 'home-figma-duration-picker open' : 'home-figma-duration-picker'}>
            <button
              type="button"
              className="home-figma-chip home-figma-chip-button"
              aria-haspopup="menu"
              aria-expanded={isLanguageMenuOpen}
              onClick={() => {
                setIsLanguageMenuOpen((current) => !current);
                setIsDurationMenuOpen(false);
                setIsWordTargetMenuOpen(false);
                setIsPackMenuOpen(false);
              }}
            >
              {getLearningLanguageMenuLabel(learningLanguage)}
            </button>

            {isLanguageMenuOpen ? (
              <div className="home-figma-duration-popover" role="menu" aria-label="Выбор языка обучения">
                {LEARNING_LANGUAGE_OPTIONS.map((option) => {
                  const isActive = option === learningLanguage;

                  return (
                    <button
                      key={option}
                      type="button"
                      role="menuitemradio"
                      aria-checked={isActive}
                      className={isActive ? 'home-figma-duration-option active' : 'home-figma-duration-option'}
                      onClick={() => {
                        onLearningLanguageChange(option);
                        setIsLanguageMenuOpen(false);
                      }}
                    >
                      {getLearningLanguageMenuLabel(option)}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className={isDurationMenuOpen ? 'home-figma-duration-picker open' : 'home-figma-duration-picker'}>
            <button
              type="button"
              className="home-figma-chip home-figma-chip-button"
              aria-haspopup="menu"
              aria-expanded={isDurationMenuOpen}
              onClick={() => {
                setIsDurationMenuOpen((current) => !current);
                setIsLanguageMenuOpen(false);
                setIsWordTargetMenuOpen(false);
                setIsPackMenuOpen(false);
              }}
            >
              {lessonDurationMinutes} min
            </button>

            {isDurationMenuOpen ? (
              <div className="home-figma-duration-popover" role="menu" aria-label="Выбор длительности урока">
                {DURATION_OPTIONS.map((option) => {
                  const isActive = option === lessonDurationMinutes;

                  return (
                    <button
                      key={option}
                      type="button"
                      role="menuitemradio"
                      aria-checked={isActive}
                      className={isActive ? 'home-figma-duration-option active' : 'home-figma-duration-option'}
                      onClick={() => {
                        onLessonDurationChange(option);
                        setIsDurationMenuOpen(false);
                      }}
                    >
                      {option} min
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className={isWordTargetMenuOpen ? 'home-figma-duration-picker open' : 'home-figma-duration-picker'}>
            <button
              type="button"
              className="home-figma-chip home-figma-chip-button"
              aria-haspopup="menu"
              aria-expanded={isWordTargetMenuOpen}
              onClick={() => {
                setIsWordTargetMenuOpen((current) => !current);
                setIsLanguageMenuOpen(false);
                setIsDurationMenuOpen(false);
                setIsPackMenuOpen(false);
              }}
            >
              {lessonWordTarget} слов
            </button>

            {isWordTargetMenuOpen ? (
              <div className="home-figma-duration-popover" role="menu" aria-label="Выбор количества слов в уроке">
                {WORD_TARGET_OPTIONS.map((option) => {
                  const isActive = option === lessonWordTarget;

                  return (
                    <button
                      key={option}
                      type="button"
                      role="menuitemradio"
                      aria-checked={isActive}
                      className={isActive ? 'home-figma-duration-option active' : 'home-figma-duration-option'}
                      onClick={() => {
                        onLessonWordTargetChange(option);
                        setIsWordTargetMenuOpen(false);
                      }}
                    >
                      {option} слов
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className={isPackMenuOpen ? 'home-figma-duration-picker open' : 'home-figma-duration-picker'}>
            <button
              type="button"
              className="home-figma-chip home-figma-chip-button home-figma-chip-pack"
              aria-haspopup="menu"
              aria-expanded={isPackMenuOpen}
              onClick={() => {
                setIsPackMenuOpen((current) => !current);
                setIsLanguageMenuOpen(false);
                setIsDurationMenuOpen(false);
                setIsWordTargetMenuOpen(false);
              }}
              title={`Источник слов: ${lessonPackLabel}`}
            >
              {lessonPackLabel}
            </button>

            {isPackMenuOpen ? (
              <div className="home-figma-duration-popover home-figma-pack-popover" role="menu" aria-label="Выбор пака для урока">
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={lessonSourcePackId === null}
                  className={lessonSourcePackId === null ? 'home-figma-duration-option active' : 'home-figma-duration-option'}
                  onClick={() => {
                    onLessonSourcePackChange(null);
                    setIsPackMenuOpen(false);
                  }}
                >
                  Все слова
                </button>
                {packs.map((pack) => {
                  const isActive = pack.id === lessonSourcePackId;

                  return (
                    <button
                      key={pack.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={isActive}
                      className={isActive ? 'home-figma-duration-option active' : 'home-figma-duration-option'}
                      onClick={() => {
                        onLessonSourcePackChange(pack.id);
                        setIsPackMenuOpen(false);
                      }}
                    >
                      {pack.title}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </section>

        <button
          type="button"
          className="home-figma-block"
          title={`Подключено паков: ${addedPacksCount}`}
          onClick={onOpenPacks}
        >
          <span className="home-figma-block-title">Packs</span>
        </button>

        <section
          className="home-figma-block home-figma-block-stat"
          role="button"
          tabIndex={0}
          aria-label={`Открыть статистику. ${statisticSummary}`}
          title={statisticSummary}
          onClick={onOpenStatistics}
          onKeyDown={(event) => activateWithKeyboard(event, onOpenStatistics)}
        >
          <h2 className="home-figma-block-title">Statistic</h2>
        </section>

        <button
          type="button"
          className="home-figma-block"
          title="Открыть профиль и настройки приложения"
          onClick={onOpenProfile}
        >
          <span className="home-figma-block-title">Settings</span>
        </button>
      </div>
    </section>
  );
}
