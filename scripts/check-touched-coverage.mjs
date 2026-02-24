import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const threshold = Number(process.env.COVERAGE_MIN ?? '50');
const baseRef = process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : 'origin/main';

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

function resolveDiffRange() {
  if (process.env.COVERAGE_DIFF_RANGE) {
    return process.env.COVERAGE_DIFF_RANGE;
  }

  try {
    const mergeBase = sh(`git merge-base HEAD ${baseRef}`);
    return `${mergeBase}...HEAD`;
  } catch {
    return 'HEAD~1...HEAD';
  }
}

const summary = JSON.parse(readFileSync('coverage/coverage-summary.json', 'utf8'));
const diffRange = resolveDiffRange();
const changed = sh(`git diff --name-only ${diffRange}`).split('\n').filter(Boolean);

function isCoveredSourceFile(file) {
  return (
    file.startsWith('src/') &&
    /\.(ts|tsx)$/.test(file) &&
    !file.endsWith('.d.ts') &&
    !file.includes('/test/') &&
    !file.endsWith('.test.ts') &&
    !file.endsWith('.test.tsx')
  );
}

const touchedSources = changed.filter(isCoveredSourceFile);

const missing = [];
const low = [];

for (const file of touchedSources) {
  const key = Object.keys(summary).find((candidate) => candidate.endsWith(file));
  if (!key) {
    missing.push(file);
    continue;
  }

  const pct = summary[key].lines.pct;
  if (pct < threshold) {
    low.push({ file, pct });
  }
}

if (missing.length || low.length) {
  if (missing.length) {
    console.error('Missing coverage entries for touched files:');
    for (const file of missing) console.error(`- ${file}`);
  }
  if (low.length) {
    console.error(`Touched files below ${threshold}% line coverage:`);
    for (const item of low) console.error(`- ${item.file}: ${item.pct}%`);
  }
  process.exit(1);
}

console.log(`Touched-module coverage check passed (${touchedSources.length} source files, min ${threshold}%).`);
