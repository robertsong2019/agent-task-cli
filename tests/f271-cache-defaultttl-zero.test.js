const { Cache } = require('../src/utils/cache');
const { Orchestrator } = require('../src/orchestrator-v2');

// R74 / F271 — falsy-default family: constructor `options.defaultTTL || 3600000`
// swallowed an explicit 0. Per-call ttl=0 already means "no expiry" in set()
// (`expiresAt: ttl ? Date.now() + ttl : null`), so an explicit defaultTTL: 0 must
// mean "entries do not expire by default" — not silently fall back to 1 hour.
describe('F271: Cache defaultTTL honors explicit 0 (falsy-default family)', () => {
  afterEach(() => cache.destroy());
  let cache;

  test('defaultTTL: 0 is stored as 0, not swallowed into 1h', () => {
    cache = new Cache({ defaultTTL: 0 });
    expect(cache.defaultTTL).toBe(0);
  });

  test('set() without explicit ttl on defaultTTL:0 cache never expires', () => {
    cache = new Cache({ defaultTTL: 0 });
    cache.set('k', 'v');
    expect(cache.cache.get('k').expiresAt).toBeNull();
  });

  test('behavioral: value still present after system clock passes +1h (defaultTTL:0)', () => {
    jest.useFakeTimers();
    try {
      const t0 = Date.now();
      cache = new Cache({ defaultTTL: 0 });
      jest.setSystemTime(t0);
      cache.set('k', 'v'); // no explicit ttl → default applies
      jest.setSystemTime(t0 + 3600001); // past the old buggy 1h fallback
      expect(cache.get('k')).toBe('v');
    } finally {
      jest.useRealTimers();
    }
  });

  test('getOrSet() default path on defaultTTL:0 cache stores a no-expiry entry', async () => {
    cache = new Cache({ defaultTTL: 0 });
    await cache.getOrSet('k', () => 'computed');
    expect(cache.cache.get('k').expiresAt).toBeNull();
  });

  test('setNX() default path on defaultTTL:0 cache stores a no-expiry entry', () => {
    cache = new Cache({ defaultTTL: 0 });
    expect(cache.setNX('k', 'v')).toBe(true);
    expect(cache.cache.get('k').expiresAt).toBeNull();
  });

  test('regression: no options keeps 1h default', () => {
    cache = new Cache();
    expect(cache.defaultTTL).toBe(3600000);
  });

  test('regression: positive defaultTTL passes through unchanged', () => {
    cache = new Cache({ defaultTTL: 60000 });
    expect(cache.defaultTTL).toBe(60000);
  });

  test('defaultTTL: null means "use the 1h default" (null is not a TTL)', () => {
    cache = new Cache({ defaultTTL: null });
    expect(cache.defaultTTL).toBe(3600000);
  });

  test('defaultTTL: undefined means "use the 1h default"', () => {
    cache = new Cache({ defaultTTL: undefined });
    expect(cache.defaultTTL).toBe(3600000);
  });

  test('explicit per-call ttl still overrides defaultTTL: 0', () => {
    cache = new Cache({ defaultTTL: 0 });
    cache.set('k', 'v', 5000);
    expect(cache.cache.get('k').expiresAt).toBeGreaterThan(Date.now());
  });
});

describe('F271 sibling: Orchestrator cacheTTL pass-through', () => {
  test('Orchestrator({ cacheTTL: 0 }) does not swallow 0 into Cache 1h default', () => {
    const o = new Orchestrator({ cacheTTL: 0 });
    try {
      expect(o.cache.defaultTTL).toBe(0);
    } finally {
      o.cache.destroy();
    }
  });

  test('Orchestrator default cacheTTL stays 1h', () => {
    const o = new Orchestrator();
    try {
      expect(o.cache.defaultTTL).toBe(3600000);
    } finally {
      o.cache.destroy();
    }
  });
});
