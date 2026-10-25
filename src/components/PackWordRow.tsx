import type { ReactNode } from 'react';

interface PackWordRowProps {
  media: ReactNode;
  title: string;
  /** BCP-47 language of the title word, so kanji get Japanese glyphs. */
  titleLang?: string;
  subtitle: string;
  badges?: ReactNode;
  action?: ReactNode;
  details?: ReactNode;
}

export function PackWordRow({ media, title, titleLang, subtitle, badges, action, details }: PackWordRowProps) {
  return (
    <article className="pack-word-row">
      <div className="pack-word-row-media">{media}</div>
      <div className="pack-word-row-body">
        <div className="pack-word-row-head">
          <div className="pack-word-row-copy">
            <h3 className="word-title" lang={titleLang}>{title}</h3>
            <p className="word-subtitle">{subtitle}</p>
          </div>
          {action ? <div className="pack-word-row-action">{action}</div> : null}
        </div>
        {badges ? <div className="badge-row">{badges}</div> : null}
        {details ? <div className="pack-word-row-details">{details}</div> : null}
      </div>
    </article>
  );
}
