const { RetryHandler } = require('../src/utils/retry-handler');

describe('F19: RetryHandler.executeUntil()', () => {
  let rh;
  beforeEach(() => { rh = new RetryHandler({ maxRetries: 3, baseDelay: 10 }); });

  test('returns result immediately when validate passes', async () => {
    let calls = 0;
    const result = await rh.executeUntil(
      () => { calls++; return { ok: true }; },
      { validate: (r) => r.ok }
    );
    expect(result).toEqual({ ok: true });
    expect(calls).toBe(1);
  });

  test('retries until validate passes', async () => {
    let calls = 0;
    const result = await rh.executeUntil(
      () => { calls++; return calls >= 3 ? 'done' : null; },
      { validate: (r) => r !== null }
    );
    expect(result).toBe('done');
    expect(calls).toBe(3);
  });

  test('returns null when max retries exhausted', async () => {
    const result = await rh.executeUntil(
      () => false,
      { maxRetries: 2 }
    );
    expect(result).toBeNull();
  });

  test('default validate checks truthiness', async () => {
    let calls = 0;
    const result = await rh.executeUntil(
      () => { calls++; return calls >= 2 ? 'yes' : ''; }
    );
    expect(result).toBe('yes');
    expect(calls).toBe(2);
  });
});
