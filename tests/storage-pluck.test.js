const { Storage } = require('../src/utils/storage');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('Storage.pluck (F113)', () => {
  let tmpDir, storage;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'storage-pluck-'));
    storage = new Storage(tmpDir);
    await storage.saveTask('t1', { id: 't1', status: 'pending', priority: 5, tags: ['a'] });
    await storage.saveTask('t2', { id: 't2', status: 'running', priority: 3, tags: ['b'] });
    await storage.saveTask('t3', { id: 't3', status: 'done', priority: 1 });
  });

  afterEach(async () => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('extracts a single field from all tasks', async () => {
    const statuses = await storage.pluck('status');
    expect(statuses.sort()).toEqual(['done', 'pending', 'running']);
  });

  test('extracts numeric field', async () => {
    const priorities = await storage.pluck('priority');
    expect(priorities.sort()).toEqual([1, 3, 5]);
  });

  test('extracts complex field (array)', async () => {
    const tags = await storage.pluck('tags');
    expect(tags).toHaveLength(2);
    expect(tags).toContainEqual(['a']);
    expect(tags).toContainEqual(['b']);
  });

  test('skips tasks where field is undefined', async () => {
    const tags = await storage.pluck('tags');
    expect(tags).toHaveLength(2); // t3 has no tags
  });

  test('returns empty array for nonexistent field', async () => {
    const result = await storage.pluck('nonexistent');
    expect(result).toEqual([]);
  });

  test('returns empty array when no tasks exist', async () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'empty-pluck-'));
    const emptyStorage = new Storage(emptyDir);
    const result = await emptyStorage.pluck('status');
    expect(result).toEqual([]);
    fs.rmSync(emptyDir, { recursive: true, force: true });
  });

  test('handles null values correctly', async () => {
    await storage.saveTask('t4', { id: 't4', status: null });
    const statuses = await storage.pluck('status');
    // null !== undefined so it should be included
    expect(statuses).toContain(null);
  });
});
