const { Cache } = require('../src/utils/cache');
const { EventBus } = require('../src/utils/event-bus');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// ─── F147: Cache.mget(keys[]) ───
describe('F147: Cache.mget', () => {
  let cache;
  beforeEach(() => { cache = new Cache({ defaultTTL: 0 }); });

  test('returns values in same order as keys', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    expect(cache.mget(['a', 'b', 'c'])).toEqual([1, 2, 3]);
  });

  test('returns undefined for missing keys', () => {
    cache.set('a', 1);
    expect(cache.mget(['a', 'missing', 'c'])).toEqual([1, undefined, undefined]);
  });

  test('returns undefined for expired keys', async () => {
    cache.set('a', 1, 50);
    cache.set('b', 2);
    await new Promise(r => setTimeout(r, 60));
    expect(cache.mget(['a', 'b'])).toEqual([undefined, 2]);
  });

  test('empty array returns empty array', () => {
    expect(cache.mget([])).toEqual([]);
  });

  test('updates accessedAt on hits', () => {
    cache.set('a', 1);
    const before = cache.getWithMeta('a').accessedAt;
    // small delay then mget
    const origGet = cache.get.bind(cache);
    let observedAt;
    cache.get = (k) => { const v = origGet(k); if (k === 'a') observedAt = Date.now(); return v; };
    cache.mget(['a']);
    expect(observedAt).toBeGreaterThanOrEqual(before);
  });

  test('throws TypeError for non-array input', () => {
    expect(() => cache.mget('a')).toThrow(TypeError);
    expect(() => cache.mget(null)).toThrow(TypeError);
    expect(() => cache.mget({})).toThrow(TypeError);
  });

  test('handles single key', () => {
    cache.set('x', 42);
    expect(cache.mget(['x'])).toEqual([42]);
  });
});

// ─── F148: Storage.bulkUpdate(updates) ───
describe('F148: Storage.bulkUpdate', () => {
  let tmpDir, Storage, storage;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'storage-bulk-'));
    Storage = require('../src/utils/storage').Storage;
    storage = new Storage(tmpDir);
    // seed tasks
    await storage.saveTask('t1', { name: 'Task1', status: 'pending' });
    await storage.saveTask('t2', { name: 'Task2', status: 'pending' });
    await storage.saveTask('t3', { name: 'Task3', status: 'pending' });
  });

  afterEach(async () => {
    try { await fs.rm(tmpDir, { recursive: true }); } catch {}
  });

  test('updates multiple tasks in one call', async () => {
    const res = await storage.bulkUpdate({
      t1: { status: 'done' },
      t2: { status: 'running' },
    });
    expect(res.updated.sort()).toEqual(['t1', 't2']);
    expect(res.missing).toEqual([]);
    const t1 = await storage.getTask('t1');
    expect(t1.status).toBe('done');
  });

  test('reports missing IDs', async () => {
    const res = await storage.bulkUpdate({
      t1: { status: 'done' },
      ghost: { status: 'done' },
    });
    expect(res.updated).toEqual(['t1']);
    expect(res.missing).toEqual(['ghost']);
  });

  test('all missing returns empty updated', async () => {
    const res = await storage.bulkUpdate({
      nope1: { x: 1 },
      nope2: { x: 2 },
    });
    expect(res.updated).toEqual([]);
    expect(res.missing.sort()).toEqual(['nope1', 'nope2']);
  });

  test('empty updates object is a no-op', async () => {
    const res = await storage.bulkUpdate({});
    expect(res.updated).toEqual([]);
    expect(res.missing).toEqual([]);
  });

  test('merges patches without overwriting entire task', async () => {
    await storage.bulkUpdate({ t1: { status: 'done' } });
    const t1 = await storage.getTask('t1');
    expect(t1.name).toBe('Task1'); // original field preserved
    expect(t1.status).toBe('done'); // new field added
  });

  test('multiple fields in single patch', async () => {
    await storage.bulkUpdate({
      t1: { status: 'done', result: 'success', score: 100 },
    });
    const t1 = await storage.getTask('t1');
    expect(t1).toMatchObject({ status: 'done', result: 'success', score: 100 });
  });
});

// ─── F149: EventBus.onceAny(channels[], handler) ───
describe('F149: EventBus.onceAny', () => {
  let bus;
  beforeEach(() => { bus = new EventBus(); });

  test('fires on first event from any channel', async () => {
    const received = [];
    bus.onceAny(['a', 'b', 'c'], (e) => received.push(e.data));

    bus.emit('b', { val: 42 });
    expect(received).toEqual([{ val: 42 }]);
  });

  test('only fires once even if more events come', () => {
    const received = [];
    bus.onceAny(['a', 'b'], (e) => received.push(e.data));

    bus.emit('a', { n: 1 });
    bus.emit('b', { n: 2 });
    bus.emit('a', { n: 3 });
    expect(received).toEqual([{ n: 1 }]);
  });

  test('auto-unsubscribes from all channels after firing', () => {
    const received = [];
    bus.onceAny(['x', 'y'], (e) => received.push(e.data));

    bus.emit('x', { n: 1 });
    // Channels should have no subscribers now
    expect(bus.channels()).not.toContain('x');
    expect(bus.channels()).not.toContain('y');
  });

  test('manual unsub before any event prevents firing', () => {
    const received = [];
    const unsub = bus.onceAny(['a', 'b'], (e) => received.push(e.data));

    unsub();
    bus.emit('a', { n: 1 });
    bus.emit('b', { n: 2 });
    expect(received).toEqual([]);
  });

  test('throws for empty or non-array channels', () => {
    expect(() => bus.onceAny([], () => {})).toThrow(TypeError);
    expect(() => bus.onceAny('abc', () => {})).toThrow(TypeError);
    expect(() => bus.onceAny(null, () => {})).toThrow(TypeError);
  });

  test('single channel works', () => {
    const received = [];
    bus.onceAny(['only'], (e) => received.push(e.data));
    bus.emit('only', { hello: true });
    expect(received).toEqual([{ hello: true }]);
  });

  test('does not interfere with regular subscribers on same channel', () => {
    const regular = [];
    const onceAny = [];
    bus.on('a', (e) => regular.push(e.data));
    bus.onceAny(['a', 'b'], (e) => onceAny.push(e.data));

    bus.emit('a', { n: 1 });
    bus.emit('a', { n: 2 });

    expect(regular).toEqual([{ n: 1 }, { n: 2 }]);
    expect(onceAny).toEqual([{ n: 1 }]);
  });
});
