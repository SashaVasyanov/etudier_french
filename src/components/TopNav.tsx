import type { ReactNode } from 'react';
import { AppCard } from './AppCard';

interface TopNavProps {
  title: string;
  eyebrow: string;
  meta: string;
  navigation: ReactNode;
}

export function TopNav({ title, eyebrow, meta, navigation }: TopNavProps) {
  return (
    <AppCard as="header" tone="hero" className="top-nav">
      <div className="top-nav-head">
        <div className="top-nav-copy">
          <span className="eyebrow">{eyebrow}</span>
          <strong className="topbar-title">{title}</strong>
        </div>
        <span className="info-subtle top-nav-meta">{meta}</span>
      </div>
      {navigation}
    </AppCard>
  );
}
