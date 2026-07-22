import type { ReactNode, SVGProps } from 'react';

export type AppIconName =
  | 'arrow-right'
  | 'arrow-left'
  | 'book-open'
  | 'calendar'
  | 'cards'
  | 'chart'
  | 'check'
  | 'check-circle'
  | 'clock'
  | 'close'
  | 'flame'
  | 'grid'
  | 'headphones'
  | 'home'
  | 'kanji'
  | 'layers'
  | 'leaf'
  | 'play'
  | 'settings'
  | 'sparkles'
  | 'target'
  | 'trend-up'
  | 'user'
  | 'volume';

interface AppIconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: AppIconName;
  size?: number;
}

const ICON_PATHS: Record<AppIconName, ReactNode> = {
  'arrow-right': <><path d="M5 12h14" /><path d="m14 7 5 5-5 5" /></>,
  'arrow-left': <><path d="M19 12H5" /><path d="m10 7-5 5 5 5" /></>,
  'book-open': <><path d="M3.5 5.5A3.5 3.5 0 0 1 7 3h4v16H7a3.5 3.5 0 0 0-3.5 2V5.5Z" /><path d="M20.5 5.5A3.5 3.5 0 0 0 17 3h-4v16h4a3.5 3.5 0 0 1 3.5 2V5.5Z" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" /><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" /></>,
  cards: <><rect x="5" y="4" width="14" height="16" rx="3" /><path d="M9 8h6M9 12h4" /><path d="M3.5 7.5 2.7 17a3 3 0 0 0 2.7 3.3" /><path d="m20.5 7.5.8 9.5a3 3 0 0 1-2.7 3.3" /></>,
  chart: <><path d="M4 19V9M10 19V5M16 19v-7M22 19V3" /><path d="M2 21h22" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  'check-circle': <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16.5 8" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  close: <><path d="m7 7 10 10M17 7 7 17" /></>,
  flame: <path d="M13.5 3.5c.7 3.2-.9 4.5-2.2 5.8-1.2-1.6-1.6-3-1.1-4.8C7 6.7 5 9.5 5 13a7 7 0 0 0 14 0c0-3.4-1.9-6.5-5.5-9.5ZM12 20c-2 0-3.5-1.4-3.5-3.2 0-1.5.8-2.8 2.2-4.1.1 1.5.7 2.4 1.4 3 .7-.9 1.1-1.8 1-3.1 1.6 1.2 2.4 2.6 2.4 4.2C15.5 18.6 14 20 12 20Z" />,
  grid: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
  headphones: <><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><path d="M6 13H5a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h2v-7ZM18 13h1a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2v-7Z" /></>,
  home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></>,
  kanji: <text x="12" y="17" fill="currentColor" stroke="none" textAnchor="middle" fontSize="15" fontWeight="800">部</text>,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
  leaf: <><path d="M20.5 3.5C12 3.7 6.2 7.1 5.2 13.1c-.7 4.1 2.4 7.2 6.2 6.4 5.7-1.2 8.6-7.3 9.1-16Z" /><path d="M4 21c2.7-5.5 6.6-9.2 12-12" /></>,
  play: <><circle cx="12" cy="12" r="9" /><path d="m10 8 6 4-6 4V8Z" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
  sparkles: <><path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z" /><path d="m19 14 .7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7L19 14ZM5 13l.8 2.2L8 16l-2.2.8L5 19l-.8-2.2L2 16l2.2-.8L5 13Z" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  'trend-up': <><path d="m3 17 6-6 4 4 8-9" /><path d="M16 6h5v5" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></>,
  volume: <><path d="M5 10H2v4h3l4 4V6l-4 4Z" /><path d="M13 9a4 4 0 0 1 0 6M16 6a8 8 0 0 1 0 12" /></>,
};

export function AppIcon({ name, size = 24, className, ...props }: AppIconProps) {
  return (
    <svg
      className={['app-icon-svg', className].filter(Boolean).join(' ')}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {ICON_PATHS[name]}
    </svg>
  );
}
