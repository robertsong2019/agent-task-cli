/**
 * F82: RetryHandler edge cases
 * - getStats returns copy
 * - markSuccessfulRetry
 * - getCircuitBreakerState initial
 * - calculateDelay respects maxDelay
 */
const { RetryHandler } = require('../src/utils/retry-handler');

describe('F82: RetryHandler edges', () => {
  test('getStats returns a copy', () => {
    const rh = new RetryHandler({ maxRetries: 0, baseDelay: 1 });
    const stats = rh.getStats();
    stats.totalRetries = 999;
    expect(rh.getStats().totalRetries).toBe(0);
  });

  test('markSuccessfulRetry increments counter', () => {
    const rh = new RetryHandler({ maxRetries: 0, baseDelay: 1 });
    rh.markSuccessfulRetry();
    rh.markSuccessfulRetry();
    expect(rh.getStats().successfulRetries).toBe(2);
  });

  test('getCircuitBreakerState is uninitialized before use', () => {
    const rh = new RetryHandler({ maxRetries: 0, baseDelay: 1 });
    expect(rh.getCircuitBreakerState()).toBe('uninitialized');
  });

  test('calculateDelay respects maxDelay', () => {
    const rh = new RetryHandler({ baseDelay: 100, maxDelay: 200, backoffFactor: 10 });
    // attempt 5 would be 100 * 10^5 = 100000, but capped to 200 ± 25% jitter
    for (let i = 0; i < 20; i++) {
      const delay = rh.calculateDelay(5);
      expect(delay).toBeGreaterThanOrEqual(150);
      expect(delay).toBeLessThanOrEqual(250);
    }
  });

  test('calculateDelay at attempt 0 is near baseDelay', () => {
    const rh = new RetryHandler({ baseDelay: 1000, maxDelay: 5000, backoffFactor: 2 });
    for (let i = 0; i < 20; i++) {
      const delay = rh.calculateDelay(0);
      // 1000 ± 25% = [750, 1250]
      expect(delay).toBeGreaterThanOrEqual(750);
      expect(delay).toBeLessThanOrEqual(1250);
    }
  });

  test('try() returns {ok:false} for non-retryable error immediately', async () => {
    const rh = new RetryHandler({ maxRetries: 3, baseDelay: 1 });
    let calls = 0;
    const result = await rh.try(async () => {
      calls++;
      throw new Error('custom fatal error');
    });
    expect(result.ok).toBe(false);
    expect(result.attempts).toBe(1);
    expect(calls).toBe(1);
  });

  test('try() retries on retryable error', async () => {
    const rh = new RetryHandler({ maxRetries: 2, baseDelay: 1 });
    let calls = 0;
    const result = await rh.try(async () => {
      calls++;
      if (calls < 3) throw new Error('ETIMEDOUT');
      return 'done';
    });
    expect(result.ok).toBe(true);
    expect(result.result).toBe('done');
    expect(result.attempts).toBe(3);
  });
});
