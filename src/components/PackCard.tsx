import type { CSSProperties } from 'react';
import type { PackStatus, WordPack } from '../types';
import { countRu, RU_WORDS } from '../lib/utils';
import { AppCard } from './AppCard';
import { PackCover } from './PackCover';
import { StatusBadge } from './StatusBadge';

interface PackCardProps {
  pack: WordPack;
  status: PackStatus;
  completion: number;
  onAdd: () => void;
  onOpen: () => void;
}

export function PackCard({ pack, status, completion, onAdd, onOpen }: PackCardProps) {
  return (
    <AppCard as="article" className="pack-card" style={{ '--pack-accent': pack.accent } as CSSProperties}>
      <button type="button" className="pack-card-cover-button" onClick={onOpen} aria-label={`Открыть тему «${pack.title}»`}>
        <PackCover pack={pack} />
      </button>

      <div className="pack-card-body">
        <div className="pack-card-header">
          <h2 className="pack-card-title">{pack.title}</h2>
          {status === 'not_added' ? null : <StatusBadge status={status} />}
        </div>
        <p className="pack-card-description">{pack.description}</p>
        <p className="pack-card-words">{pack.words.slice(0, 4).map((word) => word.translation).join(' · ')}</p>
        <div className="pack-card-progress">
          <span>{countRu(pack.words.length, RU_WORDS)}</span>
          <span>{completion}% освоено</span>
        </div>
        <div className="progress-track" aria-hidden="true">
          <div className="progress-fill" style={{ width: `${completion}%` }} />
        </div>
      </div>

      <div className="pack-card-actions">
        <button type="button" className="secondary-button" onClick={onOpen}>
          Открыть
        </button>
        {status === 'not_added' ? (
          <button type="button" className="primary-button" onClick={onAdd}>
            Добавить
          </button>
        ) : (
          <span className="pack-card-added">В уроках</span>
        )}
      </div>
    </AppCard>
  );
}
