import type { ReactNode } from 'react';

interface LessonChoiceButtonProps {
  children: ReactNode;
  state?: 'default' | 'correct' | 'incorrect' | 'muted' | 'selected';
  disabled?: boolean;
  onClick: () => void;
}

export function LessonChoiceButton({
  children,
  state = 'default',
  disabled,
  onClick,
}: LessonChoiceButtonProps) {
  return (
    <button
      type="button"
      className={['choice-button', state !== 'default' ? state : ''].filter(Boolean).join(' ')}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
