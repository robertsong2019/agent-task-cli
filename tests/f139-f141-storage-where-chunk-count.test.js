const { Storage } = require('../src/utils/storage');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

let tmpDir, storage;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'storage-test-'));
  storage = new Storage(tmpDir);
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
});

describe('F139: Storage.where(predicate)', () => {
  beforeEach(async () => {
    await storage.saveTask('t1', { status: 'pending', priority: 5 });
    await storage.saveTask('t2', { status: 'done', priority: 3 });
    await storage.saveTask('t3', { status: 'pending', priority: 8 });
    await storage.saveTask('t4', { status: 'done', priority: 1 });
  });

  test('filters by predicate', async () => {
    const pending = await storage.where(t => t.status === 'pending');
    expect(pending).toHaveLength(2);
    expect(pending.map(t => t.id).sort()).toEqual(['t1', 't3']);
  });

  test('filters by numeric comparison', async () => {
    const highPriority = await storage.where(t => t.priority >= 5);
    expect(highPriority).toHaveLength(2);
  });

  test('returns empty for no matches', async () => {
    const none = await storage.where(t => t.status === 'cancelled');
    expect(none).toEqual([]);
  });

  test('returns all when predicate always true', async () => {
    const all = await storage.where(() => true);
    expect(all).toHaveLength(4);
  });

  test('task objects include id field', async () => {
    const results = await storage.where(t => t.status === 'done');
    expect(results[0]).toHaveProperty('id');
    expect(results[1]).toHaveProperty('id');
  });
});

describe('F140: Storage.chunk(size)', () => {
  beforeEach(async () => {
    for (let i = 1; i <= 10; i++) {
      await storage.saveTask(`t${i}`, { index: i });
    }
  });

  test('splits into even chunks', async () => {
    const chunks = await storage.chunk(3);
    expect(chunks).toHaveLength(4); // 3 + 3 + 3 + 1
    expect(chunks[0]).toHaveLength(3);
    expect(chunks[3]).toHaveLength(1);
  });

  test('size=1 gives single-element chunks', async () => {
    const chunks = await storage.chunk(1);
    expect(chunks).toHaveLength(10);
    expect(chunks[0]).toHaveLength(1);
  });

  test('size larger than total gives one chunk', async () => {
    const chunks = await storage.chunk(100);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toHaveLength(10);
  });

  test('throws for size < 1', async () => {
    await expect(storage.chunk(0)).rejects.toThrow('chunk size must be >= 1');
  });

  test('empty storage gives empty array', async () => {
    const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'empty-chunk-'));
    const empty = new Storage(emptyDir);
    const chunks = await empty.chunk(5);
    expect(chunks).toEqual([]);
    await fs.rm(emptyDir, { recursive: true, force: true }).catch(() => {});
  });
});

describe('F141: Storage.count()', () => {
  test('empty storage returns 0', async () => {
    const empty = new Storage(tmpDir);
    expect(await empty.count()).toBe(0);
  });

  test('counts after adding tasks', async () => {
    await storage.saveTask('a', { x: 1 });
    await storage.saveTask('b', { x: 2 });
    await storage.saveTask('c', { x: 3 });
    expect(await storage.count()).toBe(3);
  });

  test('count decreases after deletion', async () => {
    await storage.saveTask('a', { x: 1 });
    await storage.saveTask('b', { x: 2 });
    await storage.deleteTask('a');
    expect(await storage.count()).toBe(1);
  });

  test('count matches listTasks length', async () => {
    await storage.saveTask('a', {});
    await storage.saveTask('b', {});
    await storage.saveTask('c', {});
    const listed = await storage.listTasks();
    expect(await storage.count()).toBe(listed.length);
  });
});
