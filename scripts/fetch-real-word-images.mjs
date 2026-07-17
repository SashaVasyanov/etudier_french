import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import ts from 'typescript';

const DATASET_FILES = ['public/data/words_a1.json', 'public/data/words_a2.json', 'public/data/words_b1.json'];
const JAPANESE_WORDS_SOURCE = 'src/data/japaneseWords.ts';
const JAPANESE_CORRECTIONS_SOURCE = 'src/data/japaneseWordCorrections.ts';
const MANIFEST_PATH = 'public/data/word_images.json';
const OUTPUT_DIR = 'public/generated-word-images';
const REQUEST_DELAY_MS = Number(process.env.IMAGE_FETCH_DELAY_MS ?? 900);
const RATE_LIMIT_DELAY_MS = Number(process.env.IMAGE_RATE_LIMIT_DELAY_MS ?? 30000);
const USER_AGENT = 'EtudierImageFetcher/2.0 (educational vocabulary app)';

const COMMONS_API_URL = 'https://commons.wikimedia.org/w/api.php';
const OPENVERSE_SEARCH_URL = 'https://api.openverse.org/v1/images/';

const SAFE_COMMONS_LICENSE = /^(?:cc\s*(?:by|by-sa|zero)|public domain|pdm|pd\b|gfdl)/i;
const UNSAFE_IMAGE_TERMS = [
  'adult content',
  'autopsy',
  'blood',
  'bloody',
  'breast',
  'cadaver',
  'corpse',
  'erotic',
  'explicit',
  'genital',
  'gore',
  'naked',
  'nude',
  'nudity',
  'penis',
  'porn',
  'sexual',
  'vagina',
];

const JAPANESE_ASSOCIATION_RULES = [
  { terms: ['что?', 'вопрос'], query: 'person asking a question' },
  { terms: ['человек', 'люди', 'некто'], query: 'people everyday life Japan' },
  { terms: ['женщина', 'девушка'], query: 'Japanese woman everyday portrait' },
  { terms: ['мужчина', 'муж'], query: 'Japanese man everyday portrait' },
  { terms: ['ребён', 'дети', 'сын', 'дочь'], query: 'Japanese family children' },
  { terms: ['семья', 'родител', 'мать', 'отец'], query: 'Japanese family at home' },
  { terms: ['друг', 'товарищ', 'приятел'], query: 'friends together Japan' },
  { terms: ['разговор', 'говорить', 'слово', 'высказыван', 'история'], query: 'people talking together' },
  { terms: ['слушать', 'слышать', 'звук', 'голос'], query: 'person listening carefully' },
  { terms: ['смотреть', 'видеть', 'глаз'], query: 'person looking closely' },
  { terms: ['читать', 'книга'], query: 'person reading a book' },
  { terms: ['писать', 'запис', 'строка'], query: 'person writing in notebook' },
  { terms: ['учить', 'преподавать', 'учитель', 'понимать', 'объяснять'], query: 'teacher helping student study' },
  { terms: ['думать', 'мысль', 'идея', 'понимание'], query: 'person thinking idea' },
  { terms: ['помнить', 'забывать', 'память'], query: 'memory photographs album' },
  { terms: ['искать', 'поиск', 'расследован'], query: 'detective searching evidence' },
  { terms: ['знать', 'правда'], query: 'open book knowledge' },
  { terms: ['факт', 'вещь', 'предмет'], query: 'everyday objects arranged on table' },
  { terms: ['работ', 'дело', 'создавать', 'делать'], query: 'person working at desk' },
  { terms: ['деньги', 'цена', 'стоимость', 'платить', 'покупать'], query: 'paying money in shop' },
  { terms: ['магазин', 'продавать'], query: 'Japanese grocery shop' },
  { terms: ['еда', 'есть', 'кушать', 'обед', 'ужин', 'завтрак'], query: 'Japanese meal on table' },
  { terms: ['пить', 'напиток', 'вода'], query: 'person drinking water' },
  { terms: ['дом', 'жилище', 'комната'], query: 'Japanese home interior' },
  { terms: ['дверь', 'входить', 'выходить'], query: 'open traditional Japanese door' },
  { terms: ['машина', 'автомобиль', 'водить'], query: 'car driving in Japan' },
  { terms: ['поезд', 'станция', 'ехать', 'прибывать'], query: 'Japanese train station' },
  { terms: ['улица', 'дорога', 'идти', 'ходить'], query: 'people walking Japanese street' },
  { terms: ['бежать', 'быстро', 'скорость'], query: 'person running outdoors' },
  { terms: ['телефон', 'звонок', 'связываться'], query: 'person using smartphone' },
  { terms: ['время', 'час', 'момент', 'раньше', 'позже'], query: 'clock calendar time' },
  { terms: ['сегодня', 'завтра', 'день', 'неделя', 'месяц', 'год'], query: 'calendar planning schedule' },
  { terms: ['свет', 'сияние', 'яркий'], query: 'sunlight through window' },
  { terms: ['ночь', 'тёмный', 'темнота'], query: 'quiet city at night Japan' },
  { terms: ['мир', 'страна', 'япония'], query: 'Japan landscape Mount Fuji' },
  { terms: ['место', 'снаружи', 'внутри', 'рядом'], query: 'place direction sign' },
  { terms: ['вверх', 'сверху', 'внизу', 'под', 'перед', 'сзади'], query: 'spatial direction objects' },
  { terms: ['начинать', 'первый', 'сначала'], query: 'runner at starting line' },
  { terms: ['заканчивать', 'последний', 'конец', 'результат'], query: 'runner crossing finish line' },
  { terms: ['план', 'расписание', 'планировать'], query: 'planning calendar notebook' },
  { terms: ['решать', 'решение', 'проблема', 'задача'], query: 'solving puzzle together' },
  { terms: ['безопас', 'защищать', 'защита'], query: 'safety helmet protection' },
  { terms: ['опасн', 'осторож'], query: 'warning sign danger' },
  { terms: ['помощь', 'помогать', 'забота'], query: 'helping hand support' },
  { terms: ['любить', 'любовь', 'сердце'], query: 'couple holding hands affection' },
  { terms: ['счаст', 'радость', 'везение', 'удача'], query: 'happy smiling people celebration' },
  { terms: ['груст', 'печаль', 'плакать'], query: 'sad person by window' },
  { terms: ['злость', 'сердит', 'гнев'], query: 'angry frustrated person' },
  { terms: ['страх', 'бояться', 'беспоко'], query: 'worried person thinking' },
  { terms: ['смеяться', 'улыбка', 'весёл'], query: 'friends laughing together' },
  { terms: ['спать', 'сон', 'устал'], query: 'person sleeping peacefully' },
  { terms: ['жизнь', 'живой'], query: 'family enjoying life outdoors' },
  { terms: ['смерть', 'умирать', 'убийство'], query: 'memorial candle cemetery peaceful' },
  { terms: ['сила', 'сильный'], query: 'athlete strength training' },
  { terms: ['больш', 'великий', 'высший'], query: 'large building beside small person' },
  { terms: ['маленьк', 'немного'], query: 'small object held in hand' },
  { terms: ['одинаков', 'такой же', 'вместе'], query: 'matching pair objects together' },
  { terms: ['другой', 'разный', 'различ'], query: 'different colorful objects' },
  { terms: ['красив', 'лучший'], query: 'beautiful Japanese garden' },
  { terms: ['плох', 'худший', 'сломанный'], query: 'broken object repair' },
  { terms: ['новый'], query: 'new gift box opening' },
  { terms: ['старый'], query: 'old weathered object' },
  { terms: ['много', 'все', 'полностью', 'тысяч'], query: 'many objects collection' },
  { terms: ['один', 'в одиночку'], query: 'one person alone outdoors' },
  { terms: ['два', 'пара', 'вдвоём'], query: 'two people together' },
  { terms: ['обещать', 'договариваться'], query: 'people making promise handshake' },
  { terms: ['жениться', 'брак'], query: 'Japanese wedding couple' },
  { terms: ['благодар', 'спасибо'], query: 'person bowing thanks Japan' },
  { terms: ['извин'], query: 'person apologizing bow Japan' },
  { terms: ['соглас'], query: 'person nodding agreement' },
  { terms: ['отказ'], query: 'person refusing gesture' },
];

function parseArgs(argv) {
  const options = {
    download: false,
    downloadLinked: false,
    force: false,
    limit: Infinity,
    ids: new Set(),
    provider: 'openverse',
    language: 'french',
    concurrency: 1,
    reuseExisting: false,
    reuseOnly: false,
    completeAssociations: false,
  };

  argv.forEach((arg) => {
    if (arg === '--download') {
      options.download = true;
      return;
    }

    if (arg === '--download-linked') {
      options.downloadLinked = true;
      return;
    }

    if (arg === '--force') {
      options.force = true;
      return;
    }

    if (arg === '--reuse-existing') {
      options.reuseExisting = true;
      return;
    }

    if (arg === '--reuse-only') {
      options.reuseExisting = true;
      options.reuseOnly = true;
      return;
    }

    if (arg === '--complete-associations') {
      options.reuseExisting = true;
      options.completeAssociations = true;
      return;
    }

    if (arg.startsWith('--provider=')) {
      options.provider = arg.slice('--provider='.length);
      return;
    }

    if (arg.startsWith('--language=')) {
      options.language = arg.slice('--language='.length);
      return;
    }

    if (arg.startsWith('--concurrency=')) {
      const parsed = Number(arg.slice('--concurrency='.length));
      options.concurrency = Number.isFinite(parsed) ? Math.max(1, Math.min(6, Math.floor(parsed))) : 1;
      return;
    }

    if (arg.startsWith('--limit=')) {
      const parsed = Number(arg.slice('--limit='.length));
      options.limit = Number.isFinite(parsed) && parsed > 0 ? parsed : Infinity;
      return;
    }

    if (arg.startsWith('--ids=')) {
      arg
        .slice('--ids='.length)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((item) => options.ids.add(item));
    }
  });

  return options;
}

function normalize(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value) {
  return normalize(value)
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasAny(haystack, needles) {
  return needles.some((needle) => haystack.includes(needle));
}

async function loadJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function readStaticValue(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(readStaticValue);

  if (ts.isObjectLiteralExpression(node)) {
    return Object.fromEntries(
      node.properties
        .filter(ts.isPropertyAssignment)
        .map((property) => {
          const key = ts.isComputedPropertyName(property.name)
            ? ''
            : ts.isIdentifier(property.name) || ts.isStringLiteral(property.name) || ts.isNumericLiteral(property.name)
              ? property.name.text
              : property.name.getText().replace(/^['"]|['"]$/g, '');
          return [key, readStaticValue(property.initializer)];
        })
        .filter(([key]) => key),
    );
  }

  return undefined;
}

async function loadJapaneseCorrections() {
  const sourceText = await fs.readFile(JAPANESE_CORRECTIONS_SOURCE, 'utf8');
  const sourceFile = ts.createSourceFile(
    JAPANESE_CORRECTIONS_SOURCE,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  let corrections = {};

  sourceFile.forEachChild((statement) => {
    if (!ts.isVariableStatement(statement)) return;

    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === 'JAPANESE_WORD_CORRECTIONS' && declaration.initializer) {
        corrections = readStaticValue(declaration.initializer) ?? {};
      }
    }
  });

  return corrections;
}

async function loadJapaneseWords() {
  const [sourceText, corrections] = await Promise.all([
    fs.readFile(JAPANESE_WORDS_SOURCE, 'utf8'),
    loadJapaneseCorrections(),
  ]);
  const words = [...sourceText.matchAll(/createJapaneseWord\((\{[^\n]+\})\)/g)].map((match) => JSON.parse(match[1]));

  if (words.length !== 1000) {
    throw new Error(`Expected 1000 Japanese words, found ${words.length}`);
  }

  return words.map((word) => ({
    ...word,
    ...(corrections[word.original] ?? {}),
    language: 'japanese',
  }));
}

async function loadWords(language) {
  if (language === 'japanese') return loadJapaneseWords();
  if (language === 'all') {
    const [french, japanese] = await Promise.all([
      Promise.all(DATASET_FILES.map((file) => loadJson(file, []))).then((groups) => groups.flat()),
      loadJapaneseWords(),
    ]);
    return [...french, ...japanese];
  }

  return (await Promise.all(DATASET_FILES.map((file) => loadJson(file, [])))).flat();
}

function inferExtension(contentType, url) {
  if (contentType?.includes('png')) return 'png';
  if (contentType?.includes('webp')) return 'webp';
  if (contentType?.includes('jpeg') || contentType?.includes('jpg')) return 'jpg';

  const found = new URL(url).pathname.toLowerCase().match(/\.(png|webp|jpg|jpeg)$/);
  return found ? found[1].replace('jpeg', 'jpg') : 'jpg';
}

async function fetchJson(url) {
  let response;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await sleep(REQUEST_DELAY_MS);
    response = await fetch(url, {
      headers: {
        accept: 'application/json',
        'user-agent': USER_AGENT,
      },
    });

    if (response.status !== 429) {
      break;
    }

    await sleep(RATE_LIMIT_DELAY_MS * (attempt + 1));
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${url}`);
  }

  return response.json();
}

async function downloadBinary(url) {
  let response;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await sleep(REQUEST_DELAY_MS);
    response = await fetch(url, {
      headers: {
        accept: 'image/avif,image/webp,image/png,image/jpeg,*/*;q=0.5',
        'user-agent': USER_AGENT,
      },
    });

    if (response.status !== 429) break;
    await sleep(RATE_LIMIT_DELAY_MS * (attempt + 1));
  }

  if (!response?.ok) {
    throw new Error(`download failed ${response?.status ?? 'unknown'} ${response?.statusText ?? ''}: ${url}`);
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get('content-type') ?? '',
  };
}

async function downloadBinaryWithFallback(...urls) {
  const errors = [];

  for (const url of urls.filter(Boolean)) {
    try {
      return await downloadBinary(url);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new Error(errors[0] ?? 'download failed');
}

function buildAssociativeQueries(word) {
  const original = String(word.original ?? '').trim();
  const translation = String(word.translation ?? '').trim();
  const pos = normalize(word.part_of_speech ?? '');
  const tags = (word.tags ?? []).map(normalize);
  const key = normalize(`${original} ${translation} ${tags.join(' ')}`);
  const queries = [];

  const add = (...items) => {
    items
      .map((item) => String(item).trim())
      .filter(Boolean)
      .forEach((item) => {
        if (!queries.includes(item)) {
          queries.push(item);
        }
      });
  };

  if (word.language === 'japanese') {
    const translationKey = normalize(translation);
    if (/^да(?:\s|\/|\(|$)/u.test(translationKey)) add('person nodding agreement');
    if (/^нет(?:\s|\/|\(|$)/u.test(translationKey)) add('person refusing gesture');
    if (/^(?:я|ты|вы|мы|он|она|они)(?:\s|\/|\(|$)/u.test(translationKey)) {
      add('person pointing during conversation');
    }
    const matchedRules = JAPANESE_ASSOCIATION_RULES.filter((rule) => hasAny(translationKey, rule.terms));
    matchedRules.slice(0, 2).forEach((rule) => add(rule.query));

    const primaryMeaning = translation
      .split(/[\/,;(\[]/u)[0]
      .replace(/[«»"'!?]/g, '')
      .trim();

    if (pos === 'verb' && queries.length === 0) add(`${primaryMeaning} action person`);
    if (pos === 'adjective' && queries.length === 0) add(`${primaryMeaning} visual concept`);
    if (['adverb', 'pronoun', 'determiner', 'conjunction'].includes(pos) && queries.length === 0) {
      add(`${primaryMeaning} everyday situation`);
    }
    if (pos === 'interjection' && queries.length === 0) add('person emotional reaction');

    add(primaryMeaning, original, `${original} ${primaryMeaning}`);
    return queries.slice(0, 4);
  }

  if (hasAny(key, ['bonjour', 'salut', 'merci', 'pardon', 'au revoir', 'здравств', 'привет', 'спасибо', 'извин', 'свидан'])) {
    add('greeting people', 'handshake', 'people waving goodbye');
  }

  if (/(^|\s)(oui|да)(\s|$)/.test(key)) add('thumbs up yes', 'person agreeing');
  if (/(^|\s)(non|нет)(\s|$)/.test(key)) add('stop sign no', 'person refusing');
  if (hasAny(key, ['rouge', 'красн'])) add('red object', 'red flower');
  if (hasAny(key, ['bleu', 'син'])) add('blue sky', 'blue object');
  if (hasAny(key, ['vert', 'зелен'])) add('green leaves', 'green object');
  if (hasAny(key, ['blanc', 'бел'])) add('white object', 'white wall');
  if (hasAny(key, ['noir', 'черн', 'чёрн'])) add('black object', 'black cat');
  if (hasAny(key, ['heureux', 'счаст'])) add('happy person smiling');
  if (hasAny(key, ['triste', 'груст'])) add('sad person');
  if (hasAny(key, ['chaud', 'тепл', 'горяч'])) add('hot weather sun', 'hot drink');
  if (hasAny(key, ['froid', 'холод'])) add('cold snow', 'ice');
  if (hasAny(key, ['grand', 'больш'])) add('large building', 'big object');
  if (hasAny(key, ['petit', 'мален'])) add('small object', 'small house');
  if (hasAny(key, ['jeune', 'молод'])) add('young person');
  if (hasAny(key, ['vieux', 'стар'])) add('old person');
  if (hasAny(key, ['beau', 'красив'])) add('beautiful landscape');
  if (hasAny(key, ['mauvais', 'плох'])) add('broken object');
  if (hasAny(key, ['facile', 'легк', 'лёгк'])) add('easy task student');
  if (hasAny(key, ['difficile', 'трудн', 'сложн'])) add('difficult task student');
  if (hasAny(key, ['rapide', 'быстр'])) add('fast train', 'running athlete');

  if (hasAny(key, ['manger', 'есть ', 'еду', 'куш'])) add('person eating food');
  if (hasAny(key, ['boire', 'пить'])) add('person drinking water');
  if (hasAny(key, ['dormir', 'спать'])) add('person sleeping');
  if (hasAny(key, ['lire', 'читать'])) add('person reading book');
  if (hasAny(key, ['ecrire', 'писать'])) add('person writing');
  if (hasAny(key, ['ecouter', 'слушать'])) add('person listening headphones');
  if (hasAny(key, ['parler', 'dire', 'говор'])) add('people talking');
  if (hasAny(key, ['regarder', 'voir', 'смотреть', 'видеть'])) add('person looking');
  if (hasAny(key, ['chercher', 'искать'])) add('person searching');
  if (hasAny(key, ['apprendre', 'etudier', 'учить', 'учиться'])) add('student studying');
  if (hasAny(key, ['travailler', 'работ'])) add('person working laptop');
  if (hasAny(key, ['acheter', 'покуп'])) add('shopping store');
  if (hasAny(key, ['payer', 'плат'])) add('paying by card');
  if (hasAny(key, ['ouvrir', 'откры'])) add('open door');
  if (hasAny(key, ['fermer', 'закры'])) add('closed door');
  if (hasAny(key, ['entrer', 'вход'])) add('entrance door');
  if (hasAny(key, ['sortir', 'выход'])) add('exit door');
  if (hasAny(key, ['marcher', 'ходить'])) add('person walking');
  if (hasAny(key, ['courir', 'бежать'])) add('running person');
  if (hasAny(key, ['jouer', 'играть'])) add('children playing');
  if (hasAny(key, ['aimer', 'любить'])) add('heart hands');
  if (hasAny(key, ['attendre', 'ждать'])) add('person waiting');
  if (hasAny(key, ['partir', 'уезжать'])) add('departure train station');
  if (hasAny(key, ['arriver', 'прибывать'])) add('arrival train station');
  if (hasAny(key, ['commencer', 'начинать'])) add('start line');
  if (hasAny(key, ['finir', 'заканчивать'])) add('finish line');

  if (tags.includes('grammar') || ['preposition', 'determiner', 'pronoun', 'conjunction'].includes(pos)) {
    add('French grammar book', 'French textbook classroom', 'language learning notebook');
  }

  if (tags.includes('time')) add(`${original} calendar`, 'calendar clock');
  if (tags.includes('food')) add(`${original} food`, original);
  if (tags.includes('travel') || tags.includes('transport')) add(`${original} travel`, `${original} transport`, 'travel transportation');
  if (tags.includes('home')) add(`${original} home`, `${original} interior`);
  if (tags.includes('work')) add(`${original} work office`, 'office work');
  if (tags.includes('study')) add(`${original} student`, 'school study');
  if (tags.includes('health')) add(`${original} health`, 'doctor health');
  if (tags.includes('feelings')) add(`${original} emotion`, 'human emotion');
  if (tags.includes('nature')) add(`${original} nature`, original);

  if (pos === 'noun') add(original, `${original} object`, translation);
  if (pos === 'verb') add(`${original} action`, original);
  if (pos === 'adjective') add(`${original} adjective`, original);
  if (pos === 'adverb') add(`${original} concept`, original);
  if (pos === 'expression' || pos === 'interjection') add(`${original} expression`, original);

  add(original, translation, 'French language learning');

  return queries.slice(0, 4);
}

function scoreSearchResult(result, query) {
  const text = normalize(
    `${result.title ?? ''} ${result.description ?? ''} ${result.excerpt ?? ''} ${result.tags?.map?.((tag) => tag.name).join(' ') ?? ''}`,
  );
  const queryWords = normalize(query).split(/\s+/).filter((item) => item.length > 2);
  let score = 0;

  for (const word of queryWords) {
    if (text.includes(word)) score += 2;
  }

  if (text.includes('file:')) score += 1;
  if (hasAny(text, ['logo', 'icon', 'svg', 'map', 'coat of arms', 'flag', 'diagram', 'chart'])) score -= 6;
  if (hasAny(text, ['book cover', 'poster', 'brochure', 'advertisement', 'screenshot'])) score -= 8;
  if (hasAny(text, ['jpg', 'jpeg', 'png'])) score += 1;

  return score;
}

async function searchOpenverseImage(word) {
  const queries = buildAssociativeQueries(word);
  const errors = [];

  for (const query of queries) {
    try {
      const url = new URL(OPENVERSE_SEARCH_URL);
      url.searchParams.set('q', query);
      url.searchParams.set('page_size', '8');
      url.searchParams.set('mature', 'false');
      const payload = await fetchJson(url);
      const candidates = (payload.results ?? [])
        .filter((item) => item.thumbnail || item.url)
        .filter((item) => !item.mature)
        .filter((item) => /^(?:cc0|pdm|by|by-sa)$/i.test(String(item.license ?? '')))
        .filter((item) => {
          const searchableText = normalize(
            `${item.title ?? ''} ${item.description ?? ''} ${item.tags?.map?.((tag) => tag.name).join(' ') ?? ''}`,
          );
          return !hasAny(searchableText, UNSAFE_IMAGE_TERMS);
        })
        .filter((item) => !/\.(svg|gif|tif|tiff|pdf|webm|ogv)$/i.test(String(item.url ?? item.thumbnail ?? '')))
        .map((item) => ({ ...item, score: scoreSearchResult(item, query) }))
        .sort((left, right) => right.score - left.score);

      const best = candidates[0];

      if (!best) {
        continue;
      }

      return {
        imageUrl: best.thumbnail ?? best.url,
        fullImageUrl: best.url ?? best.thumbnail,
        sourceUrl: best.foreign_landing_url ?? best.detail_url ?? best.url,
        query,
        title: best.title ?? query,
        provider: best.provider ?? best.source ?? 'openverse',
        license: [best.license, best.license_version].filter(Boolean).join('-') || undefined,
        licenseUrl: best.license_url ?? undefined,
        attribution: best.attribution ?? undefined,
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new Error(`no Openverse image found for ${word.id}: ${errors.slice(0, 2).join('; ')}`);
}

function stripHtml(value) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function metadataValue(metadata, key) {
  return stripHtml(metadata?.[key]?.value);
}

function isSafeCommonsCandidate(page) {
  const info = page?.imageinfo?.[0];
  const metadata = info?.extmetadata;
  const license = metadataValue(metadata, 'LicenseShortName');
  const searchableText = normalize(
    [
      page?.title,
      metadataValue(metadata, 'ObjectName'),
      metadataValue(metadata, 'ImageDescription'),
      metadataValue(metadata, 'Categories'),
    ].join(' '),
  );

  if (!info?.thumburl || !['image/jpeg', 'image/png', 'image/webp'].includes(String(info.mime))) return false;
  if (!license || !SAFE_COMMONS_LICENSE.test(license)) return false;
  if (hasAny(searchableText, UNSAFE_IMAGE_TERMS)) return false;
  if (hasAny(searchableText, ['watermark', 'logo', 'coat of arms', 'screenshot', 'text document'])) return false;
  return true;
}

async function searchCommonsImage(word) {
  const queries = buildAssociativeQueries(word);
  const errors = [];

  for (const query of queries) {
    try {
      const url = new URL(COMMONS_API_URL);
      url.searchParams.set('action', 'query');
      url.searchParams.set('format', 'json');
      url.searchParams.set('generator', 'search');
      url.searchParams.set('gsrsearch', query);
      url.searchParams.set('gsrnamespace', '6');
      url.searchParams.set('gsrlimit', '12');
      url.searchParams.set('prop', 'imageinfo');
      url.searchParams.set('iiprop', 'url|mime|extmetadata');
      url.searchParams.set('iiurlwidth', '640');
      const payload = await fetchJson(url);
      const candidates = Object.values(payload.query?.pages ?? {})
        .filter(isSafeCommonsCandidate)
        .map((page) => {
          const metadata = page.imageinfo[0].extmetadata;
          const candidate = {
            ...page,
            description: `${metadataValue(metadata, 'ObjectName')} ${metadataValue(metadata, 'ImageDescription')} ${metadataValue(metadata, 'Categories')}`,
          };
          return { ...candidate, score: scoreSearchResult(candidate, query) };
        })
        .sort((left, right) => right.score - left.score);

      const best = candidates[0];

      if (!best) {
        continue;
      }

      const info = best.imageinfo[0];
      const metadata = info.extmetadata;
      const artist = metadataValue(metadata, 'Attribution') || metadataValue(metadata, 'Artist') || 'Wikimedia Commons contributor';

      return {
        imageUrl: info.thumburl,
        sourceUrl: info.descriptionurl ?? info.descriptionshorturl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(best.title)}`,
        query,
        title: best.title,
        provider: 'wikimedia-commons',
        license: metadataValue(metadata, 'LicenseShortName'),
        licenseUrl: metadataValue(metadata, 'LicenseUrl'),
        attribution: artist,
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new Error(`no real image found for ${word.id}: ${errors.slice(0, 2).join('; ')}`);
}

function isRealManifestEntry(entry) {
  if (!entry?.imagePath && !entry?.imageUrl) return false;
  if (entry?.imageSource === 'local:fallback') return false;
  if (String(entry?.imagePath ?? '').startsWith('data:image/svg+xml')) return false;
  if (/\.(?:aac|flac|m4a|mp3|oga|ogg|opus|wav)(?:$|[?#])/i.test(String(entry?.imageSource ?? ''))) return false;
  if (/\.(?:aac|flac|m4a|mp3|oga|ogg|opus|wav)$/i.test(String(entry?.imageSourceTitle ?? ''))) return false;
  return true;
}

function isRemoteImageEntry(entry) {
  const source = String(entry?.imageUrl ?? entry?.imagePath ?? '');
  return /^https?:\/\//i.test(source);
}

const TRANSLATION_STOP_WORDS = new Set([
  'без',
  'быть',
  'весь',
  'всё',
  'для',
  'другой',
  'или',
  'как',
  'когда',
  'который',
  'можно',
  'она',
  'они',
  'оно',
  'очень',
  'при',
  'самый',
  'такой',
  'только',
  'чтобы',
  'этот',
]);

function translationTokens(value) {
  return normalize(value)
    .replace(/[^а-яёa-z0-9]+/gi, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !TRANSLATION_STOP_WORDS.has(token));
}

function primaryTranslation(value) {
  return normalize(String(value).split(/[\/,;(\[]/u)[0]).replace(/[^а-яёa-z0-9 ]+/gi, '').trim();
}

function findReusableImage(word, frenchWords, manifest) {
  const primary = primaryTranslation(word.translation);
  const tokens = new Set(translationTokens(word.translation));
  let best = null;
  let bestScore = 0;

  for (const candidate of frenchWords) {
    const entry = manifest[candidate.id];
    if (!isRealManifestEntry(entry) || !String(entry.imagePath ?? '').startsWith('/generated-word-images/')) continue;

    const candidatePrimary = primaryTranslation(candidate.translation);
    const sharedTokens = translationTokens(candidate.translation).filter((token) => tokens.has(token));
    let score = primary && primary === candidatePrimary ? 100 : 0;

    if (sharedTokens.length > 0) {
      score = Math.max(score, Math.max(...sharedTokens.map((token) => token.length)) * 5);
    }

    if (word.part_of_speech === candidate.part_of_speech) score += 4;

    if (score > bestScore) {
      best = { candidate, entry };
      bestScore = score;
    }
  }

  return bestScore >= 15 ? best : null;
}

const ASSOCIATION_STOP_WORDS = new Set([
  'action',
  'associative',
  'concept',
  'everyday',
  'image',
  'japan',
  'japanese',
  'object',
  'person',
  'query',
  'real',
  'situation',
  'visual',
]);

function associationTokens(value) {
  return normalize(value)
    .replace(/[^a-z]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !ASSOCIATION_STOP_WORDS.has(token));
}

function findReusableAssociation(word, frenchWords, manifest) {
  const query = buildAssociativeQueries(word)[0] ?? '';
  const queryTokens = new Set(associationTokens(query));
  if (queryTokens.size < 2) return null;

  let best = null;
  let bestScore = 0;

  for (const candidate of frenchWords) {
    const entry = manifest[candidate.id];
    if (!isRealManifestEntry(entry) || !String(entry.imagePath ?? '').startsWith('/generated-word-images/')) continue;

    const prompt = normalize(entry.imagePrompt ?? '');
    const sharedTokens = associationTokens(prompt).filter((token) => queryTokens.has(token));
    const exactQuery = prompt.includes(`query: ${normalize(query)}`);
    const score = exactQuery ? 100 : sharedTokens.length * 10;

    if (score > bestScore) {
      best = { candidate, entry };
      bestScore = score;
    }
  }

  return bestScore >= 20 ? best : null;
}

const CURATED_FRENCH_ORIGINAL_BY_QUERY = new Map([
  ['person asking a question', 'question'],
  ['people everyday life Japan', 'famille'],
  ['Japanese woman everyday portrait', 'femme'],
  ['Japanese man everyday portrait', 'homme'],
  ['Japanese family children', 'famille'],
  ['Japanese family at home', 'famille'],
  ['friends together Japan', 'ami'],
  ['people talking together', 'parler'],
  ['person listening carefully', 'écouter'],
  ['person looking closely', 'regarder'],
  ['person reading a book', 'lire'],
  ['person writing in notebook', 'écrire'],
  ['teacher helping student study', 'professeur'],
  ['person thinking idea', 'idée'],
  ['memory photographs album', 'mémoire'],
  ['detective searching evidence', 'chercher'],
  ['open book knowledge', 'livre'],
  ['person working at desk', 'travailler'],
  ['paying money in shop', 'argent'],
  ['Japanese grocery shop', 'magasin'],
  ['Japanese meal on table', 'repas'],
  ['person drinking water', 'boire'],
  ['Japanese home interior', 'maison'],
  ['open traditional Japanese door', 'porte'],
  ['car driving in Japan', 'voiture'],
  ['Japanese train station', 'train'],
  ['people walking Japanese street', 'rue'],
  ['person running outdoors', 'courir'],
  ['person using smartphone', 'téléphone'],
  ['clock calendar time', 'temps'],
  ['calendar planning schedule', 'plan'],
  ['sunlight through window', 'lumière'],
  ['quiet city at night Japan', 'nuit'],
  ['Japan landscape Mount Fuji', 'montagne'],
  ['place direction sign', 'lieu'],
  ['spatial direction objects', 'devant'],
  ['runner at starting line', 'commencer'],
  ['runner crossing finish line', 'finir'],
  ['planning calendar notebook', 'plan'],
  ['solving puzzle together', 'problème'],
  ['safety helmet protection', 'sécurité'],
  ['warning sign danger', 'danger'],
  ['helping hand support', 'aider'],
  ['couple holding hands affection', 'amour'],
  ['happy smiling people celebration', 'heureux'],
  ['sad person by window', 'triste'],
  ['angry frustrated person', 'colère'],
  ['worried person thinking', 'peur'],
  ['friends laughing together', 'rire'],
  ['person sleeping peacefully', 'dormir'],
  ['family enjoying life outdoors', 'vie'],
  ['memorial candle cemetery peaceful', 'nuit'],
  ['athlete strength training', 'sport'],
  ['large building beside small person', 'grand'],
  ['small object held in hand', 'petit'],
  ['matching pair objects together', 'ensemble'],
  ['different colorful objects', 'couleur'],
  ['beautiful Japanese garden', 'jardin'],
  ['broken object repair', 'mauvais'],
  ['new gift box opening', 'nouveau'],
  ['old weathered object', 'vieux'],
  ['many objects collection', 'beaucoup'],
  ['one person alone outdoors', 'seul'],
  ['two people together', 'ensemble'],
  ['people making promise handshake', 'promesse'],
  ['Japanese wedding couple', 'amour'],
  ['person bowing thanks Japan', 'merci'],
  ['person apologizing bow Japan', 'pardon'],
  ['person nodding agreement', 'oui'],
  ['person refusing gesture', 'non'],
  ['person pointing during conversation', 'ami'],
  ['person emotional reaction', 'surprise'],
]);

const JAPANESE_IMAGE_SOURCE_OVERRIDES = new Map([
  ['ja-0008', 'a1-femme-61'],
  ['ja-0524', 'ja-0002'],
  ['ja-0328', 'ja-0002'],
  ['ja-0125', 'ja-0002'],
  ['ja-0014', 'ja-0002'],
  ['ja-0510', 'ja-0002'],
  ['ja-0190', 'ja-0002'],
  ['ja-0254', 'ja-0002'],
  ['ja-0871', 'a1-glace-575'],
  ['ja-0516', 'a1-ordinateur-44'],
  ['ja-0177', 'a1-lieu-635'],
  ['ja-0419', 'a1-lieu-635'],
  ['ja-0719', 'a1-ordinateur-44'],
  ['ja-0767', 'a1-mauvais-188'],
  ['ja-0163', 'a1-carte-126'],
  ['ja-0943', 'a1-carte-126'],
  ['ja-0736', 'a1-carte-126'],
  ['ja-0405', 'a1-carte-126'],
  ['ja-0704', 'a1-etranger-466'],
  ['ja-0607', 'a1-beaucoup-1306'],
  ['ja-0638', 'a2-choix-150'],
  ['ja-0942', 'a1-rapide-195'],
  ['ja-0211', 'ja-0002'],
  ['ja-0555', 'a1-securite-948'],
  ['ja-0723', 'a1-ordinateur-44'],
  ['ja-0721', 'a1-danger-989'],
  ['ja-0739', 'a1-bureau-36'],
  ['ja-0421', 'a1-danger-989'],
  ['ja-0238', 'a1-marcher-281'],
  ['ja-0611', 'a1-medecin-66'],
  ['ja-0938', 'a1-parler-237'],
  ['ja-0159', 'a2-idee-148'],
  ['ja-0452', 'a1-ensemble-229'],
  ['ja-0402', 'a1-beaucoup-1306'],
  ['ja-0403', 'a1-grand-182'],
  ['ja-0355', 'a1-nuit-78'],
  ['ja-0702', 'a1-famille-54'],
  ['ja-0763', 'a1-ensemble-229'],
]);

const ONE_PERSON_IMAGE_IDS = new Set(['ja-0213', 'ja-0084', 'ja-0025', 'ja-0140']);

function applyCuratedImageOverrides(words, manifest) {
  const wordsById = new Map(words.map((word) => [word.id, word]));

  for (const entry of Object.values(manifest)) {
    if (entry?.imageProvider === 'openai-imagegen') {
      entry.imageAttribution = 'Создано специально для étudier';
    }
  }

  for (const wordId of ONE_PERSON_IMAGE_IDS) {
    const word = wordsById.get(wordId);
    if (!word) continue;
    manifest[wordId] = {
      imagePath: '/generated-word-images/ja-association-one-person.jpg',
      imageUrl: '/generated-word-images/ja-association-one-person.jpg',
      imageAlt: `${word.translation}: ${word.original}`,
      imagePrompt: 'Exactly one Japanese adult walking alone in a quiet park.',
      imageSource: 'generated:openai-imagegen',
      imageSourceTitle: 'Curated association: one person or alone',
      imageProvider: 'openai-imagegen',
      imageAttribution: 'Создано специально для étudier',
    };
  }

  for (const [wordId, sourceWordId] of JAPANESE_IMAGE_SOURCE_OVERRIDES) {
    const word = wordsById.get(wordId);
    const sourceEntry = manifest[sourceWordId];
    if (!word || !isRealManifestEntry(sourceEntry)) continue;
    manifest[wordId] = {
      ...sourceEntry,
      imageAlt: `${word.translation}: ${word.original}`,
      imagePrompt: `Curated real associative image for "${word.original}" (${word.translation}).`,
      imageAssociationWordId: sourceWordId,
    };
  }
}

function findFrenchWordByOriginal(frenchWords, original) {
  const key = normalize(original);
  return frenchWords.find((word) => normalize(word.original) === key) ?? null;
}

function findCuratedAssociation(word, frenchWords, manifest) {
  const query = buildAssociativeQueries(word)[0] ?? '';
  const original = CURATED_FRENCH_ORIGINAL_BY_QUERY.get(query);
  const candidate = original ? findFrenchWordByOriginal(frenchWords, original) : null;
  const defaultOriginalByPartOfSpeech = {
    adjective: 'beau',
    adverb: 'temps',
    conjunction: 'livre',
    noun: 'idée',
    particle: 'livre',
    verb: 'faire',
  };
  const fallbackCandidate = candidate ?? findFrenchWordByOriginal(frenchWords, defaultOriginalByPartOfSpeech[word.part_of_speech]);

  if (fallbackCandidate && isRealManifestEntry(manifest[fallbackCandidate.id])) {
    return { candidate: fallbackCandidate, entry: manifest[fallbackCandidate.id] };
  }

  const generatedFallbackId = word.part_of_speech === 'pronoun' ? 'ja-0003' : word.part_of_speech === 'interjection' ? 'ja-0002' : 'ja-0007';
  return isRealManifestEntry(manifest[generatedFallbackId])
    ? { candidate: { id: generatedFallbackId, original: query || word.part_of_speech }, entry: manifest[generatedFallbackId] }
    : null;
}

async function localizeManifestEntry(word, entry) {
  const remoteUrl = entry.imageUrl ?? entry.imagePath;
  const downloaded = await downloadBinary(remoteUrl);
  const extension = inferExtension(downloaded.contentType, remoteUrl);
  const filename = `${slugify(word.id || `${word.original}-${word.translation}`)}.${extension}`;
  const outputPath = path.join(OUTPUT_DIR, filename);
  const publicPath = `/${path.relative('public', outputPath).replaceAll(path.sep, '/')}`;

  await fs.writeFile(outputPath, downloaded.buffer);

  return {
    ...entry,
    imagePath: publicPath,
    imageUrl: publicPath,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const words = await loadWords(options.language);
  const manifest = await loadJson(MANIFEST_PATH, {});
  if (options.language === 'japanese') applyCuratedImageOverrides(words, manifest);
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  let processed = 0;
  let saved = 0;
  let skipped = 0;
  let failed = 0;
  let reused = 0;

  if (options.reuseExisting && options.language === 'japanese') {
    const frenchWords = await loadWords('french');

    for (const word of words) {
      if (isRealManifestEntry(manifest[word.id])) continue;
      const reusable =
        findReusableImage(word, frenchWords, manifest)
        ?? findReusableAssociation(word, frenchWords, manifest)
        ?? (options.completeAssociations ? findCuratedAssociation(word, frenchWords, manifest) : null);
      if (!reusable) continue;

      manifest[word.id] = {
        ...reusable.entry,
        imageAlt: `${word.translation}: ${word.original}`,
        imagePrompt: `Shared real associative image for "${word.original}" (${word.translation}) via "${reusable.candidate.original}".`,
        imageAssociationWordId: reusable.candidate.id,
      };
      reused += 1;
    }

    await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);

    if (options.reuseOnly) {
      console.log(JSON.stringify({ reused, total: words.length }, null, 2));
      return;
    }
  }
  const selectedWords = [];

  for (const word of words) {
    if (options.ids.size > 0 && !options.ids.has(word.id)) continue;
    const current = manifest[word.id];
    const needsLocalization = options.downloadLinked && isRealManifestEntry(current) && isRemoteImageEntry(current);

    if (!needsLocalization && !options.force && isRealManifestEntry(current)) {
      skipped += 1;
      continue;
    }

    if (selectedWords.length >= options.limit) break;
    selectedWords.push(word);
  }

  let nextIndex = 0;
  let persistPromise = Promise.resolve();

  const persistManifest = (force = false) => {
    const completed = saved + failed;
    if (!force && completed % 20 !== 0) return persistPromise;
    persistPromise = persistPromise.then(() => fs.writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`));
    return persistPromise;
  };

  const processWord = async (word) => {
    const current = manifest[word.id];
    processed += 1;

    try {
      if (options.downloadLinked && isRealManifestEntry(current) && isRemoteImageEntry(current)) {
        manifest[word.id] = await localizeManifestEntry(word, current);
        saved += 1;
        console.log(`localized ${word.id}`);
        await persistManifest();
        return;
      }

      const found = options.provider === 'commons' ? await searchCommonsImage(word) : await searchOpenverseImage(word);
      let publicPath = found.imageUrl;

      if (options.download) {
        const downloadUrl = found.fullImageUrl ?? found.imageUrl;
        const downloaded = await downloadBinaryWithFallback(found.imageUrl, downloadUrl);
        const extension = inferExtension(downloaded.contentType, downloadUrl);
        const filename = `${slugify(word.id || `${word.original}-${word.translation}`)}.${extension}`;
        const outputPath = path.join(OUTPUT_DIR, filename);
        publicPath = `/${path.relative('public', outputPath).replaceAll(path.sep, '/')}`;

        await fs.writeFile(outputPath, downloaded.buffer);
      }

      manifest[word.id] = {
        imagePath: publicPath,
        imageUrl: publicPath,
        imageAlt: `${word.translation}: ${word.original}`,
        imagePrompt: `Real associative image for "${word.original}" (${word.translation}). Query: ${found.query}.`,
        imageSource: found.sourceUrl,
        imageSourceTitle: found.title,
        imageProvider: found.provider ?? options.provider,
        imageLicense: found.license,
        imageLicenseUrl: found.licenseUrl,
        imageAttribution: found.attribution,
      };

      saved += 1;
      console.log(`${options.download ? 'saved' : 'linked'} ${word.id} <- ${found.query}`);
    } catch (error) {
      failed += 1;
      manifest[word.id] = {
        ...current,
        imageSource: current?.imageSource === 'local:fallback' ? 'real-image:none' : current?.imageSource,
      };
      console.warn(`failed ${word.id}: ${error instanceof Error ? error.message : String(error)}`);
    }

    await persistManifest();
  };

  const worker = async () => {
    while (nextIndex < selectedWords.length) {
      const word = selectedWords[nextIndex];
      nextIndex += 1;
      await processWord(word);
    }
  };

  await Promise.all(Array.from({ length: options.concurrency }, () => worker()));
  await persistManifest(true);
  console.log(JSON.stringify({ saved, reused, skipped, failed, processed }, null, 2));
}

await main();
