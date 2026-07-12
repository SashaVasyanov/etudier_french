import type { ReactNode } from 'react';

interface LessonChoiceButtonProps {
  children: ReactNode;
  state?: 'default' | 'correct' | 'incorrect' | 'muted' | 'selected';
  disabled?: boolean;
  className?: string;
  onClick: () => void;
}

export function LessonChoiceButton({
  children,
  state = 'default',
  disabled,
  className = '',
  onClick,
}: LessonChoiceButtonProps) {
  return (
    <button
      type="button"
      className={['choice-button', state !== 'default' ? state : '', className].filter(Boolean).join(' ')}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="choice-button-label">{children}</span>
    </button>
  );
}
