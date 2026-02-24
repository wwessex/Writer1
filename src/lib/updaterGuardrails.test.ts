import { beforeEach, describe, expect, it } from 'vitest';
import { compareSemver, markUpdateFailure, shouldAcceptVersion, shouldUseLaunchFallback, setPinnedVersion, clearUpdateFailures } from '@/lib/updaterGuardrails';

describe('updaterGuardrails', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('compares semantic versions', () => {
    expect(compareSemver('2.1.0', '2.0.9')).toBeGreaterThan(0);
    expect(compareSemver('2.0.0', '2.0.0')).toBe(0);
    expect(compareSemver('1.9.9', '2.0.0')).toBeLessThan(0);
  });

  it('enforces pinned version floor', () => {
    setPinnedVersion('2.0.5');
    expect(shouldAcceptVersion('2.0.4')).toBe(false);
    expect(shouldAcceptVersion('2.0.5')).toBe(true);
  });

  it('enters fallback after repeated failures', () => {
    clearUpdateFailures();
    markUpdateFailure();
    markUpdateFailure();
    markUpdateFailure();
    expect(shouldUseLaunchFallback()).toBe(true);
  });
});
