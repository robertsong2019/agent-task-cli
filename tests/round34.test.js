/**
 * Round 34 tests: F133 Storage.sort + F134 PriorityQueue.isEmpty/remove + F135 ConcurrencyManager.isIdle
 */
const { Storage } = require('../src/utils/storage');
const { PriorityQueue } = require('../src/utils/priority-queue');
const { ConcurrencyManager } = require('../src/utils/concurrency-manager');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ── F133: Storage.sort ──
describe('F133: Storage.sort', () => {
  let storage;
  let tmpDir;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'store-sort-'));
    storage = new Storage(tmpDir);
    await storage.saveTask('c', { name: 'charlie', priority: 3, createdAt: 300 });
    await storage.saveTask('a', { name: 'alice', priority: 1, createdAt: 100 });
    await storage.saveTask('b', { name: 'bob', priority: 2, createdAt: 200 });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('sort ascending by numeric field', async () => {
    const sorted = await storage.sort('priority');
    expect(sorted.map(t => t.name)).toEqual(['alice', 'bob', 'charlie']);
  });

  test('sort descending by numeric field', async () => {
    const sorted = await storage.sort('priority', 'desc');
    expect(sorted.map(t => t.name)).toEqual(['charlie', 'bob', 'alice']);
  });

  test('sort by string field', async () => {
    const sorted = await storage.sort('name');
    expect(sorted.map(t => t.name)).toEqual(['alice', 'bob', 'charlie']);
  });

  test('sort by string field descending', async () => {
    const sorted = await storage.sort('name', 'desc');
    expect(sorted.map(t => t.name)).toEqual(['charlie', 'bob', 'alice']);
  });

  test('undefined fields sort to end', async () => {
    await storage.saveTask('d', { name: 'dave' }); // no priority
    const sorted = await storage.sort('priority');
    const names = sorted.map(t => t.name);
    expect(names[names.length - 1]).toBe('dave');
  });

  test('default order is ascending', async () => {
    const sorted = await storage.sort('createdAt');
    expect(sorted.map(t => t.name)).toEqual(['alice', 'bob', 'charlie']);
  });
});

// ── F134: PriorityQueue.isEmpty + remove ──
describe('F134: PriorityQueue.isEmpty + remove', () => {
  test('isEmpty returns true for new queue', () => {
    const pq = new PriorityQueue();
    expect(pq.isEmpty()).toBe(true);
  });

  test('isEmpty returns false after enqueue', () => {
    const pq = new PriorityQueue();
    pq.enqueue('task1');
    expect(pq.isEmpty()).toBe(false);
  });

  test('isEmpty returns true after dequeue all', () => {
    const pq = new PriorityQueue();
    pq.enqueue('task1');
    pq.dequeue();
    expect(pq.isEmpty()).toBe(true);
  });

  test('remove by reference', () => {
    const pq = new PriorityQueue();
    const item = { id: 42 };
    pq.enqueue(item);
    const removed = pq.remove(item);
    expect(removed).toBe(item);
    expect(pq.size).toBe(0);
  });

  test('remove with comparator', () => {
    const pq = new PriorityQueue();
    pq.enqueue({ id: 1 });
    pq.enqueue({ id: 2 });
    pq.enqueue({ id: 3 });
    const removed = pq.remove(null, (item) => item.id === 2);
    expect(removed).toEqual({ id: 2 });
    expect(pq.size).toBe(2);
  });

  test('remove returns undefined when not found', () => {
    const pq = new PriorityQueue();
    pq.enqueue('x');
    expect(pq.remove('y')).toBeUndefined();
  });

  test('remove from empty queue returns undefined', () => {
    const pq = new PriorityQueue();
    expect(pq.remove('x')).toBeUndefined();
  });

  test('isEmpty after clear', () => {
    const pq = new PriorityQueue();
    pq.enqueue(1);
    pq.enqueue(2);
    pq.clear();
    expect(pq.isEmpty()).toBe(true);
  });
});

// ── F135: ConcurrencyManager.isIdle ──
describe('F135: ConcurrencyManager.isIdle', () => {
  test('isIdle true on new manager', () => {
    const cm = new ConcurrencyManager({ maxConcurrent: 2 });
    expect(cm.isIdle()).toBe(true);
  });

  test('isIdle false when task is running', async () => {
    const cm = new ConcurrencyManager({ maxConcurrent: 2 });
    let resolveTask;
    const task = new Promise(r => { resolveTask = r; });
    const promise = cm.execute(async () => task);
    // Let the task start
    await new Promise(r => setTimeout(r, 10));
    expect(cm.isIdle()).toBe(false);
    resolveTask(42);
    await promise;
  });

  test('isIdle true after all tasks complete', async () => {
    const cm = new ConcurrencyManager({ maxConcurrent: 2 });
    await cm.execute(async () => 'done');
    expect(cm.isIdle()).toBe(true);
  });

  test('isIdle false when tasks are queued', async () => {
    const cm = new ConcurrencyManager({ maxConcurrent: 1 });
    let resolveFirst;
    const slowTask = new Promise(r => { resolveFirst = r; });
    const p1 = cm.execute(async () => slowTask);
    const p2 = cm.execute(async () => 'quick');
    await new Promise(r => setTimeout(r, 10));
    expect(cm.isIdle()).toBe(false);
    expect(cm.queueSize).toBe(1);
    resolveFirst(1);
    await Promise.all([p1, p2]);
    expect(cm.isIdle()).toBe(true);
  });

  test('isIdle true after drain', async () => {
    const cm = new ConcurrencyManager({ maxConcurrent: 2 });
    cm.execute(async () => {
      await new Promise(r => setTimeout(r, 50));
    });
    await cm.drain();
    expect(cm.isIdle()).toBe(true);
  });
});
