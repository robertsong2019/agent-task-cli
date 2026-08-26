const { ConcurrencyManager } = require('../src/utils/concurrency-manager');

describe('F244: ConcurrencyManager.waterfall(tasks, initialValue) — sequential result chaining', () => {
  let cm;

  beforeEach(() => {
    cm = new ConcurrencyManager({ maxConcurrent: 2 });
  });

  test('passes each result to the next task in order', async () => {
    const seen = [];
    const result = await cm.waterfall([
      async (v) => { seen.push(['a', v]); return 1; },
      async (v) => { seen.push(['b', v]); return v + 1; },
      async (v) => { seen.push(['c', v]); return v * 10; }
    ]);
    expect(result).toBe(20);
    expect(seen).toEqual([['a', undefined], ['b', 1], ['c', 2]]);
  });

  test('first task receives initialValue', async () => {
    const result = await cm.waterfall([
      async (v) => v + 1,
      async (v) => v * 2
    ], 20);
    expect(result).toBe(42);
  });

  test('empty tasks array resolves initialValue', async () => {
    expect(await cm.waterfall([])).toBeUndefined();
    expect(await cm.waterfall([], 'seed')).toBe('seed');
  });

  test('rejects immediately on error and skips remaining tasks', async () => {
    const boom = new Error('fail-at-2');
    let thirdRan = false;
    await expect(cm.waterfall([
      async () => 'first',
      async () => { throw boom; },
      async () => { thirdRan = true; }
    ])).rejects.toThrow('fail-at-2');
    expect(thirdRan).toBe(false);
  });

  test('works with synchronous task functions', async () => {
    const result = await cm.waterfall([(v) => (v ?? 3) + 1, (v) => v * 3]);
    expect(result).toBe(12);
  });

  test('throws TypeError when tasks is not an array', async () => {
    await expect(cm.waterfall('nope')).rejects.toThrow(TypeError);
    await expect(cm.waterfall(null)).rejects.toThrow(/must be an array/);
  });
});
