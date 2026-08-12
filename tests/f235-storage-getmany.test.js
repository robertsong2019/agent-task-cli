const { Storage } = require('../src/utils/storage');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

describe('F235: Storage.getMany(ids[])', () => {
  let tmpDir, storage;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `atc-f235-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    storage = new Storage(tmpDir);
    await storage.ensureDataDir();
  });

  afterEach(async () => {
    try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch {}
  });

  test('returns Map with found tasks', async () => {
    await storage.saveTask('a', { status: 'pending' });
    await storage.saveTask('b', { status: 'done' });
    await storage.saveTask('c', { status: 'pending' });

    const result = await storage.getMany(['a', 'b', 'c']);
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(3);
    expect(result.get('a').status).toBe('pending');
    expect(result.get('b').status).toBe('done');
  });

  test('omits missing IDs from result', async () => {
    await storage.saveTask('x', { status: 'pending' });
    const result = await storage.getMany(['x', 'nonexistent']);
    expect(result.size).toBe(1);
    expect(result.has('x')).toBe(true);
    expect(result.has('nonexistent')).toBe(false);
  });

  test('returns empty Map for empty input array', async () => {
    const result = await storage.getMany([]);
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });

  test('returns empty Map when no IDs match', async () => {
    await storage.saveTask('real', { status: 'pending' });
    const result = await storage.getMany(['ghost1', 'ghost2']);
    expect(result.size).toBe(0);
  });

  test('throws TypeError for non-array input', async () => {
    await expect(storage.getMany('not-an-array')).rejects.toThrow(TypeError);
    await expect(storage.getMany(null)).rejects.toThrow(TypeError);
    await expect(storage.getMany(42)).rejects.toThrow(TypeError);
  });

  test('deduplicates repeated IDs in input', async () => {
    await storage.saveTask('dup', { status: 'pending' });
    const result = await storage.getMany(['dup', 'dup', 'dup']);
    expect(result.size).toBe(1);
  });
});
