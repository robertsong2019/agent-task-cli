const { Cache } = require('../src/utils/cache');

// Round 75 — F272/F273, Redis string/TTL-family parity continuation of
// F265 (expire modes) / F267 (append/strlen/getrange) / F269-F271 lineage.
describe('Round 75: F272 Cache.setrange / F273 Cache.touch', () => {
  describe('F272: Cache setrange(key, offset, value) — Redis SETRANGE parity', () => {
    let cache;

    beforeEach(() => {
      cache = new Cache({ maxSize: 100, defaultTTL: 0 });
    });

    afterEach(() => {
      cache.destroy();
    });

    test('missing key, offset 0 → stores value, returns its length', () => {
      expect(cache.setrange('k', 0, 'hello')).toBe(5);
      expect(cache.get('k')).toBe('hello');
    });

    test('missing key, offset > 0 → zero-pads the gap with \\0 (Redis parity)', () => {
      const len = cache.setrange('k', 3, 'ab');
      expect(len).toBe(5);
      expect(cache.get('k')).toBe('\0\0\0ab');
      expect(cache.strlen('k')).toBe(5);
    });

    test('existing string overwritten in place; prefix and suffix preserved', () => {
      cache.set('k', 'Hello World');
      expect(cache.setrange('k', 6, 'Redis')).toBe(11);
      expect(cache.get('k')).toBe('Hello Redis');
    });

    test('offset beyond current length → gap zero-padded, old tail kept', () => {
      cache.set('k', 'abc');
      expect(cache.setrange('k', 5, 'XY')).toBe(7);
      // positions 0-2 = "abc", 3-4 = \0 gap, 5-6 = "XY"
      expect(cache.get('k')).toBe('abc\0\0XY');
    });

    test('round-trips with F267 getrange (setrange writes what getrange reads)', () => {
      cache.set('k', 'abcdefghijklmnop');
      cache.setrange('k', 4, 'XYZ');
      expect(cache.getrange('k', 3, 7)).toBe('dXYZh'); // idx3-7: d,X,Y,Z,h
    });

    test('empty value on missing key → returns 0, does NOT create the key (Redis parity)', () => {
      expect(cache.setrange('ghost', 0, '')).toBe(0);
      expect(cache.has('ghost')).toBe(false);
    });

    test('empty value on existing key → returns current length, value unchanged', () => {
      cache.set('k', 'stay');
      expect(cache.setrange('k', 2, '')).toBe(4);
      expect(cache.get('k')).toBe('stay');
    });

    test('existing TTL is preserved (Redis SETRANGE keeps TTL)', () => {
      jest.useFakeTimers();
      try {
        cache.set('k', 'abc', 1000);
        jest.setSystemTime(Date.now() + 999);
        cache.setrange('k', 0, 'X');
        expect(cache.get('k')).toBe('Xbc'); // still alive right before expiry
        jest.setSystemTime(Date.now() + 2);
        expect(cache.get('k')).toBeUndefined(); // original expiry still governs
      } finally {
        jest.useRealTimers();
      }
    });

    test('fresh key (missing/expired) gets current default TTL, like F267 append', () => {
      jest.useFakeTimers();
      try {
        cache = new Cache({ maxSize: 100 }); // default TTL 1h (F271 semantics)
        cache.setrange('fresh', 0, 'v');
        expect(cache.ttl('fresh')).toBeGreaterThan(0);
      } finally {
        jest.useRealTimers();
      }
    });

    test('expired key treated as missing: fresh base, purged before write', () => {
      jest.useFakeTimers();
      try {
        cache.set('k', 'old', 500);
        jest.setSystemTime(Date.now() + 600);
        expect(cache.setrange('k', 2, 'new')).toBe(5);
        expect(cache.get('k')).toBe('\0\0new');
      } finally {
        jest.useRealTimers();
      }
    });

    test('non-string existing value → TypeError (WRONGTYPE family)', () => {
      cache.set('k', { obj: true });
      expect(() => cache.setrange('k', 0, 'x')).toThrow(TypeError);
    });

    test('non-string value argument → TypeError', () => {
      expect(() => cache.setrange('k', 0, 42)).toThrow(TypeError);
      expect(() => cache.setrange('k', 0, null)).toThrow(TypeError);
    });

    test('non-integer offset → TypeError', () => {
      expect(() => cache.setrange('k', 1.5, 'x')).toThrow(TypeError);
      expect(() => cache.setrange('k', '0', 'x')).toThrow(TypeError);
    });

    test('negative offset → RangeError (Redis: offset out of range)', () => {
      expect(() => cache.setrange('k', -1, 'x')).toThrow(RangeError);
    });

    test('offset beyond Redis 512MB string limit (2^29) → RangeError', () => {
      expect(() => cache.setrange('k', 2 ** 29 + 1, 'x')).toThrow(RangeError);
    });
  });

  describe('F273: Cache touchLru(keys) — Redis TOUCH parity (LRU refresh without reading)', () => {
    let cache;

    beforeEach(() => {
      cache = new Cache({ maxSize: 100, defaultTTL: 0 });
    });

    afterEach(() => {
      cache.destroy();
    });

    test('existing keys → returns count, refreshes lastAccessed', () => {
      jest.useFakeTimers();
      try {
        cache.set('a', 1);
        jest.setSystemTime(Date.now() + 100);
        const before = cache.getWithMeta('a').accessedAt;
        jest.setSystemTime(Date.now() + 100);
        expect(cache.touchLru(['a'])).toBe(1);
        expect(cache.getWithMeta('a').accessedAt).toBeGreaterThan(before);
      } finally {
        jest.useRealTimers();
      }
    });

    test('mixed existing/missing → counts only existing', () => {
      cache.set('a', 1);
      cache.set('c', 3);
      expect(cache.touchLru(['a', 'ghost', 'c'])).toBe(2);
    });

    test('expired key → purged and NOT counted', () => {
      jest.useFakeTimers();
      try {
        cache.set('a', 1, 500);
        jest.setSystemTime(Date.now() + 600);
        expect(cache.touchLru(['a'])).toBe(0);
        expect(cache.has('a')).toBe(false); // purged, like get()
      } finally {
        jest.useRealTimers();
      }
    });

    test('touch changes LRU eviction victim (behavioral proof)', () => {
      cache = new Cache({ maxSize: 2, defaultTTL: 0 });
      cache.set('a', 1); // t0
      cache.set('b', 2); // t0, newer by insertion order tie-break is same ms — use wait
      // advance so b is strictly more recent than a
      jest.useFakeTimers();
      try {
        // restart cleanly under fake timers
        cache.destroy();
        cache = new Cache({ maxSize: 2, defaultTTL: 0 });
        cache.set('a', 1); // lastAccessed = t0
        jest.setSystemTime(Date.now() + 50);
        cache.set('b', 2); // lastAccessed = t0+50
        jest.setSystemTime(Date.now() + 50);
        cache.touchLru(['a']); // a refreshed → a=t0+100 > b=t0+50
        cache.set('c', 3); // at capacity → evicts LRU = b
        expect(cache.has('b')).toBe(false);
        expect(cache.has('a')).toBe(true);
        expect(cache.has('c')).toBe(true);
        expect(cache.getStats().evictions).toBe(1);
      } finally {
        jest.useRealTimers();
      }
    });

    test('touch does not pollute hit/miss stats (metadata op, like peek)', () => {
      cache.set('a', 1);
      const { hits, misses } = cache.getStats();
      cache.touchLru(['a', 'ghost']);
      const after = cache.getStats();
      expect(after.hits).toBe(hits);
      expect(after.misses).toBe(misses);
    });

    test('TTL preserved by touch (does not extend or shorten expiry)', () => {
      jest.useFakeTimers();
      try {
        cache.set('a', 1, 1000);
        jest.setSystemTime(Date.now() + 500);
        cache.touchLru(['a']);
        expect(cache.ttl('a')).toBeGreaterThan(0);
        expect(cache.ttl('a')).toBeLessThanOrEqual(500);
        jest.setSystemTime(Date.now() + 501);
        expect(cache.get('a')).toBeUndefined();
      } finally {
        jest.useRealTimers();
      }
    });

    test('empty array → 0; non-array input → TypeError', () => {
      expect(cache.touchLru([])).toBe(0);
      expect(() => cache.touchLru('a')).toThrow(TypeError);
      expect(() => cache.touchLru(null)).toThrow(TypeError);
    });

    test('touch does not notify watchers (no value change, no set event)', () => {
      cache.set('a', 1);
      const seen = [];
      cache.watch('a', (event) => seen.push(event));
      cache.touchLru(['a']);
      expect(seen).toEqual([]);
    });
  });
});
