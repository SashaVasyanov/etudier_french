import { useState, type KeyboardEvent } from 'react';
import { getTodayDateKey, percentage } from '../lib/utils';
import type { AppStorage, LessonDurationMinutes, Word, WordProgress } from '../types';

interface HomeDashboardProps {
  availableWords: Word[];
  totalWords: Word[];
  storage: AppStorage;
  progressList: WordProgress[];
  addedPacksCount: number;
  lessonDurationMinutes: LessonDurationMinutes;
  onLessonDurationChange: (value: LessonDurationMinutes) => void;
  onStartLesson: () => void;
  onOpenDictionary: () => void;
  onOpenStatistics: () => void;
  onOpenProfile: () => void;
  onOpenPacks: () => void;
}

const DURATION_OPTIONS: LessonDurationMinutes[] = [10, 20, 30];

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
  addedPacksCount,
  lessonDurationMinutes,
  onLessonDurationChange,
  onStartLesson,
  onOpenDictionary,
  onOpenStatistics,
  onOpenProfile,
  onOpenPacks,
}: HomeDashboardProps) {
  const [isDurationMenuOpen, setIsDurationMenuOpen] = useState(false);
  const today = storage.dailyStats.find((item) => item.date === getTodayDateKey());
  const todayAccuracy = today ? percentage(today.correctAnswers, today.totalAnswers) : 0;
  const fallbackStat = `${availableWords.length}/${totalWords.length}`;
  const learnedWordIds = new Set(
    progressList
      .filter((progress) => progress.status === 'known' || progress.status === 'mastered')
      .map((progress) => progress.word_id),
  );
  const wordsInProcess = Math.max(0, availableWords.length - learnedWordIds.size);
  const statisticSummary = `Точность сегодня ${todayAccuracy}%. Активная база ${fallbackStat}. Слов в работе ${wordsInProcess}.`;

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

        <section className="home-figma-sidepanel" aria-label="Язык и длительность урока">
          <div className="home-figma-chip home-figma-chip-static">French</div>

          <div className={isDurationMenuOpen ? 'home-figma-duration-picker open' : 'home-figma-duration-picker'}>
            <button
              type="button"
              className="home-figma-chip home-figma-chip-button"
              aria-haspopup="menu"
              aria-expanded={isDurationMenuOpen}
              onClick={() => {
                setIsDurationMenuOpen((current) => !current);
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
