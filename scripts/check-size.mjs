#!/usr/bin/env node
// Size budget for the built app. Prints what takes the space and warns when a
// budget is exceeded, so growth is noticed at build time rather than by feel.
//
//   node scripts/check-size.mjs                 # checks dist/
//   node scripts/check-size.mjs path/to/X.app   # also checks the .app bundle
//   node scripts/check-size.mjs --strict ...    # exit 1 when over budget
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

const MB = 1024 * 1024;
const KB = 1024;
const BUDGET = {
  appBundle: 200 * MB, // 0.14: ~110 MB of recorded neural speech for every word and sentence
  images: 70 * MB, // 0.14.3: generated pictures replace the random Flickr photos (~2200 pictures)
  javascript: 1.6 * MB,
  largestChunk: 420 * KB,
  css: 220 * KB,
};

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const appPath = args.find((arg) => !arg.startsWith('--'));

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(path));
    else files.push({ path, size: statSync(path).size });
  }
  return files;
}

const sum = (files) => files.reduce((total, file) => total + file.size, 0);
const format = (bytes) => (bytes >= MB ? `${(bytes / MB).toFixed(1)} MB` : `${Math.round(bytes / KB)} KB`);
const problems = [];

function check(label, value, budget) {
  const over = value > budget;
  if (over) problems.push(label);
  console.log(`${over ? '✗' : '✓'} ${label.padEnd(22)} ${format(value).padStart(9)}   (бюджет ${format(budget)})`);
}

if (!existsSync('dist')) {
  console.error('dist/ не найден: сначала npm run build');
  process.exit(1);
}

const dist = walk('dist');
const js = dist.filter((file) => extname(file.path) === '.js');
const css = dist.filter((file) => extname(file.path) === '.css');
const images = dist.filter((file) => file.path.includes('generated-word-images'));
const largest = [...js].sort((a, b) => b.size - a.size)[0];

console.log(`dist/: ${format(sum(dist))}, файлов ${dist.length}`);
check('картинки слов', sum(images), BUDGET.images);
check('JavaScript всего', sum(js), BUDGET.javascript);
if (largest) check(`крупнейший чанк`, largest.size, BUDGET.largestChunk);
check('CSS', sum(css), BUDGET.css);
if (largest) console.log(`  крупнейший: ${relative('dist', largest.path)}`);

if (appPath) {
  if (existsSync(appPath)) check('приложение .app', sum(walk(appPath)), BUDGET.appBundle);
  else console.log(`! ${appPath} не найден`);
}

if (problems.length) {
  console.log(`\nПревышен бюджет: ${problems.join(', ')}`);
  if (strict) process.exit(1);
}
