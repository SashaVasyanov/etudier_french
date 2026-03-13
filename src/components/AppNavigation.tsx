interface AppNavigationProps {
  activeScreen: 'home' | 'lesson' | 'dictionary' | 'profile' | 'packs';
  lessonAvailable: boolean;
  onNavigate: (screen: 'home' | 'lesson' | 'dictionary' | 'profile' | 'packs') => void;
}

const NAV_ITEMS: Array<{ id: AppNavigationProps['activeScreen']; label: string; hint: string }> = [
  { id: 'home', label: 'Главная', hint: 'План на день' },
  { id: 'lesson', label: 'Урок', hint: 'Текущий поток' },
  { id: 'dictionary', label: 'Словарь', hint: 'Карточки слов' },
  { id: 'packs', label: 'Паки', hint: 'Тематические темы' },
  { id: 'profile', label: 'Профиль', hint: 'История и streak' },
];

export function AppNavigation({ activeScreen, lessonAvailable, onNavigate }: AppNavigationProps) {
  return (
    <nav className="app-nav" aria-label="Основная навигация">
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
            <strong>{item.label}</strong>
            <span>{item.hint}</span>
          </button>
        );
      })}
    </nav>
  );
}
