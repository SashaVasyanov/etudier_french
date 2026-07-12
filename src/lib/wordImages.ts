import type { Word } from '../types';

export type IllustrationCategory = 'plants' | 'animals' | 'food' | 'travel' | 'home' | 'japanese' | 'core';

interface IllustrationTheme {
  backgroundStart: string;
  backgroundEnd: string;
  foreground: string;
  secondary: string;
  accent: string;
  line: string;
}

interface IllustrationShape {
  primary: string;
  secondary?: string;
  detail?: string;
}

function hashSeed(value: string): number {
  return [...value].reduce((total, char) => total + char.charCodeAt(0), 0);
}

const THEMES: Record<IllustrationCategory, IllustrationTheme> = {
  plants: {
    backgroundStart: '#e9f8ed',
    backgroundEnd: '#d4efdb',
    foreground: '#4e8d5a',
    secondary: '#7fc489',
    accent: '#c8a66b',
    line: '#2d5f39',
  },
  animals: {
    backgroundStart: '#fff3ea',
    backgroundEnd: '#ffdcca',
    foreground: '#8f5a3c',
    secondary: '#f2b48d',
    accent: '#fff2d7',
    line: '#6a402b',
  },
  food: {
    backgroundStart: '#fff8e5',
    backgroundEnd: '#ffe7b7',
    foreground: '#9b671a',
    secondary: '#f0be61',
    accent: '#d95147',
    line: '#7f510e',
  },
  travel: {
    backgroundStart: '#eaf2ff',
    backgroundEnd: '#d4e3ff',
    foreground: '#486cb7',
    secondary: '#9bb8eb',
    accent: '#f9c75b',
    line: '#315090',
  },
  home: {
    backgroundStart: '#f5efff',
    backgroundEnd: '#e3d8ff',
    foreground: '#6a57ab',
    secondary: '#b39ce9',
    accent: '#f2c8a1',
    line: '#4b3b86',
  },
  japanese: {
    backgroundStart: '#f2f4ff',
    backgroundEnd: '#e3e8ff',
    foreground: '#4b61b3',
    secondary: '#9cabe4',
    accent: '#e36b70',
    line: '#2f427f',
  },
  core: {
    backgroundStart: '#edf4ff',
    backgroundEnd: '#dde8ff',
    foreground: '#466ca9',
    secondary: '#a7bee8',
    accent: '#f0c36d',
    line: '#2c4b7f',
  },
};

const ILLUSTRATION_SHAPES: Record<string, IllustrationShape> = {
  tree: {
    primary: 'M116 152c0-21 17-38 38-38 5 0 11 1 16 4 5-15 19-26 35-26 20 0 37 16 37 36 0 4-1 7-1 10 13 4 23 16 23 31 0 18-14 31-33 31H115c-19 0-34-14-34-32 0-15 10-27 24-31-1-3-1-4-1-7Z',
    secondary: 'M167 135h20v77h-20z',
    detail: 'M142 205h70v11h-70z',
  },
  flower: {
    primary: 'M144 98c9 0 17 7 17 17 0 3-1 6-2 9 6-6 15-10 24-10 11 0 20 9 20 20 0 8-4 14-9 18 12 0 21 9 21 21 0 11-9 20-21 20-8 0-15-4-18-10v33h-18v-33c-4 6-10 10-18 10-12 0-21-9-21-20 0-12 9-21 21-21-6-4-10-10-10-18 0-11 9-20 20-20 9 0 18 4 24 10-1-3-2-6-2-9 0-10 8-17 17-17Z',
    secondary: 'M168 150a15 15 0 1 0 0 30 15 15 0 0 0 0-30Z',
    detail: 'M165 179h6v41h-6z',
  },
  leaf: {
    primary: 'M95 180c0-58 41-96 108-108-6 67-50 111-108 108Zm35-16c18-5 32-19 43-41',
    secondary: 'M123 124c13 13 22 34 22 61h-14c0-20-7-40-20-53z',
  },
  seed: {
    primary: 'M167 78c35 24 42 60 18 100-35-3-59-24-67-59 5-23 22-39 49-41Z',
    secondary: 'M137 170c12-17 28-31 48-41',
  },
  grass: {
    primary: 'M87 208c10-34 24-64 42-89 6 20 5 48-4 89H87Zm49 0c10-43 25-78 45-109 7 28 6 63-3 109h-42Zm54 0c10-29 24-55 43-79 5 20 4 46-2 79h-41Z',
  },
  forest: {
    primary: 'M88 202 129 103l40 99H88Zm53 0 33-80 33 80h-66Zm53 0 25-60 25 60h-50Z',
    secondary: 'M124 202h10v20h-10zm52 0h10v20h-10zm51 0h10v20h-10z',
  },
  branch: {
    primary: 'M86 168c59 0 88-15 121-55l9 10c-35 45-71 61-130 61z',
    secondary: 'M165 126c3-16 12-27 28-34l8 10c-11 6-18 15-22 29zm-35 18c2-14 7-25 16-34l10 7c-7 8-11 17-12 30z',
  },
  root: {
    primary: 'M158 78h18v53c0 10-3 19-8 27l-9 15v49h-18v-49l-10-15c-5-8-8-17-8-27V78h18v52c0 7 2 13 6 19l3 4 3-4c4-6 5-12 5-19z',
    secondary: 'M150 174c-16 0-33 8-46 24m57-24c15 0 31 8 46 24m-48-15c-6 5-10 12-13 20',
  },
  bouquet: {
    primary: 'M121 98a18 18 0 1 0 0 36 18 18 0 0 0 0-36Zm46-8a16 16 0 1 0 0 32 16 16 0 0 0 0-32Zm33 19a16 16 0 1 0 0 32 16 16 0 0 0 0-32Z',
    secondary: 'M127 130 164 206m40-65-34 65m-20-52 10 52',
    detail: 'M138 208h54l-9 16h-36z',
  },
  dog: {
    primary: 'M116 153c0-22 18-40 40-40h32c19 0 35 16 35 35v18c0 18-14 33-33 33h-46c-16 0-28-13-28-29v-17Z',
    secondary: 'M151 118 131 97c-6-7-5-18 3-23 8-5 18-4 24 4l15 16Zm55 4 13-23c5-9 16-12 25-7 8 5 11 15 7 24l-14 24Z',
    detail: 'M160 148a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm38 0a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z',
  },
  cat: {
    primary: 'M126 173c0-31 18-54 42-54s42 23 42 54c0 16-10 28-26 28h-32c-16 0-26-12-26-28Z',
    secondary: 'M139 118 154 91l14 21m10-21 15 27 13-22',
    detail: 'M157 160a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm27 0a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  },
  bird: {
    primary: 'M108 164c0-28 25-50 55-50 16 0 30 5 40 15-6 35-35 61-69 61-15 0-26-10-26-26Z',
    secondary: 'M189 132c11-2 22 3 29 13-11 3-22-1-29-13Zm-40 44 36-36',
  },
  fish: {
    primary: 'M84 158c23-34 51-50 84-50 30 0 55 13 76 38-22 25-46 38-76 38-33 0-61-16-84-26Zm87-17a14 14 0 1 0 0 28 14 14 0 0 0 0-28Z',
    secondary: 'M84 158 64 135m20 23-21 22',
  },
  horse: {
    primary: 'M113 167c0-31 19-54 49-54h24c16 0 28 12 28 27v18c0 24-17 43-39 43h-34c-16 0-28-13-28-34Z',
    secondary: 'M158 114 146 90l20-16 18 17-3 23Zm46 0 23-11 10 18-16 10Z',
    detail: 'M145 202v18m43-18v18',
  },
  bear: {
    primary: 'M121 169c0-28 21-51 47-51s47 23 47 51c0 18-14 32-32 32h-30c-18 0-32-14-32-32Z',
    secondary: 'M137 120a14 14 0 1 0 0-28 14 14 0 0 0 0 28Zm62 0a14 14 0 1 0 0-28 14 14 0 0 0 0 28Z',
    detail: 'M156 160a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm25 0a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  },
  rabbit: {
    primary: 'M131 176c0-31 17-54 39-54s39 23 39 54c0 14-11 25-25 25h-28c-14 0-25-11-25-25Z',
    secondary: 'M146 124V83c0-14 8-25 18-25s18 11 18 25v42m-6-1V76c0-12 7-22 16-22 8 0 15 10 15 22v51',
    detail: 'M157 163a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm21 0a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  },
  duck: {
    primary: 'M110 171c0-25 18-42 48-42h15c14 0 27 4 36 11v17c0 24-16 41-38 41h-28c-18 0-33-12-33-27Z',
    secondary: 'M201 141 227 149l-16 13h-22',
    detail: 'M146 151a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  },
  lion: {
    primary: 'M126 169c0-24 19-43 42-43s42 19 42 43c0 18-14 32-31 32h-22c-17 0-31-14-31-32Z',
    secondary: 'M168 98c34 0 61 27 61 61 0 10-2 20-7 29-7-18-25-30-45-30h-18c-20 0-38 12-45 30-5-9-7-19-7-29 0-34 27-61 61-61Z',
    detail: 'M157 164a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm22 0a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  },
  pig: {
    primary: 'M118 153c0-24 20-43 44-43h18c24 0 44 19 44 43v12c0 20-16 36-36 36h-34c-20 0-36-16-36-36v-12Z',
    secondary: 'M208 129 226 113l14 17-18 14ZM129 131l-19-15-12 17 19 13Z',
    detail: 'M157 153h28a9 9 0 0 1 0 18h-28a9 9 0 0 1 0-18Z',
  },
  bread: {
    primary: 'M102 175c0-39 26-67 66-67s66 28 66 67c0 16-13 29-29 29h-74c-16 0-29-13-29-29Z',
    secondary: 'M142 130c0-8 6-14 14-14m18 4c0-8 6-14 14-14',
  },
  cheese: {
    primary: 'M96 189V133l76-34 52 24v66H96Z',
    secondary: 'M142 144a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm43 19a6 6 0 1 0 0 12 6 6 0 0 0 0-12Zm-19-36a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z',
  },
  soup: {
    primary: 'M97 151h138c0 30-24 55-54 55h-30c-30 0-54-25-54-55Z',
    secondary: 'M116 138h100c0 7-5 13-12 13h-76c-7 0-12-6-12-13Zm30-27c0-12 10-21 21-21m15 21c0-12 9-21 21-21',
  },
  apple: {
    primary: 'M123 156c0-27 20-49 45-49 25 0 45 22 45 49 0 25-20 46-45 46-25 0-45-21-45-46Z',
    secondary: 'M165 107c-6-14-2-30 10-39 8 15 5 30-10 39Zm-13 2c-13-12-24-17-38-18 10-11 28-10 38 18Z',
  },
  pear: {
    primary: 'M135 118c0-15 12-28 28-28s28 13 28 28c0 7-3 13-6 18 15 8 25 24 25 42 0 28-19 49-42 49h-8c-23 0-42-21-42-49 0-18 10-34 25-42-5-5-8-11-8-18Z',
    secondary: 'M167 89c0-9 7-17 17-20',
  },
  grapes: {
    primary: 'M147 108a15 15 0 1 0 0 30 15 15 0 0 0 0-30Zm29 6a15 15 0 1 0 0 30 15 15 0 0 0 0-30Zm-43 23a15 15 0 1 0 0 30 15 15 0 0 0 0-30Zm30 18a15 15 0 1 0 0 30 15 15 0 0 0 0-30Zm31-13a15 15 0 1 0 0 30 15 15 0 0 0 0-30Z',
    secondary: 'M167 106c7-13 16-22 28-27',
  },
  carrot: {
    primary: 'M150 109c22 18 37 43 45 77-35 3-62-7-83-28 8-20 21-37 38-49Z',
    secondary: 'M171 95c7-13 17-24 31-31m-54 35c-12-8-24-12-37-12',
  },
  tomato: {
    primary: 'M121 159c0-28 21-50 47-50s47 22 47 50c0 24-21 43-47 43s-47-19-47-43Z',
    secondary: 'M167 100c13-11 25-14 38-9-5 8-13 12-24 13m-21-7c-11-8-21-10-31-6 6 9 14 12 24 12',
  },
  potato: {
    primary: 'M123 160c0-30 20-51 47-51s47 21 47 51c0 22-17 40-39 40h-16c-22 0-39-18-39-40Z',
    secondary: 'M151 143a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm29-11a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm12 26a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  },
  rice: {
    primary: 'M101 168c0-24 18-43 42-43h48c24 0 42 19 42 43v19H101v-19Z',
    secondary: 'M120 143h94c-7-15-20-24-37-24h-26c-17 0-30 9-31 24Z',
    detail: 'M127 168h80',
  },
  pasta: {
    primary: 'M114 144c14-18 33-27 58-27 25 0 44 9 58 27-14 18-33 27-58 27-25 0-44-9-58-27Z',
    secondary: 'M131 145c6 8 16 12 28 12m18 0c12 0 22-4 29-12',
  },
  water: {
    primary: 'M168 83c28 34 42 59 42 78 0 25-18 44-42 44s-42-19-42-44c0-19 14-44 42-78Z',
    secondary: 'M152 177c3 6 9 10 16 12',
  },
  cup: {
    primary: 'M112 123h89c0 39-12 67-41 67h-7c-29 0-41-28-41-67Z',
    secondary: 'M201 130h19c11 0 19 9 19 19s-8 19-19 19h-13',
    detail: 'M112 193h102',
  },
  dessert: {
    primary: 'M119 190c0-23 22-40 49-40s49 17 49 40H119Z',
    secondary: 'M135 151 156 98h24l21 53Zm11-61a14 14 0 1 0 28 0 14 14 0 0 0-28 0Z',
  },
  suitcase: {
    primary: 'M105 110h126a14 14 0 0 1 14 14v66a14 14 0 0 1-14 14H105a14 14 0 0 1-14-14v-66a14 14 0 0 1 14-14Z',
    secondary: 'M142 110V92c0-11 9-20 20-20h12c11 0 20 9 20 20v18',
    detail: 'M162 145h12v23h-12z',
  },
  passport: {
    primary: 'M118 84h92c13 0 24 11 24 24v92c0 13-11 24-24 24h-92c-13 0-24-11-24-24v-92c0-13 11-24 24-24Z',
    secondary: 'M164 115a21 21 0 1 0 0 42 21 21 0 0 0 0-42Z',
    detail: 'M131 177h66',
  },
  ticket: {
    primary: 'M85 128c11 0 20-9 20-20h130c0 11 9 20 20 20v38c-11 0-20 9-20 20H105c0-11-9-20-20-20v-38Z',
    secondary: 'M155 108v98',
    detail: 'M123 145h19m26 0h31',
  },
  station: {
    primary: 'M96 200v-57l72-45 72 45v57H96Z',
    secondary: 'M117 200v-34h25v34m18-34h16m19 0h25v34',
    detail: 'M86 200h164',
  },
  train: {
    primary: 'M111 103h114c16 0 29 13 29 29v42c0 16-13 29-29 29H111c-16 0-29-13-29-29v-42c0-16 13-29 29-29Z',
    secondary: 'M104 203 89 223m44-20-15 20m91-20 15 20m-44-20 15 20',
    detail: 'M115 123h43v31h-43Zm53 0h43v31h-43Z',
  },
  plane: {
    primary: 'M78 153 186 123 238 83l12 11-31 54 31 13-8 12-38-6-24 41-11-6 6-42-58 14Z',
  },
  hotel: {
    primary: 'M109 88h119v116H109V88Z',
    secondary: 'M133 112h20v22h-20Zm0 36h20v22h-20Zm43-36h20v22h-20Zm0 36h20v22h-20Z',
    detail: 'M160 88v116',
  },
  room: {
    primary: 'M100 198v-66h128v66h-22v-34h-84v34H100Z',
    secondary: 'M112 132V96h104v36',
    detail: 'M161 164h10',
  },
  map: {
    primary: 'M97 90 145 73l42 16 36-15v124l-36 15-42-16-48 17V90Z',
    secondary: 'M145 73v124m42-108v124',
  },
  route: {
    primary: 'M113 187a15 15 0 1 0 0-30 15 15 0 0 0 0 30Zm104-89a15 15 0 1 0 0-30 15 15 0 0 0 0 30Z',
    secondary: 'M127 165c25-7 50-26 75-58',
    detail: 'M173 110c7 0 12 5 12 12s-5 12-12 12-12-5-12-12 5-12 12-12Z',
  },
  museum: {
    primary: 'M97 110 168 77l71 33v16H97v-16Zm8 23h15v52h-15Zm38 0h15v52h-15Zm37 0h15v52h-15Zm38 0h15v52h-15Z',
    detail: 'M88 190h160',
  },
  beach: {
    primary: 'M94 182c18-18 39-27 61-27 22 0 43 9 63 27H94Z',
    secondary: 'M120 152c11-17 17-38 18-63 25 14 39 38 43 72m-23-59h69',
    detail: 'M95 198h131',
  },
  mountain: {
    primary: 'M93 201 146 112l28 50 21-31 48 70H93Z',
    secondary: 'M146 112 171 152l14-22',
  },
  guide: {
    primary: 'M113 92h84c10 0 18 8 18 18v92c0 10-8 18-18 18h-84c-10 0-18-8-18-18v-92c0-10 8-18 18-18Z',
    secondary: 'M122 116h66m-66 24h66m-66 24h47',
    detail: 'M184 181 204 201',
  },
  tourist: {
    primary: 'M130 173c0-22 17-39 38-39s38 17 38 39v18h-76v-18Z',
    secondary: 'M168 128a19 19 0 1 0 0-38 19 19 0 0 0 0 38Zm42 12 20 24m-53-79 29-11',
  },
  house: {
    primary: 'M100 118 168 69l68 49v86h-43v-41h-50v41h-43v-86Z',
    secondary: 'M154 128h28v23h-28Z',
  },
  kitchen: {
    primary: 'M98 204v-83h144v83h-34v-38h-76v38H98Z',
    secondary: 'M114 95h112v26H114Zm77 71h17v38h-17Z',
    detail: 'M130 140h20m54 0h14',
  },
  sofa: {
    primary: 'M98 162c0-18 14-32 32-32h76c18 0 32 14 32 32v30h-22v-14h-96v14H98v-30Z',
    secondary: 'M113 130v-15c0-15 11-26 26-26h16c15 0 26 11 26 26v15m19 0v-15c0-12 10-22 22-22',
  },
  bed: {
    primary: 'M96 154h144v42H96v-42Z',
    secondary: 'M108 118h34c10 0 18 8 18 18v18h-52v-36Zm62 18c0-10 8-18 18-18h28c10 0 18 8 18 18v18h-64v-18Z',
  },
  lamp: {
    primary: 'M127 114h82l-23 36h-36l-23-36Zm31 36h20v44h-20z',
    secondary: 'M138 196h60v11h-60z',
  },
  door: {
    primary: 'M117 88h87c10 0 18 8 18 18v112H99V106c0-10 8-18 18-18Z',
    secondary: 'M146 102h44v102h-44Z',
    detail: 'M182 152a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  },
  window: {
    primary: 'M102 95h132v118H102V95Z',
    secondary: 'M168 95v118M102 154h132',
    detail: 'M112 107h46v35m20-35h46v35',
  },
  broom: {
    primary: 'M132 92 199 188l-13 9-69-94Zm69 96 18 22-34 9 16-31Z',
  },
  vacuum: {
    primary: 'M120 165c0-17 13-30 30-30h26c17 0 30 13 30 30s-13 30-30 30h-26c-17 0-30-13-30-30Z',
    secondary: 'M206 148h22c11 0 20 9 20 20m-101-11V96h22v61',
    detail: 'M103 192h46',
  },
  towel: {
    primary: 'M113 108h110v90c0 9-7 16-16 16h-78c-9 0-16-7-16-16v-90Z',
    secondary: 'M130 128h76m-76 25h76m-76 25h54',
  },
  shelf: {
    primary: 'M103 99h130v15H103V99Zm0 49h130v15H103v-15Zm0 49h130v15H103v-15Z',
    secondary: 'M122 114v83m43-83v83m43-83v83',
  },
  plate: {
    primary: 'M120 159c0-26 22-48 48-48s48 22 48 48-22 48-48 48-48-22-48-48Z',
    secondary: 'M142 159c0-14 12-26 26-26s26 12 26 26-12 26-26 26-26-12-26-26Z',
  },
  person: {
    primary: 'M168 83a27 27 0 1 0 0 54 27 27 0 0 0 0-54Zm-50 116c0-38 22-66 50-66s50 28 50 66H118Z',
    secondary: 'M144 142c7 9 15 13 24 13s17-4 24-13',
  },
  people: {
    primary: 'M119 103a21 21 0 1 0 0 42 21 21 0 0 0 0-42Zm98 0a21 21 0 1 0 0 42 21 21 0 0 0 0-42ZM83 200c0-31 16-54 36-54s36 23 36 54H83Zm98 0c0-31 16-54 36-54s36 23 36 54h-72Z',
    secondary: 'M137 200c0-37 19-64 43-64s43 27 43 64h-86Z',
  },
  speech: {
    primary: 'M89 91h158c14 0 25 11 25 25v55c0 14-11 25-25 25h-82l-38 28 8-28H89c-14 0-25-11-25-25v-55c0-14 11-25 25-25Z',
    secondary: 'M103 132h112m-112 26h79',
  },
  question: {
    primary: 'M132 119c1-27 18-44 44-44 27 0 45 16 45 39 0 19-10 29-27 39-13 8-18 15-18 29h-18c0-23 8-34 25-45 13-8 19-13 19-23 0-13-10-21-26-21-15 0-24 10-25 26h-19Zm34 76a12 12 0 1 0 0 24 12 12 0 0 0 0-24Z',
    secondary: 'M93 188a28 28 0 1 0 0-56 28 28 0 0 0 0 56Z',
  },
  heart: {
    primary: 'M168 207 91 137c-29-27-10-75 28-75 20 0 38 12 49 30 11-18 29-30 49-30 38 0 57 48 28 75l-77 70Z',
    secondary: 'M118 91c10-8 24-8 34 0',
  },
  clock: {
    primary: 'M168 72a76 76 0 1 0 0 152 76 76 0 0 0 0-152Z',
    secondary: 'M168 96v58l39 22',
    detail: 'M168 79v13m0 124v13M91 150h13m128 0h13',
  },
  work: {
    primary: 'M84 119h168c13 0 24 11 24 24v57c0 13-11 24-24 24H84c-13 0-24-11-24-24v-57c0-13 11-24 24-24Z',
    secondary: 'M132 119V99c0-13 10-23 23-23h26c13 0 23 10 23 23v20',
    detail: 'M60 163h216m-118-12h20v25h-20z',
  },
  book: {
    primary: 'M73 88h70c14 0 25 11 25 25v99c-8-12-20-18-36-18H73V88Zm194 0h-70c-14 0-29 11-29 25v99c8-12 24-18 40-18h59V88Z',
    secondary: 'M168 113v99m-72-91h42m-42 24h42m64-24h42m-42 24h42',
  },
  phone: {
    primary: 'M131 67h74c12 0 22 10 22 22v128c0 12-10 22-22 22h-74c-12 0-22-10-22-22V89c0-12 10-22 22-22Z',
    secondary: 'M127 94h82v105h-82Z',
    detail: 'M154 215h28',
  },
  car: {
    primary: 'M78 151h18l19-45c5-12 16-20 29-20h61c13 0 24 8 29 20l18 45h10c12 0 22 10 22 22v24H56v-24c0-12 10-22 22-22Z',
    secondary: 'M126 106h82l17 45H108l18-45Z',
    detail: 'M93 190a16 16 0 1 0 0 32 16 16 0 0 0 0-32Zm150 0a16 16 0 1 0 0 32 16 16 0 0 0 0-32Z',
  },
  eye: {
    primary: 'M63 151c27-40 62-60 105-60s78 20 105 60c-27 40-62 60-105 60S90 191 63 151Z',
    secondary: 'M168 116a35 35 0 1 0 0 70 35 35 0 0 0 0-70Z',
    detail: 'M168 137a14 14 0 1 0 0 28 14 14 0 0 0 0-28Z',
  },
  money: {
    primary: 'M73 96h190v112H73V96Z',
    secondary: 'M168 118a34 34 0 1 0 0 68 34 34 0 0 0 0-68Z',
    detail: 'M88 113c13 0 23-6 29-17m102 0c6 11 16 17 29 17M88 191c13 0 23 6 29 17m102 0c6-11 16-17 29-17',
  },
  family: {
    primary: 'M108 109a22 22 0 1 0 0 44 22 22 0 0 0 0-44Zm119 0a22 22 0 1 0 0 44 22 22 0 0 0 0-44ZM70 204c0-32 17-55 38-55s38 23 38 55H70Zm120 0c0-32 17-55 37-55 21 0 39 23 39 55h-76Z',
    secondary: 'M168 136a18 18 0 1 0 0 36 18 18 0 0 0 0-36Zm-30 68c0-28 13-48 30-48s30 20 30 48h-60Z',
  },
  idea: {
    primary: 'M168 69c-39 0-68 29-68 65 0 23 12 40 29 53 8 6 12 13 12 23h54c0-10 4-17 12-23 17-13 29-30 29-53 0-36-29-65-68-65Z',
    secondary: 'M141 211h54m-47 17h40',
    detail: 'M168 90v26m-57-42 17 18m98-18-17 18M88 132h25m110 0h25',
  },
  shield: {
    primary: 'M168 66c25 18 52 28 79 30v48c0 43-27 72-79 96-52-24-79-53-79-96V96c27-2 54-12 79-30Z',
    secondary: 'm129 151 24 24 51-58',
  },
  search: {
    primary: 'M144 76a61 61 0 1 0 0 122 61 61 0 0 0 0-122Z',
    secondary: 'm188 187 55 45',
    detail: 'M121 127c8-17 23-27 42-27',
  },
  write: {
    primary: 'M79 76h127v150H79V76Z',
    secondary: 'm126 187 89-89 24 24-89 89-31 8 7-32Z',
    detail: 'M101 108h72m-72 28h52m-52 28h36',
  },
  listen: {
    primary: 'M103 161v-23c0-38 28-68 65-68s65 30 65 68v23',
    secondary: 'M92 153h27v56H92c-11 0-20-9-20-20v-16c0-11 9-20 20-20Zm152 0h-27v56h27c11 0 20-9 20-20v-16c0-11-9-20-20-20Z',
    detail: 'M132 122c9-9 21-14 36-14s27 5 36 14',
  },
  walk: {
    primary: 'M168 67a22 22 0 1 0 0 44 22 22 0 0 0 0-44Zm-10 59 25-22 34 31-13 14-21-18-9 35 27 25-13 15-38-34-23 31-17-10 30-42 8-43-28 27-13-13 41-39Z',
    secondary: 'M91 220h150',
  },
  star: {
    primary: 'm168 66 25 51 56 8-40 39 9 56-50-26-50 26 9-56-40-39 56-8 25-51Z',
    secondary: 'M168 101v70m-35-35h70',
  },
  globe: {
    primary: 'M168 70a80 80 0 1 0 0 160 80 80 0 0 0 0-160Z',
    secondary: 'M88 150h160M168 70c25 22 38 49 38 80s-13 58-38 80c-25-22-38-49-38-80s13-58 38-80Z',
    detail: 'M103 108h130m-130 84h130',
  },
  calendar: {
    primary: 'M84 91h168v132H84V91Z',
    secondary: 'M84 125h168M121 70v42m94-42v42',
    detail: 'M113 151h23v20h-23zm44 0h23v20h-23zm44 0h23v20h-23zm-88 34h23v20h-23zm44 0h23v20h-23z',
  },
  gift: {
    primary: 'M78 126h180v104H78V126Z',
    secondary: 'M66 100h204v40H66v-40Zm92 0h20v130h-20z',
    detail: 'M168 100c-27-2-48-12-48-29 0-12 9-20 21-20 17 0 27 18 27 49Zm0 0c27-2 48-12 48-29 0-12-9-20-21-20-17 0-27 18-27 49Z',
  },
};

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function getShape(type: string): IllustrationShape {
  return ILLUSTRATION_SHAPES[type] ?? ILLUSTRATION_SHAPES.tree;
}

function buildIllustrationSvg(category: IllustrationCategory, type: string, seedLabel: string, accentOverride?: string): string {
  const theme = THEMES[category];
  const shape = getShape(type);
  const accent = accentOverride ?? theme.accent;
  const seed = hashSeed(seedLabel);
  const leftBubbleX = 52 + (seed % 28);
  const leftBubbleY = 38 + (seed % 20);
  const rightBubbleX = 236 + (seed % 16);
  const rightBubbleY = 42 + (seed % 18);
  const panelInset = 20 + (seed % 4);
  const rotation = (seed % 9) - 4;
  const scale = 0.94 + (seed % 8) * 0.01;
  const translateX = (seed % 14) - 7;
  const translateY = (seed % 10) - 5;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240" fill="none">
      <defs>
        <linearGradient id="bg" x1="28" y1="20" x2="286" y2="220" gradientUnits="userSpaceOnUse">
          <stop stop-color="${theme.backgroundStart}" />
          <stop offset="1" stop-color="${theme.backgroundEnd}" />
        </linearGradient>
      </defs>
      <rect width="320" height="240" rx="30" fill="url(#bg)" />
      <circle cx="${leftBubbleX}" cy="${leftBubbleY}" r="28" fill="${theme.secondary}" fill-opacity="0.22" />
      <circle cx="${rightBubbleX}" cy="${rightBubbleY}" r="18" fill="${accent}" fill-opacity="0.16" />
      <rect x="${panelInset}" y="${panelInset}" width="${320 - panelInset * 2}" height="${240 - panelInset * 2}" rx="26" fill="#ffffff" fill-opacity="0.32" stroke="#ffffff" stroke-opacity="0.55" />
      <g transform="translate(${translateX} ${translateY}) rotate(${rotation} 160 150) scale(${scale})">
        <path d="${shape.primary}" fill="${theme.foreground}" stroke="${theme.line}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
        ${shape.secondary ? `<path d="${shape.secondary}" fill="${theme.secondary}" stroke="${theme.line}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />` : ''}
        ${shape.detail ? `<path d="${shape.detail}" fill="${accent}" stroke="${theme.line}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />` : ''}
      </g>
    </svg>
  `;
}

export function createWordImage(
  category: IllustrationCategory,
  original: string,
  translation: string,
  illustrationType = 'tree',
  accent?: string,
): Pick<Word, 'imagePath' | 'imageUrl' | 'imageAlt' | 'imagePackCategory' | 'illustrationType'> {
  const imagePath = svgToDataUrl(buildIllustrationSvg(category, illustrationType, `${original}-${translation}`, accent));

  return {
    imagePath,
    imageUrl: imagePath,
    imageAlt: `${translation}: ${original}`,
    imagePackCategory: category,
    illustrationType,
  };
}

export function createPackCoverImage(
  category: IllustrationCategory,
  title: string,
  illustrationType: string,
  accent?: string,
): { coverImageUrl: string; coverImageAlt: string } {
  return {
    coverImageUrl: svgToDataUrl(buildIllustrationSvg(category, illustrationType, title, accent)),
    coverImageAlt: `Обложка пака ${title}`,
  };
}

export function getWordImageCategory(word: Word): IllustrationCategory {
  if (
    word.imagePackCategory === 'plants' ||
    word.imagePackCategory === 'animals' ||
    word.imagePackCategory === 'food' ||
    word.imagePackCategory === 'travel' ||
    word.imagePackCategory === 'home' ||
    word.imagePackCategory === 'japanese'
  ) {
    return word.imagePackCategory;
  }

  if (word.language === 'japanese') {
    return 'japanese';
  }

  if (word.tags.some((tag) => ['plants', 'nature'].includes(tag))) {
    return 'plants';
  }

  if (word.tags.some((tag) => ['animals'].includes(tag))) {
    return 'animals';
  }

  if (word.tags.some((tag) => ['food'].includes(tag))) {
    return 'food';
  }

  if (word.tags.some((tag) => ['travel', 'transport', 'city', 'places'].includes(tag))) {
    return 'travel';
  }

  if (word.tags.some((tag) => ['home', 'objects'].includes(tag))) {
    return 'home';
  }

  return 'core';
}

export function getWordIllustrationType(word: Word): string {
  const key = `${word.original} ${word.translation} ${word.tags.join(' ')}`.toLowerCase();
  const matches = (values: string[]) => values.some((value) => key.includes(value));

  if (matches(['chien', 'собак'])) return 'dog';
  if (matches(['chat', 'кот', 'кошка'])) return 'cat';
  if (matches(['oiseau', 'птиц', 'pigeon', 'canard', 'утк', 'coq', 'poule'])) return 'bird';
  if (matches(['poisson', 'рыб', 'saumon', 'thon', 'requin', 'dauphin', 'baleine'])) return 'fish';
  if (matches(['cheval', 'лошад'])) return 'horse';
  if (matches(['ours', 'медвед'])) return 'bear';
  if (matches(['lapin', 'крол'])) return 'rabbit';
  if (matches(['canard', 'утк'])) return 'duck';
  if (matches(['lion', 'лев'])) return 'lion';
  if (matches(['cochon', 'свин'])) return 'pig';
  if (matches(['arbre', 'tree', 'дерев', 'sapin', 'pin', 'chêne', 'bouleau'])) return 'tree';
  if (matches(['fleur', 'rose', 'tulipe', 'цвет', 'букет'])) return 'flower';
  if (matches(['feuille', 'лист', 'plante', 'растен'])) return 'leaf';
  if (matches(['graine', 'сем'])) return 'seed';
  if (matches(['herbe', 'grass', 'трава'])) return 'grass';
  if (matches(['forêt', 'лес'])) return 'forest';
  if (matches(['branche', 'ветк'])) return 'branch';
  if (matches(['racine', 'корень'])) return 'root';
  if (matches(['pain', 'baguette', 'croissant', 'хлеб'])) return 'bread';
  if (matches(['fromage', 'сыр'])) return 'cheese';
  if (matches(['soupe', 'суп'])) return 'soup';
  if (matches(['pomme', 'яблок'])) return 'apple';
  if (matches(['poire', 'груш'])) return 'pear';
  if (matches(['raisin', 'виноград'])) return 'grapes';
  if (matches(['carotte', 'морков'])) return 'carrot';
  if (matches(['tomate', 'помидор'])) return 'tomato';
  if (matches(['pomme de terre', 'картоф'])) return 'potato';
  if (matches(['riz', 'рис'])) return 'rice';
  if (matches(['pâtes', 'макарон'])) return 'pasta';
  if (matches(['eau', 'вода', 'boisson', 'напит'])) return 'water';
  if (matches(['café', 'thé', 'tasse', 'кофе', 'чай', 'чаш'])) return 'cup';
  if (matches(['dessert', 'gâteau', 'tarte', 'glace', 'десерт', 'торт', 'пирог'])) return 'dessert';
  if (matches(['valise', 'bagage', 'чемодан', 'багаж'])) return 'suitcase';
  if (matches(['passeport', 'visa', 'паспорт', 'виза'])) return 'passport';
  if (matches(['billet', 'ticket', 'билет'])) return 'ticket';
  if (matches(['gare', 'station', 'вокзал', 'станци'])) return 'station';
  if (matches(['train', 'métro', 'tramway', 'поезд', 'метро', 'трамвай'])) return 'train';
  if (matches(['avion', 'aéroport', 'hélicoptère', 'самол', 'аэропорт'])) return 'plane';
  if (matches(['hôtel', 'отель'])) return 'hotel';
  if (matches(['chambre', 'room', 'комната', 'номер'])) return 'room';
  if (matches(['carte', 'plan', 'map', 'карта', 'план'])) return 'map';
  if (matches(['route', 'rue', 'chemin', 'дорог', 'улиц'])) return 'route';
  if (matches(['musée', 'exposition', 'музей', 'выстав'])) return 'museum';
  if (matches(['plage', 'beach', 'пляж'])) return 'beach';
  if (matches(['montagne', 'гора', 'colline', 'vallée'])) return 'mountain';
  if (matches(['guide', 'гид'])) return 'guide';
  if (matches(['touriste', 'tourist', 'турист'])) return 'tourist';
  if (matches(['maison', 'appartement', 'immeuble', 'дом', 'квартир', 'здание'])) return 'house';
  if (matches(['cuisine', 'кухн'])) return 'kitchen';
  if (matches(['canapé', 'fauteuil', 'диван', 'кресло'])) return 'sofa';
  if (matches(['lit', 'matelas', 'bed', 'кровать'])) return 'bed';
  if (matches(['lampe', 'lumière', 'свет', 'ламп'])) return 'lamp';
  if (matches(['porte', 'entrée', 'sortie', 'двер', 'вход', 'выход'])) return 'door';
  if (matches(['fenêtre', 'окно'])) return 'window';
  if (matches(['balai', 'метла'])) return 'broom';
  if (matches(['aspirateur', 'пылесос'])) return 'vacuum';
  if (matches(['serviette', 'полотенце'])) return 'towel';
  if (matches(['étagère', 'полка'])) return 'shelf';
  if (matches(['assiette', 'plate', 'тарел'])) return 'plate';
  if (matches(['семья', 'родител', 'мать', 'отец', 'сын', 'дочь', 'родствен'])) return 'family';
  if (matches(['люди', 'народ', 'группа', 'команда', 'все /', 'весь состав', 'вместе'])) return 'people';
  if (matches(['человек', 'женщина', 'мужчина', 'ребёнок', 'ребенок', 'друг', 'товарищ', 'спутник', 'господин', 'госпожа'])) return 'person';
  if (matches(['вопрос', 'что?', 'кто?', 'почему', 'проблема', 'задача', 'сомнен'])) return 'question';
  if (matches(['разговор', 'история', 'слово', 'высказыван', 'говорить', 'сообщать', 'ответ', 'обещать'])) return 'speech';
  if (matches(['любов', 'чувство', 'настроение', 'счаст', 'радость', 'добр', 'нравиться'])) return 'heart';
  if (matches(['время', 'момент', 'час', 'минута', 'раньше', 'после', 'сегодня', 'завтра', 'вчера'])) return 'clock';
  if (matches(['год', 'месяц', 'недел', 'дата', 'расписание', 'план /'])) return 'calendar';
  if (matches(['работа', 'работать', 'дело', 'профес', 'служба', 'должность', 'офис'])) return 'work';
  if (matches(['книга', 'читать', 'учить', 'учиться', 'преподавать', 'школа', 'информация', 'знание', 'понимать', 'объяснять', 'исследовать'])) return 'book';
  if (matches(['телефон', 'звонок', 'звонить', 'связываться'])) return 'phone';
  if (matches(['машина', 'автомобил', 'водить', 'управлять'])) return 'car';
  if (matches(['глаз', 'видеть', 'смотреть', 'взгляд', 'наблюдать'])) return 'eye';
  if (matches(['деньги', 'цена', 'стоимость', 'платить', 'выгода', 'польза', 'золото'])) return 'money';
  if (matches(['идея', 'мысль', 'понимание', 'решать', 'результат', 'значение', 'означать', 'смысл'])) return 'idea';
  if (matches(['безопас', 'защищать', 'защита', 'охрана', 'порядок', 'надёж'])) return 'shield';
  if (matches(['искать', 'поиск', 'находить', 'обнаруж', 'расследован'])) return 'search';
  if (matches(['писать', 'записывать', 'подпис', 'письмо'])) return 'write';
  if (matches(['слушать', 'слышать', 'звук', 'голос', 'музык'])) return 'listen';
  if (matches(['ходить', 'идти', 'приходить', 'входить', 'двигаться', 'гулять', 'бежать'])) return 'walk';
  if (matches(['мир', 'страна', 'земля', 'международ', 'путешествовать'])) return 'globe';
  if (matches(['лучший', 'высший', 'важный', 'успех', 'удача', 'замечатель', 'прекрас'])) return 'star';
  if (matches(['подарок', 'дарить', 'получать', 'спасибо', 'благодар'])) return 'gift';

  const category = getWordImageCategory(word);

  if (category === 'plants') return 'leaf';
  if (category === 'animals') return 'dog';
  if (category === 'food') return 'plate';
  if (category === 'travel') return 'map';
  if (category === 'home') return 'house';

  if (word.part_of_speech === 'verb') return 'walk';
  if (word.part_of_speech === 'pronoun') return 'person';
  if (word.part_of_speech === 'interjection' || word.part_of_speech === 'expression') return 'speech';
  if (word.part_of_speech === 'adjective') return 'star';
  if (word.part_of_speech === 'adverb' || word.part_of_speech === 'conjunction') return 'clock';

  return 'idea';
}

export function createFallbackWordImage(
  word: Word,
): { src: string; alt: string; category: IllustrationCategory; illustrationType: string } {
  const category = getWordImageCategory(word);
  const illustrationType = word.illustrationType ?? getWordIllustrationType(word);
  const created = createWordImage(category, word.original, word.translation, illustrationType);

  return {
    src: created.imagePath ?? created.imageUrl ?? '',
    alt: created.imageAlt ?? `${word.translation}: ${word.original}`,
    category,
    illustrationType,
  };
}
