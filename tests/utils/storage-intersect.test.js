const { Storage } = require('../../src/utils/storage');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('F213: Storage.intersect(otherStorage)', () => {
  let dir1, dir2, s1, s2;

  beforeEach(() => {
    dir1 = fs.mkdtempSync(path.join(os.tmpdir(), 'store1-'));
    dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'store2-'));
    s1 = new Storage(dir1);
    s2 = new Storage(dir2);
  });

  afterEach(() => {
    fs.rmSync(dir1, { recursive: true, force: true });
    fs.rmSync(dir2, { recursive: true, force: true });
  });

  test('returns IDs present in both storages', async () => {
    await s1.saveTask('a', { name: 'A' });
    await s1.saveTask('b', { name: 'B' });
    await s1.saveTask('c', { name: 'C' });
    await s2.saveTask('b', { name: 'B2' });
    await s2.saveTask('c', { name: 'C2' });
    await s2.saveTask('d', { name: 'D' });
    const common = await s1.intersect(s2);
    expect(common.sort()).toEqual(['b', 'c']);
  });

  test('returns empty array when no overlap', async () => {
    await s1.saveTask('x', { name: 'X' });
    await s2.saveTask('y', { name: 'Y' });
    const common = await s1.intersect(s2);
    expect(common).toEqual([]);
  });

  test('returns empty array when both empty', async () => {
    const common = await s1.intersect(s2);
    expect(common).toEqual([]);
  });

  test('returns all IDs when storages are identical', async () => {
    await s1.saveTask('a', { v: 1 });
    await s1.saveTask('b', { v: 2 });
    await s2.saveTask('a', { v: 1 });
    await s2.saveTask('b', { v: 2 });
    const common = await s1.intersect(s2);
    expect(common.sort()).toEqual(['a', 'b']);
  });

  test('is symmetric (s1.intersect(s2) == s2.intersect(s1))', async () => {
    await s1.saveTask('a', { v: 1 });
    await s1.saveTask('b', { v: 2 });
    await s1.saveTask('c', { v: 3 });
    await s2.saveTask('b', { v: 2 });
    await s2.saveTask('c', { v: 3 });
    await s2.saveTask('d', { v: 4 });
    const r1 = (await s1.intersect(s2)).sort();
    const r2 = (await s2.intersect(s1)).sort();
    expect(r1).toEqual(r2);
  });

  test('handles single overlapping ID', async () => {
    await s1.saveTask('only', { v: 1 });
    await s2.saveTask('only', { v: 2 });
    const common = await s1.intersect(s2);
    expect(common).toEqual(['only']);
  });
});
