const { Cache } = require('../src/utils/cache');
const { Storage } = require('../src/utils/storage');
const { EventBus } = require('../src/utils/event-bus');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('F125: Cache.lock(key, fn)', () => {
  test('returns fn result', async () => {
    const c = new Cache();
    c.set('x', 10);
    const result = await c.lock('x', async () => c.get('x') * 2);
    expect(result).toBe(20);
  });

  test('serializes concurrent access', async () => {
    const c = new Cache();
    c.set('counter', 0);
    const ops = [];
    for (let i = 0; i < 10; i++) {
      ops.push(c.lock('counter', async () => {
        const v = c.get('counter');
        c.set('counter', v + 1);
      }));
    }
    await Promise.all(ops);
    expect(c.get('counter')).toBe(10);
  });

  test('releases lock on error', async () => {
    const c = new Cache();
    await expect(c.lock('k', () => { throw new Error('boom'); })).rejects.toThrow('boom');
    // Should be able to lock again
    const r = await c.lock('k', () => 42);
    expect(r).toBe(42);
  });
});

describe('F126: Storage.distinct(field)', () => {
  let tmpDir, storage;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'storage-distinct-'));
    storage = new Storage(tmpDir);
    await storage.saveTask('t1', { id: 't1', status: 'pending', tag: 'a' });
    await storage.saveTask('t2', { id: 't2', status: 'done', tag: 'a' });
    await storage.saveTask('t3', { id: 't3', status: 'pending', tag: 'b' });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('returns unique values for a field', async () => {
    const vals = (await storage.distinct('status')).sort();
    expect(vals).toEqual(['done', 'pending']);
  });

  test('returns unique tag values', async () => {
    const vals = (await storage.distinct('tag')).sort();
    expect(vals).toEqual(['a', 'b']);
  });

  test('returns empty for missing field', async () => {
    const vals = await storage.distinct('nonexistent');
    expect(vals).toEqual([]);
  });
});

describe('F127: EventBus.channels()', () => {
  test('returns empty when no subscribers', () => {
    const bus = new EventBus();
    expect(bus.channels()).toEqual([]);
  });

  test('returns channels with subscribers', () => {
    const bus = new EventBus();
    bus.on('alpha', () => {});
    bus.on('beta', () => {});
    expect(bus.channels().sort()).toEqual(['alpha', 'beta']);
  });

  test('removes channel after unsubscribe', () => {
    const bus = new EventBus();
    const unsub = bus.on('temp', () => {});
    expect(bus.channels()).toEqual(['temp']);
    unsub();
    expect(bus.channels()).toEqual([]);
  });

  test('does not include wildcard', () => {
    const bus = new EventBus();
    bus.on('*', () => {});
    bus.on('real', () => {});
    expect(bus.channels()).toEqual(['real']);
  });
});
