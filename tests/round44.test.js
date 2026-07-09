const { Cache } = require('../src/utils/cache');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { Storage } = require('../src/utils/storage');
const { EventBus } = require('../src/utils/event-bus');

describe('Round 44: F178-F180', () => {
  describe('F178: Cache.mpop(keys[])', () => {
    let cache;
    beforeEach(() => { cache = new Cache({ maxSize: 100 }); });
    afterEach(() => cache.destroy());

    it('pops multiple existing keys', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      const result = cache.mpop(['a', 'c']);
      expect(result).toEqual({ a: 1, c: 3 });
      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('b')).toBe(2);
      expect(cache.get('c')).toBeUndefined();
    });

    it('omits missing keys from result', () => {
      cache.set('x', 'hello');
      const result = cache.mpop(['x', 'missing', 'also-missing']);
      expect(result).toEqual({ x: 'hello' });
    });

    it('returns empty object for empty keys array', () => {
      expect(cache.mpop([])).toEqual({});
    });

    it('returns empty object when no keys exist', () => {
      expect(cache.mpop(['a', 'b'])).toEqual({});
    });

    it('handles mixed existing and expired keys', async () => {
      cache.set('fresh', 'val');
      cache.set('exp', 'old', 1);
      await new Promise(r => setTimeout(r, 10));
      const result = cache.mpop(['fresh', 'exp']);
      expect(result).toEqual({ fresh: 'val' });
    });
  });

  describe('F179: Storage.flatMap(field)', () => {
    let storage, tmpDir;
    beforeEach(async () => {
      tmpDir = path.join(os.tmpdir(), 'test-flatmap-' + Date.now());
      storage = new Storage(tmpDir);
      await storage.ensureDataDir();
      await storage.saveTask('t1', { tags: ['a', 'b'] });
      await storage.saveTask('t2', { tags: ['b', 'c'] });
      await storage.saveTask('t3', { tags: ['c', 'd'] });
      await storage.saveTask('t4', { noTags: true });
    });
    afterEach(async () => {
      await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it('flattens array fields across tasks', async () => {
      const tags = await storage.flatMap('tags');
      expect(tags).toEqual(['a', 'b', 'b', 'c', 'c', 'd']);
    });

    it('returns empty array when no tasks have the field as array', async () => {
      const result = await storage.flatMap('noTags');
      expect(result).toEqual([]);
    });

    it('returns empty array for nonexistent field', async () => {
      const result = await storage.flatMap('missing');
      expect(result).toEqual([]);
    });

    it('skips non-array values', async () => {
      await storage.saveTask('t5', { tags: 'not-an-array' });
      const tags = await storage.flatMap('tags');
      expect(tags).toEqual(['a', 'b', 'b', 'c', 'c', 'd']);
    });

    it('returns empty for empty storage', async () => {
      await storage.clear();
      const result = await storage.flatMap('tags');
      expect(result).toEqual([]);
    });
  });

  describe('F180: EventBus.forwardMany(pairs[])', () => {
    it('forwards multiple channels at once', () => {
      const bus1 = new EventBus();
      const bus2 = new EventBus();
      const received = [];
      bus2.on('a', e => received.push(['a', e.data]));
      bus2.on('b', e => received.push(['b', e.data]));

      bus1.forwardMany([
        { channel: 'a', targetBus: bus2 },
        { channel: 'b', targetBus: bus2 },
      ]);

      bus1.emit('a', 1);
      bus1.emit('b', 2);
      expect(received).toEqual([['a', 1], ['b', 2]]);
      bus1.removeAllListeners();
      bus2.removeAllListeners();
    });

    it('batch unsubscribe stops all forwards', () => {
      const bus1 = new EventBus();
      const bus2 = new EventBus();
      const received = [];
      bus2.on('x', e => received.push(e.data));
      bus2.on('y', e => received.push(e.data));

      const unsub = bus1.forwardMany([
        { channel: 'x', targetBus: bus2 },
        { channel: 'y', targetBus: bus2 },
      ]);

      unsub();
      bus1.emit('x', 1);
      bus1.emit('y', 2);
      expect(received).toEqual([]);
      bus1.removeAllListeners();
      bus2.removeAllListeners();
    });

    it('applies per-channel transforms', () => {
      const bus1 = new EventBus();
      const bus2 = new EventBus();
      const received = [];
      bus2.on('ev', e => received.push(e.data));

      bus1.forwardMany([
        { channel: 'ev', targetBus: bus2, transform: event => ({ doubled: event.data * 2 }) },
      ]);

      bus1.emit('ev', 5);
      expect(received).toEqual([{ doubled: 10 }]);
      bus1.removeAllListeners();
      bus2.removeAllListeners();
    });

    it('returns no-op for empty pairs array', () => {
      const bus1 = new EventBus();
      const unsub = bus1.forwardMany([]);
      expect(typeof unsub).toBe('function');
      unsub(); // should not throw
      bus1.removeAllListeners();
    });

    it('throws on invalid pair', () => {
      const bus1 = new EventBus();
      expect(() => bus1.forwardMany([{ channel: 'x', targetBus: null }])).toThrow(TypeError);
      bus1.removeAllListeners();
    });
  });
});
