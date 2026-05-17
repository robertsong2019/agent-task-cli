const { RetryHandler } = require('../src/utils/retry-handler');

test('try returns ok:true on first success', async () => {
  const rh = new RetryHandler({ maxRetries: 2, baseDelay: 10 });
  const res = await rh.try(() => Promise.resolve(42));
  expect(res).toEqual({ ok: true, result: 42, attempts: 1 });
});

test('try returns ok:false after exhausting retries', async () => {
  const rh = new RetryHandler({ maxRetries: 2, baseDelay: 10 });
  const res = await rh.try(() => Promise.reject(new Error('ETIMEDOUT')));
  expect(res.ok).toBe(false);
  expect(res.attempts).toBe(3); // 1 initial + 2 retries
  expect(res.error.message).toBe('ETIMEDOUT');
});

test('try succeeds after retry', async () => {
  const rh = new RetryHandler({ maxRetries: 3, baseDelay: 10 });
  let calls = 0;
  const res = await rh.try(() => {
    calls++;
    if (calls < 3) throw new Error('ETIMEDOUT');
    return 'done';
  });
  expect(res).toEqual({ ok: true, result: 'done', attempts: 3 });
});

test('try does not retry non-retryable errors', async () => {
  const rh = new RetryHandler({ maxRetries: 3, baseDelay: 10 });
  const res = await rh.try(() => { throw new Error('UNIQUE_VIOLATION'); });
  expect(res.ok).toBe(false);
  expect(res.attempts).toBe(1); // non-retryable, stop immediately
});
