import type { CSSProperties } from 'react';
import { derivePackStatus, getPackCompletionRatio } from '../lib/packs';
import type { AppStorage, WordPack } from '../types';

interface PacksScreenProps {
  packs: WordPack[];
  storage: AppStorage;
  onAddPack: (packId: string) => void;
  onOpenPack: (packId: string) => void;
}

function getStatusLabel(status: ReturnType<typeof derivePackStatus>): string {
  if (status === 'added') {
    return 'добавлен';
  }

  if (status === 'in_progress') {
    return 'в процессе';
  }

  if (status === 'completed') {
    return 'завершён';
  }

  return 'не добавлен';
}

export default function PacksScreen({ packs, storage, onAddPack, onOpenPack }: PacksScreenProps) {
  const addedCount = packs.filter((pack) => derivePackStatus(pack, storage) !== 'not_added').length;

  return (
    <section className="dashboard-shell">
      <header className="hero-card">
        <div className="hero-copy">
          <span className="eyebrow">Паки</span>
          <h1 className="hero-title compact-title">Тематические наборы слов</h1>
          <p className="hero-text">
            Добавляйте нужные темы вручную. После добавления слова появятся в словаре и начнут участвовать в уроках.
          </p>
        </div>

        <div className="hero-actions horizontal-actions">
          <article className="mini-stat">
            <span className="mini-stat-value">{packs.length}</span>
            <span className="mini-stat-label">Стартовых паков</span>
          </article>
          <article className="mini-stat">
            <span className="mini-stat-value">{addedCount}</span>
            <span className="mini-stat-label">Уже добавлено</span>
          </article>
        </div>
      </header>

      <section className="packs-grid">
        {packs.map((pack) => {
          const status = derivePackStatus(pack, storage);
          const completion = getPackCompletionRatio(pack, storage);

          return (
            <article
              key={pack.id}
              className="pack-card"
              style={{ '--pack-accent': pack.accent } as CSSProperties}
            >
              <div className="pack-card-head">
                <div>
                  <span className="eyebrow">Пак слов</span>
                  <h2 className="section-title">{pack.title}</h2>
                </div>
                <span className={`status-badge ${status === 'completed' ? 'mastered' : status === 'in_progress' ? 'review' : status === 'added' ? 'learning' : 'new'}`}>
                  {getStatusLabel(status)}
                </span>
              </div>

              <p className="hero-text">{pack.description}</p>

              <div className="pack-meta-grid">
                <div className="mini-stat">
                  <span className="mini-stat-value">{pack.words.length}</span>
                  <span className="mini-stat-label">Слов</span>
                </div>
                <div className="mini-stat">
                  <span className="mini-stat-value">{completion}%</span>
                  <span className="mini-stat-label">Освоено</span>
                </div>
              </div>

              <div className="progress-track" aria-hidden="true">
                <div className="progress-fill" style={{ width: `${completion}%` }} />
              </div>

              <div className="badge-row wrap-row">
                {pack.words.slice(0, 4).map((word) => (
                  <span key={word.id} className="tag-badge">
                    {word.original}
                  </span>
                ))}
              </div>

              <div className="pack-card-actions">
                <button type="button" className="ghost-button" onClick={() => onOpenPack(pack.id)}>
                  Смотреть слова
                </button>
                <button
                  type="button"
                  className="primary-button"
                  disabled={status !== 'not_added'}
                  onClick={() => onAddPack(pack.id)}
                >
                  {status === 'not_added' ? 'Добавить пак' : 'Пак добавлен'}
                </button>
              </div>
            </article>
          );
        })}
      </section>
    </section>
  );
}
