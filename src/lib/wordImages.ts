import type { Word } from '../types';

type IllustrationCategory = 'plants' | 'animals' | 'food' | 'travel' | 'home' | 'core';

interface IllustrationTheme {
  backgroundStart: string;
  backgroundEnd: string;
  foreground: string;
  muted: string;
  stroke: string;
}

const THEMES: Record<IllustrationCategory, IllustrationTheme> = {
  plants: {
    backgroundStart: '#e6f8eb',
    backgroundEnd: '#c9ecd2',
    foreground: '#3d7d52',
    muted: '#8bc49a',
    stroke: '#2f6240',
  },
  animals: {
    backgroundStart: '#fff1e6',
    backgroundEnd: '#ffd8c2',
    foreground: '#9c5a3b',
    muted: '#f0ae84',
    stroke: '#74422b',
  },
  food: {
    backgroundStart: '#fff7dd',
    backgroundEnd: '#ffe1b2',
    foreground: '#a36a16',
    muted: '#f0c26b',
    stroke: '#7d4f0f',
  },
  travel: {
    backgroundStart: '#e7f1ff',
    backgroundEnd: '#c9ddff',
    foreground: '#4068b8',
    muted: '#91b0ec',
    stroke: '#2e4d91',
  },
  home: {
    backgroundStart: '#f3edff',
    backgroundEnd: '#ddd0ff',
    foreground: '#6550a8',
    muted: '#ad97e4',
    stroke: '#4a3a80',
  },
  core: {
    backgroundStart: '#eef4ff',
    backgroundEnd: '#dae7ff',
    foreground: '#315c93',
    muted: '#9db7e2',
    stroke: '#224670',
  },
};

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function hashSeed(value: string): number {
  return [...value].reduce((total, char) => total + char.charCodeAt(0), 0);
}

function getCategoryIconPath(category: IllustrationCategory): string {
  switch (category) {
    case 'plants':
      return 'M92 114c6-27 23-40 53-44-8 30-29 45-53 44Zm3 17c-25-3-42-19-51-45 29-1 48 12 56 36v49H84v18h44v-18h-12v-42c11-20 30-32 56-34-9 24-26 39-49 44Z';
    case 'animals':
      return 'M79 89a16 16 0 1 1 0-32 16 16 0 0 1 0 32Zm50 0a16 16 0 1 1 0-32 16 16 0 0 1 0 32Zm-68 53c0-14 11-25 25-25s25 11 25 25-11 25-25 25-25-11-25-25Zm44 19c0-18 15-33 33-33s33 15 33 33v8H105v-8Z';
    case 'food':
      return 'M74 53c9 0 16 7 16 16v34c0 9-7 16-16 16h-6v52H50V53h24Zm62 0c14 0 26 12 26 26v92h-18v-34h-18V53h10Z';
    case 'travel':
      return 'M49 141V86l64-25 18 7-20 11 35 21 23-7 11 7-18 16 18 11-11 7-23-7-35 21 20 11-18 7-64-25Z';
    case 'home':
      return 'M49 105 108 57l59 48v66h-37v-39H86v39H49v-66Zm-5-3V81l64-51 64 51v21l-64-51-64 51Z';
    case 'core':
      return 'M55 46h78c10 0 19 8 19 18v92c0 10-9 18-19 18H55c-10 0-19-8-19-18V64c0-10 9-18 19-18Zm13 26v76h52V72H68Zm60 0v76h12V72h-12Z';
  }
}

function buildWordSvg(
  category: IllustrationCategory,
  title: string,
  subtitle: string,
  seedLabel: string,
  altAccent?: string,
): string {
  const theme = THEMES[category];
  const seed = hashSeed(seedLabel);
  const circleX = 44 + (seed % 24);
  const circleY = 48 + (seed % 16);
  const smallCircleX = 150 - (seed % 22);
  const smallCircleY = 36 + (seed % 12);
  const accent = altAccent ?? theme.foreground;
  const iconPath = getCategoryIconPath(category);

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240" fill="none">
      <defs>
        <linearGradient id="bg" x1="22" x2="278" y1="24" y2="216" gradientUnits="userSpaceOnUse">
          <stop stop-color="${theme.backgroundStart}" />
          <stop offset="1" stop-color="${theme.backgroundEnd}" />
        </linearGradient>
      </defs>
      <rect width="320" height="240" rx="28" fill="url(#bg)" />
      <circle cx="${circleX}" cy="${circleY}" r="28" fill="${theme.muted}" fill-opacity="0.35" />
      <circle cx="${smallCircleX}" cy="${smallCircleY}" r="20" fill="${theme.foreground}" fill-opacity="0.12" />
      <rect x="22" y="22" width="276" height="196" rx="24" fill="#ffffff" fill-opacity="0.28" stroke="#ffffff" stroke-opacity="0.5" />
      <path d="${iconPath}" fill="${accent}" fill-opacity="0.94" />
      <text x="26" y="177" fill="${theme.stroke}" font-size="28" font-weight="700" font-family="Trebuchet MS, Segoe UI, sans-serif">${title}</text>
      <text x="26" y="205" fill="${theme.stroke}" fill-opacity="0.72" font-size="18" font-weight="600" font-family="Trebuchet MS, Segoe UI, sans-serif">${subtitle}</text>
    </svg>
  `;
}

export function createWordImage(
  category: IllustrationCategory,
  original: string,
  translation: string,
  accent?: string,
): Pick<Word, 'imageUrl' | 'imageAlt' | 'imagePackCategory'> {
  const title = original.slice(0, 18);
  const subtitle = translation.slice(0, 24);

  return {
    imageUrl: svgToDataUrl(buildWordSvg(category, title, subtitle, `${original}-${translation}-${category}`, accent)),
    imageAlt: `${translation}: ${original}`,
    imagePackCategory: category,
  };
}

export function createPackCoverImage(
  category: IllustrationCategory,
  title: string,
  subtitle: string,
  accent?: string,
): { coverImageUrl: string; coverImageAlt: string } {
  return {
    coverImageUrl: svgToDataUrl(buildWordSvg(category, title.slice(0, 18), subtitle.slice(0, 24), title, accent)),
    coverImageAlt: `Обложка пака ${title}`,
  };
}

export function getWordImageCategory(word: Word): IllustrationCategory {
  if (word.imagePackCategory === 'plants' || word.imagePackCategory === 'animals' || word.imagePackCategory === 'food' || word.imagePackCategory === 'travel' || word.imagePackCategory === 'home') {
    return word.imagePackCategory;
  }

  return 'core';
}

export function createFallbackWordImage(word: Word): { src: string; alt: string } {
  const category = getWordImageCategory(word);
  const created = createWordImage(category, word.original, word.translation);

  return {
    src: created.imageUrl ?? '',
    alt: created.imageAlt ?? `${word.translation}: ${word.original}`,
  };
}
