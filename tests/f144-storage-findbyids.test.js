const { Storage } = require('../src/utils/storage');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

describe('F144: Storage.findByIds() / toggleTag()', () => {
  let tmpDir, storage;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-fb-'));
    storage = new Storage(tmpDir);
    await storage.saveTask('t1', { title: 'A', tags: ['x'] });
    await storage.saveTask('t2', { title: 'B', tags: ['y'] });
    await storage.saveTask('t3', { title: 'C' });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true });
  });

  describe('findByIds(ids)', () => {
    test('returns tasks in input order', async () => {
      const tasks = await storage.findByIds(['t3', 't1', 't2']);
      expect(tasks).toHaveLength(3);
      expect(tasks[0].title).toBe('C');
      expect(tasks[1].title).toBe('A');
      expect(tasks[2].title).toBe('B');
    });

    test('skips missing IDs', async () => {
      const tasks = await storage.findByIds(['t1', 'nope', 't3']);
      expect(tasks).toHaveLength(2);
      expect(tasks[0].id).toBe('t1');
      expect(tasks[1].id).toBe('t3');
    });

    test('returns empty array for no matches', async () => {
      const tasks = await storage.findByIds(['x', 'y']);
      expect(tasks).toEqual([]);
    });

    test('returns empty array for empty input', async () => {
      const tasks = await storage.findByIds([]);
      expect(tasks).toEqual([]);
    });

    test('preserves duplicate IDs', async () => {
      const tasks = await storage.findByIds(['t1', 't1']);
      expect(tasks).toHaveLength(2);
    });
  });

  describe('toggleTag(id, tag)', () => {
    test('adds tag when missing', async () => {
      const added = await storage.toggleTag('t1', 'new');
      expect(added).toBe(true);
      const task = await storage.getTask('t1');
      expect(task.tags).toContain('new');
    });

    test('removes tag when present', async () => {
      const removed = await storage.toggleTag('t1', 'x');
      expect(removed).toBe(false);
      const task = await storage.getTask('t1');
      expect(task.tags).not.toContain('x');
    });

    test('creates tags array if missing', async () => {
      // t3 has no tags
      const added = await storage.toggleTag('t3', 'first');
      expect(added).toBe(true);
      const task = await storage.getTask('t3');
      expect(task.tags).toEqual(['first']);
    });

    test('throws for non-existent task', async () => {
      await expect(storage.toggleTag('nope', 'x')).rejects.toThrow('Task not found');
    });
  });
});
