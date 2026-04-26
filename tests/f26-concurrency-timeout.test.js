const { ConcurrencyManager } = require('../src/utils/concurrency-manager');

describe('F26: ConcurrencyManager executeWithTimeout', () => {
  let cm;
  beforeEach(() => { cm = new ConcurrencyManager({ maxConcurrent: 2 }); });

  test('succeeds within timeout', async () => {
    const result = await cm.executeWithTimeout(
      async () => 'done',
      1000
    );
    expect(result).toBe('done');
  });

  test('rejects on timeout', async () => {
    await expect(
      cm.executeWithTimeout(
        () => new Promise(r => setTimeout(r, 500)),
        20
      )
    ).rejects.toThrow(/timed out/);
  });

  test('uses taskId in error message', async () => {
    await expect(
      cm.executeWithTimeout(
        () => new Promise(r => setTimeout(r, 500)),
        20,
        'my-task'
      )
    ).rejects.toThrow(/my-task/);
  });

  test('respects concurrency limit', async () => {
    const delays = [50, 50, 50];
    const start = Date.now();
    await Promise.all(delays.map((d, i) =>
      cm.executeWithTimeout(() => new Promise(r => setTimeout(r, d)), 1000, `t${i}`)
    ));
    const elapsed = Date.now() - start;
    // max 2 concurrent, 3 tasks of 50ms => ~100ms minimum
    expect(elapsed).toBeGreaterThanOrEqual(80);
  });
});
