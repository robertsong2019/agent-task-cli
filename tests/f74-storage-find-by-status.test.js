const { Storage } = require('../src/utils/storage');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

describe('F74: Storage.findByStatus(status)', () => {
  let storage, tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'storage-f74-'));
    storage = new Storage(tmpDir);
    await storage.saveTask('t1', { status: 'running', name: 'A' });
    await storage.saveTask('t2', { status: 'done', name: 'B' });
    await storage.saveTask('t3', { status: 'running', name: 'C' });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  test('returns tasks matching status', async () => {
    const running = await storage.findByStatus('running');
    expect(running).toHaveLength(2);
    const names = running.map(t => t.name).sort();
    expect(names).toEqual(['A', 'C']);
  });

  test('returns empty array for non-existent status', async () => {
    const failed = await storage.findByStatus('failed');
    expect(failed).toEqual([]);
  });

  test('returns single match', async () => {
    const done = await storage.findByStatus('done');
    expect(done).toHaveLength(1);
    expect(done[0].name).toBe('B');
    expect(done[0].id).toBe('t2');
  });
});
