const { PriorityQueue } = require('../src/utils/priority-queue');

describe('PriorityQueue', () => {
  it('enqueues and dequeues in priority order', () => {
    const pq = new PriorityQueue();
    pq.enqueue('low', 3);
    pq.enqueue('high', 1);
    pq.enqueue('mid', 2);
    expect(pq.dequeue()).toBe('high');
    expect(pq.dequeue()).toBe('mid');
    expect(pq.dequeue()).toBe('low');
  });

  it('maintains FIFO for equal priorities', () => {
    const pq = new PriorityQueue();
    pq.enqueue('a', 1);
    pq.enqueue('b', 1);
    expect(pq.dequeue()).toBe('a');
    expect(pq.dequeue()).toBe('b');
  });

  it('returns undefined when dequeuing from empty queue', () => {
    const pq = new PriorityQueue();
    expect(pq.dequeue()).toBeUndefined();
  });

  it('reports correct size', () => {
    const pq = new PriorityQueue();
    expect(pq.size).toBe(0);
    pq.enqueue('x', 1);
    expect(pq.size).toBe(1);
    pq.dequeue();
    expect(pq.size).toBe(0);
  });

  it('peek returns highest priority without removing', () => {
    const pq = new PriorityQueue();
    pq.enqueue('first', 5);
    pq.enqueue('second', 1);
    expect(pq.peek()).toBe('second');
    expect(pq.size).toBe(2);
  });

  it('handles objects as items', () => {
    const pq = new PriorityQueue();
    pq.enqueue({ name: 'task-a', priority: 3 }, 3);
    pq.enqueue({ name: 'task-b', priority: 1 }, 1);
    const item = pq.dequeue();
    expect(item.name).toBe('task-b');
  });

  it('clear removes all items', () => {
    const pq = new PriorityQueue();
    pq.enqueue('a', 1);
    pq.enqueue('b', 2);
    pq.clear();
    expect(pq.size).toBe(0);
    expect(pq.dequeue()).toBeUndefined();
  });

  it('toArray returns items sorted by priority', () => {
    const pq = new PriorityQueue();
    pq.enqueue('c', 3);
    pq.enqueue('a', 1);
    pq.enqueue('b', 2);
    expect(pq.toArray()).toEqual(['a', 'b', 'c']);
  });
});
