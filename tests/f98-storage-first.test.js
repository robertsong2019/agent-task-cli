const { Storage } = require('../src/utils/storage');
const fs = require('fs').promises;
const path = require('path');

const TEST_DIR = path.join(__dirname, '__test_first_' + Date.now());

describe('Storage.first()', () => {
  let storage;
  beforeEach(async () => {
    storage = new Storage(TEST_DIR);
    await storage.saveTask('t1', { id: 't1', status: 'pending', priority: 1 });
    await storage.saveTask('t2', { id: 't2', status: 'done', priority: 2 });
    await storage.saveTask('t3', { id: 't3', status: 'pending', priority: 3 });
  });
  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
  });

  test('returns first matching task', async () => {
    const t = await storage.first(t => t.status === 'pending');
    expect(t).toBeTruthy();
    expect(t.status).toBe('pending');
    expect(['t1', 't3']).toContain(t.id);
  });

  test('returns null when no match', async () => {
    const t = await storage.first(t => t.status === 'nonexistent');
    expect(t).toBeNull();
  });

  test('matches with complex predicate', async () => {
    const t = await storage.first(t => t.priority > 1);
    expect(t).toBeTruthy();
    expect(t.priority).toBeGreaterThan(1);
  });
});
