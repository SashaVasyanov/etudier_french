import { AppIcon, type AppIconName } from './AppIcon';

interface AppNavigationProps {
  activeScreen: 'home' | 'lesson' | 'dictionary' | 'radicals' | 'statistics' | 'profile' | 'packs';
  lessonAvailable: boolean;
  showKanjiRadicals: boolean;
  streakDays: number;
  onNavigate: (screen: AppNavigationProps['activeScreen']) => void;
}

const NAV_ITEMS: Array<{ id: AppNavigationProps['activeScreen']; label: string; icon: AppIconName }> = [
  { id: 'home', label: 'Главная', icon: 'home' },
  { id: 'lesson', label: 'Учиться', icon: 'play' },
  { id: 'dictionary', label: 'Словарь', icon: 'book-open' },
  { id: 'radicals', label: 'Ключи', icon: 'kanji' },
  { id: 'statistics', label: 'Прогресс', icon: 'chart' },
  { id: 'packs', label: 'Темы', icon: 'grid' },
  { id: 'profile', label: 'Профиль', icon: 'user' },
];

export function AppNavigation({ activeScreen, lessonAvailable, showKanjiRadicals, streakDays, onNavigate }: AppNavigationProps) {
  const visibleItems = NAV_ITEMS.filter((item) => item.id !== 'radicals' || showKanjiRadicals);

  return (
    <aside className="app-sidebar" aria-label="Основная навигация">
      <div className="sidebar-logo">
        <span aria-hidden="true">é</span>
        <strong>étudier</strong>
      </div>

      <nav className={showKanjiRadicals ? 'app-nav has-radicals' : 'app-nav'} aria-label="Разделы приложения">
        {visibleItems.map((item) => {
          const isActive = item.id === activeScreen;

          return (
            <button
              key={item.id}
              type="button"
              className={isActive ? 'nav-button active' : 'nav-button'}
              aria-current={isActive ? 'page' : undefined}
              aria-label={item.label}
              title={item.label}
              disabled={item.id === 'lesson' && !lessonAvailable && !isActive}
              onClick={() => onNavigate(item.id)}
            >
              <span className="nav-icon"><AppIcon name={item.icon} size={21} /></span>
              <strong>{item.label}</strong>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-streak-card">
        <span className="sidebar-streak-icon"><AppIcon name="flame" size={22} /></span>
        <strong>{streakDays || '—'} дн. подряд</strong>
        <p>Маленькая практика каждый день.</p>
      </div>
    </aside>
  );
}
