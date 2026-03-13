import { derivePackStatus, getPackCompletionRatio } from '../lib/packs';
import type { AppStorage, WordPack } from '../types';
import { AppCard } from './AppCard';
import { PackCard } from './PackCard';
import { StatCard } from './StatCard';

interface PacksScreenProps {
  packs: WordPack[];
  storage: AppStorage;
  onAddPack: (packId: string) => void;
  onOpenPack: (packId: string) => void;
}

export default function PacksScreen({ packs, storage, onAddPack, onOpenPack }: PacksScreenProps) {
  const addedCount = packs.filter((pack) => derivePackStatus(pack, storage) !== 'not_added').length;

  return (
    <section className="dashboard-shell">
      <AppCard as="header" tone="hero">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Паки</span>
            <h1 className="hero-title compact-title">Тематические наборы как коллекция</h1>
          </div>
          <p className="hero-text">Каждый пак можно добавить, открыть, просмотреть слова внутри и запустить отдельную практику по теме.</p>
        </div>

        <section className="stats-grid compact-stats">
          <StatCard label="Стартовых паков" value={packs.length} hint="Темы доступны сразу" />
          <StatCard label="Подключено" value={addedCount} hint="Влияют на словарь и уроки" tone="accent" />
        </section>
      </AppCard>

      <section className="packs-grid">
        {packs.map((pack) => {
          const status = derivePackStatus(pack, storage);
          const completion = getPackCompletionRatio(pack, storage);

          return (
            <PackCard
              key={pack.id}
              pack={pack}
              status={status}
              completion={completion}
              onAdd={() => onAddPack(pack.id)}
              onOpen={() => onOpenPack(pack.id)}
            />
          );
        })}
      </section>
    </section>
  );
}
