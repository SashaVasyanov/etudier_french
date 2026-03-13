import type { LessonDurationMinutes } from '../types';

interface LessonDurationSelectorProps {
  value: LessonDurationMinutes;
  onChange: (value: LessonDurationMinutes) => void;
  title?: string;
  description?: string;
}

const OPTIONS: Array<{ value: LessonDurationMinutes; label: string; hint: string }> = [
  { value: 10, label: '10 минут', hint: 'Короткий урок с меньшим числом слов и упражнений.' },
  { value: 20, label: '20 минут', hint: 'Сбалансированный темп для ежедневной практики.' },
  { value: 30, label: '30 минут', hint: 'Расширенный урок с большим объёмом повторения.' },
];

export function LessonDurationSelector({
  value,
  onChange,
  title = 'Размер занятия',
  description = 'Выберите длительность перед запуском урока. Выбор сохраняется локально.',
}: LessonDurationSelectorProps) {
  return (
    <section className="duration-card">
      <div className="chart-header">
        <div>
          <span className="eyebrow">Длительность</span>
          <h2 className="section-title">{title}</h2>
        </div>
        <span className="info-subtle">{description}</span>
      </div>

      <div className="duration-grid" role="radiogroup" aria-label="Выбор длительности урока">
        {OPTIONS.map((option) => {
          const isActive = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              className={isActive ? 'duration-option active' : 'duration-option'}
              aria-pressed={isActive}
              onClick={() => onChange(option.value)}
            >
              <strong>{option.label}</strong>
              <span>{option.hint}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
