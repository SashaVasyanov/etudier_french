interface AppNavigationProps {
  activeScreen: 'home' | 'lesson' | 'dictionary' | 'statistics' | 'profile' | 'packs';
  lessonAvailable: boolean;
  streakDays: number;
  onNavigate: (screen: 'home' | 'lesson' | 'dictionary' | 'statistics' | 'profile' | 'packs') => void;
}

const NAV_ITEMS: Array<{ id: AppNavigationProps['activeScreen']; label: string; icon: string }> = [
  { id: 'home', label: 'Главная', icon: '⌂' },
  { id: 'lesson', label: 'Учиться', icon: '◉' },
  { id: 'dictionary', label: 'Словарь', icon: 'Аа' },
  { id: 'statistics', label: 'Прогресс', icon: '↗' },
  { id: 'packs', label: 'Темы', icon: '✿' },
  { id: 'profile', label: 'Профиль', icon: '☻' },
];

export function AppNavigation({ activeScreen, lessonAvailable, streakDays, onNavigate }: AppNavigationProps) {
  return (
    <aside className="app-sidebar" aria-label="Основная навигация">
      <div className="sidebar-logo">
        <span aria-hidden="true">é</span>
        <strong>étudier</strong>
      </div>

      <nav className="app-nav" aria-label="Разделы приложения">
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === activeScreen;

          return (
            <button
              key={item.id}
              type="button"
              className={isActive ? 'nav-button active' : 'nav-button'}
              disabled={item.id === 'lesson' && !lessonAvailable && !isActive}
              onClick={() => onNavigate(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <strong>{item.label}</strong>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-streak-card">
        <span className="sidebar-streak-icon" aria-hidden="true">
          🔥
        </span>
        <strong>{streakDays || '—'} дн. подряд</strong>
        <p>Маленькая практика каждый день.</p>
      </div>
    </aside>
  );
}
