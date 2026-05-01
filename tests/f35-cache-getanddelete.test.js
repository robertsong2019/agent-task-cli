const { Cache } = require('../src/utils/cache');

test('getAndDelete returns value and removes key', () => {
  const cache = new Cache({ maxSize: 10, defaultTTL: 0 });
  cache.set('key1', 'val1', 0);

  const val = cache.getAndDelete('key1');
  expect(val).toBe('val1');
  expect(cache.has('key1')).toBe(false);
});

test('getAndDelete returns undefined for missing key', () => {
  const cache = new Cache({ maxSize: 10, defaultTTL: 0 });
  expect(cache.getAndDelete('nope')).toBeUndefined();
});

test('getAndDelete decrements size', () => {
  const cache = new Cache({ maxSize: 10, defaultTTL: 0 });
  cache.set('a', 1, 0);
  cache.set('b', 2, 0);
  expect(cache.size()).toBe(2);

  cache.getAndDelete('a');
  expect(cache.size()).toBe(1);
});

test('getAndDelete on expired key returns undefined', () => {
  const cache = new Cache({ maxSize: 10, defaultTTL: 0 });
  cache.set('exp', 'old', 1); // 1ms TTL
  return new Promise(r => setTimeout(r, 10)).then(() => {
    expect(cache.getAndDelete('exp')).toBeUndefined();
  });
});
