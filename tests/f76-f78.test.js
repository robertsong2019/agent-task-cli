const { Cache } = require('../src/utils/cache');
const { EventBus } = require('../src/utils/event-bus');
const { Storage } = require('../src/utils/storage');
const fs = require('fs');
const path = require('path');
const os = require('os');

// F76: Cache.decr
describe('F76: Cache.decr', () => {
  test('decrements by 1 by default', () => {
    const c = new Cache();
    c.set('counter', 10);
    expect(c.decr('counter')).toBe(9);
    expect(c.get('counter')).toBe(9);
  });

  test('decrements by custom delta', () => {
    const c = new Cache();
    c.set('counter', 10);
    expect(c.decr('counter', 5)).toBe(5);
  });

  test('creates key with negative if missing', () => {
    const c = new Cache();
    expect(c.decr('new')).toBe(-1);
  });

  test('throws for non-numeric value', () => {
    const c = new Cache();
    c.set('s', 'hello');
    expect(() => c.decr('s')).toThrow(TypeError);
  });
});

// F77: EventBus.emitAndWait
describe('F77: EventBus.emitAndWait', () => {
  test('returns empty array for no subscribers', async () => {
    const bus = new EventBus();
    const results = await bus.emitAndWait('ch', { x: 1 });
    expect(results).toEqual([]);
  });

  test('collects results from all handlers', async () => {
    const bus = new EventBus();
    bus.on('ch', (d) => d.x * 2);
    bus.on('ch', (d) => d.x + 10);
    const results = await bus.emitAndWait('ch', { x: 5 });
    expect(results.sort()).toEqual([10, 15]);
  });

  test('works with async handlers', async () => {
    const bus = new EventBus();
    bus.on('ch', async (d) => {
      await new Promise(r => setTimeout(r, 10));
      return d.val;
    });
    const results = await bus.emitAndWait('ch', { val: 42 });
    expect(results).toEqual([42]);
  });

  test('respects timeout', async () => {
    const bus = new EventBus();
    bus.on('ch', async () => {
      await new Promise(r => setTimeout(r, 1000));
      return 'late';
    });
    await expect(bus.emitAndWait('ch', {}, 50)).rejects.toThrow('Handler timeout');
  });
});

// F78: Storage.deleteByStatus
describe('F78: Storage.deleteByStatus', () => {
  let tmpDir, storage;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'storage-f78-'));
    storage = new Storage(tmpDir);
    await storage.saveTask('t1', { name: 'a', status: 'pending' });
    await storage.saveTask('t2', { name: 'b', status: 'done' });
    await storage.saveTask('t3', { name: 'c', status: 'pending' });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('deletes tasks with matching status and returns count', async () => {
    const count = await storage.deleteByStatus('pending');
    expect(count).toBe(2);
    const remaining = await storage.loadTasks();
    expect(Object.keys(remaining)).toEqual(['t2']);
  });

  test('returns 0 when no tasks match', async () => {
    const count = await storage.deleteByStatus('unknown');
    expect(count).toBe(0);
  });

  test('deletes all tasks if all match', async () => {
    await storage.deleteByStatus('pending');
    const count = await storage.deleteByStatus('done');
    expect(count).toBe(1);
    const remaining = await storage.loadTasks();
    expect(Object.keys(remaining)).toEqual([]);
  });
});
