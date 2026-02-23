import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const isCi = process.argv.includes('--ci');
const assetsDir = join(process.cwd(), 'dist', 'assets');

const budgets = {
  main: 800 * 1024,
  export: 220 * 1024,
  ai: 220 * 1024,
  integrations: 220 * 1024,
  totalJs: 3000 * 1024,
};

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

const jsFiles = readdirSync(assetsDir)
  .filter((file) => file.endsWith('.js'))
  .map((file) => {
    const fullPath = join(assetsDir, file);
    const source = readFileSync(fullPath);
    return {
      file,
      rawBytes: statSync(fullPath).size,
      gzipBytes: gzipSync(source).length,
    };
  })
  .sort((a, b) => b.rawBytes - a.rawBytes);

const totalJs = jsFiles.reduce((sum, file) => sum + file.rawBytes, 0);
const byPrefix = (prefix) => jsFiles.find(({ file }) => file.startsWith(`${prefix}-`));

const checks = [
  { key: 'main', actual: byPrefix('index')?.rawBytes ?? 0 },
  { key: 'export', actual: byPrefix('export')?.rawBytes ?? 0 },
  { key: 'ai', actual: byPrefix('ai')?.rawBytes ?? 0 },
  { key: 'integrations', actual: byPrefix('integrations')?.rawBytes ?? 0 },
  { key: 'totalJs', actual: totalJs },
];

console.log('Bundle analysis (dist/assets/*.js):');
for (const file of jsFiles) {
  console.log(`- ${file.file}: raw ${formatKb(file.rawBytes)}, gzip ${formatKb(file.gzipBytes)}`);
}

console.log('\nBundle budgets:');
let failed = false;
for (const check of checks) {
  const limit = budgets[check.key];
  const pass = check.actual <= limit;
  if (!pass) failed = true;
  const status = pass ? 'PASS' : 'FAIL';
  console.log(`- [${status}] ${check.key}: ${formatKb(check.actual)} / ${formatKb(limit)}`);
}

if (failed && isCi) {
  console.error('\nBundle budget check failed. Reduce bundle sizes or adjust budgets intentionally.');
  process.exit(1);
}
