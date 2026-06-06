const { Cache } = require('../src/utils/cache');
const { EventBus } = require('../src/utils/event-bus');
const { Storage } = require('../src/utils/storage');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// F109: Cache.expireAt(key, timestamp)
describe('F109: Cache.expireAt(key, timestamp)', () => {
  let cache;
  beforeEach(() => { cache = new Cache({ maxSize: 100, defaultTTL: 0 }); });
  afterEach(() => { cache.destroy(); });

  test('sets absolute expiry timestamp on existing key', () => {
    cache.set('a', 1);
    const futureTs = Date.now() + 5000;
    expect(cache.expireAt('a', futureTs)).toBe(true);
    // key should still be accessible (not yet expired)
    expect(cache.get('a')).toBe(1);
  });

  test('key expires when timestamp is in the past', () => {
    cache.set('a', 1);
    const pastTs = Date.now() - 1000;
    cache.expireAt('a', pastTs);
    expect(cache.get('a')).toBeUndefined();
  });

  test('returns false for non-existent key', () => {
    expect(cache.expireAt('nonexistent', Date.now() + 5000)).toBe(false);
  });

  test('throws on invalid timestamp (non-number)', () => {
    cache.set('a', 1);
    expect(() => cache.expireAt('a', 'not-a-number')).toThrow('positive number');
    expect(() => cache.expireAt('a', NaN)).toThrow('positive number');
  });

  test('throws on zero or negative timestamp', () => {
    cache.set('a', 1);
    expect(() => cache.expireAt('a', 0)).toThrow('positive number');
    expect(() => cache.expireAt('a', -100)).toThrow('positive number');
  });

  test('different from expire(ttl) — expireAt uses absolute, expire uses relative', () => {
    cache.set('a', 1);
    const baseTime = Date.now();
    // expire with ttl=5000 → expiresAt ≈ baseTime + 5000
    cache.expire('a', 5000);
    const entry1 = cache.cache.get('a');
    const relativeExpiry = entry1.expiresAt;

    cache.set('b', 2);
    const absoluteTs = baseTime + 5000;
    cache.expireAt('b', absoluteTs);
    const entry2 = cache.cache.get('b');

    // Both should expire at roughly the same time
    expect(Math.abs(entry2.expiresAt - relativeExpiry)).toBeLessThan(100);
  });
});

// F110: Storage.sum(field)
describe('F110: Storage.sum(field)', () => {
  let storage;
  let tmpDir;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `storage-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    storage = new Storage(tmpDir);
  });

  afterEach(async () => {
    try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch {}
  });

  test('sums a numeric field across all tasks', async () => {
    await storage.saveTask('t1', { score: 10, status: 'done' });
    await storage.saveTask('t2', { score: 20, status: 'pending' });
    await storage.saveTask('t3', { score: 30, status: 'done' });
    expect(await storage.sum('score')).toBe(60);
  });

  test('returns 0 when no tasks exist', async () => {
    expect(await storage.sum('score')).toBe(0);
  });

  test('returns 0 when field does not exist on any task', async () => {
    await storage.saveTask('t1', { name: 'task1' });
    await storage.saveTask('t2', { name: 'task2' });
    expect(await storage.sum('nonexistent')).toBe(0);
  });

  test('skips non-numeric values', async () => {
    await storage.saveTask('t1', { amount: 100 });
    await storage.saveTask('t2', { amount: 'not-a-number' });
    await storage.saveTask('t3', { amount: null });
    await storage.saveTask('t4', { amount: undefined });
    await storage.saveTask('t5', { amount: 50 });
    expect(await storage.sum('amount')).toBe(150);
  });

  test('handles negative numbers', async () => {
    await storage.saveTask('t1', { delta: -10 });
    await storage.saveTask('t2', { delta: 30 });
    expect(await storage.sum('delta')).toBe(20);
  });

  test('handles NaN values by skipping them', async () => {
    await storage.saveTask('t1', { val: NaN });
    await storage.saveTask('t2', { val: 5 });
    expect(await storage.sum('val')).toBe(5);
  });
});

// F111: EventBus.emitMany(events[])
describe('F111: EventBus.emitMany(events[])', () => {
  let bus;
  beforeEach(() => { bus = new EventBus(); });

  test('emits events across multiple channels', () => {
    const received = [];
    bus.on('a', (e) => received.push(['a', e.data]));
    bus.on('b', (e) => received.push(['b', e.data]));
    bus.on('c', (e) => received.push(['c', e.data]));

    const count = bus.emitMany([
      { channel: 'a', data: { val: 1 } },
      { channel: 'b', data: { val: 2 } },
      { channel: 'c', data: { val: 3 } },
    ]);
    expect(count).toBe(3);
    expect(received).toHaveLength(3);
    expect(received[0]).toEqual(['a', { val: 1 }]);
    expect(received[2]).toEqual(['c', { val: 3 }]);
  });

  test('returns 0 for empty array', () => {
    expect(bus.emitMany([])).toBe(0);
  });

  test('throws on non-array input', () => {
    expect(() => bus.emitMany('not-an-array')).toThrow();
    expect(() => bus.emitMany({})).toThrow();
  });

  test('skips entries with invalid channel (non-string or missing)', () => {
    const received = [];
    bus.on('valid', (e) => received.push(e.data));
    const count = bus.emitMany([
      { channel: 'valid', data: { ok: true } },
      { channel: 123, data: {} },
      { data: { noChannel: true } },
      { channel: '', data: {} },
    ]);
    expect(count).toBe(1);
    expect(received).toHaveLength(1);
  });

  test('defaults data to {} when not provided', () => {
    let received = null;
    bus.on('test', (e) => { received = e.data; });
    bus.emitMany([{ channel: 'test' }]);
    expect(received).toEqual({});
  });

  test('wildcard listener receives all events', () => {
    const all = [];
    bus.on('*', (e) => all.push(e.channel));
    bus.emitMany([
      { channel: 'x', data: 1 },
      { channel: 'y', data: 2 },
    ]);
    expect(all).toEqual(['x', 'y']);
  });

  test('adds a single consolidated history entry', () => {
    bus.emitMany([
      { channel: 'a', data: {} },
      { channel: 'b', data: {} },
      { channel: 'c', data: {} },
    ]);
    // History should have the batch entry
    const batchEntries = bus._history.filter(e => e.channel === '__batch__');
    expect(batchEntries).toHaveLength(1);
    expect(batchEntries[0].data.count).toBe(3);
    expect(batchEntries[0].data.channels).toEqual(['a', 'b', 'c']);
  });

  test('interceptors are applied per-channel', () => {
    let received = [];
    bus.on('protected', (e) => received.push(e.data));
    bus.intercept('protected', (data) => {
      if (data.blocked) return false;
      return { ...data, intercepted: true };
    });

    bus.emitMany([
      { channel: 'protected', data: { blocked: false } },
      { channel: 'protected', data: { blocked: true } },
    ]);
    expect(received).toHaveLength(1);
    expect(received[0].intercepted).toBe(true);
  });
});
