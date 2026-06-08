import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Cache } from '../src/utils/cache.js';
import { Storage } from '../src/utils/storage.js';
import { EventBus } from '../src/utils/event-bus.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('F115: Cache.watch()', () => {
  it('fires callback on set', () => {
    const cache = new Cache();
    const events = [];
    cache.watch('k', e => events.push(e));
    cache.set('k', 42);
    assert.equal(events.length, 1);
    assert.deepEqual(events[0], { key: 'k', event: 'set', value: 42 });
    cache.destroy();
  });

  it('fires callback on delete', () => {
    const cache = new Cache();
    const events = [];
    cache.set('k', 1);
    cache.watch('k', e => events.push(e));
    cache.delete('k');
    assert.equal(events.length, 1);
    assert.equal(events[0].event, 'delete');
    assert.equal(events[0].value, 1);
    cache.destroy();
  });

  it('unwatch stops notifications', () => {
    const cache = new Cache();
    const events = [];
    const unwatch = cache.watch('k', e => events.push(e));
    cache.set('k', 1);
    unwatch();
    cache.set('k', 2);
    assert.equal(events.length, 1);
    cache.destroy();
  });

  it('multiple watchers on same key', () => {
    const cache = new Cache();
    const a = [], b = [];
    cache.watch('k', e => a.push(e));
    cache.watch('k', e => b.push(e));
    cache.set('k', 'hello');
    assert.equal(a.length, 1);
    assert.equal(b.length, 1);
    cache.destroy();
  });
});

describe('F116+F117: Storage.min() / max()', () => {
  let dir;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'store-test-')); });

  it('min() returns minimum of numeric field', async () => {
    const storage = new Storage(dir);
    await storage.saveTask('a', { id: 'a', priority: 3 });
    await storage.saveTask('b', { id: 'b', priority: 1 });
    await storage.saveTask('c', { id: 'c', priority: 5 });
    assert.equal(await storage.min('priority'), 1);
  });

  it('max() returns maximum of numeric field', async () => {
    const storage = new Storage(dir);
    await storage.saveTask('a', { id: 'a', priority: 3 });
    await storage.saveTask('b', { id: 'b', priority: 7 });
    assert.equal(await storage.max('priority'), 7);
  });

  it('returns null for empty storage', async () => {
    const storage = new Storage(dir);
    assert.equal(await storage.min('priority'), null);
    assert.equal(await storage.max('priority'), null);
  });

  it('ignores non-numeric values', async () => {
    const storage = new Storage(dir);
    await storage.saveTask('a', { id: 'a', priority: 3, name: 'test' });
    assert.equal(await storage.min('name'), null);
    assert.equal(await storage.max('priority'), 3);
  });
});

describe('F118: EventBus.last()', () => {
  it('returns last event for channel', () => {
    const bus = new EventBus();
    bus.emit('ch', 1);
    bus.emit('ch', 2);
    bus.emit('other', 99);
    bus.emit('ch', 3);
    const last = bus.last('ch');
    assert.equal(last.length, 1);
    assert.equal(last[0].data, 3);
  });

  it('returns last N events', () => {
    const bus = new EventBus();
    bus.emit('ch', 'a');
    bus.emit('ch', 'b');
    bus.emit('ch', 'c');
    const last = bus.last('ch', 2);
    assert.equal(last.length, 2);
    assert.equal(last[0].data, 'b');
    assert.equal(last[1].data, 'c');
  });

  it('returns empty array for unknown channel', () => {
    const bus = new EventBus();
    assert.deepEqual(bus.last('nope'), []);
  });
});
