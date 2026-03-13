import { percentage } from '../lib/utils';
import type { ExerciseOutcome, Word } from '../types';

interface LessonResultProps {
  outcomes: ExerciseOutcome[];
  mistakeWords: Word[];
  onRepeatMistakes: () => void;
  onFinish: () => void;
}

function getMessage(successRate: number): string {
  if (successRate >= 90) {
    return 'Очень сильный проход. Можно смело усложнять следующий урок.';
  }

  if (successRate >= 70) {
    return 'Хороший темп. Еще один короткий подход закрепит сложные слова.';
  }

  return 'Нормальный рабочий результат. Повтор ошибок сейчас даст лучший эффект.';
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
      <div className="result-hero">
        <span className="eyebrow">Результат урока</span>
        <h2 className="result-title">{correctAnswers} правильных ответов</h2>
        <p className="result-score">{successRate}% успеха</p>
        <p className="result-message">{getMessage(successRate)}</p>
      </div>

      <div className="result-stats">
        <div className="mini-stat">
          <span className="mini-stat-value">{outcomes.length}</span>
          <span className="mini-stat-label">Всего заданий</span>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-value">{mistakeWords.length}</span>
          <span className="mini-stat-label">Слова с ошибками</span>
        </div>
      </div>

      <div className="mistake-card">
        <h3 className="mistake-title">Слова, которые стоит повторить</h3>
        {mistakeWords.length === 0 ? (
          <p className="mistake-empty">Ошибок нет. Можно завершать урок или пройти новый набор.</p>
        ) : (
          <ul className="mistake-list">
            {mistakeWords.map((word) => (
              <li key={word.id} className="mistake-item">
                <div>
                  <strong>{word.original}</strong>
                  <span>{word.translation}</span>
                </div>
                <small>{word.transcription}</small>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="result-actions">
        <button
          type="button"
          className="primary-button"
          disabled={mistakeWords.length === 0}
          onClick={onRepeatMistakes}
        >
          Повторить ошибки
        </button>
        <button type="button" className="secondary-button" onClick={onFinish}>
          На главную
        </button>
      </div>
    </section>
  );
}
