/**
 * F46: Storage.clear()
 * F47: RetryHandler.resetCircuitBreaker() + getCircuitBreakerState()
 * F48: ConcurrencyManager.cancelQueued(taskId)
 */
const { Storage } = require('../src/utils/storage');
const { RetryHandler } = require('../src/utils/retry-handler');
const { ConcurrencyManager } = require('../src/utils/concurrency-manager');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// --- F46: Storage.clear() ---
describe('F46: Storage.clear()', () => {
  let tmpDir, storage;
  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `storage-clear-test-${Date.now()}`);
    storage = new Storage(tmpDir);
  });
  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  test('clears all tasks and returns count', async () => {
    await storage.saveTask('a', { status: 'done' });
    await storage.saveTask('b', { status: 'pending' });
    const count = await storage.clear();
    expect(count).toBe(2);
    const tasks = await storage.loadTasks();
    expect(Object.keys(tasks)).toHaveLength(0);
  });

  test('returns 0 when no tasks exist', async () => {
    const count = await storage.clear();
    expect(count).toBe(0);
  });

  test('can save new tasks after clear', async () => {
    await storage.saveTask('a', { status: 'done' });
    await storage.clear();
    await storage.saveTask('c', { status: 'new' });
    const task = await storage.getTask('c');
    expect(task.status).toBe('new');
  });
});

// --- F47: RetryHandler circuit breaker management ---
describe('F47: RetryHandler.resetCircuitBreaker() + getCircuitBreakerState()', () => {
  let rh;
  beforeEach(() => {
    rh = new RetryHandler();
  });

  test('getCircuitBreakerState returns uninitialized before use', () => {
    expect(rh.getCircuitBreakerState()).toBe('uninitialized');
  });

  test('circuit breaker goes open after threshold', async () => {
    const fail = () => Promise.reject(new Error('503 error'));
    for (let i = 0; i < 5; i++) {
      await rh.withCircuitBreaker(fail, { failureThreshold: 5 }).catch(() => {});
    }
    expect(rh.getCircuitBreakerState()).toBe('open');
  });

  test('resetCircuitBreaker resets to closed', async () => {
    const fail = () => Promise.reject(new Error('503 error'));
    for (let i = 0; i < 5; i++) {
      await rh.withCircuitBreaker(fail, { failureThreshold: 5 }).catch(() => {});
    }
    expect(rh.getCircuitBreakerState()).toBe('open');
    rh.resetCircuitBreaker();
    expect(rh.getCircuitBreakerState()).toBe('closed');
    // Should be able to execute again
    const result = await rh.withCircuitBreaker(() => Promise.resolve('ok'), { failureThreshold: 5 });
    expect(result).toBe('ok');
  });

  test('resetCircuitBreaker on uninitialized is a no-op', () => {
    rh.resetCircuitBreaker();
    expect(rh.getCircuitBreakerState()).toBe('uninitialized');
  });
});

// --- F48: ConcurrencyManager.cancelQueued(taskId) ---
describe('F48: ConcurrencyManager.cancelQueued(taskId)', () => {
  let cm;
  beforeEach(() => {
    cm = new ConcurrencyManager({ maxConcurrent: 1 });
  });

  test('cancels a queued task by taskId', async () => {
    // Block the single slot
    let resolveBlocker;
    const blocker = new Promise(r => { resolveBlocker = r; });
    cm.execute(() => blocker, 'blocker');

    // Queue another task
    const queuedPromise = cm.execute(() => Promise.resolve('should not run'), 'target');

    const cancelled = cm.cancelQueued('target');
    expect(cancelled).toBe(true);

    await expect(queuedPromise).rejects.toThrow('cancelled');

    resolveBlocker();
  });

  test('returns false if taskId not found', () => {
    expect(cm.cancelQueued('nonexistent')).toBe(false);
  });

  test('does not cancel active task', async () => {
    let resolveBlocker;
    const blocker = new Promise(r => { resolveBlocker = r; });
    cm.execute(() => blocker, 'active');

    // active task is running, not queued
    expect(cm.cancelQueued('active')).toBe(false);

    resolveBlocker();
  });
});
