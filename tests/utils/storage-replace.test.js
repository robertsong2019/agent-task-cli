const { Storage } = require('../../src/utils/storage');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('Storage F205: replace(id, data)', () => {
  let storage, tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'storage-test-'));
    storage = new Storage(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('replaces existing task entirely, preserving id and createdAt', async () => {
    await storage.saveTask('old-task', { status: 'pending', tag: 'v1', createdAt: '2026-01-01T00:00:00Z' });
    const old = await storage.replace('old-task', { status: 'done', tag: 'v2', extra: true });
    expect(old.status).toBe('pending');
    expect(old.tag).toBe('v1');
    const updated = await storage.loadTasks();
    const task = updated['old-task'];
    expect(task.status).toBe('done');
    expect(task.tag).toBe('v2');
    expect(task.extra).toBe(true);
    // createdAt preserved
    expect(task.createdAt).toBe('2026-01-01T00:00:00Z');
  });

  test('returns null for non-existent task', async () => {
    const result = await storage.replace('nope', { status: 'done' });
    expect(result).toBeNull();
  });

  test('updatedAt is set on replacement', async () => {
    await storage.saveTask('t1', { status: 'pending', createdAt: '2026-01-01T00:00:00Z' });
    await storage.replace('t1', { status: 'done' });
    const tasks = await storage.loadTasks();
    expect(tasks['t1'].updatedAt).toBeTruthy();
  });

  test('fields from old data are fully removed (not merged)', async () => {
    await storage.saveTask('t2', { status: 'pending', tempField: 'remove-me', createdAt: '2026-01-01T00:00:00Z' });
    await storage.replace('t2', { status: 'done' });
    const tasks = await storage.loadTasks();
    expect(tasks['t2'].tempField).toBeUndefined();
  });

  test('preserves createdAt even if data includes a different one', async () => {
    await storage.saveTask('t3', { status: 'pending', createdAt: '2026-01-01T00:00:00Z' });
    await storage.replace('t3', { status: 'done', createdAt: '1999-01-01T00:00:00Z' });
    const tasks = await storage.loadTasks();
    expect(tasks['t3'].createdAt).toBe('2026-01-01T00:00:00Z');
  });

  test('replace with empty object leaves only id, createdAt, updatedAt', async () => {
    await storage.saveTask('t4', { status: 'pending', data: 'lots', createdAt: '2026-01-01T00:00:00Z' });
    await storage.replace('t4', {});
    const tasks = await storage.loadTasks();
    const task = tasks['t4'];
    expect(task.id).toBe('t4'); // replace preserves the id
    expect(task.status).toBeUndefined();
    expect(task.data).toBeUndefined();
    expect(task.createdAt).toBe('2026-01-01T00:00:00Z');
    expect(task.updatedAt).toBeTruthy();
  });
});
