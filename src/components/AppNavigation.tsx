interface AppNavigationProps {
  activeScreen: 'home' | 'lesson' | 'dictionary' | 'profile' | 'packs';
  lessonAvailable: boolean;
  onNavigate: (screen: 'home' | 'lesson' | 'dictionary' | 'profile' | 'packs') => void;
}

const NAV_ITEMS: Array<{ id: AppNavigationProps['activeScreen']; label: string }> = [
  { id: 'home', label: 'Главная' },
  { id: 'lesson', label: 'Урок' },
  { id: 'dictionary', label: 'Словарь' },
  { id: 'packs', label: 'Паки' },
  { id: 'profile', label: 'Профиль' },
];

export function AppNavigation({ activeScreen, lessonAvailable, onNavigate }: AppNavigationProps) {
  return (
    <nav className="app-nav" aria-label="Основная навигация">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={item.id === activeScreen ? 'nav-button active' : 'nav-button'}
          disabled={item.id === 'lesson' && !lessonAvailable && activeScreen !== 'lesson'}
          onClick={() => onNavigate(item.id)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
