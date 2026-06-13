const { Cache } = require('../src/utils/cache');
const { EventBus } = require('../src/utils/event-bus');
const { Storage } = require('../src/utils/storage');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ─── F130: Cache.copy ───
describe('F130: Cache.copy', () => {
  let cache;
  beforeEach(() => { cache = new Cache({ defaultTTL: 1000 }); });

  test('copies value to a new key', () => {
    cache.set('a', { x: 1 });
    expect(cache.copy('a', 'b')).toBe(true);
    expect(cache.get('b')).toEqual({ x: 1 });
  });

  test('returns false for non-existent source key', () => {
    expect(cache.copy('nope', 'b')).toBe(false);
    expect(cache.get('b')).toBeUndefined();
  });

  test('returns false for expired source key', (done) => {
    cache.set('a', 42, 50);
    setTimeout(() => {
      expect(cache.copy('a', 'b')).toBe(false);
      done();
    }, 60);
  });

  test('overwrites existing destination key', () => {
    cache.set('a', 'new');
    cache.set('b', 'old');
    cache.copy('a', 'b');
    expect(cache.get('b')).toBe('new');
  });

  test('accepts explicit new TTL', (done) => {
    cache.set('a', 'data', 500);
    cache.copy('a', 'b', 100);
    setTimeout(() => {
      expect(cache.get('b')).toBeUndefined(); // expired
      expect(cache.get('a')).toBe('data');   // still alive
      done();
    }, 120);
  });

  test('inherits remaining TTL when no ttl passed', (done) => {
    cache.set('a', 'data', 200);
    setTimeout(() => {
      cache.copy('a', 'b'); // ~150ms remaining
      expect(cache.get('b')).toBe('data');
    }, 50);
    setTimeout(() => {
      expect(cache.get('b')).toBeUndefined(); // should expire with source
      done();
    }, 250);
  });

  test('works with null TTL (never expires)', () => {
    cache.set('a', 'forever', null);
    expect(cache.copy('a', 'b')).toBe(true);
    expect(cache.get('b')).toBe('forever');
  });
});


// ─── F131: EventBus.before ───
describe('F131: EventBus.before', () => {
  let bus;
  beforeEach(() => { bus = new EventBus(); });

  test('fires before subscribers', () => {
    const order = [];
    bus.before('test', () => { order.push('before'); });
    bus.on('test', () => { order.push('on'); });
    bus.emit('test', { v: 1 });
    expect(order).toEqual(['before', 'on']);
  });

  test('can cancel emission by returning false', () => {
    let subscriberCalled = false;
    bus.before('cancel', () => false);
    bus.on('cancel', () => { subscriberCalled = true; });
    bus.emit('cancel', {});
    expect(subscriberCalled).toBe(false);
  });

  test('does not cancel when returning undefined', () => {
    let called = false;
    bus.before('ok', () => {});
    bus.on('ok', () => { called = true; });
    bus.emit('ok', {});
    expect(called).toBe(true);
  });

  test('supports multiple before hooks in order', () => {
    const order = [];
    bus.before('multi', () => { order.push(1); });
    bus.before('multi', () => { order.push(2); });
    bus.on('multi', () => { order.push(3); });
    bus.emit('multi', {});
    expect(order).toEqual([1, 2, 3]);
  });

  test('unsubscribe stops the before hook', () => {
    let calls = 0;
    const unsub = bus.before('rem', () => { calls++; });
    bus.emit('rem', {});
    unsub();
    bus.emit('rem', {});
    expect(calls).toBe(1);
  });

  test('can mutate data before subscribers see it', () => {
    let received;
    bus.before('mut', (ch, data) => { data.modified = true; });
    bus.on('mut', (event) => { received = event.data; });
    bus.emit('mut', { v: 1 });
    expect(received.modified).toBe(true);
  });

  test('only fires for the registered channel', () => {
    let aCalls = 0;
    bus.before('chanA', () => { aCalls++; });
    bus.emit('chanB', {});
    expect(aCalls).toBe(0);
  });
});


// ─── F132: Storage.avg ───
describe('F132: Storage.avg', () => {
  let dir, storage;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'storage-test-'));
    storage = new Storage(dir);
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('returns 0 for empty storage', async () => {
    expect(await storage.avg('price')).toBe(0);
  });

  test('returns average of numeric field', async () => {
    await storage.saveTask('t1', { price: 10 });
    await storage.saveTask('t2', { price: 20 });
    await storage.saveTask('t3', { price: 30 });
    expect(await storage.avg('price')).toBe(20);
  });

  test('skips non-numeric values', async () => {
    await storage.saveTask('t1', { price: 10 });
    await storage.saveTask('t2', { price: 'expensive' });
    await storage.saveTask('t3', { price: 30 });
    expect(await storage.avg('price')).toBe(20);
  });

  test('skips missing fields', async () => {
    await storage.saveTask('t1', { price: 10 });
    await storage.saveTask('t2', { name: 'no price' });
    await storage.saveTask('t3', { price: 20 });
    expect(await storage.avg('price')).toBe(15);
  });

  test('handles negative numbers', async () => {
    await storage.saveTask('t1', { delta: -5 });
    await storage.saveTask('t2', { delta: 15 });
    expect(await storage.avg('delta')).toBe(5);
  });

  test('returns 0 when field exists but no numeric values', async () => {
    await storage.saveTask('t1', { name: 'a' });
    await storage.saveTask('t2', { name: 'b' });
    expect(await storage.avg('name')).toBe(0);
  });

  test('handles NaN values gracefully', async () => {
    await storage.saveTask('t1', { val: NaN });
    await storage.saveTask('t2', { val: 42 });
    expect(await storage.avg('val')).toBe(42);
  });

  test('works with float values', async () => {
    await storage.saveTask('t1', { rating: 3.5 });
    await storage.saveTask('t2', { rating: 4.5 });
    expect(await storage.avg('rating')).toBeCloseTo(4.0);
  });
});
