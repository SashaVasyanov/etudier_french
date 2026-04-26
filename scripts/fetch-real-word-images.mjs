import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DATASET_FILES = ['public/data/words_a1.json', 'public/data/words_a2.json', 'public/data/words_b1.json'];
const MANIFEST_PATH = 'public/data/word_images.json';
const OUTPUT_DIR = 'public/generated-word-images';
const REQUEST_DELAY_MS = Number(process.env.IMAGE_FETCH_DELAY_MS ?? 900);
const RATE_LIMIT_DELAY_MS = Number(process.env.IMAGE_RATE_LIMIT_DELAY_MS ?? 30000);
const USER_AGENT = 'EtudierFrenchImageFetcher/1.0 (educational vocabulary app)';

const COMMONS_SEARCH_URL = 'https://commons.wikimedia.org/w/rest.php/v1/search/page';
const COMMONS_API_URL = 'https://commons.wikimedia.org/w/api.php';
const OPENVERSE_SEARCH_URL = 'https://api.openverse.org/v1/images/';

function parseArgs(argv) {
  const options = {
    download: false,
    downloadLinked: false,
    force: false,
    limit: Infinity,
    ids: new Set(),
    provider: 'openverse',
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

    if (arg.startsWith('--provider=')) {
      options.provider = arg.slice('--provider='.length);
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
  await sleep(REQUEST_DELAY_MS);
  const response = await fetch(url, {
    headers: {
      'user-agent': USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`download failed ${response.status} ${response.statusText}: ${url}`);
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

async function getImageInfo(title) {
  const url = new URL(COMMONS_API_URL);
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url|mime');
  url.searchParams.set('iiurlwidth', '900');
  url.searchParams.set('titles', title);

  const payload = await fetchJson(url);
  const page = Object.values(payload.query?.pages ?? {})[0];
  const info = page?.imageinfo?.[0];

  if (!info?.thumburl && !info?.url) {
    throw new Error(`no image info for ${title}`);
  }

  return {
    imageUrl: info.thumburl ?? info.url,
    sourceUrl: info.descriptionurl ?? info.descriptionshorturl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(title)}`,
  };
}

async function searchCommonsImage(word) {
  const queries = buildAssociativeQueries(word);
  const errors = [];

  for (const query of queries) {
    try {
      const url = new URL(COMMONS_SEARCH_URL);
      url.searchParams.set('q', query);
      url.searchParams.set('limit', '8');
      const payload = await fetchJson(url);
      const candidates = (payload.pages ?? [])
        .filter((page) => String(page.title ?? '').startsWith('File:'))
        .filter((page) => page.thumbnail?.url)
        .filter((page) => !/\.(svg|gif|tif|tiff|pdf|webm|ogv)$/i.test(String(page.title ?? '')))
        .map((page) => ({ ...page, score: scoreSearchResult(page, query) }))
        .sort((left, right) => right.score - left.score);

      const best = candidates[0];

      if (!best) {
        continue;
      }

      return {
        imageUrl: normalizeCommonsThumbnailUrl(best.thumbnail.url),
        sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURI(best.title.replaceAll(' ', '_'))}`,
        query,
        title: best.title,
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new Error(`no real image found for ${word.id}: ${errors.slice(0, 2).join('; ')}`);
}

function normalizeCommonsThumbnailUrl(url) {
  return url.replace(/\/\d+px-([^/?#]+)$/u, '/640px-$1');
}

function isRealManifestEntry(entry) {
  if (!entry?.imagePath && !entry?.imageUrl) return false;
  if (entry?.imageSource === 'local:fallback') return false;
  if (String(entry?.imagePath ?? '').startsWith('data:image/svg+xml')) return false;
  return true;
}

function isRemoteImageEntry(entry) {
  const source = String(entry?.imageUrl ?? entry?.imagePath ?? '');
  return /^https?:\/\//i.test(source);
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
  const words = (await Promise.all(DATASET_FILES.map((file) => loadJson(file, [])))).flat();
  const manifest = await loadJson(MANIFEST_PATH, {});
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  let processed = 0;
  let saved = 0;
  let skipped = 0;
  let failed = 0;

  for (const word of words) {
    if (processed >= options.limit) break;
    if (options.ids.size > 0 && !options.ids.has(word.id)) continue;

    const current = manifest[word.id];
    if (options.downloadLinked && isRealManifestEntry(current) && isRemoteImageEntry(current)) {
      processed += 1;

      try {
        manifest[word.id] = await localizeManifestEntry(word, current);
        saved += 1;
        console.log(`localized ${word.id}`);
      } catch (error) {
        failed += 1;
        console.warn(`failed ${word.id}: ${error instanceof Error ? error.message : String(error)}`);
      }

      continue;
    }

    if (!options.force && isRealManifestEntry(current)) {
      skipped += 1;
      continue;
    }

    processed += 1;

    try {
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
  }

  await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ saved, skipped, failed, processed }, null, 2));
}

await main();
