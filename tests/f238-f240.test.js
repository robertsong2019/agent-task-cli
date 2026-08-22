const { Storage } = require('../src/utils/storage');
const { PriorityQueue } = require('../src/utils/priority-queue');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

describe('Round 61: F238 Storage.every / F239 Storage.some / F240 PriorityQueue.batch', () => {
  describe('F238: Storage.every(predicate)', () => {
    let tmpDir, storage;

    beforeEach(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-every-'));
      storage = new Storage(tmpDir);
      await storage.saveTask('t1', { title: 'A', status: 'done', priority: 3 });
      await storage.saveTask('t2', { title: 'B', status: 'done', priority: 1 });
    });

    afterEach(async () => {
      await fs.rm(tmpDir, { recursive: true });
    });

    test('returns true when all tasks match', async () => {
      expect(await storage.every(t => t.status === 'done')).toBe(true);
    });

    test('returns false when at least one task fails', async () => {
      expect(await storage.every(t => t.priority > 0)).toBe(true);
      expect(await storage.every(t => t.priority > 2)).toBe(false);
    });

    test('returns true for empty storage (vacuous truth)', async () => {
      await storage.clear();
      expect(await storage.every(() => false)).toBe(true);
    });

    test('predicate receives task id merged into the task object', async () => {
      expect(await storage.every(t => /^t\d+$/.test(t.id))).toBe(true);
    });

    test('complements some(): every = !some(negation)', async () => {
      const isDone = t => t.status === 'done';
      expect(await storage.every(isDone)).toBe(!(await storage.some(t => !isDone(t))));
    });
  });

  describe('F239: Storage.some(predicate)', () => {
    let tmpDir, storage;

    beforeEach(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-some-'));
      storage = new Storage(tmpDir);
      await storage.saveTask('t1', { title: 'A', status: 'done', priority: 3 });
      await storage.saveTask('t2', { title: 'B', status: 'pending', priority: 1 });
      await storage.saveTask('t3', { title: 'C', status: 'running', priority: 5 });
    });

    afterEach(async () => {
      await fs.rm(tmpDir, { recursive: true });
    });

    test('returns true when at least one task matches', async () => {
      expect(await storage.some(t => t.status === 'pending')).toBe(true);
    });

    test('returns false when no task matches', async () => {
      expect(await storage.some(t => t.status === 'archived')).toBe(false);
    });

    test('returns false on empty storage', async () => {
      await storage.clear();
      expect(await storage.some(() => true)).toBe(false);
    });

    test('predicate receives task id merged into the task object', async () => {
      expect(await storage.some(t => t.id === 't2' && t.priority === 1)).toBe(true);
      expect(await storage.some(t => t.id === 't2' && t.priority === 9)).toBe(false);
    });

    test('works with numeric field comparisons across tasks', async () => {
      expect(await storage.some(t => t.priority > 4)).toBe(true);
      expect(await storage.some(t => t.priority > 10)).toBe(false);
    });
  });

  describe('F240: PriorityQueue.batch(n)', () => {
    test('dequeues up to n items in priority order', () => {
      const pq = new PriorityQueue();
      pq.enqueue('low', 9);
      pq.enqueue('high', 1);
      pq.enqueue('mid', 5);
      pq.enqueue('mid2', 5);

      const out = pq.batch(3);
      expect(out).toEqual(['high', 'mid', 'mid2']);
      expect(pq.size).toBe(1);
    });

    test('returns fewer items when queue is smaller than n', () => {
      const pq = new PriorityQueue();
      pq.enqueue('a', 2);
      const out = pq.batch(10);
      expect(out).toEqual(['a']);
      expect(pq.isEmpty()).toBe(true);
    });

    test('returns empty array for n=0 or empty queue', () => {
      const pq = new PriorityQueue();
      expect(pq.batch(0)).toEqual([]);
      pq.enqueue('x', 1);
      expect(new PriorityQueue().batch(3)).toEqual([]);
      expect(pq.batch(0)).toEqual([]);
    });

    test('drains entire queue when n equals size', () => {
      const pq = new PriorityQueue();
      pq.enqueue(3, 3);
      pq.enqueue(1, 1);
      pq.enqueue(2, 2);
      expect(pq.batch(3)).toEqual([1, 2, 3]);
      expect(pq.isEmpty()).toBe(true);
    });

    test('throws TypeError for negative or non-integer n', () => {
      const pq = new PriorityQueue();
      expect(() => pq.batch(-1)).toThrow(TypeError);
      expect(() => pq.batch(1.5)).toThrow(TypeError);
      expect(() => pq.batch('2')).toThrow(TypeError);
    });
  });
});
