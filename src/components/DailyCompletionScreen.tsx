import type { LessonDurationMinutes } from '../types';
import { formatDurationLabel, percentage } from '../lib/utils';
import { LessonDurationSelector } from './LessonDurationSelector';
import type { DailyLessonRecord, Word } from '../types';

interface DailyCompletionScreenProps {
  completion: DailyLessonRecord | null;
  words: Word[];
  lessonDurationMinutes: LessonDurationMinutes;
  onLessonDurationChange: (value: LessonDurationMinutes) => void;
  onContinueLearning: () => void;
  onOpenDictionary: () => void;
  onReviewDifficult: () => void;
  onBackHome: () => void;
}

export function DailyCompletionScreen({
  completion,
  words,
  lessonDurationMinutes,
  onLessonDurationChange,
  onContinueLearning,
  onOpenDictionary,
  onReviewDifficult,
  onBackHome,
}: DailyCompletionScreenProps) {
  const difficultCount = completion?.difficultWordIds.length ?? 0;
  const totalKnownOrLearned = (completion?.knownWords ?? 0) + (completion?.newWords ?? 0);

  return (
    <section className="result-card">
      <div className="result-hero">
        <span className="eyebrow">День завершен</span>
        <h1 className="result-title">На сегодня заданий нет</h1>
        <p className="result-message">
          {completion
            ? 'Все модули на сегодня завершены. Ежедневный урок закрыт, но вы можете продолжить обучение в свободном режиме, повторить сложные слова или открыть словарь.'
            : 'Сегодняшний набор уже завершен или для него сейчас нет новых задач.'}
        </p>
      </div>

      <div className="result-stats completion-stats">
        <div className="mini-stat">
          <span className="mini-stat-value">{completion?.completedModules ?? 0}</span>
          <span className="mini-stat-label">Модулей завершено</span>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-value">{completion?.totalAnswers ?? 0}</span>
          <span className="mini-stat-label">Ответов за день</span>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-value">
            {completion ? `${percentage(completion.correctAnswers, completion.totalAnswers)}%` : '0%'}
          </span>
          <span className="mini-stat-label">Точность</span>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-value">{difficultCount}</span>
          <span className="mini-stat-label">Сложных слов</span>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-value">{formatDurationLabel(completion?.timeSpentSeconds ?? 0)}</span>
          <span className="mini-stat-label">Время</span>
        </div>
      </div>

      <div className="mistake-card">
        <h3 className="mistake-title">Краткая статистика урока</h3>
        <p className="info-subtle">
          Новых слов: {completion?.newWords ?? 0} · Уже знали: {completion?.knownWords ?? 0} · Повторение:{' '}
          {completion?.reviewWords ?? 0} · Закрепление: {completion?.reinforcementWords ?? 0}
        </p>
        <p className="info-subtle">
          В базе доступно {words.length} французских слов. Сегодня в активный поток попало {totalKnownOrLearned} новых
          или сразу отмеченных как знакомые слова.
        </p>
      </div>

      <LessonDurationSelector
        value={lessonDurationMinutes}
        onChange={onLessonDurationChange}
        title="Длительность следующего занятия"
        description="Выберите размер следующего свободного или дневного урока. Настройка применяется сразу."
      />

      <div className="result-actions">
        <button type="button" className="primary-button" onClick={onContinueLearning}>
          Продолжить обучение
        </button>
        <button type="button" className="primary-button" onClick={onOpenDictionary}>
          Открыть словарь
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={difficultCount === 0}
          onClick={onReviewDifficult}
        >
          Повторить сложные слова
        </button>
        <button type="button" className="ghost-button" onClick={onBackHome}>
          На главную
        </button>
      </div>
    </section>
  );
}
