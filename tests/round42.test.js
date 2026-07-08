const { PriorityQueue } = require('../src/utils/priority-queue');
const { ConcurrencyManager } = require('../src/utils/concurrency-manager');
const { Storage } = require('../src/utils/storage');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

describe('F172: PriorityQueue.toSortedArray()', () => {
  let pq;
  beforeEach(() => { pq = new PriorityQueue(); });

  test('returns empty array for empty queue', () => {
    expect(pq.toSortedArray()).toEqual([]);
  });

  test('returns items in priority order without draining', () => {
    pq.enqueue('low', 10);
    pq.enqueue('high', 1);
    pq.enqueue('mid', 5);
    expect(pq.toSortedArray()).toEqual(['high', 'mid', 'low']);
  });

  test('does not modify the queue', () => {
    pq.enqueue('a', 1);
    pq.enqueue('b', 3);
    pq.toSortedArray();
    expect(pq.size).toBe(2);
    expect(pq.dequeue()).toBe('a');
    expect(pq.dequeue()).toBe('b');
  });

  test('works with single item', () => {
    pq.enqueue('only', 5);
    expect(pq.toSortedArray()).toEqual(['only']);
  });

  test('preserves insertion order for equal priorities', () => {
    pq.enqueue('first', 5);
    pq.enqueue('second', 5);
    pq.enqueue('third', 5);
    expect(pq.toSortedArray()).toEqual(['first', 'second', 'third']);
  });

  test('returns shallow copy (modifying result does not affect queue)', () => {
    pq.enqueue('a', 1);
    const arr = pq.toSortedArray();
    arr.push('injected');
    expect(pq.size).toBe(1);
    expect(pq.dequeue()).toBe('a');
  });
});

describe('F173: ConcurrencyManager.activeTasks()', () => {
  let cm;
  beforeEach(() => { cm = new ConcurrencyManager({ maxConcurrent: 2 }); });

  test('returns empty array when idle', () => {
    expect(cm.activeTasks()).toEqual([]);
  });

  test('returns task IDs of currently executing tasks', async () => {
    const gate = {};
    gate.promise = new Promise(r => { gate.resolve = r; });

    const promise = cm.execute(async () => {
      await gate.promise;
      return 'done';
    }, 'task-A');

    // Give it a tick to start
    await new Promise(r => setImmediate(r));
    expect(cm.activeTasks()).toEqual(['task-A']);

    gate.resolve();
    await promise;
    expect(cm.activeTasks()).toEqual([]);
  });

  test('tracks multiple concurrent tasks', async () => {
    const gates = [0, 1].map(() => {
      const g = {};
      g.promise = new Promise(r => { g.resolve = r; });
      return g;
    });

    const p1 = cm.execute(async () => { await gates[0].promise; }, 'task-1');
    const p2 = cm.execute(async () => { await gates[1].promise; }, 'task-2');

    await new Promise(r => setImmediate(r));
    const active = cm.activeTasks().sort();
    expect(active).toEqual(['task-1', 'task-2']);

    gates[0].resolve();
    await p1;
    expect(cm.activeTasks()).toEqual(['task-2']);

    gates[1].resolve();
    await p2;
    expect(cm.activeTasks()).toEqual([]);
  });

  test('excludes tasks without IDs', async () => {
    const gate = {};
    gate.promise = new Promise(r => { gate.resolve = r; });

    const promise = cm.execute(async () => { await gate.promise; }, null);

    await new Promise(r => setImmediate(r));
    expect(cm.activeTasks()).toEqual([]);

    gate.resolve();
    await promise;
  });

  test('clears task ID after completion even on error', async () => {
    try {
      await cm.execute(async () => { throw new Error('boom'); }, 'err-task');
    } catch (e) { /* expected */ }
    expect(cm.activeTasks()).toEqual([]);
  });

  test('clears task ID when queued task gets executed', async () => {
    const gates = [0, 1, 2].map(() => {
      const g = {};
      g.promise = new Promise(r => { g.resolve = r; });
      return g;
    });

    // Fill both slots
    const p1 = cm.execute(async () => { await gates[0].promise; }, 'task-1');
    const p2 = cm.execute(async () => { await gates[1].promise; }, 'task-2');
    // This one gets queued
    const p3 = cm.execute(async () => { await gates[2].promise; }, 'task-3');

    await new Promise(r => setImmediate(r));
    expect(cm.activeTasks().sort()).toEqual(['task-1', 'task-2']);

    // Free a slot
    gates[0].resolve();
    await p1;
    await new Promise(r => setImmediate(r));

    // task-3 should now be active
    expect(cm.activeTasks().sort()).toEqual(['task-2', 'task-3']);

    gates[1].resolve();
    gates[2].resolve();
    await p2;
    await p3;
    expect(cm.activeTasks()).toEqual([]);
  });
});

describe('F174: Storage.countWhere(predicate)', () => {
  let tmpDir, storage;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'storage-test-'));
    storage = new Storage(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  test('returns 0 for empty storage', async () => {
    const count = await storage.countWhere(() => true);
    expect(count).toBe(0);
  });

  test('counts all tasks when predicate returns true', async () => {
    await storage.saveTask('t1', { status: 'pending' });
    await storage.saveTask('t2', { status: 'done' });
    const count = await storage.countWhere(() => true);
    expect(count).toBe(2);
  });

  test('counts tasks matching specific condition', async () => {
    await storage.saveTask('t1', { status: 'pending', priority: 1 });
    await storage.saveTask('t2', { status: 'done', priority: 5 });
    await storage.saveTask('t3', { status: 'pending', priority: 3 });
    const pending = await storage.countWhere(t => t.status === 'pending');
    expect(pending).toBe(2);
  });

  test('passes task object with id to predicate', async () => {
    await storage.saveTask('abc', { status: 'active' });
    let captured = null;
    await storage.countWhere(t => { captured = t; return true; });
    expect(captured.id).toBe('abc');
    expect(captured.status).toBe('active');
  });

  test('throws TypeError for non-function predicate', async () => {
    await expect(storage.countWhere('not a function'))
      .rejects.toThrow(TypeError);
  });

  test('handles complex predicates', async () => {
    await storage.saveTask('t1', { status: 'done', tags: ['urgent'] });
    await storage.saveTask('t2', { status: 'done', tags: ['low'] });
    await storage.saveTask('t3', { status: 'pending', tags: ['urgent'] });
    const urgentDone = await storage.countWhere(
      t => t.status === 'done' && t.tags && t.tags.includes('urgent')
    );
    expect(urgentDone).toBe(1);
  });

  test('returns 0 when no tasks match', async () => {
    await storage.saveTask('t1', { status: 'pending' });
    const count = await storage.countWhere(t => t.status === 'archived');
    expect(count).toBe(0);
  });
});
