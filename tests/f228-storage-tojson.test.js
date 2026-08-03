const { Storage } = require('../src/utils/storage');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('F228: Storage.toJSON()', () => {
  let tmpDir, storage;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'storage-test-'));
    storage = new Storage(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('serializes all tasks to JSON string', async () => {
    await storage.saveTask('t1', { id: 't1', title: 'Task 1', status: 'pending' });
    await storage.saveTask('t2', { id: 't2', title: 'Task 2', status: 'done' });

    const json = await storage.toJSON();
    const parsed = JSON.parse(json);

    expect(parsed.t1.title).toBe('Task 1');
    expect(parsed.t2.status).toBe('done');
    expect(Object.keys(parsed)).toHaveLength(2);
  });

  test('returns empty object JSON for no tasks', async () => {
    const json = await storage.toJSON();
    expect(JSON.parse(json)).toEqual({});
  });

  test('filters to specified fields only', async () => {
    await storage.saveTask('t1', { id: 't1', title: 'Task 1', status: 'pending', priority: 5 });
    await storage.saveTask('t2', { id: 't2', title: 'Task 2', status: 'done', priority: 3 });

    const json = await storage.toJSON(['title']);
    const parsed = JSON.parse(json);

    expect(parsed.t1).toEqual({ title: 'Task 1' });
    expect(parsed.t2).toEqual({ title: 'Task 2' });
    expect(parsed.t1.status).toBeUndefined();
    expect(parsed.t1.priority).toBeUndefined();
  });

  test('omits undefined fields when filtering', async () => {
    await storage.saveTask('t1', { id: 't1', title: 'Task 1', status: 'pending' });

    const json = await storage.toJSON(['title', 'nonexistent']);
    const parsed = JSON.parse(json);

    expect(parsed.t1).toEqual({ title: 'Task 1' });
    expect(parsed.t1.nonexistent).toBeUndefined();
  });

  test('handles large number of tasks', async () => {
    for (let i = 0; i < 50; i++) {
      await storage.saveTask(`t${i}`, { id: `t${i}`, index: i });
    }

    const json = await storage.toJSON();
    const parsed = JSON.parse(json);

    expect(Object.keys(parsed)).toHaveLength(50);
    expect(parsed.t49.index).toBe(49);
  });
});
