import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const JAPANESE_WORDS_SOURCE = 'src/data/japaneseWords.ts';
const MANIFEST_PATH = 'public/data/word_images.json';
const PUBLIC_DIR = path.resolve('public');
const EXPECTED_WORD_COUNT = 1000;

function isRasterHeader(buffer) {
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng = buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  return isJpeg || isPng || isWebp;
}

async function main() {
  const [sourceText, manifestText] = await Promise.all([
    fs.readFile(JAPANESE_WORDS_SOURCE, 'utf8'),
    fs.readFile(MANIFEST_PATH, 'utf8'),
  ]);
  const words = [...sourceText.matchAll(/createJapaneseWord\((\{[^\n]+\})\)/g)].map((match) => JSON.parse(match[1]));
  const manifest = JSON.parse(manifestText);

  assert.equal(words.length, EXPECTED_WORD_COUNT, 'Japanese word count changed unexpectedly');

  const missing = [];
  const invalid = [];
  const paths = new Set();
  const providers = new Map();
  let totalBytes = 0;

  for (const word of words) {
    const entry = manifest[word.id];

    if (!entry?.imagePath) {
      missing.push(word.id);
      continue;
    }

    const imagePath = String(entry.imagePath);
    const absolutePath = path.resolve(PUBLIC_DIR, imagePath.replace(/^\//, ''));
    const provider = String(entry.imageProvider ?? 'unknown');
    providers.set(provider, (providers.get(provider) ?? 0) + 1);
    paths.add(imagePath);

    if (!absolutePath.startsWith(`${PUBLIC_DIR}${path.sep}`)) {
      invalid.push(`${word.id}: path escapes public directory`);
      continue;
    }

    if (!/^\/generated-word-images\/.+\.(?:jpe?g|png|webp)$/i.test(imagePath)) {
      invalid.push(`${word.id}: not a local raster path (${imagePath})`);
      continue;
    }

    if (!entry.imageSource || entry.imageSource === 'generated:semantic-svg-v2') {
      invalid.push(`${word.id}: missing real image provenance`);
    }

    if (/\.(?:aac|flac|m4a|mp3|oga|ogg|opus|wav)(?:$|[?#])/i.test(String(entry.imageSource))) {
      invalid.push(`${word.id}: image provenance points to an audio file`);
    }

    if (provider === 'wikimedia-commons' && (!entry.imageLicense || !entry.imageAttribution)) {
      invalid.push(`${word.id}: incomplete Wikimedia attribution`);
    }

    if (provider === 'openai-imagegen' && entry.imageAttribution !== 'Создано специально для étudier') {
      invalid.push(`${word.id}: generated image attribution is not localized`);
    }

    try {
      const file = await fs.readFile(absolutePath);
      totalBytes += file.byteLength;

      if (file.byteLength < 4_000) invalid.push(`${word.id}: suspiciously small file (${file.byteLength} bytes)`);
      if (!isRasterHeader(file)) invalid.push(`${word.id}: file signature is not JPEG, PNG or WebP`);
    } catch (error) {
      invalid.push(`${word.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  assert.deepEqual(missing, [], `Missing Japanese images: ${missing.slice(0, 20).join(', ')}`);
  assert.deepEqual(invalid, [], `Invalid Japanese images:\n${invalid.slice(0, 30).join('\n')}`);
  assert.ok(paths.size >= 200, `Only ${paths.size} distinct images for ${words.length} words`);

  console.log(
    JSON.stringify(
      {
        words: words.length,
        distinctImages: paths.size,
        bundledMegabytes: Number((totalBytes / 1024 / 1024).toFixed(2)),
        providers: Object.fromEntries([...providers.entries()].sort(([left], [right]) => left.localeCompare(right))),
      },
      null,
      2,
    ),
  );
}

await main();
