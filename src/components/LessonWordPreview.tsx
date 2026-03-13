import type { Word } from '../types';

interface LessonWordPreviewProps {
  word: Word;
  current: number;
  total: number;
  onReplayAudio: () => void;
  onNext: () => void;
}

export function LessonWordPreview({
  word,
  current,
  total,
  onReplayAudio,
  onNext,
}: LessonWordPreviewProps) {
  return (
    <section className="exercise-card preview-card">
      <header className="exercise-header">
        <span className="eyebrow">Новые слова</span>
        <h2 className="exercise-title">{word.original}</h2>
        <div className="question-block">
          <p className="question-primary">{word.translation}</p>
          <p className="question-secondary">
            {word.transcription} · {word.part_of_speech} · {word.level}
          </p>
        </div>
      </header>

      <div className="example-card">
        <p className="example-original">{word.example_original}</p>
        <p className="example-translation">{word.example_translation}</p>
      </div>

      <div className="preview-meta">
        <span>
          {current} / {total}
        </span>
        <span>{word.tags.join(' · ')}</span>
      </div>

      <div className="result-actions">
        <button type="button" className="ghost-button" onClick={onReplayAudio}>
          Прослушать
        </button>
        <button type="button" className="primary-button" onClick={onNext}>
          Далее
        </button>
      </div>
    </section>
  );
}
