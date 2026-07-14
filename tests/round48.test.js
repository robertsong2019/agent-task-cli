const { PriorityQueue } = require('../src/utils/priority-queue');
const { Cache, generateTaskCacheKey } = require('../src/utils/cache');
const { Storage } = require('../src/utils/storage');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('F192: PriorityQueue.removeAt(index)', () => {
  let pq;
  beforeEach(() => { pq = new PriorityQueue(); });

  test('removes item at valid index', () => {
    pq.enqueue('a', 1).enqueue('b', 2).enqueue('c', 3);
    const removed = pq.removeAt(1);
    expect(removed).toBe('b');
    expect(pq.size).toBe(2);
    expect(pq.toArray()).toEqual(['a', 'c']);
  });

  test('removes first item (index 0)', () => {
    pq.enqueue('x', 1).enqueue('y', 5);
    expect(pq.removeAt(0)).toBe('x');
    expect(pq.peek()).toBe('y');
  });

  test('removes last item', () => {
    pq.enqueue('a', 1).enqueue('b', 2).enqueue('c', 3);
    expect(pq.removeAt(2)).toBe('c');
    expect(pq.size).toBe(2);
  });

  test('returns undefined for out-of-bounds index', () => {
    pq.enqueue('a', 1);
    expect(pq.removeAt(5)).toBeUndefined();
    expect(pq.size).toBe(1);
  });

  test('returns undefined for empty queue', () => {
    expect(pq.removeAt(0)).toBeUndefined();
  });

  test('throws RangeError for negative index', () => {
    expect(() => pq.removeAt(-1)).toThrow(RangeError);
  });

  test('throws RangeError for non-integer', () => {
    expect(() => pq.removeAt(1.5)).toThrow(RangeError);
  });

  test('maintains priority order after removal', () => {
    pq.enqueue('low', 5).enqueue('high', 1).enqueue('mid', 3);
    pq.removeAt(0); // remove 'high'
    expect(pq.dequeue()).toBe('mid');
    expect(pq.dequeue()).toBe('low');
  });
});

describe('F193: Cache.peek(key)', () => {
  let cache;
  beforeEach(() => {
    cache = new Cache({ maxSize: 100, defaultTTL: 60000 });
  });

  test('returns value for existing key', () => {
    cache.set('k1', 'v1');
    expect(cache.peek('k1')).toBe('v1');
  });

  test('returns undefined for missing key', () => {
    expect(cache.peek('nope')).toBeUndefined();
  });

  test('does NOT update hit stats', () => {
    cache.set('k1', 'v1');
    const before = cache.getStats().hits;
    cache.peek('k1');
    cache.peek('k1');
    const after = cache.getStats().hits;
    expect(after).toBe(before);
  });

  test('does NOT update miss stats', () => {
    cache.peek('missing');
    cache.peek('missing');
    expect(cache.getStats().misses).toBe(0);
  });

  test('does NOT update LRU position', () => {
    cache = new Cache({ maxSize: 2, defaultTTL: 0 });
    cache.set('a', 1);
    cache.set('b', 2);
    // Peek 'a' — should NOT make it recently used
    cache.peek('a');
    // Add 'c' — should evict 'a' (least recently used via real get)
    cache.set('c', 3);
    expect(cache.peek('a')).toBeUndefined();
    expect(cache.peek('b')).toBe(2);
    expect(cache.peek('c')).toBe(3);
  });

  test('returns undefined for expired key and deletes it', () => {
    cache.set('exp', 'val', 50);
    return new Promise(resolve => {
      setTimeout(() => {
        expect(cache.peek('exp')).toBeUndefined();
        expect(cache.has('exp')).toBe(false);
        resolve();
      }, 100);
    });
  });

  test('does not affect access time on entry', () => {
    cache.set('k', 'v');
    const entry = cache.cache.get('k');
    const accessBefore = entry.lastAccessed;
    // Small delay to ensure timestamp would differ
    return new Promise(resolve => {
      setTimeout(() => {
        cache.peek('k');
        const entryAfter = cache.cache.get('k');
        expect(entryAfter.lastAccessed).toBe(accessBefore);
        resolve();
      }, 10);
    });
  });
});

describe('F194: Storage.batchCreate(records)', () => {
  let tmpDir, storage;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'storage-test-'));
    storage = new Storage(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('creates all new records', async () => {
    const result = await storage.batchCreate({
      't1': { status: 'pending', name: 'Task 1' },
      't2': { status: 'pending', name: 'Task 2' },
    });
    expect(result.created).toEqual(expect.arrayContaining(['t1', 't2']));
    expect(result.skipped).toEqual([]);
    expect(result.created.length).toBe(2);
  });

  test('skips IDs that already exist', async () => {
    await storage.saveTask('existing', { status: 'done' });
    const result = await storage.batchCreate({
      'existing': { status: 'pending' },
      'new': { status: 'pending' },
    });
    expect(result.created).toEqual(['new']);
    expect(result.skipped).toEqual(['existing']);
  });

  test('does not overwrite existing task data', async () => {
    await storage.saveTask('keep', { status: 'done', important: true });
    await storage.batchCreate({
      'keep': { status: 'pending' },
    });
    const task = await storage.getTask('keep');
    expect(task.status).toBe('done');
    expect(task.important).toBe(true);
  });

  test('empty records object returns empty results', async () => {
    const result = await storage.batchCreate({});
    expect(result.created).toEqual([]);
    expect(result.skipped).toEqual([]);
  });

  test('handles mix of new and existing', async () => {
    await storage.saveTask('old1', { val: 1 });
    const result = await storage.batchCreate({
      'old1': { val: 99 },
      'new1': { val: 2 },
      'new2': { val: 3 },
      'old2': { val: 99 },
    });
    // old2 doesn't exist, only old1 does
    expect(result.created.length).toBe(3);
    expect(result.skipped).toEqual(['old1']);
  });

  test('persists data to disk', async () => {
    await storage.batchCreate({
      'p1': { status: 'active' },
    });
    // Reload storage from same dir
    const storage2 = new Storage(tmpDir);
    const task = await storage2.getTask('p1');
    expect(task).toBeTruthy();
    expect(task.status).toBe('active');
  });
});
