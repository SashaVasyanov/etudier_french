import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DATASET_FILES = ['public/data/words_a1.json', 'public/data/words_a2.json', 'public/data/words_b1.json'];
const MANIFEST_PATH = 'public/data/word_images.json';
const OUTPUT_DIR = 'public/generated-word-images';

function parseArgs(argv) {
  const options = {
    provider: process.env.OPENAI_API_KEY ? 'openai' : 'wikimedia',
    force: false,
    limit: Infinity,
    ids: new Set(),
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

    await new Promise((resolve) => setTimeout(resolve, 1600 * (attempt + 1)));
  }

  throw new Error(`Failed to download image: exhausted retries for ${url}`);
}

async function fetchWikimediaImage(word) {
  const attempts = [word.original, word.original.charAt(0).toUpperCase() + word.original.slice(1)];

  for (const title of attempts) {
    const summaryUrl = `https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/\s+/g, '_'))}`;
    const response = await fetch(summaryUrl, {
      headers: {
        'user-agent': 'EtudierFrenchImageGenerator/1.0',
      },
    });

    if (!response.ok) {
      continue;
    }

    const payload = await response.json();
    const imageUrl = payload.originalimage?.source ?? payload.thumbnail?.source;

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

    if (!options.force && manifest[word.id]?.imagePath) {
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
      console.warn(`skip ${word.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`done: saved=${saved} skipped=${skipped} provider=${options.provider}`);
}

await main();
