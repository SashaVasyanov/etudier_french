import type { HTMLAttributes, ReactNode } from 'react';

interface AppCardProps extends HTMLAttributes<HTMLElement> {
  as?: 'article' | 'section' | 'div' | 'header';
  tone?: 'default' | 'hero' | 'accent' | 'soft';
  children: ReactNode;
}

export function AppCard({ as = 'article', tone = 'default', className = '', children, ...props }: AppCardProps) {
  const Component = as;
  const classes = ['app-card', tone !== 'default' ? `app-card-${tone}` : '', className].filter(Boolean).join(' ');

  return (
    <Component className={classes} {...props}>
      <div className="app-card-shell">{children}</div>
    </Component>
  );
}
