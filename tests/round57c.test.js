/**
 * Round 57 Part 3: PriorityQueue.frontPriority/toSortedArray/getByPriority
 *           + ConcurrencyManager.pendingCount/isIdle
 */
const { PriorityQueue } = require('../src/utils/priority-queue');
const { ConcurrencyManager } = require('../src/utils/concurrency-manager');

// --- PriorityQueue.frontPriority ---
describe('PriorityQueue.frontPriority', () => {
  test('returns priority of front item', () => {
    const pq = new PriorityQueue();
    pq.enqueue('low', 5);
    pq.enqueue('high', 1);
    expect(pq.frontPriority()).toBe(1);
  });

  test('returns undefined for empty queue', () => {
    const pq = new PriorityQueue();
    expect(pq.frontPriority()).toBeUndefined();
  });
});

// --- PriorityQueue.toSortedArray ---
describe('PriorityQueue.toSortedArray', () => {
  test('returns items in priority order', () => {
    const pq = new PriorityQueue();
    pq.enqueue('c', 3);
    pq.enqueue('a', 1);
    pq.enqueue('b', 2);
    expect(pq.toSortedArray()).toEqual(['a', 'b', 'c']);
  });

  test('returns empty array for empty queue', () => {
    expect(new PriorityQueue().toSortedArray()).toEqual([]);
  });

  test('does not modify the queue', () => {
    const pq = new PriorityQueue();
    pq.enqueue('x', 1);
    pq.enqueue('y', 2);
    pq.toSortedArray();
    expect(pq.size).toBe(2);
    expect(pq.dequeue()).toBe('x');
  });
});

// --- PriorityQueue.getByPriority ---
describe('PriorityQueue.getByPriority', () => {
  test('returns all items with matching priority', () => {
    const pq = new PriorityQueue();
    pq.enqueue('a1', 1);
    pq.enqueue('b1', 1);
    pq.enqueue('c2', 2);
    expect(pq.getByPriority(1)).toEqual(['a1', 'b1']);
    expect(pq.getByPriority(2)).toEqual(['c2']);
  });

  test('returns empty array for non-matching priority', () => {
    const pq = new PriorityQueue();
    pq.enqueue('x', 1);
    expect(pq.getByPriority(99)).toEqual([]);
  });

  test('returns empty array for empty queue', () => {
    expect(new PriorityQueue().getByPriority(0)).toEqual([]);
  });
});

// --- ConcurrencyManager.pendingCount ---
describe('ConcurrencyManager.pendingCount', () => {
  test('returns 0 when idle', () => {
    const cm = new ConcurrencyManager({ maxConcurrent: 2 });
    expect(cm.pendingCount()).toBe(0);
  });

  test('returns queued task count', async () => {
    const cm = new ConcurrencyManager({ maxConcurrent: 1 });
    // Start a long task to occupy the slot
    const p1 = cm.execute(() => new Promise(r => setTimeout(r, 200)));
    // Queue a second task
    const p2 = cm.execute(() => 'fast');
    // Give it a tick to settle
    await new Promise(r => setTimeout(r, 10));
    expect(cm.pendingCount()).toBeGreaterThanOrEqual(1);
    await Promise.all([p1, p2]);
  });
});

// --- ConcurrencyManager.isIdle ---
describe('ConcurrencyManager.isIdle', () => {
  test('returns true when no tasks running or queued', () => {
    const cm = new ConcurrencyManager({ maxConcurrent: 2 });
    expect(cm.isIdle()).toBe(true);
  });

  test('returns false when task is running', async () => {
    const cm = new ConcurrencyManager({ maxConcurrent: 1 });
    const p = cm.execute(() => new Promise(r => setTimeout(r, 100)));
    await new Promise(r => setTimeout(r, 10));
    expect(cm.isIdle()).toBe(false);
    await p;
    // After completion
    await new Promise(r => setTimeout(r, 10));
    expect(cm.isIdle()).toBe(true);
  });
});
