const { Storage } = require('../src/utils/storage');
const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir, storage;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'storage-test-'));
  storage = new Storage(tmpDir);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('F152: Storage.rename(id, newId)', () => {
  test('renames existing task', async () => {
    await storage.saveTask('old', { name: 'task1', status: 'pending' });
    const result = await storage.rename('old', 'new');
    expect(result).toBe(true);
    expect(await storage.exists('old')).toBe(false);
    expect(await storage.exists('new')).toBe(true);
    const task = await storage.getTask('new');
    expect(task.name).toBe('task1');
  });

  test('returns false when source does not exist', async () => {
    const result = await storage.rename('missing', 'new');
    expect(result).toBe(false);
  });

  test('returns false when target already exists', async () => {
    await storage.saveTask('a', { name: 'A' });
    await storage.saveTask('b', { name: 'B' });
    const result = await storage.rename('a', 'b');
    expect(result).toBe(false);
    // Both original tasks preserved
    expect(await storage.getTask('a')).toEqual({ name: 'A' });
    expect(await storage.getTask('b')).toEqual({ name: 'B' });
  });

  test('returns false for same id', async () => {
    await storage.saveTask('x', { name: 'X' });
    const result = await storage.rename('x', 'x');
    expect(result).toBe(false);
  });

  test('returns false for empty/null ids', async () => {
    expect(await storage.rename('', 'b')).toBe(false);
    expect(await storage.rename('a', '')).toBe(false);
    expect(await storage.rename(null, 'b')).toBe(false);
  });

  test('preserves all task data after rename', async () => {
    const data = { name: 'complex', status: 'running', tags: ['a', 'b'], nested: { x: 1 } };
    await storage.saveTask('orig', data);
    await storage.rename('orig', 'renamed');
    const task = await storage.getTask('renamed');
    expect(task).toEqual(data);
  });

  test('handles concurrent rename + read (lock safety)', async () => {
    await storage.saveTask('task1', { name: 'T1' });
    const [renameResult, listResult] = await Promise.all([
      storage.rename('task1', 'task2'),
      storage.listTasks(),
    ]);
    expect(renameResult).toBe(true);
    expect(listResult).toBeDefined();
  });
});
