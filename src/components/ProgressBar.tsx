import { AppCard } from './AppCard';

interface ProgressBarProps {
  current: number;
  total: number;
}

export function ProgressBar({ current, total }: ProgressBarProps) {
  const progress = total === 0 ? 0 : (current / total) * 100;

  return (
    <AppCard as="section" className="progress-panel">
      <div className="progress-meta">
        <div>
          <span className="progress-caption">Общий прогресс урока</span>
          <strong className="progress-count">
            {current} из {total}
          </strong>
        </div>
        <span className="progress-percent">{Math.round(progress)}%</span>
      </div>
      <div className="progress-track" aria-hidden="true">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
    </AppCard>
  );
}
