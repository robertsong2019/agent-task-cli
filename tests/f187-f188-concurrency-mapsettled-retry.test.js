const { ConcurrencyManager } = require('../src/utils/concurrency-manager');

describe('F187: ConcurrencyManager.mapSettled()', () => {
  it('returns fulfilled and rejected arrays with correct indices', async () => {
    const cm = new ConcurrencyManager({ maxConcurrent: 2 });
    const items = [1, 2, 3, 4, 5];
    const fn = (x) => x > 3 ? Promise.resolve(x * 2) : Promise.reject(new Error(`too small: ${x}`));

    const result = await cm.mapSettled(items, fn);

    expect(result.summary.total).toBe(5);
    expect(result.summary.passed).toBe(2);
    expect(result.summary.failed).toBe(3);
    expect(result.fulfilled).toHaveLength(2);
    expect(result.rejected).toHaveLength(3);
    expect(result.fulfilled[0]).toEqual({ index: 3, value: 8 });
    expect(result.fulfilled[1]).toEqual({ index: 4, value: 10 });
    expect(result.rejected[0].index).toBe(0);
    expect(result.rejected[0].reason.message).toBe('too small: 1');
  });

  it('handles all-success case', async () => {
    const cm = new ConcurrencyManager({ maxConcurrent: 3 });
    const items = [1, 2, 3];
    const fn = (x) => Promise.resolve(x * 10);

    const result = await cm.mapSettled(items, fn);

    expect(result.summary).toEqual({ total: 3, passed: 3, failed: 0 });
    expect(result.fulfilled.map(f => f.value)).toEqual([10, 20, 30]);
  });

  it('handles all-failure case', async () => {
    const cm = new ConcurrencyManager({ maxConcurrent: 2 });
    const items = ['a', 'b'];
    const fn = () => Promise.reject(new Error('always fails'));

    const result = await cm.mapSettled(items, fn);

    expect(result.summary).toEqual({ total: 2, passed: 0, failed: 2 });
    expect(result.rejected[0].reason.message).toBe('always fails');
  });

  it('handles empty array', async () => {
    const cm = new ConcurrencyManager({ maxConcurrent: 2 });
    const result = await cm.mapSettled([], () => {});
    expect(result.summary).toEqual({ total: 0, passed: 0, failed: 0 });
  });

  it('throws on non-array items', async () => {
    const cm = new ConcurrencyManager({ maxConcurrent: 2 });
    await expect(cm.mapSettled('not array', () => {})).rejects.toThrow(TypeError);
  });

  it('throws on non-function fn', async () => {
    const cm = new ConcurrencyManager({ maxConcurrent: 2 });
    await expect(cm.mapSettled([1, 2], null)).rejects.toThrow(TypeError);
  });
});

describe('F188: ConcurrencyManager.withRetry()', () => {
  it('succeeds on first attempt', async () => {
    const cm = new ConcurrencyManager({ maxConcurrent: 2 });
    const fn = jest.fn().mockResolvedValue('success');

    const result = await cm.withRetry(fn, 3);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and eventually succeeds', async () => {
    const cm = new ConcurrencyManager({ maxConcurrent: 1 });
    let attempts = 0;
    const fn = jest.fn(() => {
      attempts++;
      if (attempts < 3) return Promise.reject(new Error('fail'));
      return Promise.resolve('ok');
    });

    const result = await cm.withRetry(fn, 5);

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws after all retries exhausted', async () => {
    const cm = new ConcurrencyManager({ maxConcurrent: 1 });
    const fn = jest.fn().mockRejectedValue(new Error('permanent failure'));

    await expect(cm.withRetry(fn, 2)).rejects.toThrow('permanent failure');
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it('works with 0 retries (single attempt)', async () => {
    const cm = new ConcurrencyManager({ maxConcurrent: 1 });
    const fn = jest.fn().mockResolvedValue('done');

    const result = await cm.withRetry(fn, 0);

    expect(result).toBe('done');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws on non-function fn', async () => {
    const cm = new ConcurrencyManager({ maxConcurrent: 1 });
    await expect(cm.withRetry(null, 3)).rejects.toThrow(TypeError);
  });

  it('throws on negative retries', async () => {
    const cm = new ConcurrencyManager({ maxConcurrent: 1 });
    await expect(cm.withRetry(() => {}, -1)).rejects.toThrow(TypeError);
  });

  it('accepts taskId parameter', async () => {
    const cm = new ConcurrencyManager({ maxConcurrent: 2 });
    const fn = jest.fn().mockResolvedValue('result');

    const result = await cm.withRetry(fn, 2, 'my-task');

    expect(result).toBe('result');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
