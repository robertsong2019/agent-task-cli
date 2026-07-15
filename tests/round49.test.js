const { PriorityQueue } = require('../src/utils/priority-queue');
const { Cache, generateTaskCacheKey } = require('../src/utils/cache');
const { Storage } = require('../src/utils/storage');
const { EventBus } = require('../src/utils/event-bus');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ─── F195: Storage.countByField(field) ───────────────────────────────────────

describe('F195: Storage.countByField(field)', () => {
  let storage;
  let tmpDir;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-countbyfield-'));
    storage = new Storage(tmpDir);
  });

  afterEach(async () => {
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
  });

  test('counts tasks grouped by arbitrary field', async () => {
    await storage.saveTask('t1', { status: 'pending', priority: 'high' });
    await storage.saveTask('t2', { status: 'done', priority: 'low' });
    await storage.saveTask('t3', { status: 'pending', priority: 'high' });
    await storage.saveTask('t4', { status: 'done', priority: 'medium' });

    const counts = await storage.countByField('status');
    expect(counts).toEqual({ pending: 2, done: 2 });
  });

  test('works with any field, not just status', async () => {
    await storage.saveTask('t1', { status: 'pending', priority: 'high' });
    await storage.saveTask('t2', { status: 'done', priority: 'high' });
    await storage.saveTask('t3', { status: 'pending', priority: 'low' });

    const counts = await storage.countByField('priority');
    expect(counts).toEqual({ high: 2, low: 1 });
  });

  test('groups undefined field values under "undefined"', async () => {
    await storage.saveTask('t1', { status: 'pending' });
    await storage.saveTask('t2', { status: 'done' });
    await storage.saveTask('t3', {}); // no status

    const counts = await storage.countByField('status');
    expect(counts).toEqual({ pending: 1, done: 1, undefined: 1 });
  });

  test('returns empty object when no tasks', async () => {
    const counts = await storage.countByField('status');
    expect(counts).toEqual({});
  });

  test('throws on non-string field', async () => {
    await expect(storage.countByField(123)).rejects.toThrow(TypeError);
    await expect(storage.countByField('')).rejects.toThrow(TypeError);
  });

  test('handles numeric field values by stringifying', async () => {
    await storage.saveTask('t1', { score: 10 });
    await storage.saveTask('t2', { score: 20 });
    await storage.saveTask('t3', { score: 10 });

    const counts = await storage.countByField('score');
    expect(counts).toEqual({ '10': 2, '20': 1 });
  });
});

// ─── F196: Cache.toggle(key, initial) ────────────────────────────────────────

describe('F196: Cache.toggle(key, initial)', () => {
  let cache;

  beforeEach(() => {
    cache = new Cache({ maxSize: 10, defaultTTL: 0 }); // no expiry
  });

  afterEach(() => cache.destroy());

  test('starts true for non-existent key with default initial=false', () => {
    const result = cache.toggle('flag');
    expect(result).toBe(true);
    expect(cache.get('flag')).toBe(true);
  });

  test('starts false when initial=true', () => {
    const result = cache.toggle('flag', true);
    expect(result).toBe(false);
    expect(cache.get('flag')).toBe(false);
  });

  test('flips true→false', () => {
    cache.set('flag', true);
    const result = cache.toggle('flag');
    expect(result).toBe(false);
    expect(cache.get('flag')).toBe(false);
  });

  test('flips false→true', () => {
    cache.set('flag', false);
    const result = cache.toggle('flag');
    expect(result).toBe(true);
    expect(cache.get('flag')).toBe(true);
  });

  test('multiple toggles alternate correctly', () => {
    expect(cache.toggle('sw')).toBe(true);  // missing → !false = true
    expect(cache.toggle('sw')).toBe(false); // true → false
    expect(cache.toggle('sw')).toBe(true);  // false → true
    expect(cache.toggle('sw')).toBe(false); // true → false
  });

  test('toggle does not count as hit or miss', () => {
    cache.toggle('flag');
    const hitsBefore = cache.stats.hits;
    const missesBefore = cache.stats.misses;
    cache.toggle('flag');
    expect(cache.stats.hits).toBe(hitsBefore);
    expect(cache.stats.misses).toBe(missesBefore);
  });

  test('toggle on truthy non-boolean value returns false', () => {
    cache.set('val', 'hello');
    expect(cache.toggle('val')).toBe(false);
  });

  test('toggle on falsy non-boolean value returns true', () => {
    cache.set('val', 0);
    expect(cache.toggle('val')).toBe(true);
  });
});

// ─── F197: EventBus.emitWithAck(channel, data, timeout) ─────────────────────

describe('F197: EventBus.emitWithAck(channel, data, timeout)', () => {
  let bus;

  beforeEach(() => { bus = new EventBus(); });
  afterEach(() => { bus.destroy && bus.destroy(); });

  test('collects sync handler return values', async () => {
    bus.on('compute', (event) => event.data.x * 2);
    bus.on('compute', (event) => event.data.x + 1);

    const ack = await bus.emitWithAck('compute', { x: 10 });
    expect(ack.handlers).toBe(2);
    expect(ack.results).toContain(20);
    expect(ack.results).toContain(11);
    expect(ack.errors).toEqual([]);
  });

  test('collects async handler results', async () => {
    bus.on('fetch', async (event) => {
      return new Promise(resolve => setTimeout(() => resolve(`data:${event.data.id}`), 10));
    });

    const ack = await bus.emitWithAck('fetch', { id: 42 });
    expect(ack.results).toEqual(['data:42']);
    expect(ack.errors).toEqual([]);
  });

  test('captures handler errors without failing', async () => {
    bus.on('risky', () => { throw new Error('boom'); });
    bus.on('risky', (event) => 'ok');

    const ack = await bus.emitWithAck('risky', {});
    expect(ack.handlers).toBe(2);
    expect(ack.results).toEqual(['ok']);
    expect(ack.errors).toHaveLength(1);
    expect(ack.errors[0].error).toBe('boom');
  });

  test('returns empty results for channel with no subscribers', async () => {
    const ack = await bus.emitWithAck('noop', { test: true });
    expect(ack.handlers).toBe(0);
    expect(ack.results).toEqual([]);
    expect(ack.errors).toEqual([]);
  });

  test('records event in history', async () => {
    bus.on('ch', (event) => true);
    await bus.emitWithAck('ch', { v: 1 });

    const history = bus.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].channel).toBe('ch');
    expect(history[0].data).toEqual({ v: 1 });
  });

  test('async handler timeout produces error', async () => {
    bus.on('slow', async () => {
      return new Promise(resolve => setTimeout(() => resolve('late'), 200));
    });

    const ack = await bus.emitWithAck('slow', {}, 50);
    expect(ack.errors).toHaveLength(1);
    expect(ack.errors[0].error).toContain('timeout');
    expect(ack.results).toEqual([]);
  });

  test('mixed sync and async handlers', async () => {
    bus.on('mixed', (event) => event.data.n + 1);
    bus.on('mixed', async (event) => {
      return new Promise(resolve => setTimeout(() => resolve(event.data.n + 2), 5));
    });

    const ack = await bus.emitWithAck('mixed', { n: 10 });
    expect(ack.handlers).toBe(2);
    expect(ack.results).toContain(11);
    expect(ack.results).toContain(12);
  });
});
