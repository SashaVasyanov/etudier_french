import fs from 'node:fs/promises';
import path from 'node:path';

const PROJECT_ROOT = process.cwd();
const PUBLIC_ROOT = path.resolve(PROJECT_ROOT, 'public');
const GENERATED_ROOT = path.resolve(PUBLIC_ROOT, 'generated-word-images');
const DATA_ROOT = path.resolve(PUBLIC_ROOT, 'data');
const SOURCE_ROOT = path.resolve(PROJECT_ROOT, 'src');
const GENERATED_URL_PREFIX = '/generated-word-images/';

// CI asset budgets for the current catalog. Lower these only after re-encoding assets.
const MAX_SINGLE_IMAGE_BYTES = 6 * 1024 * 1024; // 6 MiB: current largest image is about 5.5 MiB.
const MAX_TOTAL_IMAGE_BYTES = 128 * 1024 * 1024; // 128 MiB: allows the bundled 1,581 referenced images with growth headroom.

const args = new Set(process.argv.slice(2));
const deleteOrphans = args.has('--delete');
const check = args.has('--check');

if ([...args].some((arg) => arg !== '--delete' && arg !== '--check')) {
  throw new Error('Usage: node scripts/audit-generated-word-images.mjs [--check] [--delete]');
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function isWithin(root, target) {
  const relative = path.relative(root, target);
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}

async function walk(root, predicate) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const paths = [];

  for (const entry of entries) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) {
      paths.push(...await walk(target, predicate));
    } else if (entry.isFile() && predicate(target)) {
      paths.push(target);
    }
  }

  return paths.sort((left, right) => left.localeCompare(right));
}

function collectImagePaths(value, sourceName, references, invalidReferences) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectImagePaths(item, sourceName, references, invalidReferences));
    return;
  }

  if (!value || typeof value !== 'object') return;

  for (const [key, item] of Object.entries(value)) {
    if ((key === 'imagePath' || key === 'imageUrl') && typeof item === 'string' && item.startsWith(GENERATED_URL_PREFIX)) {
      addReference(item, sourceName, references, invalidReferences);
    }
    collectImagePaths(item, sourceName, references, invalidReferences);
  }
}

function addReference(urlPath, sourceName, references, invalidReferences) {
  const decoded = decodeURIComponent(urlPath.split(/[?#]/, 1)[0]);
  const relative = decoded.slice(1);
  const absolute = path.resolve(PUBLIC_ROOT, relative);

  if (!isWithin(GENERATED_ROOT, absolute)) {
    invalidReferences.push(`${sourceName}: ${urlPath} escapes generated-word-images root`);
    return;
  }

  references.set(absolute, { urlPath: `${GENERATED_URL_PREFIX}${toPosix(path.relative(GENERATED_ROOT, absolute))}`, sourceName });
}

async function readReferences() {
  const references = new Map();
  const invalidReferences = [];
  const jsonFiles = await walk(DATA_ROOT, (file) => file.endsWith('.json'));
  const sourceFiles = await walk(SOURCE_ROOT, (file) => /\.(?:ts|tsx)$/.test(file));

  for (const file of jsonFiles) {
    const sourceName = toPosix(path.relative(PROJECT_ROOT, file));
    const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
    collectImagePaths(parsed, sourceName, references, invalidReferences);
  }

  const literalPattern = /['"](\/generated-word-images\/[^'"`\s]+)['"]/g;
  for (const file of sourceFiles) {
    const sourceName = toPosix(path.relative(PROJECT_ROOT, file));
    const source = await fs.readFile(file, 'utf8');
    for (const match of source.matchAll(literalPattern)) {
      addReference(match[1], sourceName, references, invalidReferences);
    }
  }

  return { references, invalidReferences, jsonFiles: jsonFiles.map((file) => toPosix(path.relative(PROJECT_ROOT, file))), sourceFiles: sourceFiles.map((file) => toPosix(path.relative(PROJECT_ROOT, file))) };
}

async function main() {
  if (!isWithin(PUBLIC_ROOT, GENERATED_ROOT)) throw new Error('Generated image root is outside public root');
  const { references, invalidReferences, jsonFiles, sourceFiles } = await readReferences();
  const files = await walk(GENERATED_ROOT, () => true);
  const fileSet = new Set(files);
  const missing = [...references.keys()].filter((file) => !fileSet.has(file)).map((file) => references.get(file).urlPath).sort();
  const orphans = files.filter((file) => !references.has(file));
  const fileStats = await Promise.all(files.map(async (file) => ({ file, bytes: (await fs.stat(file)).size })));
  const totalBytes = fileStats.reduce((total, item) => total + item.bytes, 0);
  const largest = [...fileStats].sort((left, right) => right.bytes - left.bytes || left.file.localeCompare(right.file))[0] ?? { bytes: 0, file: '' };

  const orphanBytes = orphans.reduce((total, file) => total + (fileStats.find((item) => item.file === file)?.bytes ?? 0), 0);
  const remainingTotalBytes = totalBytes - (deleteOrphans ? orphanBytes : 0);

  if (deleteOrphans) {
    for (const file of orphans) {
      if (!isWithin(GENERATED_ROOT, file)) throw new Error(`Refusing to delete outside generated root: ${file}`);
      await fs.unlink(file);
    }
  }

  const report = {
    mode: deleteOrphans ? 'delete' : 'report',
    budgets: { maxSingleImageBytes: MAX_SINGLE_IMAGE_BYTES, maxTotalImageBytes: MAX_TOTAL_IMAGE_BYTES },
    inputs: { jsonFiles, sourceFileCount: sourceFiles.length },
    referencedImageCount: references.size,
    generatedFileCount: files.length,
    totalImageBytes: totalBytes,
    remainingTotalImageBytes: remainingTotalBytes,
    largestImage: { path: largest.file ? `/${toPosix(path.relative(PUBLIC_ROOT, largest.file))}` : null, bytes: largest.bytes },
    missingReferences: missing,
    invalidReferences: invalidReferences.sort(),
    orphanCount: orphans.length,
    orphanBytes,
    orphans: orphans.map((file) => `/${toPosix(path.relative(PUBLIC_ROOT, file))}`),
    deletedCount: deleteOrphans ? orphans.length : 0,
    deletedBytes: deleteOrphans ? orphanBytes : 0,
  };

  console.log(JSON.stringify(report, null, 2));

  const violations = [
    ...invalidReferences,
    ...missing.map((item) => `missing reference: ${item}`),
    ...(check && !deleteOrphans && orphans.length ? [`orphan images: ${orphans.length}`] : []),
    ...(remainingTotalBytes > MAX_TOTAL_IMAGE_BYTES ? [`total bytes ${remainingTotalBytes} exceed ${MAX_TOTAL_IMAGE_BYTES}`] : []),
    ...(largest.bytes > MAX_SINGLE_IMAGE_BYTES ? [`largest image ${largest.bytes} exceeds ${MAX_SINGLE_IMAGE_BYTES}`] : []),
  ];
  if (violations.length) {
    console.error(`Generated image audit failed:\n${violations.join('\n')}`);
    process.exitCode = 1;
  }
}

await main();
