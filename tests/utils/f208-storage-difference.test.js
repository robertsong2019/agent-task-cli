const { Storage } = require('../../src/utils/storage');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

describe('F208: Storage.difference(otherStorage)', () => {
  let tmpDir1, tmpDir2, storage1, storage2;

  beforeEach(async () => {
    tmpDir1 = await fs.mkdtemp(path.join(os.tmpdir(), 'stor1-'));
    tmpDir2 = await fs.mkdtemp(path.join(os.tmpdir(), 'stor2-'));
    storage1 = new Storage(tmpDir1);
    storage2 = new Storage(tmpDir2);
  });

  afterEach(async () => {
    await fs.rm(tmpDir1, { recursive: true, force: true });
    await fs.rm(tmpDir2, { recursive: true, force: true });
  });

  test('returns IDs in self but not in other', async () => {
    await storage1.create('task-a', { status: 'pending' });
    await storage1.create('task-b', { status: 'pending' });
    await storage1.create('task-c', { status: 'pending' });

    await storage2.create('task-b', { status: 'pending' });

    const diff = await storage1.difference(storage2);
    expect(diff.sort()).toEqual(['task-a', 'task-c']);
  });

  test('returns empty array when all IDs match', async () => {
    await storage1.create('x1', { status: 'done' });
    await storage2.create('x1', { status: 'done' });

    const diff = await storage1.difference(storage2);
    expect(diff).toEqual([]);
  });

  test('returns all IDs when other is empty', async () => {
    await storage1.create('a', {});
    await storage1.create('b', {});

    const diff = await storage1.difference(storage2);
    expect(diff.sort()).toEqual(['a', 'b']);
  });

  test('returns empty array when self is empty', async () => {
    await storage2.create('a', {});

    const diff = await storage1.difference(storage2);
    expect(diff).toEqual([]);
  });

  test('handles completely disjoint sets', async () => {
    await storage1.create('p1', {});
    await storage1.create('p2', {});
    await storage2.create('q1', {});
    await storage2.create('q2', {});

    const diff = await storage1.difference(storage2);
    expect(diff.sort()).toEqual(['p1', 'p2']);
  });

  test('asymmetric: self.difference(other) != other.difference(self)', async () => {
    await storage1.create('shared', {});
    await storage1.create('only1', {});
    await storage2.create('shared', {});
    await storage2.create('only2', {});

    const diff1 = await storage1.difference(storage2);
    const diff2 = await storage2.difference(storage1);

    expect(diff1).toEqual(['only1']);
    expect(diff2).toEqual(['only2']);
  });

  test('works with many tasks', async () => {
    for (let i = 0; i < 50; i++) {
      await storage1.create(`task-${i}`, { idx: i });
      if (i % 2 === 0) {
        await storage2.create(`task-${i}`, { idx: i });
      }
    }

    const diff = await storage1.difference(storage2);
    // Odd-numbered tasks should be in the difference
    expect(diff.length).toBe(25);
    expect(diff).toContain('task-1');
    expect(diff).toContain('task-49');
    expect(diff).not.toContain('task-0');
  });
});
