#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const SRC_DIR = path.join(ROOT_DIR, 'src');
const TEST_FILE_PATTERN = /\.test\.tsx?$/;

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const resolved = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(resolved);
      continue;
    }

    if (entry.isFile() && TEST_FILE_PATTERN.test(entry.name)) {
      yield resolved;
    }
  }
}

function countMatches(contents, regex) {
  return (contents.match(regex) ?? []).length;
}

const describePattern = /\bdescribe\s*\(/g;
const itPattern = /\bit\s*\(/g;

const files = [];
for await (const file of walk(SRC_DIR)) {
  files.push(file);
}
files.sort((a, b) => a.localeCompare(b));

const inventory = [];
for (const file of files) {
  const contents = await readFile(file, 'utf8');
  inventory.push({
    file: path.relative(ROOT_DIR, file).split(path.sep).join('/'),
    describeCount: countMatches(contents, describePattern),
    itCount: countMatches(contents, itPattern),
  });
}

const totals = inventory.reduce(
  (acc, item) => {
    acc.suites += 1;
    acc.describe += item.describeCount;
    acc.it += item.itCount;
    return acc;
  },
  { suites: 0, describe: 0, it: 0 },
);

console.log('# Test inventory (src/**/*.test.ts[x])');
console.log('');
console.log('| Test file | `describe` blocks | `it` cases |');
console.log('|---|---:|---:|');
for (const item of inventory) {
  console.log(`| \`${item.file}\` | ${item.describeCount} | ${item.itCount} |`);
}
console.log('');
console.log(`Suites: ${totals.suites}`);
console.log(`Describe blocks: ${totals.describe}`);
console.log(`It cases: ${totals.it}`);
