const { Cache } = require('../src/utils/cache');
const { Storage } = require('../src/utils/storage');
const { EventBus } = require('../src/utils/event-bus');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('F122: Cache.diff(otherCache)', () => {
  test('returns empty diff for identical caches', () => {
    const a = new Cache(), b = new Cache();
    a.set('x', 1); b.set('x', 1);
    const diff = a.diff(b);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.changed).toEqual([]);
  });

  test('detects added and removed keys', () => {
    const a = new Cache(), b = new Cache();
    a.set('x', 1); a.set('y', 2);
    b.set('x', 1); b.set('z', 3);
    const diff = a.diff(b);
    expect(diff.added).toEqual(['y']);
    expect(diff.removed).toEqual(['z']);
  });

  test('detects changed values', () => {
    const a = new Cache(), b = new Cache();
    a.set('x', 1); a.set('y', 'hello');
    b.set('x', 2); b.set('y', 'hello');
    const diff = a.diff(b);
    expect(diff.changed).toEqual(['x']);
  });

  test('works with empty caches', () => {
    const a = new Cache(), b = new Cache();
    expect(a.diff(b)).toEqual({ added: [], removed: [], changed: [] });
  });
});

describe('F123: Storage.sample(n)', () => {
  let tmpDir, storage;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'storage-sample-'));
    storage = new Storage(tmpDir);
    for (let i = 0; i < 10; i++) {
      await storage.saveTask(`t${i}`, { id: `t${i}`, name: `task${i}` });
    }
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('returns up to n tasks', async () => {
    const sample = await storage.sample(5);
    expect(sample.length).toBe(5);
  });

  test('returns all tasks if n > total', async () => {
    const sample = await storage.sample(100);
    expect(sample.length).toBe(10);
  });

  test('returns empty array for empty storage', async () => {
    const empty = new Storage(fs.mkdtempSync(path.join(os.tmpdir(), 'empty-')));
    const sample = await empty.sample(3);
    expect(sample).toEqual([]);
  });

  test('returns shuffled results', async () => {
    const first = (await storage.sample(10)).map(t => t.id).join(',');
    let different = false;
    for (let i = 0; i < 10; i++) {
      const next = (await storage.sample(10)).map(t => t.id).join(',');
      if (next !== first) { different = true; break; }
    }
    expect(different).toBe(true);
  });
});

describe('F124: EventBus.afterAll(channel, handler)', () => {
  test('fires after emit with event info', () => {
    const bus = new EventBus();
    const calls = [];
    bus.afterAll('test', (info) => calls.push(info));
    bus.emit('test', { x: 1 });
    expect(calls.length).toBe(1);
    expect(calls[0].channel).toBe('test');
    expect(calls[0].data).toEqual({ x: 1 });
  });

  test('unsubscribe stops firing', () => {
    const bus = new EventBus();
    const calls = [];
    const unsub = bus.afterAll('ch', () => calls.push(1));
    bus.emit('ch', {});
    expect(calls.length).toBe(1);
    unsub();
    bus.emit('ch', {});
    expect(calls.length).toBe(1);
  });

  test('multiple hooks fire in order', () => {
    const bus = new EventBus();
    const order = [];
    bus.afterAll('ch', () => order.push('a'));
    bus.afterAll('ch', () => order.push('b'));
    bus.emit('ch', {});
    expect(order).toEqual(['a', 'b']);
  });

  test('does not fire for other channels', () => {
    const bus = new EventBus();
    const calls = [];
    bus.afterAll('a', () => calls.push(1));
    bus.emit('b', {});
    expect(calls.length).toBe(0);
  });
});
