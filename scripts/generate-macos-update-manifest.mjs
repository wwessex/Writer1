import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  if (!arg.startsWith('--')) continue;
  const key = arg.slice(2);
  const next = process.argv[index + 1];
  if (next && !next.startsWith('--')) {
    args.set(key, next);
    index += 1;
  } else {
    args.set(key, 'true');
  }
}

const required = ['app', 'dmg', 'checksums', 'output', 'channel'];
for (const key of required) {
  if (!args.get(key)) {
    console.error(`Missing required argument: --${key}`);
    process.exit(2);
  }
}

const appPath = args.get('app');
const dmgPath = args.get('dmg');
const checksumsPath = args.get('checksums');
const checksumSignaturePath = args.get('checksum-signature') ?? '';
const outputPath = args.get('output');
const channel = args.get('channel');
const baseURL = args.get('base-url') ?? '';
const releaseNotes = args.get('release-notes') ?? '';

for (const path of [appPath, dmgPath, checksumsPath]) {
  if (!existsSync(path)) {
    console.error(`Missing file or directory: ${path}`);
    process.exit(1);
  }
}

const infoPlistPath = `${appPath}/Contents/Info.plist`;
if (!existsSync(infoPlistPath)) {
  console.error(`Missing Info.plist: ${infoPlistPath}`);
  process.exit(1);
}

const plistText = readFileSync(infoPlistPath, 'utf8');

const plistValue = (key) => {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = plistText.match(new RegExp(`<key>${escaped}</key>\\s*<string>([^<]*)</string>`));
  return match?.[1] ?? '';
};

const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const normalizedBaseURL = baseURL.replace(/\/+$/, '');
const dmgName = basename(dmgPath);
const checksumsName = basename(checksumsPath);
const checksumSignatureName = checksumSignaturePath && existsSync(checksumSignaturePath)
  ? basename(checksumSignaturePath)
  : null;

const manifest = {
  schemaVersion: 1,
  appName: plistValue('CFBundleDisplayName') || plistValue('CFBundleName') || 'DraftHarbour',
  bundleIdentifier: plistValue('CFBundleIdentifier'),
  platform: 'macos',
  channel,
  version: plistValue('CFBundleShortVersionString'),
  build: plistValue('CFBundleVersion'),
  minimumSystemVersion: plistValue('LSMinimumSystemVersion'),
  generatedAt: new Date().toISOString(),
  releaseNotes,
  artifact: {
    name: dmgName,
    path: dmgPath,
    url: normalizedBaseURL ? `${normalizedBaseURL}/${dmgName}` : null,
    sizeBytes: statSync(dmgPath).size,
    sha256: sha256(dmgPath),
  },
  integrity: {
    checksums: checksumsName,
    checksumsSha256: sha256(checksumsPath),
    checksumSignature: checksumSignatureName,
  },
  notarization: {
    requiredForDistribution: true,
    notarized: args.get('notarized') === '1' || args.get('notarized') === 'true',
    stapled: args.get('stapled') === '1' || args.get('stapled') === 'true',
  },
};

writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${outputPath}`);
