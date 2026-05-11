const { Cache } = require('../src/utils/cache');
const { EventBus } = require('../src/utils/event-bus');
const fs = require('fs');
const path = require('path');
const os = require('os');

// F61: Cache.nonExpiredSize
describe('F61: Cache.nonExpiredSize', () => {
  test('returns 0 for empty cache', () => {
    const c = new Cache();
    expect(c.nonExpiredSize).toBe(0);
  });

  test('counts non-expired entries', () => {
    const c = new Cache({ defaultTTL: 10000 });
    c.set('a', 1);
    c.set('b', 2);
    expect(c.nonExpiredSize).toBe(2);
  });

  test('excludes expired entries', () => {
    const c = new Cache({ defaultTTL: 1 });
    c.set('x', 'val');
    // Manually expire
    c.cache.get('x').expiresAt = Date.now() - 1;
    c.set('y', 'val2');
    expect(c.nonExpiredSize).toBe(1);
  });
});

// F62: Storage.findRecent
describe('F62: Storage.findRecent', () => {
  let dir, storage;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'storage-test-'));
    const { Storage } = require('../src/utils/storage');
    storage = new Storage(dir);
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('returns empty array when no tasks', async () => {
    const recent = await storage.findRecent(5);
    expect(recent).toEqual([]);
  });

  test('returns tasks sorted by updatedAt desc', async () => {
    await storage.saveTask('1', { status: 'done', updatedAt: 100 });
    await storage.saveTask('2', { status: 'pending', updatedAt: 300 });
    await storage.saveTask('3', { status: 'done', updatedAt: 200 });
    const recent = await storage.findRecent(2);
    expect(recent).toHaveLength(2);
    expect(recent[0].id).toBe('2');
    expect(recent[1].id).toBe('3');
  });

  test('respects count limit', async () => {
    for (let i = 0; i < 10; i++) {
      await storage.saveTask(String(i), { status: 'ok', updatedAt: i * 10 });
    }
    const recent = await storage.findRecent(3);
    expect(recent).toHaveLength(3);
    expect(recent[0].id).toBe('9');
  });
});

// F63: EventBus.peek
describe('F63: EventBus.peek', () => {
  test('returns null when no events emitted', () => {
    const bus = new EventBus();
    expect(bus.peek('test')).toBeNull();
  });

  test('returns last event for channel', () => {
    const bus = new EventBus({ maxHistory: 100 });
    bus.emit('ch', { v: 1 });
    bus.emit('ch', { v: 2 });
    const ev = bus.peek('ch');
    expect(ev.data.v).toBe(2);
  });

  test('ignores events from other channels', () => {
    const bus = new EventBus({ maxHistory: 100 });
    bus.emit('other', { v: 99 });
    bus.emit('target', { v: 1 });
    bus.emit('other', { v: 98 });
    const ev = bus.peek('target');
    expect(ev.data.v).toBe(1);
  });

  test('returns null for channel with no history', () => {
    const bus = new EventBus();
    bus.emit('a', {});
    expect(bus.peek('b')).toBeNull();
  });
});
