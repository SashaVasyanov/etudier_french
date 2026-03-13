interface CenteredWordBlockProps {
  title: string;
  subtitle?: string;
  meta?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  className?: string;
}

export function CenteredWordBlock({
  title,
  subtitle,
  meta,
  titleClassName = '',
  subtitleClassName = '',
  className = '',
}: CenteredWordBlockProps) {
  return (
    <div className={['centered-word-block', className].filter(Boolean).join(' ')}>
      <div className="centered-word-block-inner">
        <h2 className={['centered-word-title', titleClassName].filter(Boolean).join(' ')}>{title}</h2>
        {subtitle ? <p className={['centered-word-subtitle', subtitleClassName].filter(Boolean).join(' ')}>{subtitle}</p> : null}
        {meta ? <p className="centered-word-meta">{meta}</p> : null}
      </div>
    </div>
  );
}
