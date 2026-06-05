const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { Storage } = require('../../src/utils/storage');

describe('Storage F107: groupBy(field)', () => {
  let tmpDir, storage;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), 'test-storage-' + Date.now());
    storage = new Storage(tmpDir);
    await storage.ensureDataDir();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  test('groups tasks by status field', async () => {
    await storage.saveTask('1', { id: '1', status: 'pending', name: 'A' });
    await storage.saveTask('2', { id: '2', status: 'done', name: 'B' });
    await storage.saveTask('3', { id: '3', status: 'pending', name: 'C' });

    const groups = await storage.groupBy('status');
    expect(groups.pending).toHaveLength(2);
    expect(groups.done).toHaveLength(1);
    expect(groups.pending.map(t => t.id)).toEqual(expect.arrayContaining(['1', '3']));
  });

  test('groups with null for missing field', async () => {
    await storage.saveTask('1', { id: '1', status: 'active' });
    await storage.saveTask('2', { id: '2' }); // no status field

    const groups = await storage.groupBy('status');
    expect(groups.active).toHaveLength(1);
    expect(groups.null).toHaveLength(1);
  });

  test('returns empty object for no tasks', async () => {
    const groups = await storage.groupBy('status');
    expect(groups).toEqual({});
  });

  test('groups by priority field', async () => {
    await storage.saveTask('1', { id: '1', priority: 'high' });
    await storage.saveTask('2', { id: '2', priority: 'low' });
    await storage.saveTask('3', { id: '3', priority: 'high' });
    await storage.saveTask('4', { id: '4', priority: 'medium' });

    const groups = await storage.groupBy('priority');
    expect(Object.keys(groups)).toHaveLength(3);
    expect(groups.high).toHaveLength(2);
    expect(groups.low).toHaveLength(1);
    expect(groups.medium).toHaveLength(1);
  });

  test('converts non-string field values to string keys', async () => {
    await storage.saveTask('1', { id: '1', count: 5 });
    await storage.saveTask('2', { id: '2', count: 5 });
    await storage.saveTask('3', { id: '3', count: 10 });

    const groups = await storage.groupBy('count');
    expect(groups['5']).toHaveLength(2);
    expect(groups['10']).toHaveLength(1);
  });
});
