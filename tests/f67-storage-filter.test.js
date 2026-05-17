const { Storage } = require('../src/utils/storage');
const fs = require('fs').promises;
const path = require('path');

const TMPDIR = path.join(__dirname, '..', 'data', 'test-f67');

beforeEach(async () => {
  await fs.mkdir(TMPDIR, { recursive: true });
  await fs.writeFile(path.join(TMPDIR, 'tasks.json'), '{}');
});
afterAll(async () => {
  await fs.rm(TMPDIR, { recursive: true, force: true }).catch(() => {});
});

test('filter returns empty when no tasks match', async () => {
  const s = new Storage(TMPDIR);
  await s.saveTask('a', { status: 'done', priority: 1 });
  const results = await s.filter(t => t.priority > 5);
  expect(results).toHaveLength(0);
});

test('filter returns matching tasks', async () => {
  const s = new Storage(TMPDIR);
  await s.saveTask('a', { status: 'running', priority: 3 });
  await s.saveTask('b', { status: 'done', priority: 7 });
  await s.saveTask('c', { status: 'done', priority: 2 });
  const results = await s.filter(t => t.status === 'done');
  expect(results).toHaveLength(2);
  const ids = results.map(r => r.id).sort();
  expect(ids).toEqual(['b', 'c']);
});

test('filter includes id in results', async () => {
  const s = new Storage(TMPDIR);
  await s.saveTask('xyz', { status: 'pending', value: 42 });
  const [hit] = await s.filter(t => t.value === 42);
  expect(hit.id).toBe('xyz');
});

test('filter with complex predicate', async () => {
  const s = new Storage(TMPDIR);
  await s.saveTask('a', { status: 'done', tags: ['urgent'] });
  await s.saveTask('b', { status: 'running', tags: ['low'] });
  const results = await s.filter(t => Array.isArray(t.tags) && t.tags.includes('urgent'));
  expect(results).toHaveLength(1);
  expect(results[0].id).toBe('a');
});
