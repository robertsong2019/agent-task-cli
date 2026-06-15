const { PriorityQueue } = require('../src/utils/priority-queue');

describe('F138: PriorityQueue.peekAt(n) — peek at Nth item', () => {
  let pq;

  beforeEach(() => {
    pq = new PriorityQueue();
  });

  test('returns the item at index 0 (same as peek)', () => {
    pq.enqueue('a', 1);
    pq.enqueue('b', 5);
    expect(pq.peekAt(0)).toBe('a');
  });

  test('returns the item at arbitrary index', () => {
    pq.enqueue('a', 1);
    pq.enqueue('b', 3);
    pq.enqueue('c', 5);
    expect(pq.peekAt(1)).toBe('b');
    expect(pq.peekAt(2)).toBe('c');
  });

  test('returns undefined for out-of-bounds index', () => {
    pq.enqueue('a', 1);
    expect(pq.peekAt(1)).toBeUndefined();
    expect(pq.peekAt(99)).toBeUndefined();
  });

  test('returns undefined for empty queue', () => {
    expect(pq.peekAt(0)).toBeUndefined();
  });

  test('does not mutate the queue', () => {
    pq.enqueue('x', 2);
    pq.enqueue('y', 4);
    pq.peekAt(0);
    pq.peekAt(1);
    expect(pq.size).toBe(2);
    expect(pq.dequeue()).toBe('x');
    expect(pq.dequeue()).toBe('y');
  });

  test('throws RangeError for negative index', () => {
    expect(() => pq.peekAt(-1)).toThrow(RangeError);
  });

  test('throws RangeError for non-integer index', () => {
    expect(() => pq.peekAt(1.5)).toThrow(RangeError);
  });

  test('respects priority ordering in peekAt', () => {
    pq.enqueue('low', 9);
    pq.enqueue('high', 1);
    pq.enqueue('mid', 5);
    expect(pq.peekAt(0)).toBe('high');
    expect(pq.peekAt(1)).toBe('mid');
    expect(pq.peekAt(2)).toBe('low');
  });
});
