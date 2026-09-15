const { Cache } = require('../src/utils/cache');

// Round 76c — F169b: msetnx guard hardening + expired-key (EXISTS parity) semantics.
// Found via R76c audit: pair-array input slipped past the typeof-object guard and
// was silently interpreted as {0: [...]} — writing junk key '0'. Family convention
// (hmset F284): object-input methods reject arrays with TypeError.
describe('Round 76c: Cache.msetnx guards + expired-key parity (F169b)', () => {
  let cache;

  beforeEach(() => {
    cache = new Cache({ maxSize: 100, defaultTTL: 0 });
  });

  afterEach(() => {
    cache.destroy();
  });

  test('RED→fix: array input → TypeError, nothing written (was: silent {0: [...]} junk)', () => {
    expect(() => cache.msetnx([['a', 1], ['b', 2]])).toThrow(TypeError);
    expect(cache.has('a')).toBe(false);
    expect(cache.has('b')).toBe(false);
    expect(cache.has('0')).toBe(false); // the old silent-junk key
  });

  test('null input → TypeError (pin existing guard)', () => {
    expect(() => cache.msetnx(null)).toThrow(TypeError);
  });

  test('string / number input → TypeError (pin existing guard)', () => {
    expect(() => cache.msetnx('a:1')).toThrow(TypeError);
    expect(() => cache.msetnx(42)).toThrow(TypeError);
  });

  test('expired key treated as missing (Redis EXISTS parity) → set succeeds', () => {
    cache.set('x', 'old', 30);
    // eslint-disable-next-line no-empty
    const waitUntil = (ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) {} };
    waitUntil(40);
    expect(cache.has('x')).toBe(false); // expired = missing
    expect(cache.msetnx({ x: 'new' })).toBe(true);
    expect(cache.get('x')).toBe('new');
  });

  test('atomicity holds when a key is expired among live existing keys → nothing written', () => {
    cache.set('live', 'v', 0);
    cache.set('dying', 'v', 30);
    const waitUntil = (ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) {} };
    waitUntil(40);
    // 'live' exists → NX fails even though 'dying' expired away
    expect(cache.msetnx({ live: 'x2', dying: 'x2', fresh: 'x2' })).toBe(false);
    expect(cache.get('live')).toBe('v');
    expect(cache.has('fresh')).toBe(false);
  });
});
