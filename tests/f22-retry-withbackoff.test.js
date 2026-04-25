const { RetryHandler } = require('../src/utils/retry-handler');

describe('F22: RetryHandler.withBackoff()', () => {
  test('succeeds on first try', async () => {
    const rh = new RetryHandler();
    const result = await rh.withBackoff(() => Promise.resolve('ok'));
    expect(result).toBe('ok');
  });

  test('retries on failure then succeeds', async () => {
    const rh = new RetryHandler({ baseDelay: 5 });
    let attempts = 0;
    const result = await rh.withBackoff(() => {
      attempts++;
      if (attempts < 3) return Promise.reject(new Error('not yet'));
      return Promise.resolve('done');
    });
    expect(result).toBe('done');
    expect(attempts).toBe(3);
  });

  test('throws after max retries', async () => {
    const rh = new RetryHandler({ maxRetries: 2, baseDelay: 5 });
    await expect(
      rh.withBackoff(() => Promise.reject(new Error('always fail')))
    ).rejects.toThrow('always fail');
  });

  test('calls onRetry callback before each retry', async () => {
    const rh = new RetryHandler({ maxRetries: 2, baseDelay: 5 });
    const retries = [];
    let attempts = 0;
    await rh.withBackoff(
      () => {
        attempts++;
        if (attempts <= 2) return Promise.reject(new Error('retry'));
        return Promise.resolve('ok');
      },
      { onRetry: (attempt, err) => retries.push({ attempt, msg: err.message }) }
    );
    expect(retries).toEqual([
      { attempt: 1, msg: 'retry' },
      { attempt: 2, msg: 'retry' }
    ]);
  });

  test('respects custom maxRetries option', async () => {
    const rh = new RetryHandler({ maxRetries: 0, baseDelay: 5 });
    let attempts = 0;
    await expect(
      rh.withBackoff(
        () => { attempts++; return Promise.reject(new Error('nope')); },
        { maxRetries: 3 }
      )
    ).rejects.toThrow('nope');
    expect(attempts).toBe(4); // 1 initial + 3 retries
  });

  test('respects custom baseDelay option', async () => {
    const rh = new RetryHandler({ baseDelay: 500 });
    let attempts = 0;
    const start = Date.now();
    await rh.withBackoff(
      () => { attempts++; return attempts < 2 ? Promise.reject(new Error('x')) : Promise.resolve('ok'); },
      { baseDelay: 5 }
    );
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(100); // Would be ~500ms with default baseDelay
  });

  test('works with sync functions', async () => {
    const rh = new RetryHandler({ baseDelay: 5 });
    let attempts = 0;
    const result = await rh.withBackoff(() => {
      attempts++;
      if (attempts < 2) throw new Error('sync fail');
      return 'sync-ok';
    });
    expect(result).toBe('sync-ok');
  });
});
