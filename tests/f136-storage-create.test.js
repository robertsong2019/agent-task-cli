const { Storage } = require('../src/utils/storage');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('F136: Storage.create(id, data) — NX pattern', () => {
  let tmpDir, storage;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'storage-test-'));
    storage = new Storage(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('creates a new task when id does not exist', async () => {
    const result = await storage.create('t1', { name: 'Task 1', status: 'pending' });
    expect(result).toBe(true);
    const task = await storage.getTask('t1');
    expect(task).toEqual({ name: 'Task 1', status: 'pending' });
  });

  test('returns false when id already exists', async () => {
    await storage.create('t1', { name: 'Original' });
    const result = await storage.create('t1', { name: 'Overwrite' });
    expect(result).toBe(false);
    const task = await storage.getTask('t1');
    expect(task.name).toBe('Original');
  });

  test('works when tasks file does not exist yet', async () => {
    const result = await storage.create('first', { priority: 1 });
    expect(result).toBe(true);
    expect(await storage.getTask('first')).toEqual({ priority: 1 });
  });

  test('handles concurrent create calls for same id — only one succeeds', async () => {
    const [r1, r2, r3] = await Promise.all([
      storage.create('race', { v: 1 }),
      storage.create('race', { v: 2 }),
      storage.create('race', { v: 3 }),
    ]);
    const successes = [r1, r2, r3].filter(r => r === true);
    expect(successes.length).toBe(1);
  });

  test('create multiple distinct ids all succeed', async () => {
    expect(await storage.create('a', { n: 1 })).toBe(true);
    expect(await storage.create('b', { n: 2 })).toBe(true);
    expect(await storage.create('c', { n: 3 })).toBe(true);
    const all = await storage.listTasks();
    expect(all.length).toBe(3);
    expect(all.map(t => t.n).sort()).toEqual([1, 2, 3]);
  });
});
