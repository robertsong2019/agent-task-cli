const { Storage } = require('../src/utils/storage');
const { EventBus } = require('../src/utils/event-bus');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

describe('Round 64: F247 EventBus.waitForMatch / F248 Storage.partition / F249 Storage.minBy+maxBy', () => {
  describe('F247: EventBus.waitForMatch(channel, predicate, timeoutMs)', () => {
    let bus;

    beforeEach(() => {
      bus = new EventBus();
    });

    test('resolves with the first matching event (full event object)', async () => {
      const p = bus.waitForMatch('task', (e) => e.data && e.data.status === 'done', 1000);
      bus.emit('task', { id: 't1', status: 'done' });
      const event = await p;
      expect(event.channel).toBe('task');
      expect(event.data.status).toBe('done');
      expect(event.data.id).toBe('t1');
    });

    test('ignores non-matching events and keeps listening', async () => {
      const p = bus.waitForMatch('task', (e) => e.data && e.data.status === 'done', 1000);
      bus.emit('task', { id: 't1', status: 'pending' });
      bus.emit('task', { id: 't2', status: 'running' });
      bus.emit('task', { id: 't3', status: 'done' });
      const event = await p;
      expect(event.data.id).toBe('t3');
    });

    test('rejects on timeout when no matching event arrives', async () => {
      await expect(
        bus.waitForMatch('task', () => false, 50)
      ).rejects.toThrow('Timeout waiting for event match: task');
    });

    test('stops listening after a match (no double resolve / no leak)', async () => {
      const p = bus.waitForMatch('task', (e) => e.data && e.data.ok === true, 1000);
      bus.emit('task', { ok: true });
      await p;
      // after match, further emissions must not invoke the removed handler
      expect(() => bus.emit('task', { ok: true })).not.toThrow();
      expect(bus.listenerCount('task')).toBe(0);
    });

    test('times out and unsubscribes when only non-matching events arrive', async () => {
      const p = bus.waitForMatch('task', (e) => e.data && e.data.ok, 50);
      bus.emit('task', { ok: false });
      await expect(p).rejects.toThrow('Timeout');
      expect(bus.listenerCount('task')).toBe(0);
    });

    test('rejects with TypeError when predicate is not a function', async () => {
      await expect(bus.waitForMatch('task', null, 100)).rejects.toThrow(TypeError);
      await expect(bus.waitForMatch('task', 'not-a-fn', 100)).rejects.toThrow(TypeError);
    });
  });

  describe('F248: Storage.partition(predicate)', () => {
    let tmpDir, storage;

    beforeEach(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-partition-'));
      storage = new Storage(tmpDir);
      await storage.saveTask('t1', { title: 'A', status: 'done', priority: 3 });
      await storage.saveTask('t2', { title: 'B', status: 'open', priority: 1 });
      await storage.saveTask('t3', { title: 'C', status: 'done', priority: 2 });
    });

    afterEach(async () => {
      await fs.rm(tmpDir, { recursive: true });
    });

    test('splits tasks into passing and failing by predicate', async () => {
      const { passing, failing } = await storage.partition((t) => t.status === 'done');
      expect(passing.map((t) => t.id).sort()).toEqual(['t1', 't3']);
      expect(failing.map((t) => t.id)).toEqual(['t2']);
    });

    test('both sides contain full task objects with id merged', async () => {
      const { passing } = await storage.partition((t) => t.priority >= 3);
      expect(passing).toHaveLength(1);
      expect(passing[0]).toMatchObject({ id: 't1', title: 'A', status: 'done', priority: 3 });
    });

    test('all-passing leaves failing empty and vice versa', async () => {
      const all = await storage.partition(() => true);
      expect(all.passing).toHaveLength(3);
      expect(all.failing).toHaveLength(0);
      const none = await storage.partition(() => false);
      expect(none.passing).toHaveLength(0);
      expect(none.failing).toHaveLength(3);
    });

    test('empty storage yields two empty arrays', async () => {
      await storage.clear();
      const { passing, failing } = await storage.partition(() => true);
      expect(passing).toEqual([]);
      expect(failing).toEqual([]);
    });

    test('partition is consistent with countWhere', async () => {
      const pred = (t) => t.priority > 1;
      const { passing } = await storage.partition(pred);
      expect(passing.length).toBe(await storage.countWhere(pred));
    });

    test('throws TypeError when predicate is not a function', async () => {
      await expect(storage.partition(null)).rejects.toThrow(TypeError);
    });
  });

  describe('F249: Storage.minBy(field) / Storage.maxBy(field)', () => {
    let tmpDir, storage;

    beforeEach(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-extreme-'));
      storage = new Storage(tmpDir);
      await storage.saveTask('t1', { title: 'A', score: 7 });
      await storage.saveTask('t2', { title: 'B', score: 2 });
      await storage.saveTask('t3', { title: 'C', score: 9 });
      await storage.saveTask('t4', { title: 'D' }); // missing field → ignored
    });

    afterEach(async () => {
      await fs.rm(tmpDir, { recursive: true });
    });

    test('minBy returns the task with the smallest numeric value', async () => {
      const t = await storage.minBy('score');
      expect(t).toMatchObject({ id: 't2', title: 'B', score: 2 });
    });

    test('maxBy returns the task with the largest numeric value', async () => {
      const t = await storage.maxBy('score');
      expect(t).toMatchObject({ id: 't3', title: 'C', score: 9 });
    });

    test('ignores tasks missing the field', async () => {
      const t = await storage.minBy('score');
      expect(t.id).not.toBe('t4');
    });

    test('returns null when no task has a finite numeric value', async () => {
      await storage.saveTask('t5', { title: 'E', score: 'not-a-number' });
      await storage.saveTask('t6', { title: 'F', score: NaN });
      const s2 = new Storage(tmpDir);
      await s2.deleteTask('t1');
      await s2.deleteTask('t2');
      await s2.deleteTask('t3');
      expect(await s2.minBy('score')).toBeNull();
      expect(await s2.maxBy('score')).toBeNull();
    });

    test('returns null for empty storage', async () => {
      await storage.clear();
      expect(await storage.minBy('score')).toBeNull();
      expect(await storage.maxBy('score')).toBeNull();
    });

    test('throws TypeError for invalid field argument', async () => {
      await expect(storage.minBy('')).rejects.toThrow(TypeError);
      await expect(storage.maxBy(42)).rejects.toThrow(TypeError);
    });
  });
});
