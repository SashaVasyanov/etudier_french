import type { LessonDurationMinutes } from '../types';
import { AppCard } from './AppCard';

interface LessonDurationSelectorProps {
  value: LessonDurationMinutes;
  onChange: (value: LessonDurationMinutes) => void;
  title?: string;
  description?: string;
}

const OPTIONS: Array<{ value: LessonDurationMinutes; label: string; hint: string }> = [
  { value: 10, label: '10 минут', hint: 'Быстрый заход на один короткий цикл.' },
  { value: 20, label: '20 минут', hint: 'Оптимальный темп для ежедневного урока.' },
  { value: 30, label: '30 минут', hint: 'Расширенный формат с большим объёмом закрепления.' },
];

export function LessonDurationSelector({
  value,
  onChange,
  title = 'Размер занятия',
  description = 'Выберите длительность до старта. Выбор сохраняется локально и влияет на объём урока.',
}: LessonDurationSelectorProps) {
  const active = OPTIONS.find((option) => option.value === value) ?? OPTIONS[1];

  // A compact segmented control, the same one as on the home screen.
  return (
    <AppCard as="section" tone="soft" className="duration-card duration-card-compact">
      <div className="duration-card-copy">
        <h2 className="section-title">{title}</h2>
        <p className="hero-text">{description}</p>
      </div>

      <div className="duration-card-control">
        <div className="duration-switch" role="group" aria-label="Выбор длительности урока">
          {OPTIONS.map((option) => {
            const isActive = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                className={isActive ? 'active' : undefined}
                aria-pressed={isActive}
                onClick={() => onChange(option.value)}
              >
                {option.value} мин
              </button>
            );
          })}
        </div>
        <small>{active.hint}</small>
      </div>
    </AppCard>
  );
}
