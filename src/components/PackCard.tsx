import type { CSSProperties } from 'react';
import type { PackStatus, WordPack } from '../types';
import { AppCard } from './AppCard';
import { StatusBadge } from './StatusBadge';
import { WordImage } from './WordImage';

interface PackCardProps {
  pack: WordPack;
  status: PackStatus;
  completion: number;
  onAdd: () => void;
  onOpen: () => void;
}

export function PackCard({ pack, status, completion, onAdd, onOpen }: PackCardProps) {
  const previewWord = pack.words[0];

  return (
    <AppCard as="article" className="pack-card" style={{ '--pack-accent': pack.accent } as CSSProperties}>
      <div className="pack-card-cover">
        {previewWord ? <WordImage word={previewWord} size="large" className="pack-cover-image" /> : null}
      </div>

      <div className="pack-card-body">
        <div className="pack-card-header">
          <div className="pack-card-title-group">
            <span className="eyebrow">Пак слов</span>
            <h2 className="section-title">{pack.title}</h2>
          </div>
          <StatusBadge status={status} />
        </div>

        <p className="hero-text">{pack.description}</p>

        <div className="pack-card-meta">
          <div className="pack-kpi">
            <strong>{pack.words.length}</strong>
            <span>слов</span>
          </div>
          <div className="pack-kpi">
            <strong>{completion}%</strong>
            <span>освоено</span>
          </div>
        </div>

        <div className="progress-track" aria-hidden="true">
          <div className="progress-fill" style={{ width: `${completion}%` }} />
        </div>

        <div className="badge-row">
          {pack.words.slice(0, 4).map((word) => (
            <span key={word.id} className="tag-badge">
              {word.translation}
            </span>
          ))}
        </div>
      </div>

      <div className="pack-card-actions">
        <button type="button" className="ghost-button" onClick={onOpen}>
          Открыть
        </button>
        <button type="button" className="primary-button" disabled={status !== 'not_added'} onClick={onAdd}>
          {status === 'not_added' ? 'Добавить пак' : 'Пак добавлен'}
        </button>
      </div>
    </AppCard>
  );
}
