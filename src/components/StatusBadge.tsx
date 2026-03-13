import type { PackStatus, WordStatus } from '../types';

type StatusBadgeValue = WordStatus | PackStatus | 'review';

interface StatusBadgeProps {
  status: StatusBadgeValue;
  label?: string;
}

function getLabel(status: StatusBadgeValue): string {
  switch (status) {
    case 'known':
      return 'уже известно';
    case 'mastered':
      return 'выучено';
    case 'difficult':
      return 'сложное';
    case 'learning':
    case 'review':
      return 'изучается';
    case 'added':
      return 'добавлен';
    case 'in_progress':
      return 'в процессе';
    case 'completed':
      return 'завершён';
    case 'not_added':
      return 'не добавлен';
    default:
      return 'новое';
  }
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const tone =
    status === 'mastered' || status === 'completed'
      ? 'mastered'
      : status === 'learning' || status === 'review' || status === 'added' || status === 'in_progress'
        ? 'review'
        : status === 'difficult'
          ? 'difficult'
          : status === 'known'
            ? 'known'
            : 'new';

  return <span className={`status-badge ${tone}`}>{label ?? getLabel(status)}</span>;
}
