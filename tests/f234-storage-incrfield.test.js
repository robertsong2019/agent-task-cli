const { Storage } = require('../src/utils/storage');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');

describe('F234: Storage.incrField(id, field, delta=1)', () => {
  let tmpDir;
  let storage;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `atc-f234-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    storage = new Storage(tmpDir);
    await storage.ensureDataDir();
  });

  afterEach(async () => {
    try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch {}
  });

  test('increments a numeric field by 1 (default delta)', async () => {
    await storage.saveTask('t1', { count: 5, name: 'task1' });
    const result = await storage.incrField('t1', 'count');
    expect(result).toBe(6);
    const task = await storage.getTask('t1');
    expect(task.count).toBe(6);
  });

  test('increments with custom delta', async () => {
    await storage.saveTask('t1', { views: 10 });
    const result = await storage.incrField('t1', 'views', 5);
    expect(result).toBe(15);
    expect((await storage.getTask('t1')).views).toBe(15);
  });

  test('increments with negative delta (decrement)', async () => {
    await storage.saveTask('t1', { stock: 8 });
    const result = await storage.incrField('t1', 'stock', -3);
    expect(result).toBe(5);
  });

  test('creates field if it does not exist (starts from 0)', async () => {
    await storage.saveTask('t1', { name: 'task1' });
    const result = await storage.incrField('t1', 'newCounter');
    expect(result).toBe(1);
    expect((await storage.getTask('t1')).newCounter).toBe(1);
  });

  test('creates field with custom delta if not existing', async () => {
    await storage.saveTask('t1', { name: 'task1' });
    const result = await storage.incrField('t1', 'score', 10);
    expect(result).toBe(10);
  });

  test('returns null for non-existent task', async () => {
    const result = await storage.incrField('nonexistent', 'count');
    expect(result).toBeNull();
  });

  test('throws TypeError when existing field value is non-numeric', async () => {
    await storage.saveTask('t1', { name: 'task1' });
    await expect(storage.incrField('t1', 'name')).rejects.toThrow(TypeError);
  });

  test('handles float deltas', async () => {
    await storage.saveTask('t1', { price: 10.5 });
    const result = await storage.incrField('t1', 'price', 0.25);
    expect(result).toBeCloseTo(10.75);
  });

  test('preserves other fields on the task', async () => {
    await storage.saveTask('t1', { count: 1, name: 'original', tags: ['a', 'b'] });
    await storage.incrField('t1', 'count', 5);
    const task = await storage.getTask('t1');
    expect(task.name).toBe('original');
    expect(task.tags).toEqual(['a', 'b']);
  });

  test('is atomic — concurrent increments all apply', async () => {
    await storage.saveTask('t1', { count: 0 });
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(storage.incrField('t1', 'count'));
    }
    await Promise.all(promises);
    const task = await storage.getTask('t1');
    expect(task.count).toBe(10);
  });
});
