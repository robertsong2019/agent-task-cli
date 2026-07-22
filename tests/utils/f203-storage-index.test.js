const { Storage } = require('../../src/utils/storage');
const path = require('path');
const fs = require('fs');
const os = require('os');

describe('F203: Storage.ensureIndex / findByIndex', () => {
  let storage, tmpDir;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'storage-test-'));
    storage = new Storage(tmpDir);
    // Seed with test data
    await storage.saveTask('t1', { id: 't1', status: 'pending', priority: 'high' });
    await storage.saveTask('t2', { id: 't2', status: 'done', priority: 'low' });
    await storage.saveTask('t3', { id: 't3', status: 'pending', priority: 'high' });
    await storage.saveTask('t4', { id: 't4', status: 'done', priority: 'medium' });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('ensureIndex builds index for a field', async () => {
    const index = await storage.ensureIndex('status');
    expect(index).toBeInstanceOf(Map);
    expect(index.has('pending')).toBe(true);
    expect(index.has('done')).toBe(true);
    expect(index.get('pending').size).toBe(2);
    expect(index.get('done').size).toBe(2);
  });

  test('ensureIndex returns cached index on second call', async () => {
    const idx1 = await storage.ensureIndex('status');
    const idx2 = await storage.ensureIndex('status');
    expect(idx1).toBe(idx2); // same object reference
  });

  test('findByIndex returns matching tasks', async () => {
    await storage.ensureIndex('status');
    const pending = await storage.findByIndex('status', 'pending');
    expect(pending).toHaveLength(2);
    expect(pending.map(t => t.id).sort()).toEqual(['t1', 't3']);
  });

  test('findByIndex returns empty for non-matching value', async () => {
    await storage.ensureIndex('status');
    const result = await storage.findByIndex('status', 'nonexistent');
    expect(result).toEqual([]);
  });

  test('findByIndex throws if no index exists', async () => {
    await expect(storage.findByIndex('nonexistent_field', 'val'))
      .rejects.toThrow(/No index for field/);
  });

  test('indexes different fields independently', async () => {
    await storage.ensureIndex('status');
    await storage.ensureIndex('priority');
    const highPri = await storage.findByIndex('priority', 'high');
    expect(highPri).toHaveLength(2);
    const done = await storage.findByIndex('status', 'done');
    expect(done).toHaveLength(2);
  });

  test('index handles numeric values by stringifying', async () => {
    const s2 = new Storage(fs.mkdtempSync(path.join(os.tmpdir(), 'st-')));
    await s2.saveTask('n1', { id: 'n1', count: 42 });
    await s2.saveTask('n2', { id: 'n2', count: 42 });
    await s2.saveTask('n3', { id: 'n3', count: 99 });
    await s2.ensureIndex('count');
    const result = await s2.findByIndex('count', 42);
    expect(result).toHaveLength(2);
  });
});
