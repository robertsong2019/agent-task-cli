const { PriorityQueue } = require('../src/utils/priority-queue');
const { ConcurrencyManager } = require('../src/utils/concurrency-manager');

describe('F189: PriorityQueue.contains()', () => {
  let pq;
  beforeEach(() => { pq = new PriorityQueue(); });

  test('returns false for empty queue', () => {
    expect(pq.contains('x')).toBe(false);
  });

  test('returns true for existing item (reference equality)', () => {
    const obj = { id: 1 };
    pq.enqueue(obj, 3);
    expect(pq.contains(obj)).toBe(true);
  });

  test('returns false for non-existing item', () => {
    pq.enqueue({ id: 1 }, 3);
    expect(pq.contains({ id: 1 })).toBe(false); // different reference
  });

  test('uses custom comparator', () => {
    pq.enqueue({ id: 1 }, 3);
    pq.enqueue({ id: 2 }, 5);
    expect(pq.contains({ id: 2 }, (x) => x.id === 2)).toBe(true);
    expect(pq.contains({ id: 99 }, (x) => x.id === 99)).toBe(false);
  });

  test('works after drain', () => {
    pq.enqueue('a', 1);
    pq.drain();
    expect(pq.contains('a')).toBe(false);
  });

  test('works with primitives', () => {
    pq.enqueue(42, 1);
    pq.enqueue('hello', 2);
    expect(pq.contains(42)).toBe(true);
    expect(pq.contains('hello')).toBe(true);
    expect(pq.contains('world')).toBe(false);
  });
});

describe('F190: PriorityQueue.updatePriority()', () => {
  let pq;
  beforeEach(() => { pq = new PriorityQueue(); });

  test('updates priority of existing item', () => {
    pq.enqueue('low', 5);
    pq.enqueue('high', 1);
    expect(pq.peek()).toBe('high');

    expect(pq.updatePriority('low', 0)).toBe(true);
    expect(pq.peek()).toBe('low'); // now highest priority
  });

  test('returns false for non-existing item', () => {
    expect(pq.updatePriority('missing', 1)).toBe(false);
  });

  test('throws TypeError for non-number priority', () => {
    pq.enqueue('x', 1);
    expect(() => pq.updatePriority('x', 'high')).toThrow(TypeError);
  });

  test('uses custom comparator', () => {
    pq.enqueue({ id: 1 }, 5);
    pq.enqueue({ id: 2 }, 3);
    expect(pq.updatePriority({ id: 1 }, 0, (x) => x.id === 1)).toBe(true);
    expect(pq.peek().id).toBe(1);
  });

  test('re-sorts correctly after update', () => {
    pq.enqueue('a', 3);
    pq.enqueue('b', 2);
    pq.enqueue('c', 1);
    // Original order: c(1), b(2), a(3)
    expect(pq.toArray()).toEqual(['c', 'b', 'a']);

    pq.updatePriority('c', 5);
    // New order: b(2), a(3), c(5)
    expect(pq.toArray()).toEqual(['b', 'a', 'c']);
  });

  test('preserves FIFO for same priority after update', () => {
    pq.enqueue('a', 1);
    pq.enqueue('b', 1);
    // Both priority 1, 'a' was enqueued first
    pq.updatePriority('a', 1); // same priority, no effective change
    expect(pq.toArray()).toEqual(['a', 'b']);
  });
});

describe('F191: ConcurrencyManager.getQueuedIds()', () => {
  test('returns empty array when queue is empty', () => {
    const cm = new ConcurrencyManager({ maxConcurrent: 1 });
    expect(cm.getQueuedIds()).toEqual([]);
  });

  test('returns IDs of queued tasks', async () => {
    const cm = new ConcurrencyManager({ maxConcurrent: 1 });
    // Block the single slot with a controllable promise
    let resolveBlocker;
    const blocker = new Promise(resolve => { resolveBlocker = resolve; });
    const execPromise = cm.execute(async () => blocker, 'task-active');

    // Now queue two more tasks
    const p2 = cm.execute(async () => 2, 'task-queued-1');
    const p3 = cm.execute(async () => 3, 'task-queued-2');

    // Let event loop settle so queued tasks register
    await new Promise(r => setTimeout(r, 10));

    expect(cm.getQueuedIds()).toEqual(['task-queued-1', 'task-queued-2']);

    // Cleanup
    resolveBlocker();
    await Promise.all([execPromise, p2, p3]);
  });

  test('excludes tasks without IDs', async () => {
    const cm = new ConcurrencyManager({ maxConcurrent: 1 });
    let resolveBlocker;
    const blocker = new Promise(resolve => { resolveBlocker = resolve; });
    const execPromise = cm.execute(async () => blocker, 'blocking');

    // Queue task without ID
    const p2 = cm.execute(async () => 42);
    const p3 = cm.execute(async () => 99, 'with-id');

    await new Promise(r => setTimeout(r, 10));

    expect(cm.getQueuedIds()).toEqual(['with-id']);

    resolveBlocker();
    await Promise.all([execPromise, p2, p3]);
  });

  test('updates dynamically as queue changes', async () => {
    const cm = new ConcurrencyManager({ maxConcurrent: 1 });
    let resolveBlocker;
    const blocker = new Promise(resolve => { resolveBlocker = resolve; });
    const execPromise = cm.execute(async () => blocker, 'blocker');

    const p2 = cm.execute(async () => 1, 'q1');
    await new Promise(r => setTimeout(r, 10));
    expect(cm.getQueuedIds()).toEqual(['q1']);

    const p3 = cm.execute(async () => 2, 'q2');
    await new Promise(r => setTimeout(r, 10));
    expect(cm.getQueuedIds()).toEqual(['q1', 'q2']);

    // Cancel q1
    cm.cancelQueued('q1');
    expect(cm.getQueuedIds()).toEqual(['q2']);

    resolveBlocker();
    await Promise.all([execPromise, p2.catch(() => {}), p3]);
  });
});
