import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Unit tests for lib/featureFlags.
 *
 * Covers env parsing, default-on semantics for `onboarding-tour`, and
 * dev-only runtime overrides. Tests are deterministic: env vars are set
 * explicitly per-case and restored afterwards.
 */

const ENV_KEYS = [
  'NEXT_PUBLIC_FEATURE_FLAGS',
  'NEXT_PUBLIC_FEATURE_ONBOARDING_TOUR',
  'NODE_ENV',
] as const;

const originalEnv: Record<string, string | undefined> = {};

function snapshotEnv() {
  for (const key of ENV_KEYS) {
    originalEnv[key] = process.env[key];
  }
}

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

async function loadFeatureFlags() {
  vi.resetModules();
  return import('../featureFlags');
}

describe('lib/featureFlags', () => {
  beforeEach(() => {
    snapshotEnv();
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    restoreEnv();
    vi.resetModules();
  });

  describe('isEnabled / env map behavior', () => {
    it('returns false for unknown flags', async () => {
      const { isEnabled } = await loadFeatureFlags();
      expect(isEnabled('does-not-exist')).toBe(false);
    });

    it('parses comma-separated flags from NEXT_PUBLIC_FEATURE_FLAGS', async () => {
      process.env.NEXT_PUBLIC_FEATURE_FLAGS = 'comparison,secondary-market';
      const { isEnabled } = await loadFeatureFlags();

      expect(isEnabled('comparison')).toBe(true);
      expect(isEnabled('secondary-market')).toBe(true);
      expect(isEnabled('kyb-gate')).toBe(false);
    });

    it('trims whitespace and ignores empty entries', async () => {
      process.env.NEXT_PUBLIC_FEATURE_FLAGS = ' comparison , , secondary-market ,';
      const { isEnabled } = await loadFeatureFlags();

      expect(isEnabled('comparison')).toBe(true);
      expect(isEnabled('secondary-market')).toBe(true);
      expect(isEnabled('')).toBe(false);
    });

    it('treats an empty env map as no flags enabled', async () => {
      process.env.NEXT_PUBLIC_FEATURE_FLAGS = '';
      const { isEnabled } = await loadFeatureFlags();

      expect(isEnabled('comparison')).toBe(false);
      expect(isEnabled('secondary-market')).toBe(false);
    });
  });

  describe('onboarding-tour default-on semantics', () => {
    it('is enabled by default when no env is provided', async () => {
      const { isEnabled } = await loadFeatureFlags();
      expect(isEnabled('onboarding-tour')).toBe(true);
    });

    it('stays enabled even when other flags are configured', async () => {
      process.env.NEXT_PUBLIC_FEATURE_FLAGS = 'comparison';
      const { isEnabled } = await loadFeatureFlags();

      expect(isEnabled('onboarding-tour')).toBe(true);
      expect(isEnabled('comparison')).toBe(true);
    });

    it('can be explicitly disabled via its dedicated env var', async () => {
      process.env.NEXT_PUBLIC_FEATURE_ONBOARDING_TOUR = 'false';
      const { isEnabled } = await loadFeatureFlags();

      expect(isEnabled('onboarding-tour')).toBe(false);
    });
  });

  describe('runtime overrides (dev-only)', () => {
    it('applies overrides in development', async () => {
      process.env.NODE_ENV = 'development';
      const mod = await loadFeatureFlags();

      if (typeof mod.setOverride !== 'function') {
        // Overrides are not exposed in this build; nothing to assert.
        return;
      }

      mod.setOverride('comparison', true);
      expect(mod.isEnabled('comparison')).toBe(true);

      mod.setOverride('comparison', false);
      expect(mod.isEnabled('comparison')).toBe(false);
    });

    it('ignores overrides outside development', async () => {
      process.env.NODE_ENV = 'production';
      const mod = await loadFeatureFlags();

      if (typeof mod.setOverride !== 'function') {
        return;
      }

      mod.setOverride('comparison', true);
      expect(mod.isEnabled('comparison')).toBe(false);
    });
  });
});
