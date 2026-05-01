const { RetryHandler } = require('../src/utils/retry-handler');

test('withCircuitBreaker succeeds normally', async () => {
  const rh = new RetryHandler();
  const result = await rh.withCircuitBreaker(() => Promise.resolve('ok'));
  expect(result).toBe('ok');
});

test('withCircuitBreaker opens after failureThreshold', async () => {
  const rh = new RetryHandler();
  const fail = () => Promise.reject(new Error('fail'));

  for (let i = 0; i < 5; i++) {
    await expect(rh.withCircuitBreaker(fail, { failureThreshold: 5, resetTimeoutMs: 60000 })).rejects.toThrow('fail');
  }

  // Circuit should be open now
  await expect(rh.withCircuitBreaker(() => Promise.resolve('ok'), { failureThreshold: 5, resetTimeoutMs: 60000 })).rejects.toThrow('Circuit breaker is open');
});

test('withCircuitBreaker half-open after resetTimeout', async () => {
  const rh = new RetryHandler();
  const fail = () => Promise.reject(new Error('fail'));

  for (let i = 0; i < 3; i++) {
    await expect(rh.withCircuitBreaker(fail, { failureThreshold: 3, resetTimeoutMs: 10 })).rejects.toThrow('fail');
  }

  // Wait for reset timeout
  await new Promise(r => setTimeout(r, 20));

  // Should be half-open and succeed
  const result = await rh.withCircuitBreaker(() => Promise.resolve('recovered'), { failureThreshold: 3, resetTimeoutMs: 10 });
  expect(result).toBe('recovered');
});

test('withCircuitBreaker resets on success', async () => {
  const rh = new RetryHandler();

  // Accumulate 2 failures
  await expect(rh.withCircuitBreaker(() => Promise.reject(new Error('fail')), { failureThreshold: 5, resetTimeoutMs: 60000 })).rejects.toThrow('fail');
  await expect(rh.withCircuitBreaker(() => Promise.reject(new Error('fail')), { failureThreshold: 5, resetTimeoutMs: 60000 })).rejects.toThrow('fail');

  // Success resets counter
  await rh.withCircuitBreaker(() => Promise.resolve('ok'), { failureThreshold: 5, resetTimeoutMs: 60000 });

  // Now 3 more failures shouldn't open (counter was reset)
  for (let i = 0; i < 4; i++) {
    await expect(rh.withCircuitBreaker(() => Promise.reject(new Error('fail')), { failureThreshold: 5, resetTimeoutMs: 60000 })).rejects.toThrow('fail');
  }
  // Still closed (4 < 5)
  const result = await rh.withCircuitBreaker(() => Promise.resolve('still-ok'), { failureThreshold: 5, resetTimeoutMs: 60000 });
  expect(result).toBe('still-ok');
});
