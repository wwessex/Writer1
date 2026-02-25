/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it } from 'vitest';

import { secureCacheDecode, secureCacheEncode } from './secureCache';

describe('secureCache', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trips small strings', async () => {
    const value = 'small payload with unicode ✓ and emoji 🚀';

    const encoded = await secureCacheEncode(value);
    const decoded = await secureCacheDecode(encoded);

    expect(encoded).not.toBe(value);
    expect(decoded).toBe(value);
  });

  it('round-trips large strings without throwing', async () => {
    const value = 'large-cache-payload-'.repeat(25_000);

    const encoded = await secureCacheEncode(value);

    expect(encoded).toBeTypeOf('string');
    await expect(secureCacheDecode(encoded)).resolves.toBe(value);
  });
});
