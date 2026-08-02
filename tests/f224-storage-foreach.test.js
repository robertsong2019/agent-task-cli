const { Storage } = require('../src/utils/storage');
const fs = require('fs').promises;
const path = require('path');

describe('F224: Storage.forEach()', () => {
  let storage;
  const tmpDir = path.join(__dirname, '..', 'tmp-test-foreach');

  beforeEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    storage = new Storage(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  test('iterates all tasks', async () => {
    await storage.saveTask('t1', { name: 'Alpha' });
    await storage.saveTask('t2', { name: 'Beta' });
    await storage.saveTask('t3', { name: 'Gamma' });

    const names = [];
    const count = await storage.forEach((task) => {
      names.push(task.name);
    });

    expect(count).toBe(3);
    expect(names.sort()).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  test('callback receives (task, id)', async () => {
    await storage.saveTask('x1', { val: 10 });

    const ids = [];
    await storage.forEach((task, id) => {
      ids.push(id);
    });

    expect(ids).toEqual(['x1']);
  });

  test('returning false stops iteration early', async () => {
    await storage.saveTask('a', { n: 1 });
    await storage.saveTask('b', { n: 2 });
    await storage.saveTask('c', { n: 3 });
    await storage.saveTask('d', { n: 4 });

    const visited = [];
    const count = await storage.forEach((task) => {
      visited.push(task.n);
      if (visited.length >= 2) return false;
    });

    expect(count).toBe(2);
    expect(visited.length).toBe(2);
  });

  test('returns 0 for empty storage', async () => {
    const count = await storage.forEach(() => {});
    expect(count).toBe(0);
  });

  test('handles async save between iterations', async () => {
    await storage.saveTask('s1', { v: 'first' });
    await storage.saveTask('s2', { v: 'second' });

    const collected = [];
    await storage.forEach((task) => {
      collected.push(task.v);
    });

    expect(collected).toContain('first');
    expect(collected).toContain('second');
  });

  test('works with tasks that have complex nested data', async () => {
    await storage.saveTask('complex', {
      meta: { tags: ['a', 'b'], priority: 5 },
      data: { items: [1, 2, 3] }
    });

    let found = null;
    await storage.forEach((task) => {
      found = task;
    });

    expect(found.meta.tags).toEqual(['a', 'b']);
    expect(found.data.items).toEqual([1, 2, 3]);
  });
});
