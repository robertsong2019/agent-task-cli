const { Storage } = require('../../src/utils/storage');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('F209: Storage.upsertMany(records)', () => {
  let storage, tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'storage-test-'));
    storage = new Storage(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('creates all new records when storage is empty', async () => {
    const records = {
      't1': { status: 'pending', title: 'Task 1' },
      't2': { status: 'pending', title: 'Task 2' },
    };
    const result = await storage.upsertMany(records);
    expect(result.created).toHaveLength(2);
    expect(result.updated).toHaveLength(0);
    const tasks = await storage.loadTasks();
    expect(tasks['t1']).toBeDefined();
    expect(tasks['t2']).toBeDefined();
  });

  test('updates existing records', async () => {
    await storage.create('t1', { status: 'pending', title: 'Old' });
    const records = {
      't1': { status: 'done' },
      't2': { status: 'pending', title: 'New' },
    };
    const result = await storage.upsertMany(records);
    expect(result.created).toEqual(['t2']);
    expect(result.updated).toEqual(['t1']);
    const tasks = await storage.loadTasks();
    expect(tasks['t1'].status).toBe('done');
    expect(tasks['t1'].title).toBe('Old'); // merge, not replace
    expect(tasks['t2']).toBeDefined();
  });

  test('sets updatedAt on updates, createdAt on creates', async () => {
    await storage.create('t1', { status: 'pending' });
    const result = await storage.upsertMany({ 't1': { status: 'done' }, 't2': { status: 'new' } });
    const tasks = await storage.loadTasks();
    expect(tasks['t1'].updatedAt).toBeDefined();
    expect(tasks['t2'].createdAt).toBeDefined();
  });

  test('handles empty records object', async () => {
    const result = await storage.upsertMany({});
    expect(result.created).toHaveLength(0);
    expect(result.updated).toHaveLength(0);
  });

  test('handles all-existing records', async () => {
    await storage.create('t1', { val: 1 });
    await storage.create('t2', { val: 2 });
    const result = await storage.upsertMany({
      't1': { val: 10 },
      't2': { val: 20 },
    });
    expect(result.created).toHaveLength(0);
    expect(result.updated).toHaveLength(2);
    const tasks = await storage.loadTasks();
    expect(tasks['t1'].val).toBe(10);
    expect(tasks['t2'].val).toBe(20);
  });

  test('preserves existing fields not in update (merge behavior)', async () => {
    await storage.create('t1', { status: 'pending', priority: 'high', tags: ['a', 'b'] });
    await storage.upsertMany({ 't1': { status: 'done' } });
    const tasks = await storage.loadTasks();
    expect(tasks['t1'].priority).toBe('high');
    expect(tasks['t1'].tags).toEqual(['a', 'b']);
    expect(tasks['t1'].status).toBe('done');
  });

  test('handles large batch (100 records)', async () => {
    const records = {};
    for (let i = 0; i < 100; i++) {
      records[`task-${i}`] = { index: i };
    }
    const result = await storage.upsertMany(records);
    expect(result.created).toHaveLength(100);
    const tasks = await storage.loadTasks();
    expect(Object.keys(tasks)).toHaveLength(100);
  });
});
