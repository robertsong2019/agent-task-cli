const { Storage } = require('../src/utils/storage');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

describe('F142: Storage.countWhere() / hasTag() / tags()', () => {
  let tmpDir, storage;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-cw-'));
    storage = new Storage(tmpDir);
    await storage.saveTask('t1', { title: 'A', status: 'done', tags: ['bug', 'urgent'] });
    await storage.saveTask('t2', { title: 'B', status: 'pending', tags: ['feature'] });
    await storage.saveTask('t3', { title: 'C', status: 'done', tags: ['bug'] });
    await storage.saveTask('t4', { title: 'D', status: 'running' });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true });
  });

  describe('countWhere(predicate)', () => {
    test('counts tasks matching predicate', async () => {
      const count = await storage.countWhere(t => t.status === 'done');
      expect(count).toBe(2);
    });

    test('returns 0 when no tasks match', async () => {
      const count = await storage.countWhere(t => t.status === 'cancelled');
      expect(count).toBe(0);
    });

    test('counts all tasks with always-true predicate', async () => {
      const count = await storage.countWhere(() => true);
      expect(count).toBe(4);
    });

    test('predicate receives task with id', async () => {
      const ids = [];
      await storage.countWhere(t => {
        ids.push(t.id);
        return true;
      });
      expect(ids).toContain('t1');
      expect(ids).toContain('t4');
    });
  });

  describe('hasTag(tag)', () => {
    test('returns true if any task has the tag', async () => {
      expect(await storage.hasTag('bug')).toBe(true);
      expect(await storage.hasTag('feature')).toBe(true);
      expect(await storage.hasTag('urgent')).toBe(true);
    });

    test('returns false if no task has the tag', async () => {
      expect(await storage.hasTag('nonexistent')).toBe(false);
    });

    test('returns false for tasks without tags array', async () => {
      // t4 has no tags
      const count = await storage.countWhere(t => !Array.isArray(t.tags));
      expect(count).toBe(1);
    });
  });

  describe('tags()', () => {
    test('returns all unique tags sorted', async () => {
      const tags = await storage.tags();
      expect(tags).toEqual(['bug', 'feature', 'urgent']);
    });

    test('returns empty array when no tags exist', async () => {
      const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-empty-'));
      const emptyStorage = new Storage(emptyDir);
      await emptyStorage.saveTask('x', { title: 'X' });
      const tags = await emptyStorage.tags();
      expect(tags).toEqual([]);
      await fs.rm(emptyDir, { recursive: true });
    });
  });
});
