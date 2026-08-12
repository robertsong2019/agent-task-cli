const { PriorityQueue } = require('../src/utils/priority-queue');

describe('F236: PriorityQueue.getValues()', () => {
  test('returns items in priority order without wrapper', () => {
    const pq = new PriorityQueue();
    pq.enqueue('apple', 3);
    pq.enqueue('banana', 1);
    pq.enqueue('cherry', 2);

    const values = pq.getValues();
    expect(values).toEqual(['banana', 'cherry', 'apple']);
  });

  test('returns plain items, not {item, priority} objects', () => {
    const pq = new PriorityQueue();
    pq.enqueue({ name: 'task1' }, 5);
    pq.enqueue({ name: 'task2' }, 1);

    const values = pq.getValues();
    expect(values[0]).toEqual({ name: 'task2' });
    expect(values[1]).toEqual({ name: 'task1' });
    expect(values[0].priority).toBeUndefined();
  });

  test('returns empty array for empty queue', () => {
    const pq = new PriorityQueue();
    expect(pq.getValues()).toEqual([]);
  });

  test('preserves insertion order for equal priorities', () => {
    const pq = new PriorityQueue();
    pq.enqueue('first', 1);
    pq.enqueue('second', 1);
    pq.enqueue('third', 1);

    expect(pq.getValues()).toEqual(['first', 'second', 'third']);
  });

  test('does not mutate the queue', () => {
    const pq = new PriorityQueue();
    pq.enqueue('a', 3);
    pq.enqueue('b', 1);

    const snapshot = pq.getValues();
    expect(pq.size).toBe(2);
    expect(pq.dequeue()).toBe('b');
    expect(pq.dequeue()).toBe('a');
  });

  test('works with numeric items', () => {
    const pq = new PriorityQueue();
    pq.enqueue(100, 10);
    pq.enqueue(200, 5);
    pq.enqueue(50, 15);

    expect(pq.getValues()).toEqual([200, 100, 50]);
  });

  test('returns a new array (not internal reference)', () => {
    const pq = new PriorityQueue();
    pq.enqueue('x', 1);

    const arr1 = pq.getValues();
    arr1.push('injected');
    const arr2 = pq.getValues();
    expect(arr2).not.toContain('injected');
  });
});
