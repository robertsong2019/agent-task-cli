const { PriorityQueue } = require('../src/utils/priority-queue');

describe('F227: PriorityQueue.merge()', () => {
  test('merges items from another queue, preserving priority order', () => {
    const pq1 = new PriorityQueue();
    const pq2 = new PriorityQueue();
    pq1.enqueue('a', 1);
    pq1.enqueue('c', 3);
    pq2.enqueue('b', 2);
    pq2.enqueue('d', 4);

    const count = pq1.merge(pq2);

    expect(count).toBe(2);
    expect(pq1.size).toBe(4);
    expect(pq1.toArray()).toEqual(['a', 'b', 'c', 'd']);
  });

  test('empties the source queue after merge', () => {
    const pq1 = new PriorityQueue();
    const pq2 = new PriorityQueue();
    pq2.enqueue('x', 1);
    pq2.enqueue('y', 2);

    pq1.merge(pq2);

    expect(pq2.size).toBe(0);
    expect(pq2.isEmpty()).toBe(true);
  });

  test('returns 0 when merging an empty queue', () => {
    const pq1 = new PriorityQueue();
    const pq2 = new PriorityQueue();
    pq1.enqueue('a', 1);

    const count = pq1.merge(pq2);

    expect(count).toBe(0);
    expect(pq1.size).toBe(1);
  });

  test('merges into empty queue', () => {
    const pq1 = new PriorityQueue();
    const pq2 = new PriorityQueue();
    pq2.enqueue('a', 3);
    pq2.enqueue('b', 1);

    const count = pq1.merge(pq2);

    expect(count).toBe(2);
    expect(pq1.toArray()).toEqual(['b', 'a']);
  });

  test('preserves FIFO order for same priority across queues', () => {
    const pq1 = new PriorityQueue();
    const pq2 = new PriorityQueue();
    pq1.enqueue('first', 5);
    pq2.enqueue('second', 5);

    pq1.merge(pq2);

    // pq1's item was enqueued first (lower seq), so should come first
    expect(pq1.toArray()).toEqual(['first', 'second']);
  });

  test('throws TypeError when argument is not a PriorityQueue', () => {
    const pq = new PriorityQueue();
    expect(() => pq.merge({})).toThrow(TypeError);
    expect(() => pq.merge(null)).toThrow(TypeError);
    expect(() => pq.merge([])).toThrow(TypeError);
  });
});
