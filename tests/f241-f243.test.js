/**
 * F241: Storage.updateWhere(predicate, updates) — SQL UPDATE ... WHERE semantics.
 * F242: PriorityQueue.priorities() — distinct priorities, sorted ascending.
 * F243: PriorityQueue.enqueueAll(items, priority) — bulk enqueue.
 */
const { Storage } = require('../src/utils/storage');
const { PriorityQueue } = require('../src/utils/priority-queue');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('F241: Storage.updateWhere', () => {
  let storage, dir;

  beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'f241-'));
    storage = new Storage(dir);
    await storage.saveTask('a', { status: 'todo', priority: 1, tags: ['x'] });
    await storage.saveTask('b', { status: 'done', priority: 2, tags: ['y'] });
    await storage.saveTask('c', { status: 'todo', priority: 3, tags: ['x', 'y'] });
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  test('updates all matching tasks and returns count', async () => {
    const n = await storage.updateWhere(t => t.status === 'todo', { status: 'archived' });
    expect(n).toBe(2);
    expect((await storage.getTask('a')).status).toBe('archived');
    expect((await storage.getTask('c')).status).toBe('archived');
    expect((await storage.getTask('b')).status).toBe('done'); // untouched
  });

  test('returns 0 and writes nothing when nothing matches', async () => {
    const n = await storage.updateWhere(t => t.status === 'nope', { status: 'zzz' });
    expect(n).toBe(0);
    expect(await storage.getTask('a')).toMatchObject({ status: 'todo' });
  });

  test('merges updates without dropping other fields', async () => {
    await storage.updateWhere(t => t.priority >= 2, { owner: 'bot' });
    const b = await storage.getTask('b');
    expect(b).toMatchObject({ owner: 'bot', status: 'done', priority: 2, tags: ['y'] });
  });

  test('predicate receives task object including id', async () => {
    const seen = [];
    await storage.updateWhere(t => { seen.push(t.id); return false; }, {});
    expect(seen.sort()).toEqual(['a', 'b', 'c']);
  });

  test('throws TypeError on non-function predicate / non-object updates', async () => {
    await expect(storage.updateWhere(null, {})).rejects.toThrow(TypeError);
    await expect(storage.updateWhere(() => true, 'nope')).rejects.toThrow(TypeError);
    await expect(storage.updateWhere(() => true, [1])).rejects.toThrow(TypeError);
  });
});

describe('F242: PriorityQueue.priorities', () => {
  test('returns distinct priorities sorted ascending', () => {
    const pq = new PriorityQueue();
    pq.enqueue('x', 9); pq.enqueue('y', 1); pq.enqueue('z', 9); pq.enqueue('w', 5);
    expect(pq.priorities()).toEqual([1, 5, 9]);
  });

  test('empty queue returns []', () => {
    expect(new PriorityQueue().priorities()).toEqual([]);
  });

  test('reflects state after dequeue', () => {
    const pq = new PriorityQueue();
    pq.enqueue('a', 1); pq.enqueue('b', 2);
    pq.dequeue(); // removes priority-1 item
    expect(pq.priorities()).toEqual([2]);
  });

  test('single item returns single-element array', () => {
    const pq = new PriorityQueue();
    pq.enqueue('only', 7);
    expect(pq.priorities()).toEqual([7]);
  });

  test('default priority (5) included when used', () => {
    const pq = new PriorityQueue();
    pq.enqueue('d1'); pq.enqueue('d2');
    expect(pq.priorities()).toEqual([5]);
  });
});

describe('F243: PriorityQueue.enqueueAll', () => {
  test('bulk-enqueues all items at given priority, returns new size', () => {
    const pq = new PriorityQueue();
    pq.enqueue('first', 1);
    const size = pq.enqueueAll(['a', 'b', 'c'], 3);
    expect(size).toBe(4);
    expect(pq.toArray().length).toBe(4);
  });

  test('dequeue order respects priority across bulk and single enqueues', () => {
    const pq = new PriorityQueue();
    pq.enqueueAll(['mid1', 'mid2'], 5);
    pq.enqueue('urgent', 1);
    pq.enqueueAll(['late1', 'late2'], 9);
    expect(pq.drain()).toEqual(['urgent', 'mid1', 'mid2', 'late1', 'late2']);
  });

  test('empty array is a no-op returning current size', () => {
    const pq = new PriorityQueue();
    pq.enqueue('solo', 2);
    expect(pq.enqueueAll([])).toBe(1);
  });

  test('throws TypeError on non-array items', () => {
    expect(() => new PriorityQueue().enqueueAll('nope')).toThrow(TypeError);
  });
});
