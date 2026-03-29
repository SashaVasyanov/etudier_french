import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DATASET_FILES = ['public/data/words_a1.json', 'public/data/words_a2.json', 'public/data/words_b1.json'];
const MANIFEST_PATH = 'public/data/word_images.json';
const OUTPUT_DIR = 'public/generated-word-images';
const WIKIMEDIA_REQUEST_DELAY_MS = 1500;
const WIKIMEDIA_RATE_LIMIT_DELAY_MS = 10000;
const PEXELS_REQUEST_DELAY_MS = 1200;

function parseArgs(argv) {
  const options = {
    provider: process.env.OPENAI_API_KEY ? 'openai' : 'auto',
    force: false,
    limit: Infinity,
    ids: new Set(),
    wikimediaConcreteOnly: true,
  };

  argv.forEach((arg) => {
    if (arg.startsWith('--provider=')) {
      options.provider = arg.slice('--provider='.length);
      return;
    }

    if (arg === '--force') {
      options.force = true;
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
      return;
    }

    if (arg === '--include-abstract') {
      options.wikimediaConcreteOnly = false;
    }
  });

  return options;
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildPrompt(word) {
  return [
    `Create a single clear educational image for the French vocabulary word "${word.original}".`,
    `Meaning in Russian: "${word.translation}".`,
    word.example_original ? `Context sentence: "${word.example_original}".` : '',
    'Show the most direct visual association for memorization.',
    'One main subject, centered composition, no text, no labels, no watermark, light clean background.',
    'The image should help a student remember the meaning immediately.',
  ]
    .filter(Boolean)
    .join(' ');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isLikelyConcreteWikimediaWord(word) {
  const partOfSpeech = String(word.part_of_speech ?? word.partOfSpeech ?? '').toLowerCase();
  const normalizedOriginal = String(word.original ?? '').trim().toLowerCase();

  if (partOfSpeech !== 'noun') {
    return false;
  }

  if (!normalizedOriginal) {
    return false;
  }

  if (normalizedOriginal.length < 2) {
    return false;
  }

  if (/\b(je|tu|il|elle|nous|vous|ils|elles|on)\b/.test(normalizedOriginal)) {
    return false;
  }

  if (/[?!]/.test(normalizedOriginal)) {
    return false;
  }

  if (normalizedOriginal.includes("'")) {
    return false;
  }

  return true;
}

function shouldSkipPreviouslyMissingWikimediaImage(options, manifestEntry) {
  return options.provider === 'wikimedia' && manifestEntry?.imageSource === 'wikimedia:none';
}

function shouldSkipPreviouslyMissingAutoImage(options, manifestEntry) {
  return options.provider === 'auto' && manifestEntry?.imageSource === 'auto:none';
}

function shouldSkipPreviouslyMissingPexelsImage(options, manifestEntry) {
  return options.provider === 'pexels' && manifestEntry?.imageSource === 'pexels:none';
}

async function loadWords() {
  const groups = await Promise.all(
    DATASET_FILES.map(async (file) => JSON.parse(await fs.readFile(file, 'utf8'))),
  );

  return groups.flat();
}

async function loadManifest() {
  try {
    return JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf8'));
  } catch {
    return {};
  }
}

async function ensureOutputDir() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
}

function inferExtension(contentType, url) {
  if (contentType?.includes('png')) {
    return 'png';
  }

  if (contentType?.includes('webp')) {
    return 'webp';
  }

  if (contentType?.includes('jpeg') || contentType?.includes('jpg')) {
    return 'jpg';
  }

  const pathname = new URL(url).pathname.toLowerCase();
  const found = pathname.match(/\.(png|webp|jpg|jpeg)$/);
  return found ? found[1].replace('jpeg', 'jpg') : 'jpg';
}

async function downloadBinary(url) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await sleep(WIKIMEDIA_REQUEST_DELAY_MS);
    const response = await fetch(url, {
      headers: {
        'user-agent': 'EtudierFrenchImageGenerator/1.0',
      },
    });

    if (response.ok) {
      return {
        buffer: Buffer.from(await response.arrayBuffer()),
        contentType: response.headers.get('content-type') ?? '',
      };
    }

    if (response.status !== 429 || attempt === 2) {
      throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
    }

    await sleep(WIKIMEDIA_RATE_LIMIT_DELAY_MS * (attempt + 1));
  }

  throw new Error(`Failed to download image: exhausted retries for ${url}`);
}

async function fetchWikimediaImage(word) {
  const attempts = [word.original, word.original.charAt(0).toUpperCase() + word.original.slice(1)];

  for (const title of attempts) {
    const summaryUrl = `https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/\s+/g, '_'))}`;
    await sleep(WIKIMEDIA_REQUEST_DELAY_MS);
    const response = await fetch(summaryUrl, {
      headers: {
        'user-agent': 'EtudierFrenchImageGenerator/1.0',
      },
    });

    if (response.status === 429) {
      await sleep(WIKIMEDIA_RATE_LIMIT_DELAY_MS);
      continue;
    }

    if (!response.ok) {
      continue;
    }

    const payload = await response.json();
    const imageUrl = payload.thumbnail?.source ?? payload.originalimage?.source;

    if (!imageUrl) {
      continue;
    }

    return {
      imageUrl,
      imageSource: payload.content_urls?.desktop?.page ?? summaryUrl,
    };
  }

  throw new Error(`No Wikimedia image found for "${word.original}"`);
}

async function fetchPexelsImage(word) {
  const apiKey = process.env.PEXELS_API_KEY;

  if (!apiKey) {
    throw new Error('Pexels API key is missing');
  }

  const queries = [
    word.original,
    `${word.original} object`,
    `${word.translation} object`,
    word.translation,
  ]
    .map((value) => value.trim())
    .filter(Boolean);

  for (const query of queries) {
    await sleep(PEXELS_REQUEST_DELAY_MS);
    const url = new URL('https://api.pexels.com/v1/search');
    url.searchParams.set('query', query);
    url.searchParams.set('per_page', '1');
    url.searchParams.set('orientation', 'landscape');
    const response = await fetch(url, {
      headers: {
        Authorization: apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Pexels search failed: ${response.status} ${response.statusText}`);
    }

    const payload = await response.json();
    const photo = payload.photos?.[0];

    if (!photo?.src) {
      continue;
    }

    const imageUrl = photo.src.medium ?? photo.src.large ?? photo.src.original ?? photo.src.landscape;

    if (!imageUrl) {
      continue;
    }

    return {
      imageUrl,
      imageSource: photo.url ?? 'pexels',
    };
  }

  throw new Error(`No Pexels image found for "${word.original}"`);
}

async function generateOpenAiImage(word, prompt) {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      size: '1024x1024',
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI image generation failed: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  const b64 = payload.data?.[0]?.b64_json;

  if (!b64) {
    throw new Error(`OpenAI image generation returned no image for "${word.original}"`);
  }

  return {
    buffer: Buffer.from(b64, 'base64'),
    extension: 'png',
    imageSource: 'openai:gpt-image-1',
  };
}

async function resolveImageAsset(word, provider, prompt) {
  if (provider === 'openai') {
    return generateOpenAiImage(word, prompt);
  }

  if (provider === 'pexels') {
    const pexels = await fetchPexelsImage(word);
    const downloaded = await downloadBinary(pexels.imageUrl);

    return {
      buffer: downloaded.buffer,
      extension: inferExtension(downloaded.contentType, pexels.imageUrl),
      imageSource: pexels.imageSource,
    };
  }

  if (provider === 'auto') {
    try {
      const wikimedia = await fetchWikimediaImage(word);
      const downloaded = await downloadBinary(wikimedia.imageUrl);

      return {
        buffer: downloaded.buffer,
        extension: inferExtension(downloaded.contentType, wikimedia.imageUrl),
        imageSource: wikimedia.imageSource,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (!message.startsWith('No Wikimedia image found')) {
        throw error;
      }

      const pexels = await fetchPexelsImage(word);
      const downloaded = await downloadBinary(pexels.imageUrl);

      return {
        buffer: downloaded.buffer,
        extension: inferExtension(downloaded.contentType, pexels.imageUrl),
        imageSource: pexels.imageSource,
      };
    }
  }

  const wikimedia = await fetchWikimediaImage(word);
  const downloaded = await downloadBinary(wikimedia.imageUrl);

  return {
    buffer: downloaded.buffer,
    extension: inferExtension(downloaded.contentType, wikimedia.imageUrl),
    imageSource: wikimedia.imageSource,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const words = await loadWords();
  const manifest = await loadManifest();
  await ensureOutputDir();

  let processed = 0;
  let saved = 0;
  let skipped = 0;

  for (const word of words) {
    if (processed >= options.limit) {
      break;
    }

    if (options.ids.size > 0 && !options.ids.has(word.id)) {
      continue;
    }

    if (
      (options.provider === 'wikimedia' || options.provider === 'auto') &&
      options.wikimediaConcreteOnly &&
      options.ids.size === 0 &&
      !isLikelyConcreteWikimediaWord(word)
    ) {
      skipped += 1;
      continue;
    }

    if (
      !options.force &&
      (
        manifest[word.id]?.imagePath ||
        shouldSkipPreviouslyMissingWikimediaImage(options, manifest[word.id]) ||
        shouldSkipPreviouslyMissingAutoImage(options, manifest[word.id]) ||
        shouldSkipPreviouslyMissingPexelsImage(options, manifest[word.id])
      )
    ) {
      skipped += 1;
      continue;
    }

    processed += 1;
    const prompt = buildPrompt(word);

    try {
      const asset = await resolveImageAsset(word, options.provider, prompt);
      const filename = `${slugify(word.id || `${word.original}-${word.translation}`)}.${asset.extension}`;
      const outputPath = path.join(OUTPUT_DIR, filename);
      const publicPath = `/${path.relative('public', outputPath).replaceAll(path.sep, '/')}`;

      await fs.writeFile(outputPath, asset.buffer);
      manifest[word.id] = {
        imagePath: publicPath,
        imageUrl: publicPath,
        imageAlt: `${word.translation}: ${word.original}`,
        imagePrompt: prompt,
        imageSource: asset.imageSource,
      };
      saved += 1;
      console.log(`saved ${word.id} -> ${publicPath}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (options.provider === 'wikimedia' && message.startsWith('No Wikimedia image found')) {
        manifest[word.id] = {
          ...manifest[word.id],
          imageSource: 'wikimedia:none',
        };
      }

      if (
        options.provider === 'auto' &&
        (message.startsWith('No Wikimedia image found') || message.startsWith('No Pexels image found') || message === 'Pexels API key is missing')
      ) {
        manifest[word.id] = {
          ...manifest[word.id],
          imageSource: 'auto:none',
        };
      }

      if (options.provider === 'pexels' && message.startsWith('No Pexels image found')) {
        manifest[word.id] = {
          ...manifest[word.id],
          imageSource: 'pexels:none',
        };
      }

      console.warn(`skip ${word.id}: ${message}`);
    }
  }

  await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`done: saved=${saved} skipped=${skipped} provider=${options.provider}`);
}

await main();
