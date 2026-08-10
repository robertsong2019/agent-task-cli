const { ConcurrencyManager } = require('../src/utils/concurrency-manager');

describe('F232: ConcurrencyManager.wrap(fn, opts?)', () => {
  let cm;

  beforeEach(() => {
    cm = new ConcurrencyManager({ maxConcurrent: 2 });
  });

  afterEach(() => {
    // ConcurrencyManager has no destroy method
  });

  test('returns a function', () => {
    const wrapped = cm.wrap(() => 42);
    expect(typeof wrapped).toBe('function');
  });

  test('wrapped function executes through manager', async () => {
    const fn = jest.fn().mockResolvedValue('result');
    const wrapped = cm.wrap(fn);
    const result = await wrapped('a', 'b');
    expect(result).toBe('result');
    expect(fn).toHaveBeenCalledWith('a', 'b');
  });

  test('wrapped function respects concurrency limit', async () => {
    const order = [];
    const slow = (id) => new Promise(resolve => {
      setTimeout(() => { order.push(id); resolve(id); }, 50);
    });

    const wrapped = cm.wrap(slow);
    // maxConcurrent=2, so 3rd must wait
    const p1 = wrapped(1);
    const p2 = wrapped(2);
    const p3 = wrapped(3);

    await Promise.all([p1, p2, p3]);
    // First two should be 1 and 2 (order between them may vary)
    // Third must come after
    expect(order).toContain(3);
    expect(order.indexOf(3)).toBeGreaterThanOrEqual(2);
  });

  test('throws TypeError for non-function input', () => {
    expect(() => cm.wrap('not a function')).toThrow(TypeError);
  });

  test('passes arguments through to wrapped function', async () => {
    const fn = (a, b, c) => Promise.resolve(a + b + c);
    const wrapped = cm.wrap(fn);
    expect(await wrapped(1, 2, 3)).toBe(6);
  });

  test('supports retries via opts', async () => {
    let attempts = 0;
    const flaky = () => {
      attempts++;
      if (attempts < 3) return Promise.reject(new Error('fail'));
      return Promise.resolve('success');
    };

    const wrapped = cm.wrap(flaky, { retries: 3 });
    const result = await wrapped();
    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });

  test('accepts taskId via opts', async () => {
    const fn = () => Promise.resolve('ok');
    const wrapped = cm.wrap(fn, { taskId: 'custom-task' });
    const result = await wrapped();
    expect(result).toBe('ok');
  });
});
