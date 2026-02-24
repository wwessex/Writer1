import { createHash, createVerify } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';

const [artifactPath, checksumPath, signaturePath, publicKeyPath] = process.argv.slice(2);

if (!artifactPath || !checksumPath || !signaturePath || !publicKeyPath) {
  console.error('Usage: node scripts/verify-release-artifacts.mjs <artifact> <checksums.txt> <signature> <pubkey.pem>');
  process.exit(1);
}

for (const requiredPath of [artifactPath, checksumPath, signaturePath, publicKeyPath]) {
  if (!existsSync(requiredPath)) {
    console.error(`Missing file: ${requiredPath}`);
    process.exit(1);
  }
}

const artifact = readFileSync(artifactPath);
const checksums = readFileSync(checksumPath, 'utf8');
const expected = checksums.split('\n').find((line) => line.includes(artifactPath.split('/').pop()));

if (!expected) {
  console.error('Artifact checksum line not found');
  process.exit(1);
}

const [expectedHash] = expected.trim().split(/\s+/);
const actualHash = createHash('sha256').update(artifact).digest('hex');

if (expectedHash !== actualHash) {
  console.error(`Checksum mismatch: expected ${expectedHash}, got ${actualHash}`);
  process.exit(1);
}

const verifier = createVerify('RSA-SHA256');
verifier.update(readFileSync(checksumPath));
verifier.end();
const signature = readFileSync(signaturePath);
const publicKey = readFileSync(publicKeyPath, 'utf8');

if (!verifier.verify(publicKey, signature)) {
  console.error('Signature verification failed');
  process.exit(1);
}

console.log('Artifact checksum + signature verification passed');
