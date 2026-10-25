import { countRu, RU_DAYS } from '../lib/utils';
import { AppIcon, type AppIconName } from './AppIcon';

interface AppNavigationProps {
  activeScreen: 'home' | 'lesson' | 'dictionary' | 'radicals' | 'katakana' | 'statistics' | 'profile' | 'packs';
  lessonAvailable: boolean;
  showKanjiRadicals: boolean;
  streakDays: number;
  onNavigate: (screen: AppNavigationProps['activeScreen']) => void;
}

const NAV_ITEMS: Array<{ id: AppNavigationProps['activeScreen']; label: string; icon: AppIconName }> = [
  { id: 'home', label: 'Главная', icon: 'home' },
  { id: 'lesson', label: 'Учиться', icon: 'play' },
  { id: 'dictionary', label: 'Словарь', icon: 'book-open' },
  { id: 'statistics', label: 'Прогресс', icon: 'chart' },
  { id: 'packs', label: 'Темы', icon: 'grid' },
  { id: 'profile', label: 'Профиль', icon: 'user' },
];

// Japanese-only modes, shown as their own group under the main sections.
const JAPANESE_ITEMS: typeof NAV_ITEMS = [
  { id: 'radicals', label: 'Ключи кандзи', icon: 'kanji' },
  { id: 'katakana', label: 'Катакана', icon: 'kana' },
];

export function AppNavigation({ activeScreen, lessonAvailable, showKanjiRadicals, streakDays, onNavigate }: AppNavigationProps) {
  function renderItem(item: (typeof NAV_ITEMS)[number]) {
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
  }

  return (
    <aside className="app-sidebar" aria-label="Основная навигация">
      <div className="sidebar-logo">
        <span aria-hidden="true">é</span>
        <strong>étudier</strong>
      </div>

      <nav className={showKanjiRadicals ? 'app-nav has-radicals' : 'app-nav'} aria-label="Разделы приложения">
        {NAV_ITEMS.map(renderItem)}
        {showKanjiRadicals ? (
          <>
            <span className="nav-group-label" aria-hidden="true">Японский</span>
            {JAPANESE_ITEMS.map(renderItem)}
          </>
        ) : null}
      </nav>

      <div className="sidebar-streak-card">
        <span className="sidebar-streak-icon"><AppIcon name="flame" size={22} /></span>
        <strong>{streakDays > 0 ? `${countRu(streakDays, RU_DAYS)} подряд` : 'Серия не начата'}</strong>
        <p>{streakDays > 0 ? 'Не прерывайте серию.' : 'Один урок сегодня начнёт серию.'}</p>
      </div>
    </aside>
  );
}
