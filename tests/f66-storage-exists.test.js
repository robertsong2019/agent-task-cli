const { Storage } = require('../src/utils/storage');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

describe('F66: Storage exists()', () => {
  let storage, tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'storage-test-'));
    storage = new Storage(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  test('returns false for non-existent task', async () => {
    expect(await storage.exists('no-such-id')).toBe(false);
  });

  test('returns true after saving task', async () => {
    await storage.saveTask('t1', { id: 't1', name: 'test' });
    expect(await storage.exists('t1')).toBe(true);
  });

  test('returns false after clearing all tasks', async () => {
    await storage.saveTask('t2', { id: 't2', name: 'test' });
    await storage.clear();
    expect(await storage.exists('t2')).toBe(false);
  });
});
