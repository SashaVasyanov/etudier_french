interface StatCardProps {
  label: string;
  value: string | number;
  hint: string;
  tone?: 'default' | 'accent' | 'soft';
}

export function StatCard({ label, value, hint, tone = 'default' }: StatCardProps) {
  return (
    <article className={`stat-card ${tone !== 'default' ? `stat-card-${tone}` : ''}`}>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      <p className="stat-hint">{hint}</p>
    </article>
  );
}
