const { Storage } = require('../src/utils/storage');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

describe('F31: Storage countTasks', () => {
  let storage, tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'storage-test-'));
    storage = new Storage(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  test('returns 0 for empty storage', async () => {
    expect(await storage.countTasks()).toBe(0);
  });

  test('counts all tasks when no status filter', async () => {
    await storage.saveTask('1', { status: 'pending' });
    await storage.saveTask('2', { status: 'done' });
    expect(await storage.countTasks()).toBe(2);
  });

  test('counts tasks filtered by status', async () => {
    await storage.saveTask('1', { status: 'pending' });
    await storage.saveTask('2', { status: 'done' });
    await storage.saveTask('3', { status: 'pending' });
    expect(await storage.countTasks('pending')).toBe(2);
    expect(await storage.countTasks('done')).toBe(1);
  });

  test('returns 0 for non-existent status', async () => {
    await storage.saveTask('1', { status: 'pending' });
    expect(await storage.countTasks('archived')).toBe(0);
  });

  test('count updates after deletion', async () => {
    await storage.saveTask('1', { status: 'pending' });
    await storage.saveTask('2', { status: 'done' });
    expect(await storage.countTasks()).toBe(2);
    await storage.deleteTask('1');
    expect(await storage.countTasks()).toBe(1);
  });
});
