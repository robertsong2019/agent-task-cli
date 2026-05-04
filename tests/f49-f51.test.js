/**
 * F49: Storage.findByMetadata(key, value)
 * F50: StreamManager.getStreamStats(taskId)
 * F51: Cache.setWithExpiry(key, value, expiresAt)
 */

const { Storage } = require('../src/utils/storage');
const { StreamManager } = require('../src/utils/stream-manager');
const { Cache } = require('../src/utils/cache');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// ============================================================
// F49: Storage.findByMetadata
// ============================================================
describe('F49: Storage.findByMetadata', () => {
  let tmpDir, storage;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'storage-f49-'));
    storage = new Storage(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  test('finds tasks matching metadata field', async () => {
    await storage.saveTask('t1', { name: 'a', priority: 'high' });
    await storage.saveTask('t2', { name: 'b', priority: 'low' });
    await storage.saveTask('t3', { name: 'c', priority: 'high' });

    const high = await storage.findByMetadata('priority', 'high');
    expect(high).toHaveLength(2);
    expect(high.map(t => t.name).sort()).toEqual(['a', 'c']);
  });

  test('returns empty array when no match', async () => {
    await storage.saveTask('t1', { name: 'a', status: 'done' });
    const results = await storage.findByMetadata('status', 'pending');
    expect(results).toEqual([]);
  });

  test('returns empty array on empty storage', async () => {
    const results = await storage.findByMetadata('any', 'value');
    expect(results).toEqual([]);
  });
});

// ============================================================
// F50: StreamManager.getStreamStats
// ============================================================
describe('F50: StreamManager.getStreamStats', () => {
  let sm;

  beforeEach(() => {
    sm = new StreamManager();
  });

  test('returns null for nonexistent stream', () => {
    expect(sm.getStreamStats('nope')).toBeNull();
  });

  test('returns stats for active stream', () => {
    sm.createStream('s1');
    sm.append('s1', 'hello ');
    sm.append('s1', 'world');

    const stats = sm.getStreamStats('s1');
    expect(stats.chunkCount).toBe(2);
    expect(stats.bufferLength).toBe(11);
    expect(stats.completed).toBe(false);
    expect(stats.error).toBeNull();
    expect(stats.taskId).toBe('s1');
    expect(Number(stats.throughput)).toBeGreaterThanOrEqual(0);
    expect(stats.duration).toBeGreaterThanOrEqual(0);
  });

  test('returns completed stats after completion', () => {
    sm.createStream('s1');
    sm.append('s1', 'data');
    sm.complete('s1');

    const stats = sm.getStreamStats('s1');
    expect(stats.completed).toBe(true);
    expect(stats.chunkCount).toBe(1);
  });

  test('returns error in stats', () => {
    sm.createStream('s1');
    sm.error('s1', new Error('boom'));

    const stats = sm.getStreamStats('s1');
    expect(stats.error).toBe('boom');
    expect(stats.completed).toBe(true);
  });
});

// ============================================================
// F51: Cache.setWithExpiry
// ============================================================
describe('F51: Cache.setWithExpiry', () => {
  let cache;

  beforeEach(() => {
    cache = new Cache({ maxSize: 10 });
  });

  afterEach(() => {
    clearInterval(cache.cleanupInterval);
  });

  test('sets value with absolute expiry timestamp', () => {
    const expiresAt = Date.now() + 100000;
    cache.setWithExpiry('k1', 'v1', expiresAt);

    const entry = cache.cache.get('k1');
    expect(entry.value).toBe('v1');
    expect(entry.expiresAt).toBe(expiresAt);
  });

  test('value is retrievable before expiry', () => {
    const expiresAt = Date.now() + 100000;
    cache.setWithExpiry('k1', 'v1', expiresAt);
    expect(cache.get('k1')).toBe('v1');
  });

  test('value expires after absolute time', () => {
    // Set expiry in the past
    cache.setWithExpiry('k1', 'v1', Date.now() - 1);
    expect(cache.get('k1')).toBeUndefined();
  });

  test('null expiresAt means no expiry', () => {
    cache.setWithExpiry('k1', 'v1', null);
    expect(cache.get('k1')).toBe('v1');
    const entry = cache.cache.get('k1');
    expect(entry.expiresAt).toBeNull();
  });

  test('evicts LRU when at capacity', () => {
    for (let i = 0; i < 10; i++) {
      cache.set(`key${i}`, i);
    }
    cache.setWithExpiry('new', 'val', Date.now() + 100000);
    expect(cache.cache.has('new')).toBe(true);
    expect(cache.cache.size).toBe(10);
  });
});
