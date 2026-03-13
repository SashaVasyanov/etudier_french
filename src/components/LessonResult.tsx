import { percentage } from '../lib/utils';
import type { ExerciseOutcome, Word } from '../types';
import { AppCard } from './AppCard';
import { WordImage } from './WordImage';

interface LessonResultProps {
  outcomes: ExerciseOutcome[];
  mistakeWords: Word[];
  onRepeatMistakes: () => void;
  onFinish: () => void;
}

function getMessage(successRate: number): string {
  if (successRate >= 90) {
    return 'Очень сильный проход. Можно смело переходить к следующему уровню сложности.';
  }

  if (successRate >= 70) {
    return 'Хороший темп. Ещё один короткий подход отлично закрепит материал.';
  }

  return 'Нормальный рабочий результат. Точечный повтор ошибок сейчас даст лучший эффект.';
}

export function LessonResult({
  outcomes,
  mistakeWords,
  onRepeatMistakes,
  onFinish,
}: LessonResultProps) {
  const correctAnswers = outcomes.filter((outcome) => outcome.isCorrect).length;
  const successRate = percentage(correctAnswers, outcomes.length);

  return (
    <section className="result-card">
      <AppCard as="section" tone="hero">
        <div className="result-hero">
          <span className="eyebrow">Результат урока</span>
          <h2 className="result-title">{correctAnswers} правильных ответов</h2>
          <p className="result-score">{successRate}% успеха</p>
          <p className="result-message">{getMessage(successRate)}</p>
        </div>
      </AppCard>

      <section className="stats-grid compact-stats">
        <AppCard as="article" className="mini-panel">
          <span className="mini-stat-value">{outcomes.length}</span>
          <span className="mini-stat-label">Всего заданий</span>
        </AppCard>
        <AppCard as="article" className="mini-panel">
          <span className="mini-stat-value">{mistakeWords.length}</span>
          <span className="mini-stat-label">Слов с ошибками</span>
        </AppCard>
      </section>

      <AppCard as="section" className="mistake-card">
        <h3 className="mistake-title">Что повторить перед следующим уроком</h3>
        {mistakeWords.length === 0 ? (
          <p className="mistake-empty">Ошибок нет. Можно завершать урок или открыть следующий набор.</p>
        ) : (
          <div className="mistake-grid">
            {mistakeWords.map((word) => (
              <article key={word.id} className="mistake-item-card">
                <WordImage word={word} size="small" />
                <div>
                  <strong>{word.original}</strong>
                  <p className="info-subtle">{word.translation}</p>
                  <small>{word.transcription}</small>
                </div>
              </article>
            ))}
          </div>
        )}
      </AppCard>

      <div className="result-actions">
        <button type="button" className="primary-button" disabled={mistakeWords.length === 0} onClick={onRepeatMistakes}>
          Повторить ошибки
        </button>
        <button type="button" className="secondary-button" onClick={onFinish}>
          На главную
        </button>
      </div>
    </section>
  );
}
