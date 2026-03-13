import type { LessonDurationMinutes } from '../types';
import { formatDurationLabel, percentage } from '../lib/utils';
import { LessonDurationSelector } from './LessonDurationSelector';
import type { DailyLessonRecord, Word } from '../types';
import { AppCard } from './AppCard';
import { StatCard } from './StatCard';

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
      <AppCard as="section" tone="hero" className="completion-hero">
        <div className="result-hero">
          <span className="eyebrow">День завершён</span>
          <h1 className="result-title">На сегодня заданий нет</h1>
          <p className="result-message">
            {completion
              ? 'Все 5 модулей на сегодня завершены. Ежедневный урок закрыт, но приложение не заканчивается: продолжайте практику, повторяйте сложные слова и открывайте словарь.'
              : 'Сегодняшний набор уже завершен или для него сейчас нет новых задач.'}
          </p>
        </div>

        <div className="stats-grid completion-grid">
          <StatCard label="Модулей" value={completion?.completedModules ?? 0} hint="Завершено сегодня" tone="accent" />
          <StatCard label="Ответов" value={completion?.totalAnswers ?? 0} hint="Всего попыток" />
          <StatCard label="Точность" value={completion ? `${percentage(completion.correctAnswers, completion.totalAnswers)}%` : '0%'} hint="По всем упражнениям" />
          <StatCard label="Сложные слова" value={difficultCount} hint="Можно повторить отдельно" />
          <StatCard label="Время" value={formatDurationLabel(completion?.timeSpentSeconds ?? 0)} hint="Чистое время сессии" />
        </div>
      </AppCard>

      <AppCard as="section" className="mistake-card">
        <h3 className="mistake-title">Сводка по сегодняшнему уроку</h3>
        <p className="info-subtle">
          Новых слов: {completion?.newWords ?? 0} · Уже знали: {completion?.knownWords ?? 0} · Повторение: {completion?.reviewWords ?? 0} · Закрепление: {completion?.reinforcementWords ?? 0}
        </p>
        <p className="info-subtle">
          В активной базе сейчас {words.length} слов. Сегодня в поток попало {totalKnownOrLearned} новых или сразу отмеченных знакомыми слов.
        </p>
      </AppCard>

      <LessonDurationSelector
        value={lessonDurationMinutes}
        onChange={onLessonDurationChange}
        title="Размер следующего занятия"
        description="Настройка применяется к следующему ежедневному или дополнительному уроку."
      />

      <div className="result-actions">
        <button type="button" className="primary-button" onClick={onContinueLearning}>
          Продолжить обучение
        </button>
        <button type="button" className="secondary-button" onClick={onOpenDictionary}>
          Открыть словарь
        </button>
        <button type="button" className="secondary-button" disabled={difficultCount === 0} onClick={onReviewDifficult}>
          Повторить сложные слова
        </button>
        <button type="button" className="ghost-button" onClick={onBackHome}>
          На главную
        </button>
      </div>
    </section>
  );
}
