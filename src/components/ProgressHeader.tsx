import { AppCard } from './AppCard';

interface ProgressHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  moduleLabel: string;
  stepLabel: string;
  overallLabel: string;
  badges?: string[];
}

export function ProgressHeader({
  eyebrow,
  title,
  description,
  moduleLabel,
  stepLabel,
  overallLabel,
  badges = [],
}: ProgressHeaderProps) {
  return (
    <AppCard as="section" tone="hero" className="progress-header">
      <div className="progress-header-copy">
        <span className="eyebrow">{eyebrow}</span>
        <h2 className="section-title">{title}</h2>
        <p className="hero-text">{description}</p>
      </div>

      <div className="progress-header-meta">
        <div className="progress-pill-grid">
          <div className="progress-pill">
            <span className="progress-pill-label">Модуль</span>
            <strong>{moduleLabel}</strong>
          </div>
          <div className="progress-pill">
            <span className="progress-pill-label">Шаг</span>
            <strong>{stepLabel}</strong>
          </div>
          <div className="progress-pill">
            <span className="progress-pill-label">Прогресс</span>
            <strong>{overallLabel}</strong>
          </div>
        </div>
        {badges.length > 0 ? (
          <div className="badge-row wrap-row">
            {badges.map((badge) => (
              <span key={badge} className="tag-badge">
                {badge}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </AppCard>
  );
}
