import type { ReactNode } from 'react';
import { AppCard } from './AppCard';

interface LessonCardProps {
  header: ReactNode;
  visual?: ReactNode;
  body?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function LessonCard({ header, visual, body, actions, className = '' }: LessonCardProps) {
  return (
    <AppCard as="section" className={['lesson-card', className].filter(Boolean).join(' ')}>
      <div className="lesson-card-inner">
        <div className="lesson-card-header">{header}</div>
        {visual ? <div className="lesson-card-visual">{visual}</div> : null}
        {body ? <div className="lesson-card-body">{body}</div> : null}
        {actions ? <div className="lesson-card-actions">{actions}</div> : null}
      </div>
    </AppCard>
  );
}
