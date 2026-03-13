import type { ReactNode } from 'react';
import { AppCard } from './AppCard';

interface WordCardProps {
  media?: ReactNode;
  header: ReactNode;
  badges?: ReactNode;
  details?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function WordCard({ media, header, badges, details, footer, className = '' }: WordCardProps) {
  return (
    <AppCard as="article" className={['word-card', className].filter(Boolean).join(' ')}>
      {media ? <div className="word-card-media">{media}</div> : null}
      <div className="word-card-content">
        <div className="word-card-header">{header}</div>
        {badges ? <div className="badge-row">{badges}</div> : null}
        {details ? <div className="word-card-details">{details}</div> : null}
        {footer ? <div className="word-card-footer">{footer}</div> : null}
      </div>
    </AppCard>
  );
}
