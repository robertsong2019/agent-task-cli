const { Cache } = require('../src/utils/cache');
const { EventBus } = require('../src/utils/event-bus');
const { Storage } = require('../src/utils/storage');
const fs = require('fs');
const path = require('path');
const os = require('os');

// F100: Cache.merge
describe('Cache.merge (F100)', () => {
  test('merges object into existing cached value', () => {
    const c = new Cache();
    c.set('obj', { a: 1, b: 2 });
    expect(c.merge('obj', { b: 3, c: 4 })).toBe(true);
    expect(c.get('obj')).toEqual({ a: 1, b: 3, c: 4 });
  });

  test('returns false for missing key', () => {
    const c = new Cache();
    expect(c.merge('missing', { x: 1 })).toBe(false);
  });

  test('returns false for non-object value', () => {
    const c = new Cache();
    c.set('num', 42);
    expect(c.merge('num', { x: 1 })).toBe(false);
  });

  test('returns false for null value', () => {
    const c = new Cache();
    c.set('nil', null);
    expect(c.merge('nil', { x: 1 })).toBe(false);
  });

  test('returns false for array value', () => {
    const c = new Cache();
    c.set('arr', [1, 2]);
    expect(c.merge('arr', { x: 1 })).toBe(false);
  });

  test('updates TTL when provided', () => {
    const c = new Cache();
    c.set('obj', { a: 1 });
    c.merge('obj', { b: 2 }, 1000);
    const entry = c.cache.get('obj');
    expect(entry.expiresAt).toBeGreaterThan(Date.now());
  });
});

// F101: Storage.ids
describe('Storage.ids (F101)', () => {
  let tmpDir, storage;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'storage-ids-'));
    storage = new Storage(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('returns empty array when no tasks', async () => {
    const ids = await storage.ids();
    expect(ids).toEqual([]);
  });

  test('returns all task IDs', async () => {
    await storage.saveTask('t1', { name: 'A' });
    await storage.saveTask('t2', { name: 'B' });
    const ids = await storage.ids();
    expect(ids.sort()).toEqual(['t1', 't2']);
  });
});

// F102: EventBus.relay
describe('EventBus.relay (F102)', () => {
  test('forwards all events without filter', () => {
    const bus1 = new EventBus();
    const bus2 = new EventBus();
    const received = [];
    bus2.on('click', (event) => received.push(event.data));
    bus1.relay('click', bus2);
    bus1.emit('click', { x: 1 });
    expect(received).toEqual([{ x: 1 }]);
  });

  test('filters events with predicate', () => {
    const bus1 = new EventBus();
    const bus2 = new EventBus();
    const received = [];
    bus2.on('msg', (event) => received.push(event.data));
    bus1.relay('msg', bus2, (data) => data.important);
    bus1.emit('msg', { important: true, text: 'yes' });
    bus1.emit('msg', { important: false, text: 'no' });
    expect(received).toEqual([{ important: true, text: 'yes' }]);
  });

  test('unsubscribe stops forwarding', () => {
    const bus1 = new EventBus();
    const bus2 = new EventBus();
    const received = [];
    bus2.on('x', (event) => received.push(event.data));
    const unsub = bus1.relay('x', bus2);
    bus1.emit('x', 'a');
    unsub();
    bus1.emit('x', 'b');
    expect(received).toEqual(['a']);
  });
});
