const { Cache } = require('../src/utils/cache');

describe('F20: Cache.withNamespace()', () => {
  let cache;
  beforeEach(() => {
    cache = new Cache({ maxSize: 50, defaultTTL: 60000 });
  });
  afterEach(() => cache.destroy());

  test('get/set with auto-prefix', () => {
    const ns = cache.withNamespace('user');
    ns.set('alice', { age: 30 });
    expect(ns.get('alice')).toEqual({ age: 30 });
    // Underlying key is prefixed
    expect(cache.get('user:alice')).toEqual({ age: 30 });
  });

  test('has checks prefixed key', () => {
    const ns = cache.withNamespace('session');
    ns.set('abc', 'token');
    expect(ns.has('abc')).toBe(true);
    expect(ns.has('xyz')).toBe(false);
  });

  test('delete removes prefixed entry', () => {
    const ns = cache.withNamespace('app');
    ns.set('k1', 'v1');
    expect(ns.delete('k1')).toBe(true);
    expect(ns.get('k1')).toBeUndefined();
  });

  test('clear removes only namespace entries', () => {
    cache.set('other', 'val');
    const ns = cache.withNamespace('ns');
    ns.set('a', 1);
    ns.set('b', 2);
    ns.clear();
    expect(ns.size()).toBe(0);
    expect(cache.get('other')).toBe('val');
  });

  test('keys returns unprefixed names', () => {
    const ns = cache.withNamespace('t');
    ns.set('x', 1);
    ns.set('y', 2);
    cache.set('unrelated', 3);
    expect(ns.keys().sort()).toEqual(['x', 'y']);
  });

  test('size counts only namespace entries', () => {
    cache.set('global', 1);
    const ns = cache.withNamespace('z');
    ns.set('a', 1);
    ns.set('b', 2);
    expect(ns.size()).toBe(2);
  });

  test('multiple namespaces are isolated', () => {
    const users = cache.withNamespace('user');
    const posts = cache.withNamespace('post');
    users.set('alice', 'user-data');
    posts.set('alice', 'post-data');
    expect(users.get('alice')).toBe('user-data');
    expect(posts.get('alice')).toBe('post-data');
  });

  test('TTL works through namespace', async () => {
    const ns = cache.withNamespace('short');
    ns.set('ephemeral', 'gone', 10);
    expect(ns.get('ephemeral')).toBe('gone');
    await new Promise(r => setTimeout(r, 20));
    expect(ns.get('ephemeral')).toBeUndefined();
  });
});
