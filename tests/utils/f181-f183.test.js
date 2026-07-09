const { Cache } = require('../../src/utils/cache');
const { Storage } = require('../../src/utils/storage');
const { EventBus } = require('../../src/utils/event-bus');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('F181: Cache.getTTL(key)', () => {
  let cache;
  beforeEach(() => { cache = new Cache(5000); });
  afterEach(() => cache.destroy());

  test('returns -2 for non-existent key', () => {
    expect(cache.getTTL('missing')).toBe(-2);
  });

  test('returns -1 for key with no expiry', () => {
    cache.set('persistent', 'value', 0);
    expect(cache.getTTL('persistent')).toBe(-1);
  });

  test('returns remaining TTL in ms for key with expiry', () => {
    cache.set('temp', 'value', 5000);
    const ttl = cache.getTTL('temp');
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(5000);
  });

  test('returns -2 for expired key', () => {
    cache.set('short', 'value', 1);
    return new Promise(resolve => {
      setTimeout(() => {
        expect(cache.getTTL('short')).toBe(-2);
        resolve();
      }, 10);
    });
  });

  test('TTL decreases over time', () => {
    cache.set('decay', 'value', 1000);
    const ttl1 = cache.getTTL('decay');
    return new Promise(resolve => {
      setTimeout(() => {
        const ttl2 = cache.getTTL('decay');
        expect(ttl2).toBeLessThan(ttl1);
        expect(ttl2).toBeGreaterThan(0);
        resolve();
      }, 50);
    });
  });
});

describe('F182: Storage.except(ids[])', () => {
  let tmpDir, storage;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'storage-test-'));
    storage = new Storage(tmpDir);
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('returns all tasks when no IDs excluded', async () => {
    await storage.saveTask('t1', { id: 't1', status: 'pending' });
    await storage.saveTask('t2', { id: 't2', status: 'done' });
    const result = await storage.except();
    expect(result).toHaveLength(2);
  });

  test('excludes specified IDs', async () => {
    await storage.saveTask('t1', { id: 't1', status: 'pending' });
    await storage.saveTask('t2', { id: 't2', status: 'done' });
    await storage.saveTask('t3', { id: 't3', status: 'pending' });
    const result = await storage.except(['t1', 't3']);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t2');
  });

  test('returns empty array when all IDs excluded', async () => {
    await storage.saveTask('t1', { id: 't1' });
    await storage.saveTask('t2', { id: 't2' });
    const result = await storage.except(['t1', 't2']);
    expect(result).toHaveLength(0);
  });

  test('handles non-existent IDs gracefully', async () => {
    await storage.saveTask('t1', { id: 't1' });
    const result = await storage.except(['nonexistent']);
    expect(result).toHaveLength(1);
  });

  test('works with empty storage', async () => {
    const result = await storage.except(['t1']);
    expect(result).toHaveLength(0);
  });
});

describe('F183: EventBus.broadcast(data)', () => {
  let bus;
  beforeEach(() => { bus = new EventBus(); });
  afterEach(() => bus.reset());

  test('emits to all active channels', () => {
    const received = {};
    bus.on('channel1', (e) => { received.channel1 = e.data; });
    bus.on('channel2', (e) => { received.channel2 = e.data; });
    bus.on('channel3', (e) => { received.channel3 = e.data; });
    const channels = bus.broadcast({ msg: 'hello' });
    expect(channels).toHaveLength(3);
    expect(channels).toContain('channel1');
    expect(channels).toContain('channel2');
    expect(channels).toContain('channel3');
    expect(received).toEqual({
      channel1: { msg: 'hello' },
      channel2: { msg: 'hello' },
      channel3: { msg: 'hello' },
    });
  });

  test('returns empty array when no subscribers', () => {
    const channels = bus.broadcast({ test: true });
    expect(channels).toHaveLength(0);
  });

  test('skips channels with no subscribers', () => {
    bus.on('active', () => {});
    // channel 'inactive' was never subscribed
    const channels = bus.broadcast({ x: 1 });
    expect(channels).toEqual(['active']);
  });

  test('broadcasts default empty data', () => {
    let received = null;
    bus.on('test', (e) => { received = e.data; });
    bus.broadcast();
    expect(received).toEqual({});
  });

  test('each channel receives the same data', () => {
    const results = [];
    bus.on('a', (e) => results.push(e.data.value));
    bus.on('b', (e) => results.push(e.data.value));
    bus.on('c', (e) => results.push(e.data.value));
    bus.broadcast({ value: 42 });
    expect(results).toEqual([42, 42, 42]);
  });
});
