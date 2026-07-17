import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const DATASET_FILES = ['public/data/words_a1.json', 'public/data/words_a2.json', 'public/data/words_b1.json'];
const JAPANESE_WORDS_SOURCE = 'src/data/japaneseWords.ts';
const JAPANESE_CORRECTIONS_SOURCE = 'src/data/japaneseWordCorrections.ts';
const MANIFEST_PATH = 'public/data/word_images.json';
const OUTPUT_DIR = 'public/generated-word-images';
const REQUEST_DELAY_MS = Number(process.env.IMAGE_FETCH_DELAY_MS ?? 400);
const RATE_LIMIT_DELAY_MS = Number(process.env.IMAGE_RATE_LIMIT_DELAY_MS ?? 5000);
const REQUEST_TIMEOUT_MS = Number(process.env.IMAGE_REQUEST_TIMEOUT_MS ?? 15000);
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
    unique: false,
    keepWeak: false,
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

    if (arg === '--unique') {
      options.unique = true;
      return;
    }

    if (arg === '--keep-weak') {
      options.keepWeak = true;
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

function contentHash(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function isRasterBuffer(buffer) {
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng = buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  return isJpeg || isPng || isWebp;
}

function stableNumber(value) {
  return Number.parseInt(createHash('sha1').update(String(value)).digest('hex').slice(0, 8), 16);
}

function sourceKey(value) {
  return normalize(String(value ?? '')).replace(/[?#].*$/, '');
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

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await sleep(REQUEST_DELAY_MS);
    response = await fetch(url, {
      headers: {
        accept: 'application/json',
        'user-agent': USER_AGENT,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await sleep(REQUEST_DELAY_MS);
    response = await fetch(url, {
      headers: {
        accept: 'image/avif,image/webp,image/png,image/jpeg,*/*;q=0.5',
        'user-agent': USER_AGENT,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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

async function searchOpenverseImage(word, excludedSourceKeys = new Set()) {
  const queries = buildAssociativeQueries(word);
  const errors = [];

  for (const query of queries) {
    const seededPage = 1 + (stableNumber(`${word.id}:${query}`) % 30);
    const pages = [...new Set([seededPage, 1])];

    for (const page of pages) {
      try {
        const url = new URL(OPENVERSE_SEARCH_URL);
        url.searchParams.set('q', query);
        url.searchParams.set('page_size', '20');
        url.searchParams.set('page', String(page));
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
          .map((item) => ({
            ...item,
            uniqueKey: sourceKey(item.foreign_landing_url ?? item.detail_url ?? item.id ?? item.url ?? item.thumbnail),
            score: scoreSearchResult(item, query),
          }))
          .filter((item) => item.uniqueKey && !excludedSourceKeys.has(item.uniqueKey))
          .sort((left, right) => right.score - left.score);

        const best = candidates[0];
        if (!best) continue;

        excludedSourceKeys.add(best.uniqueKey);
        return {
          imageUrl: best.thumbnail ?? best.url,
          fullImageUrl: best.url ?? best.thumbnail,
          sourceUrl: best.foreign_landing_url ?? best.detail_url ?? best.url,
          uniqueKey: best.uniqueKey,
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

async function searchCommonsImage(word, excludedSourceKeys = new Set()) {
  const queries = buildAssociativeQueries(word);
  const errors = [];

  for (const query of queries) {
    const seededOffset = (stableNumber(`${word.id}:${query}`) % 20) * 20;
    const offsets = [...new Set([seededOffset, 0])];

    for (const offset of offsets) {
      try {
        const url = new URL(COMMONS_API_URL);
        url.searchParams.set('action', 'query');
        url.searchParams.set('format', 'json');
        url.searchParams.set('generator', 'search');
        url.searchParams.set('gsrsearch', query);
        url.searchParams.set('gsrnamespace', '6');
        url.searchParams.set('gsrlimit', '20');
        url.searchParams.set('gsroffset', String(offset));
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
              uniqueKey: sourceKey(
                page.imageinfo[0].descriptionurl
                ?? page.imageinfo[0].descriptionshorturl
                ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
              ),
              description: `${metadataValue(metadata, 'ObjectName')} ${metadataValue(metadata, 'ImageDescription')} ${metadataValue(metadata, 'Categories')}`,
            };
            return { ...candidate, score: scoreSearchResult(candidate, query) };
          })
          .filter((candidate) => candidate.uniqueKey && !excludedSourceKeys.has(candidate.uniqueKey))
          .sort((left, right) => right.score - left.score);

        const best = candidates[0];
        if (!best) continue;

        const info = best.imageinfo[0];
        const metadata = info.extmetadata;
        const artist = metadataValue(metadata, 'Attribution') || metadataValue(metadata, 'Artist') || 'Wikimedia Commons contributor';
        excludedSourceKeys.add(best.uniqueKey);

        return {
          imageUrl: info.thumburl,
          sourceUrl: info.descriptionurl ?? info.descriptionshorturl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(best.title)}`,
          uniqueKey: best.uniqueKey,
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

async function buildUniqueImageState(words, manifest) {
  const replacementIds = new Set();
  const usedContentHashes = new Set();
  const usedSourceKeys = new Set();
  const hashByPath = new Map();
  const hashByWordId = new Map();

  for (const word of words) {
    const entry = manifest[word.id];
    const imagePath = String(entry?.imagePath ?? '');
    if (!isRealManifestEntry(entry) || !imagePath.startsWith('/generated-word-images/')) {
      replacementIds.add(word.id);
      continue;
    }

    const absolutePath = path.resolve('public', imagePath.replace(/^\//, ''));
    let hash = hashByPath.get(absolutePath);

    try {
      if (!hash) {
        const buffer = await fs.readFile(absolutePath);
        if (!isRasterBuffer(buffer)) {
          replacementIds.add(word.id);
          continue;
        }
        hash = contentHash(buffer);
        hashByPath.set(absolutePath, hash);
      }
    } catch {
      replacementIds.add(word.id);
      continue;
    }

    if (usedContentHashes.has(hash)) {
      replacementIds.add(word.id);
      continue;
    }

    usedContentHashes.add(hash);
    hashByWordId.set(word.id, hash);
    const key = sourceKey(entry.imageSource);
    if (key && /^https?:\/\//.test(key)) usedSourceKeys.add(key);
  }

  return { replacementIds, usedContentHashes, usedSourceKeys, hashByWordId };
}

function uniqueAssociationScore(word, candidate, entry) {
  const primary = primaryTranslation(word.translation);
  const candidatePrimary = primaryTranslation(candidate.translation);
  const wordTokens = new Set(translationTokens(word.translation));
  const candidateTokens = translationTokens(candidate.translation);
  const sharedTranslationTokens = candidateTokens.filter((token) => wordTokens.has(token));
  const wordAssociationTokens = new Set(associationTokens(buildAssociativeQueries(word).join(' ')));
  const candidateAssociations = associationTokens(
    `${buildAssociativeQueries(candidate).join(' ')} ${entry.imagePrompt ?? ''}`,
  );
  const sharedAssociationTokens = candidateAssociations.filter((token) => wordAssociationTokens.has(token));
  const wordTags = new Set((word.tags ?? []).map(normalize));
  const sharedTags = (candidate.tags ?? []).map(normalize).filter((tag) => wordTags.has(tag));
  const wordCategories = visualCategories(word);
  const candidateCategories = visualCategories(candidate, entry);
  const sharedCategories = [...candidateCategories].filter((category) => wordCategories.has(category));
  let score = 0;

  if (primary && primary === candidatePrimary) score += 1_000;
  if (primary && candidatePrimary && (primary.includes(candidatePrimary) || candidatePrimary.includes(primary))) score += 120;
  score += sharedTranslationTokens.reduce((total, token) => total + token.length * 15, 0);
  score += sharedAssociationTokens.length * 30;
  score += sharedCategories.length * 90;
  score += sharedTags.length * 12;
  if (word.part_of_speech === candidate.part_of_speech) score += 8;

  return score;
}

const VISUAL_CATEGORY_RULES = [
  ['family', ['family', 'famil', 'parent', 'mother', 'father', 'children', 'child', 'woman', 'man', 'friend', 'people', 'женщ', 'мужчин', 'семь', 'родител', 'ребён', 'друг']],
  ['communication', ['talk', 'listen', 'read', 'write', 'telephone', 'smartphone', 'voice', 'question', 'story', 'notice', 'program', 'visit', 'говор', 'слуш', 'чита', 'писа', 'телефон', 'вопрос', 'сказк', 'рассказ', 'извещ', 'программ', 'посещ', 'визит']],
  ['learning', ['student', 'teacher', 'study', 'school', 'book', 'knowledge', 'memory', 'учеб', 'учит', 'школ', 'книг', 'знан', 'памят']],
  ['work', ['work', 'office', 'desk', 'company', 'job', 'работ', 'офис', 'компан', 'дело']],
  ['commerce', ['money', 'shop', 'store', 'pay', 'buy', 'price', 'ден', 'магаз', 'плат', 'покуп', 'цен']],
  ['food', ['meal', 'food', 'drink', 'water', 'eat', 'еда', 'напит', 'вод', 'есть', 'пить', 'обед', 'ужин', 'завтрак']],
  ['home', ['home', 'house', 'room', 'door', 'interior', 'дом', 'комнат', 'двер', 'жилищ']],
  ['travel', ['car', 'train', 'station', 'street', 'road', 'walk', 'run', 'travel', 'машин', 'поезд', 'станц', 'улиц', 'дорог', 'идти', 'бежать', 'путеш']],
  ['time', ['clock', 'calendar', 'schedule', 'night', 'day', 'month', 'year', 'time', 'час', 'календар', 'расписан', 'ноч', 'день', 'месяц', 'год', 'врем']],
  ['place', ['place', 'direction', 'spatial', 'inside', 'outside', 'above', 'below', 'мест', 'направ', 'внутр', 'снаруж', 'сверху', 'внизу']],
  ['thinking', ['think', 'idea', 'plan', 'puzzle', 'problem', 'solution', 'search', 'detective', 'дум', 'иде', 'план', 'задач', 'проблем', 'решен', 'искать']],
  ['safety', ['safe', 'safety', 'danger', 'warning', 'help', 'protect', 'безопас', 'опас', 'помощ', 'защит']],
  ['emotion', ['love', 'happy', 'sad', 'angry', 'worried', 'laugh', 'smile', 'sleep', 'fear', 'emotion', 'hope', 'calm', 'regret', 'charm', 'interest', 'confidence', 'coward', 'dissatisfaction', 'tragedy', 'люб', 'счаст', 'груст', 'злост', 'страх', 'смех', 'улыб', 'спать', 'эмоц', 'чувств', 'надежд', 'спокой', 'сожал', 'очарован', 'интерес', 'уверен', 'трус', 'недоволь', 'трагед']],
  ['social', ['agreement', 'refusing', 'thanks', 'apology', 'promise', 'wedding', 'соглас', 'отказ', 'благодар', 'извин', 'обещ', 'свад']],
  ['quantity', ['large', 'small', 'many', 'one person', 'two people', 'matching', 'different', 'big', 'больш', 'малень', 'много', 'один', 'два', 'одинак', 'разн']],
  ['quality', ['beautiful', 'broken', 'new gift', 'old weathered', 'strong', 'fast', 'unique', 'complete', 'perfect', 'serious', 'simple', 'special', 'best', 'impossible', 'important', 'stable', 'excellent', 'красив', 'слом', 'нов', 'стар', 'сильн', 'быстр', 'единствен', 'полн', 'совершен', 'серьёз', 'прост', 'особ', 'лучш', 'невозмож', 'важн', 'стабил', 'превосход']],
  ['nature', ['nature', 'garden', 'mountain', 'sunlight', 'snow', 'flower', 'animal', 'earth', 'ground', 'horse', 'stream', 'wave', 'living creature', 'fire', 'природ', 'сад', 'гор', 'солн', 'снег', 'цвет', 'живот', 'земл', 'почв', 'лошад', 'конь', 'течен', 'поток', 'волн', 'существ', 'пожар']],
  ['language', ['grammar', 'language learning', 'textbook', 'pronoun', 'conjunction', 'particle', 'граммат', 'язык', 'местоимен', 'союз', 'частиц']],
  ['law', ['police', 'detective', 'court', 'trial', 'crime', 'arrest', 'inspector', 'law', 'robber', 'murder', 'hostage', 'warrant', 'execution', 'justice', 'полици', 'сыщик', 'суд', 'преступ', 'арест', 'инспектор', 'закон', 'грабител', 'убий', 'залож', 'приказ', 'казн', 'справедлив']],
  ['military', ['military', 'war', 'weapon', 'troop', 'battle', 'explosion', 'invade', 'army', 'fleet', 'warrior', 'colonel', 'captain', 'lieutenant', 'major', 'военн', 'войн', 'оруж', 'отряд', 'взрыв', 'вторг', 'арми', 'флот', 'воин', 'полковник', 'капитан', 'лейтенант', 'майор']],
  ['health', ['body', 'health', 'birth', 'corpse', 'medical', 'medicine', 'doctor', 'hospital', 'nerve', 'seizure', 'treatment', 'тело', 'здоров', 'рожд', 'труп', 'медицин', 'врач', 'больниц', 'нерв', 'приступ', 'лечен']],
  ['technology', ['equipment', 'device', 'technology', 'science', 'research', 'technical', 'machine', 'computer', 'electricity', 'satellite', 'metal', 'power source', 'code', 'tool', 'оборуд', 'устройств', 'техник', 'наук', 'исслед', 'машин', 'компьютер', 'электр', 'спутник', 'металл', 'питание', 'шифр', 'инструмент']],
  ['society', ['president', 'organization', 'humanity', 'member', 'government', 'management', 'control', 'federation', 'nation', 'enterprise', 'authority', 'revolution', 'candidate', 'ideology', 'representation', 'social position', 'group', 'collective', 'civilian', 'президент', 'организац', 'человечеств', 'член', 'правительств', 'управл', 'контрол', 'федерац', 'народ', 'предприят', 'полномоч', 'революц', 'кандидат', 'идеолог', 'представитель', 'положен', 'групп', 'коллектив', '民間']],
  ['music', ['song', 'music', 'tone', 'melody', 'песн', 'музык', 'тон', 'мелод']],
  ['measure', ['half', 'limit', 'boundary', 'number', 'first', 'last', 'pair', 'four', 'hundred', 'share', 'length', 'половин', 'предел', 'границ', 'номер', 'перв', 'послед', 'пара', 'четыр', 'сот', 'доля', 'длин', '四', '何百']],
  ['truth', ['truth', 'reality', 'real', 'honest', 'trust', 'correct', 'accuracy', 'правд', 'реальн', 'настоящ', 'честн', 'довер', 'правильн', 'точн']],
  ['state', ['state', 'condition', 'situation', 'ability', 'activity', 'action', 'result', 'cause', 'circumstance', 'acceptance', 'appearance', 'expression', 'состоян', 'услов', 'способност', 'деятельност', 'действ', 'результ', 'причин', 'обстоятельств', 'принят', 'проявлен', 'выражен']],
  ['event', ['start', 'finish', 'prepare', 'arrival', 'departure', 'change', 'replacement', 'recent', 'conclusion', 'century', 'friday', 'beginning', 'начин', 'заканч', 'готов', 'прибы', 'уезж', 'смен', 'замен', 'ближай', 'заключен', 'окончан', 'век', 'столет', 'пятниц']],
  ['geography', ['russia', 'california', 'tokyo', 'italy', 'england', 'country', 'border', 'east', 'west', 'south', 'north', 'outskirts', 'surroundings', 'росси', 'калифорни', 'токио', 'итали', 'англи', 'стран', 'границ', 'восток', 'запад', 'юг', 'север', 'окраин', 'окрестност', '西', '東', '南', '国境']],
  ['fantasy', ['queen', 'prince', 'kingdom', 'witch', 'angel', 'hero', 'castle', 'heaven', 'priest', 'empire', 'giant', 'королев', 'принц', 'царств', 'ведьм', 'ангел', 'геро', 'замок', 'рай', 'патер', 'импери', 'великан', 'гигант', '王子']],
  ['object', ['pin', 'stamp', 'goods', 'fingerprint', 'target', 'doll', 'wallet', 'material', 'letter', 'content', 'закреп', 'стерж', 'печат', 'товар', 'отпечат', 'мишень', 'кукл', 'кошел', 'матери', 'букв', 'содержим']],
  ['body', ['face', 'hand', 'finger', 'side', 'body', 'adult', 'boy', 'beauty', 'aunt', 'лицо', 'рук', 'палец', 'бок', 'тело', 'взросл', 'мальчик', 'красавиц', 'тёт']],
  ['sport', ['sport', 'player', 'racecourse', 'athlete', 'спорт', 'игрок', 'манеж', 'скаков', 'атлет']],
  ['education', ['high school', 'mathematics', 'chemistry', 'theory', 'knowledge', 'art', 'specialty', 'wisdom', 'школ', 'математ', 'хими', 'теори', 'знан', 'мудрост', 'искусств', 'специальност']],
  ['ownership', ['possession', 'owner', 'rich', 'property', 'receive', 'accept', 'обладан', 'хозяин', 'богач', 'получен', 'принят']],
  ['rules', ['rule', 'regulation', 'duty', 'obligation', 'requirement', 'denial', 'countermeasure', 'правил', 'устав', 'обязанност', 'требован', 'отрицан', 'контрмер']],
  ['aviation', ['aviation', 'aircraft', 'flight', 'air travel', 'авиац', 'воздухоплав', 'полёт']],
];

function visualCategories(word, entry) {
  const text = normalize(
    `${word.translation ?? ''} ${(word.tags ?? []).join(' ')} ${buildAssociativeQueries(word).join(' ')} ${entry?.imagePrompt ?? ''}`,
  );
  const categories = new Set(
    VISUAL_CATEGORY_RULES
      .filter(([, terms]) => hasAny(text, terms))
      .map(([category]) => category),
  );

  if (['particle', 'conjunction', 'determiner', 'pronoun'].includes(word.part_of_speech)) categories.add('language');
  if (word.part_of_speech === 'interjection') categories.add('emotion');
  return categories;
}

async function fillUniqueImagesFromExisting(words, frenchWords, manifest, uniqueState, minimumScore = 30) {
  const candidates = [];
  const poolHashes = new Set();

  for (const candidate of frenchWords) {
    const entry = manifest[candidate.id];
    const imagePath = String(entry?.imagePath ?? '');
    if (!isRealManifestEntry(entry) || !imagePath.startsWith('/generated-word-images/')) continue;

    try {
      const buffer = await fs.readFile(path.resolve('public', imagePath.replace(/^\//, '')));
      if (!isRasterBuffer(buffer)) continue;
      const hash = contentHash(buffer);
      if (uniqueState.usedContentHashes.has(hash) || poolHashes.has(hash)) continue;
      poolHashes.add(hash);
      candidates.push({ candidate, entry, hash, used: false });
    } catch {
      // Ignore stale manifest entries. The image audit reports missing active files separately.
    }
  }

  const scores = [];
  let reused = 0;

  for (const word of words) {
    if (!uniqueState.replacementIds.has(word.id)) continue;

    let best = null;
    let bestScore = -1;

    for (const item of candidates) {
      if (item.used) continue;
      const score = uniqueAssociationScore(word, item.candidate, item.entry);
      const tieBreaker = stableNumber(`${word.id}:${item.candidate.id}`) / 0xffffffff;
      const rankedScore = score + tieBreaker;

      if (rankedScore > bestScore) {
        best = item;
        bestScore = rankedScore;
      }
    }

    if (!best || Math.floor(bestScore) < minimumScore) continue;

    best.used = true;
    uniqueState.usedContentHashes.add(best.hash);
    uniqueState.replacementIds.delete(word.id);
    const key = sourceKey(best.entry.imageSource);
    if (key && /^https?:\/\//.test(key)) uniqueState.usedSourceKeys.add(key);
    manifest[word.id] = {
      ...best.entry,
      imageAlt: `${word.translation}: ${word.original}`,
      imagePrompt: `Unique real associative image for "${word.original}" (${word.translation}) via "${best.candidate.original}".`,
      imageAssociationWordId: best.candidate.id,
      imageAssociationScore: Math.floor(bestScore),
    };
    scores.push(Math.floor(bestScore));
    reused += 1;
  }

  return {
    reused,
    remaining: uniqueState.replacementIds.size,
    exact: scores.filter((score) => score >= 1_000).length,
    strong: scores.filter((score) => score >= 100 && score < 1_000).length,
    associative: scores.filter((score) => score >= 30 && score < 100).length,
  };
}

function releaseWeakUniqueAssociations(words, frenchWords, manifest, uniqueState) {
  const frenchById = new Map(frenchWords.map((word) => [word.id, word]));
  let released = 0;

  for (const word of words) {
    if (uniqueState.replacementIds.has(word.id)) continue;
    const entry = manifest[word.id];
    const candidate = frenchById.get(entry?.imageAssociationWordId);
    if (!candidate || !String(entry?.imagePrompt ?? '').startsWith('Unique real associative image')) continue;

    const score = uniqueAssociationScore(word, candidate, entry);
    if (score >= 30) {
      entry.imageAssociationScore = score;
      continue;
    }

    const hash = uniqueState.hashByWordId.get(word.id);
    if (hash) uniqueState.usedContentHashes.delete(hash);
    uniqueState.hashByWordId.delete(word.id);
    uniqueState.replacementIds.add(word.id);
    released += 1;
  }

  return released;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const words = await loadWords(options.language);
  const manifest = await loadJson(MANIFEST_PATH, {});
  if (options.language === 'japanese' && !options.unique) applyCuratedImageOverrides(words, manifest);
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  if (options.unique && options.language !== 'japanese') {
    throw new Error('--unique requires --language=japanese');
  }

  if (options.unique && !options.download && !options.reuseOnly) {
    throw new Error('--unique requires --download unless --reuse-only is used');
  }

  const uniqueState = options.unique ? await buildUniqueImageState(words, manifest) : null;

  let processed = 0;
  let saved = 0;
  let skipped = 0;
  let failed = 0;
  let reused = 0;

  if (options.reuseExisting && options.language === 'japanese') {
    const frenchWords = await loadWords('french');

    if (uniqueState) {
      const released = options.keepWeak ? 0 : releaseWeakUniqueAssociations(words, frenchWords, manifest, uniqueState);
      const result = await fillUniqueImagesFromExisting(
        words,
        frenchWords,
        manifest,
        uniqueState,
        options.keepWeak ? 8 : 30,
      );
      reused += result.reused;
      await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
      console.log(JSON.stringify({ releasedWeakAssociations: released, uniqueReuse: result }, null, 2));

      if (options.reuseOnly) return;
    }

    for (const word of uniqueState ? [] : words) {
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
    const needsUniqueImage = uniqueState?.replacementIds.has(word.id) ?? false;

    if (!needsLocalization && !needsUniqueImage && !options.force && isRealManifestEntry(current)) {
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
    if (!force && completed % 5 !== 0) return persistPromise;
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

      let found;
      let publicPath;
      let downloaded;
      const maxAttempts = options.unique ? 3 : 1;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const search = options.provider === 'commons' ? searchCommonsImage : searchOpenverseImage;
        const fallbackSearch = options.provider === 'commons' ? searchOpenverseImage : searchCommonsImage;

        try {
          found = await search(word, uniqueState?.usedSourceKeys);
        } catch (primaryError) {
          if (!options.unique) throw primaryError;
          found = await fallbackSearch(word, uniqueState?.usedSourceKeys);
        }

        publicPath = found.imageUrl;
        if (!options.download) break;

        const downloadUrl = found.fullImageUrl ?? found.imageUrl;
        downloaded = await downloadBinaryWithFallback(found.imageUrl, downloadUrl);
        if (!isRasterBuffer(downloaded.buffer)) {
          found = undefined;
          downloaded = undefined;
          continue;
        }
        const hash = contentHash(downloaded.buffer);

        if (uniqueState?.usedContentHashes.has(hash)) {
          found = undefined;
          downloaded = undefined;
          continue;
        }

        uniqueState?.usedContentHashes.add(hash);
        const extension = inferExtension(downloaded.contentType, downloadUrl);
        const filename = `${slugify(word.id || `${word.original}-${word.translation}`)}.${extension}`;
        const outputPath = path.join(OUTPUT_DIR, filename);
        publicPath = `/${path.relative('public', outputPath).replaceAll(path.sep, '/')}`;
        await fs.writeFile(outputPath, downloaded.buffer);
        break;
      }

      if (!found || !publicPath || (options.download && !downloaded)) {
        throw new Error(`no unique raster image found after ${maxAttempts} attempts`);
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
