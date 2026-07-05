/**
 * Round 38 tests: F153 Cache.withDefault + F154 Cache.incrBy + F155 Storage.upsert + F156 EventBus.emitWithMeta
 */
const { Cache } = require('../src/utils/cache');
const { Storage } = require('../src/utils/storage');
const { EventBus } = require('../src/utils/event-bus');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// ── F153: Cache.withDefault ──────────────────────────
describe('F153: Cache.withDefault', () => {
  let cache;
  beforeEach(() => { cache = new Cache(); });
  afterEach(() => { cache.destroy(); });

  test('sets and returns default when key is missing', () => {
    const result = cache.withDefault('config', { retries: 3 });
    expect(result).toEqual({ retries: 3 });
    expect(cache.get('config')).toEqual({ retries: 3 });
  });

  test('returns existing value when key exists', () => {
    cache.set('config', { retries: 5 });
    const result = cache.withDefault('config', { retries: 1 });
    expect(result).toEqual({ retries: 5 }); // existing value wins
  });

  test('sets default for expired key', async () => {
    cache.set('temp', 'old', 50);
    await new Promise(r => setTimeout(r, 60));
    const result = cache.withDefault('temp', 'new');
    expect(result).toBe('new');
    expect(cache.get('temp')).toBe('new');
  });

  test('works with primitive defaults', () => {
    expect(cache.withDefault('count', 0)).toBe(0);
    expect(cache.withDefault('count', 10)).toBe(0); // already set
  });

  test('respects custom TTL', async () => {
    cache.withDefault('short', 'val', 50);
    expect(cache.get('short')).toBe('val');
    await new Promise(r => setTimeout(r, 60));
    expect(cache.get('short')).toBeUndefined();
  });
});

// ── F154: Cache.incrBy ──────────────────────────────
describe('F154: Cache.incrBy', () => {
  let cache;
  beforeEach(() => { cache = new Cache(); });
  afterEach(() => { cache.destroy(); });

  test('increments from 0 for non-existent key', () => {
    expect(cache.incrBy('counter', 5)).toBe(5);
  });

  test('increments existing numeric value', () => {
    cache.set('counter', 10);
    expect(cache.incrBy('counter', 3)).toBe(13);
  });

  test('handles negative amounts (decrement)', () => {
    cache.set('counter', 10);
    expect(cache.incrBy('counter', -4)).toBe(6);
  });

  test('clamps to min bound', () => {
    cache.set('counter', 2);
    expect(cache.incrBy('counter', -5, { min: 0 })).toBe(0);
  });

  test('clamps to max bound', () => {
    cache.set('counter', 95);
    expect(cache.incrBy('counter', 10, { max: 100 })).toBe(100);
  });

  test('clamps to both min and max', () => {
    cache.set('counter', 50);
    expect(cache.incrBy('counter', 100, { min: 0, max: 100 })).toBe(100);
    expect(cache.incrBy('counter', -200, { min: 0, max: 100 })).toBe(0);
  });

  test('starts from 0 if key holds non-numeric value', () => {
    cache.set('counter', 'not-a-number');
    expect(cache.incrBy('counter', 1)).toBe(1);
  });

  test('throws on non-number amount', () => {
    expect(() => cache.incrBy('c', '5')).toThrow(TypeError);
    expect(() => cache.incrBy('c', NaN)).toThrow(TypeError);
    expect(() => cache.incrBy('c', Infinity)).toThrow(TypeError);
  });

  test('respects TTL option', async () => {
    cache.incrBy('temp', 1, { ttl: 50 });
    expect(cache.get('temp')).toBe(1);
    await new Promise(r => setTimeout(r, 60));
    expect(cache.get('temp')).toBeUndefined();
  });
});

// ── F155: Storage.upsert ────────────────────────────
describe('F155: Storage.upsert', () => {
  let tmpDir, storage;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'upsert-test-'));
    storage = new Storage(tmpDir);
  });

  afterEach(async () => {
    try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch {}
  });

  test('creates new task when id does not exist', async () => {
    const result = await storage.upsert('t1', { status: 'pending', priority: 1 });
    expect(result.created).toBe(true);
    expect(result.task.status).toBe('pending');
    expect(result.task.priority).toBe(1);
    expect(result.task.createdAt).toBeDefined();
  });

  test('merges data when task exists', async () => {
    await storage.upsert('t1', { status: 'pending', priority: 1 });
    const result = await storage.upsert('t1', { status: 'done' });
    expect(result.created).toBe(false);
    expect(result.task.status).toBe('done');
    expect(result.task.priority).toBe(1); // preserved from original
    expect(result.task.updatedAt).toBeDefined();
  });

  test('does not overwrite createdAt on update', async () => {
    await storage.upsert('t1', { status: 'pending' });
    const original = await storage.getTask('t1');
    await storage.upsert('t1', { status: 'done' });
    const updated = await storage.getTask('t1');
    expect(updated.createdAt).toBe(original.createdAt);
    expect(updated.updatedAt).toBeDefined();
  });

  test('handles concurrent upserts on different ids', async () => {
    const results = await Promise.all([
      storage.upsert('a', { val: 1 }),
      storage.upsert('b', { val: 2 }),
      storage.upsert('c', { val: 3 }),
    ]);
    expect(results.every(r => r.created)).toBe(true);
    expect((await storage.getTask('b')).val).toBe(2);
  });

  test('upsert same id twice: first create, second update', async () => {
    const r1 = await storage.upsert('x', { count: 0 });
    const r2 = await storage.upsert('x', { count: 5, label: 'updated' });
    expect(r1.created).toBe(true);
    expect(r2.created).toBe(false);
    expect(r2.task.count).toBe(5);
    expect(r2.task.label).toBe('updated');
  });
});

// ── F156: EventBus.emitWithMeta ─────────────────────
describe('F156: EventBus.emitWithMeta', () => {
  let bus;
  beforeEach(() => { bus = new EventBus(); });
  afterEach(() => { bus.clearHistory(); });

  test('subscribers receive meta object', () => {
    const received = [];
    bus.on('task:done', (event) => received.push(event));
    bus.emitWithMeta('task:done', { id: 1 }, { source: 'worker-1', priority: 'high' });
    expect(received).toHaveLength(1);
    expect(received[0].data).toEqual({ id: 1 });
    expect(received[0].meta).toEqual({ source: 'worker-1', priority: 'high' });
    expect(received[0].timestamp).toBeDefined();
  });

  test('default meta is empty object', () => {
    const received = [];
    bus.on('ch', (e) => received.push(e));
    bus.emitWithMeta('ch', 'hello');
    expect(received).toHaveLength(1);
    expect(received[0].meta).toEqual({});
  });

  test('meta object is cloned (not shared by reference)', () => {
    const received = [];
    bus.on('ch', (e) => received.push(e));
    const meta = { trace: 'abc' };
    bus.emitWithMeta('ch', 'data', meta);
    meta.trace = 'changed';
    expect(received[0].meta.trace).toBe('abc'); // original value preserved
  });

  test('works with wildcard (*) listener', () => {
    const all = [];
    bus.on('*', (e) => all.push(e));
    bus.emitWithMeta('a', 1, { scope: 'test' });
    bus.emitWithMeta('b', 2, { scope: 'prod' });
    expect(all).toHaveLength(2);
    expect(all[0].meta.scope).toBe('test');
    expect(all[1].meta.scope).toBe('prod');
  });

  test('stored in history with meta', () => {
    bus.emitWithMeta('x', 'data', { info: 42 });
    const last = bus.peek('x');
    expect(last.meta).toEqual({ info: 42 });
  });

  test('throws on non-object meta', () => {
    expect(() => bus.emitWithMeta('ch', 'data', 'not-object')).toThrow(TypeError);
    expect(() => bus.emitWithMeta('ch', 'data', null)).toThrow(TypeError);
  });

  test('returns true when emitted successfully', () => {
    expect(bus.emitWithMeta('ch', 'data', {})).toBe(true);
  });
});
