const { Storage } = require('../src/utils/storage');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('F231: Storage.getField(id, field, default?)', () => {
  let storage;
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'storage-test-'));
    storage = new Storage(tmpDir);
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  test('gets a single field from existing task', async () => {
    await storage.saveTask('t1', { name: 'Task One', status: 'pending', priority: 5 });
    expect(await storage.getField('t1', 'status')).toBe('pending');
  });

  test('gets a numeric field', async () => {
    await storage.saveTask('t1', { count: 42, name: 'task' });
    expect(await storage.getField('t1', 'count')).toBe(42);
  });

  test('returns defaultValue when task does not exist', async () => {
    expect(await storage.getField('nonexistent', 'name', 'N/A')).toBe('N/A');
  });

  test('returns undefined when field does not exist on task', async () => {
    await storage.saveTask('t1', { name: 'Task One' });
    expect(await storage.getField('t1', 'missingField')).toBeUndefined();
  });

  test('returns defaultValue when field does not exist', async () => {
    await storage.saveTask('t1', { name: 'Task One' });
    expect(await storage.getField('t1', 'missing', 'fallback')).toBe('fallback');
  });

  test('handles complex field values (arrays)', async () => {
    await storage.saveTask('t1', { tags: ['urgent', 'bug'], name: 'task' });
    expect(await storage.getField('t1', 'tags')).toEqual(['urgent', 'bug']);
  });

  test('handles null field values', async () => {
    await storage.saveTask('t1', { value: null, name: 'task' });
    // null !== undefined, so getField returns null
    expect(await storage.getField('t1', 'value')).toBeNull();
  });

  test('default defaultValue is undefined', async () => {
    await storage.saveTask('t1', { name: 'task' });
    expect(await storage.getField('t1', 'nonexistent')).toBeUndefined();
  });
});
