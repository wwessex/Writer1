import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ASSET_DIRS = ['public/assets', 'src/assets'];
const IMAGE_EXTENSIONS = new Set(['.png', '.svg', '.ico', '.jpg', '.jpeg', '.webp']);

async function fileExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function collectFiles(assetDir) {
  const absoluteDir = path.join(ROOT, assetDir);
  if (!(await fileExists(absoluteDir))) {
    return [];
  }

  const entries = await fs.readdir(absoluteDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(extension)) {
      continue;
    }

    const relativePath = path.posix.join(assetDir, entry.name);
    files.push(relativePath);
  }

  return files;
}

async function hashFile(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  const buffer = await fs.readFile(absolutePath);
  return createHash('sha256').update(buffer).digest('hex');
}

async function main() {
  const byFileName = new Map();

  for (const assetDir of ASSET_DIRS) {
    const files = await collectFiles(assetDir);

    for (const relativePath of files) {
      const fileName = path.basename(relativePath);
      const hash = await hashFile(relativePath);
      const current = byFileName.get(fileName) || [];

      current.push({ path: relativePath, hash });
      byFileName.set(fileName, current);
    }
  }

  const mismatched = [];
  const identicalDuplicates = [];

  for (const [fileName, entries] of byFileName) {
    if (entries.length < 2) {
      continue;
    }

    const uniqueHashes = new Set(entries.map((entry) => entry.hash));
    if (uniqueHashes.size > 1) {
      mismatched.push({ fileName, entries });
    } else {
      identicalDuplicates.push({ fileName, entries });
    }
  }

  if (mismatched.length > 0) {
    console.error('❌ Duplicate filenames with mismatched content hashes detected:');
    for (const duplicate of mismatched) {
      console.error(`- ${duplicate.fileName}`);
      for (const entry of duplicate.entries) {
        console.error(`  • ${entry.path} (${entry.hash.slice(0, 12)})`);
      }
    }
    process.exit(1);
  }

  if (identicalDuplicates.length > 0) {
    console.warn('⚠️ Duplicate filenames with identical hashes:');
    for (const duplicate of identicalDuplicates) {
      console.warn(`- ${duplicate.fileName}`);
      for (const entry of duplicate.entries) {
        console.warn(`  • ${entry.path}`);
      }
    }
  }

  console.log('✅ No duplicate filenames with mismatched hashes found.');
}

await main();
