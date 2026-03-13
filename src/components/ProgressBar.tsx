interface ProgressBarProps {
  current: number;
  total: number;
}

export function ProgressBar({ current, total }: ProgressBarProps) {
  const progress = total === 0 ? 0 : (current / total) * 100;

  return (
    <div className="progress-panel">
      <div className="progress-meta">
        <span className="progress-caption">Прогресс урока</span>
        <span className="progress-count">
          {current} из {total}
        </span>
      </div>
      <div className="progress-track" aria-hidden="true">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
