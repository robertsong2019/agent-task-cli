const { Cache } = require('../src/utils/cache');
const { Storage } = require('../src/utils/storage');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// F58: Cache.forEach
describe('F58: Cache.forEach', () => {
  let cache;
  beforeEach(() => { cache = new Cache({ maxSize: 10, defaultTTL: 60000 }); });
  afterEach(() => cache.destroy());

  test('iterates all non-expired entries', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    const result = {};
    cache.forEach((value, key) => { result[key] = value; });
    expect(result).toEqual({ a: 1, b: 2, c: 3 });
  });

  test('skips expired entries', () => {
    cache.set('a', 1, 1); // 1ms TTL
    cache.set('b', 2);
    return new Promise(resolve => {
      setTimeout(() => {
        const result = {};
        cache.forEach((value, key) => { result[key] = value; });
        expect(result).toEqual({ b: 2 });
        resolve();
      }, 10);
    });
  });

  test('passes cache as third argument', () => {
    cache.set('x', 42);
    let received;
    cache.forEach((val, key, c) => { received = c; });
    expect(received).toBe(cache);
  });
});

// F59: Storage.updateField
describe('F59: Storage.updateField', () => {
  let storage, tmpDir;
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'storage-test-'));
    storage = new Storage(tmpDir);
    await storage.saveTask('t1', { title: 'Test', status: 'pending', priority: 1 });
  });
  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  test('updates a single field', async () => {
    const updated = await storage.updateField('t1', 'status', 'done');
    expect(updated.status).toBe('done');
    expect(updated.title).toBe('Test'); // other fields preserved
  });

  test('returns null for non-existent task', async () => {
    const result = await storage.updateField('nope', 'status', 'done');
    expect(result).toBeNull();
  });

  test('persists to disk', async () => {
    await storage.updateField('t1', 'priority', 5);
    const task = await storage.getTask('t1');
    expect(task.priority).toBe(5);
  });
});

// F60: Cache.getMany
describe('F60: Cache.getMany', () => {
  let cache;
  beforeEach(() => { cache = new Cache({ maxSize: 10, defaultTTL: 60000 }); });
  afterEach(() => cache.destroy());

  test('returns Map of found entries', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    const result = cache.getMany(['a', 'b', 'c']);
    expect(result).toBeInstanceOf(Map);
    expect(result.get('a')).toBe(1);
    expect(result.get('b')).toBe(2);
    expect(result.has('c')).toBe(false);
  });

  test('returns empty Map for no matches', () => {
    const result = cache.getMany(['x', 'y']);
    expect(result.size).toBe(0);
  });

  test('returns empty Map for empty array', () => {
    const result = cache.getMany([]);
    expect(result.size).toBe(0);
  });
});
