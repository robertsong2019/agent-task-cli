const { ConcurrencyManager } = require('../src/utils/concurrency-manager');
const { RetryHandler } = require('../src/utils/retry-handler');
const { Cache, generateTaskCacheKey } = require('../src/utils/cache');
const { Logger } = require('../src/utils/logger');
const { Storage } = require('../src/utils/storage');
const fs = require('fs').promises;
const path = require('path');

describe('ConcurrencyManager', () => {
  let manager;

  beforeEach(() => {
    manager = new ConcurrencyManager({ maxConcurrent: 3 });
  });

  afterEach(() => {
    manager.clearQueue();
  });

  test('should execute tasks within concurrency limit', async () => {
    const results = [];
    const tasks = [];
    
    for (let i = 0; i < 5; i++) {
      tasks.push(manager.execute(async () => {
        results.push(i);
        await new Promise(resolve => setTimeout(resolve, 100));
        return i;
      }));
    }
    
    const values = await Promise.all(tasks);
    
    expect(values).toEqual([0, 1, 2, 3, 4]);
    expect(manager.stats.totalExecuted).toBe(5);
  });

  test('should track peak concurrency', async () => {
    const tasks = [];
    
    for (let i = 0; i < 5; i++) {
      tasks.push(manager.execute(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return i;
      }));
    }
    
    await Promise.all(tasks);
    
    expect(manager.stats.peakConcurrency).toBeLessThanOrEqual(3);
  });

  test('should queue tasks when at capacity', async () => {
    let concurrentCount = 0;
    const tasks = [];
    
    for (let i = 0; i < 10; i++) {
      tasks.push(manager.execute(async () => {
        concurrentCount++;
        await new Promise(resolve => setTimeout(resolve, 100));
        concurrentCount--;
        return i;
      }));
    }
    
    await Promise.all(tasks);
    
    expect(manager.stats.totalQueued).toBeGreaterThan(0);
    expect(concurrentCount).toBe(0); // All completed
  });

  test('should return status information', () => {
    const status = manager.getStatus();
    
    expect(status).toHaveProperty('activeCount');
    expect(status).toHaveProperty('queuedCount');
    expect(status).toHaveProperty('availableSlots');
    expect(status).toHaveProperty('stats');
  });

  test('should clear queue', async () => {
    const manager2 = new ConcurrencyManager({ maxConcurrent: 1 });
    
    // Fill up capacity
    const task1 = manager2.execute(async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
    });
    
    // Queue additional tasks
    const task2 = manager2.execute(async () => 2).catch(() => {}); // Will be rejected
    const task3 = manager2.execute(async () => 3).catch(() => {}); // Will be rejected
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const cleared = manager2.clearQueue();
    
    expect(cleared).toBe(2);
    expect(manager2.queue.length).toBe(0);
  });

  test('should update max concurrent', () => {
    manager.setMaxConcurrent(5);
    expect(manager.maxConcurrent).toBe(5);
  });

  test('should drain all tasks', async () => {
    const manager2 = new ConcurrencyManager({ maxConcurrent: 3 });
    
    for (let i = 0; i < 3; i++) {
      manager2.execute(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });
    }
    
    await manager2.drain();
    
    expect(manager2.activeCount).toBe(0);
    
    manager2.clearQueue();
  });
});

describe('RetryHandler', () => {
  let handler;

  beforeEach(() => {
    handler = new RetryHandler({ maxRetries: 3, baseDelay: 100 });
  });

  test('should execute successful function', async () => {
    const fn = jest.fn().mockResolvedValue('success');
    
    const result = await handler.execute(fn);
    
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('should retry on retryable errors', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockRejectedValueOnce(new Error('ETIMEDOUT'))
      .mockResolvedValue('success');
    
    const result = await handler.execute(fn);
    
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(handler.stats.totalRetries).toBe(2);
  });

  test('should not retry on non-retryable errors', async () => {
    const fn = jest.fn()
      .mockRejectedValue(new Error('Invalid input'));
    
    await expect(handler.execute(fn)).rejects.toThrow('Invalid input');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('should fail after max retries', async () => {
    const fn = jest.fn()
      .mockRejectedValue(new Error('ECONNRESET'));
    
    await expect(handler.execute(fn)).rejects.toThrow('ECONNRESET');
    expect(fn).toHaveBeenCalledTimes(4); // Initial + 3 retries
    expect(handler.stats.failedAfterRetries).toBe(1);
  });

  test('should identify retryable errors', () => {
    expect(handler.isRetryable(new Error('ECONNRESET'))).toBe(true);
    expect(handler.isRetryable(new Error('ETIMEDOUT'))).toBe(true);
    expect(handler.isRetryable(new Error('Rate limit exceeded'))).toBe(true);
    expect(handler.isRetryable(new Error('Invalid input'))).toBe(false);
  });

  test('should calculate exponential backoff delay', () => {
    const handler2 = new RetryHandler({ 
      baseDelay: 1000,
      maxDelay: 30000,
      backoffFactor: 2
    });
    
    const delay0 = handler2.calculateDelay(0);
    const delay1 = handler2.calculateDelay(1);
    const delay2 = handler2.calculateDelay(2);
    
    // With jitter, we check ranges
    expect(delay0).toBeGreaterThan(750); // 1000 - 25%
    expect(delay0).toBeLessThan(1250); // 1000 + 25%
    
    // Check that delays generally increase (accounting for jitter)
    expect(delay1).toBeGreaterThan(delay0 * 0.5); // At least 50% growth
    expect(delay2).toBeGreaterThan(delay1 * 0.5); // At least 50% growth
    
    // Check absolute ranges for delay1 and delay2
    expect(delay1).toBeGreaterThan(1500); // 2000 - 25%
    expect(delay1).toBeLessThan(2500); // 2000 + 25%
    expect(delay2).toBeGreaterThan(3000); // 4000 - 25%
    expect(delay2).toBeLessThan(5000); // 4000 + 25%
  });

  test('should respect max delay', () => {
    const smallHandler = new RetryHandler({ 
      maxDelay: 5000,
      baseDelay: 1000,
      backoffFactor: 10
    });
    
    const delay = smallHandler.calculateDelay(10);
    
    expect(delay).toBeLessThanOrEqual(6250); // 5000 + 25% jitter
  });

  test('should return stats', () => {
    const stats = handler.getStats();
    
    expect(stats).toHaveProperty('totalRetries');
    expect(stats).toHaveProperty('successfulRetries');
    expect(stats).toHaveProperty('failedAfterRetries');
  });
});

describe('Cache', () => {
  let cache;

  beforeEach(() => {
    cache = new Cache({ maxSize: 5, defaultTTL: 1000 });
  });

  afterEach(() => {
    cache.destroy();
  });

  test('should set and get values', () => {
    cache.set('key1', 'value1');
    
    expect(cache.get('key1')).toBe('value1');
    expect(cache.stats.hits).toBe(1);
  });

  test('should return undefined for missing keys', () => {
    expect(cache.get('missing')).toBeUndefined();
    expect(cache.stats.misses).toBe(1);
  });

  test('should check if key exists', () => {
    cache.set('key1', 'value1');
    
    expect(cache.has('key1')).toBe(true);
    expect(cache.has('missing')).toBe(false);
  });

  test('should delete keys', () => {
    cache.set('key1', 'value1');
    
    expect(cache.delete('key1')).toBe(true);
    expect(cache.get('key1')).toBeUndefined();
  });

  test('should evict LRU when at capacity', () => {
    for (let i = 0; i < 6; i++) {
      cache.set(`key${i}`, `value${i}`);
    }
    
    expect(cache.size()).toBe(5);
    expect(cache.stats.evictions).toBeGreaterThan(0);
  });

  test('should expire entries based on TTL', async () => {
    cache.set('key1', 'value1', 100);
    
    expect(cache.get('key1')).toBe('value1');
    
    await new Promise(resolve => setTimeout(resolve, 150));
    
    expect(cache.get('key1')).toBeUndefined();
  });

  test('should clear all entries', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    
    const count = cache.clear();
    
    expect(count).toBe(2);
    expect(cache.size()).toBe(0);
  });

  test('should return statistics', () => {
    cache.set('key1', 'value1');
    cache.get('key1');
    cache.get('missing');
    
    const stats = cache.getStats();
    
    expect(stats.size).toBe(1);
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBe('0.50');
  });

  test('should return keys', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    
    const keys = cache.keys();
    
    expect(keys).toContain('key1');
    expect(keys).toContain('key2');
  });
});

describe('generateTaskCacheKey', () => {
  test('should generate consistent key for same config', () => {
    const config = {
      pattern: 'work-crew',
      task: 'Test task',
      agents: [
        { name: 'agent-1', role: 'role-1' }
      ]
    };
    
    const key1 = generateTaskCacheKey(config);
    const key2 = generateTaskCacheKey(config);
    
    expect(key1).toBe(key2);
    expect(key1).toMatch(/^task-[a-f0-9]{32}$/);
  });

  test('should generate different keys for different configs', () => {
    const config1 = {
      pattern: 'work-crew',
      task: 'Test task 1',
      agents: [{ name: 'agent-1', role: 'role-1' }]
    };
    
    const config2 = {
      pattern: 'work-crew',
      task: 'Test task 2',
      agents: [{ name: 'agent-1', role: 'role-1' }]
    };
    
    const key1 = generateTaskCacheKey(config1);
    const key2 = generateTaskCacheKey(config2);
    
    expect(key1).not.toBe(key2);
  });
});

describe('Logger', () => {
  let logger;
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = {
      error: jest.spyOn(console, 'error').mockImplementation(() => {}),
      warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
      info: jest.spyOn(console, 'info').mockImplementation(() => {}),
      debug: jest.spyOn(console, 'debug').mockImplementation(() => {})
    };
  });

  afterEach(() => {
    Object.values(consoleSpy).forEach(spy => spy.mockRestore());
  });

  test('should log error messages', () => {
    logger = new Logger('error');
    logger.error('Test error message');
    
    expect(consoleSpy.error).toHaveBeenCalledWith('[ERROR]', 'Test error message');
  });

  test('should log warning messages', () => {
    logger = new Logger('warn');
    logger.warn('Test warning message');
    
    expect(consoleSpy.warn).toHaveBeenCalledWith('[WARN]', 'Test warning message');
  });

  test('should log info messages', () => {
    logger = new Logger('info');
    logger.info('Test info message');
    
    expect(consoleSpy.info).toHaveBeenCalledWith('[INFO]', 'Test info message');
  });

  test('should log debug messages', () => {
    logger = new Logger('debug');
    logger.debug('Test debug message');
    
    expect(consoleSpy.debug).toHaveBeenCalledWith('[DEBUG]', 'Test debug message');
  });

  test('should respect log levels - error only', () => {
    logger = new Logger('error');
    
    logger.error('Error message');
    logger.warn('Warning message');
    logger.info('Info message');
    logger.debug('Debug message');
    
    expect(consoleSpy.error).toHaveBeenCalled();
    expect(consoleSpy.warn).not.toHaveBeenCalled();
    expect(consoleSpy.info).not.toHaveBeenCalled();
    expect(consoleSpy.debug).not.toHaveBeenCalled();
  });

  test('should respect log levels - warn and above', () => {
    logger = new Logger('warn');
    
    logger.error('Error message');
    logger.warn('Warning message');
    logger.info('Info message');
    logger.debug('Debug message');
    
    expect(consoleSpy.error).toHaveBeenCalled();
    expect(consoleSpy.warn).toHaveBeenCalled();
    expect(consoleSpy.info).not.toHaveBeenCalled();
    expect(consoleSpy.debug).not.toHaveBeenCalled();
  });

  test('should respect log levels - info and above', () => {
    logger = new Logger('info');
    
    logger.error('Error message');
    logger.warn('Warning message');
    logger.info('Info message');
    logger.debug('Debug message');
    
    expect(consoleSpy.error).toHaveBeenCalled();
    expect(consoleSpy.warn).toHaveBeenCalled();
    expect(consoleSpy.info).toHaveBeenCalled();
    expect(consoleSpy.debug).not.toHaveBeenCalled();
  });

  test('should respect log levels - all levels', () => {
    logger = new Logger('debug');
    
    logger.error('Error message');
    logger.warn('Warning message');
    logger.info('Info message');
    logger.debug('Debug message');
    
    expect(consoleSpy.error).toHaveBeenCalled();
    expect(consoleSpy.warn).toHaveBeenCalled();
    expect(consoleSpy.info).toHaveBeenCalled();
    expect(consoleSpy.debug).toHaveBeenCalled();
  });

  test('should log with additional arguments', () => {
    logger = new Logger('info');
    logger.info('Test message', 'arg1', 'arg2');
    
    expect(consoleSpy.info).toHaveBeenCalledWith('[INFO]', 'Test message', 'arg1', 'arg2');
  });
});

describe('Storage', () => {
  let storage;
  const testDir = './test-data';
  const testFile = path.join(testDir, 'tasks.json');

  beforeEach(async () => {
    storage = new Storage(testDir);
    // Clean up test directory before each test
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore if directory doesn't exist
    }
  });

  afterEach(async () => {
    // Clean up test directory after each test
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore if directory doesn't exist
    }
  });

  test('should create data directory on init', async () => {
    await storage.ensureDataDir();
    
    const exists = await fs.access(testDir).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  test('should load empty tasks when file does not exist', async () => {
    const tasks = await storage.loadTasks();
    
    expect(tasks).toEqual({});
  });

  test('should save and load tasks', async () => {
    const taskData = {
      'task-1': { id: 'task-1', name: 'Test Task', status: 'pending' }
    };
    
    await storage.saveTasks(taskData);
    const loaded = await storage.loadTasks();
    
    expect(loaded).toEqual(taskData);
  });

  test('should save a single task', async () => {
    const taskData = { id: 'task-1', name: 'Test Task', status: 'pending' };
    
    const saved = await storage.saveTask('task-1', taskData);
    const loaded = await storage.getTask('task-1');
    
    expect(saved).toEqual(taskData);
    expect(loaded).toEqual(taskData);
  });

  test('should get task by ID', async () => {
    const taskData = { id: 'task-1', name: 'Test Task', status: 'pending' };
    await storage.saveTask('task-1', taskData);
    
    const loaded = await storage.getTask('task-1');
    
    expect(loaded).toEqual(taskData);
  });

  test('should return null for non-existent task', async () => {
    const loaded = await storage.getTask('non-existent');
    
    expect(loaded).toBeNull();
  });

  test('should update existing task', async () => {
    const taskData = { id: 'task-1', name: 'Test Task', status: 'pending' };
    await storage.saveTask('task-1', taskData);
    
    const updates = { status: 'completed', completedAt: '2026-03-24' };
    const updated = await storage.updateTask('task-1', updates);
    
    expect(updated.status).toBe('completed');
    expect(updated.completedAt).toBe('2026-03-24');
    expect(updated.name).toBe('Test Task'); // Original field preserved
  });

  test('should return null when updating non-existent task', async () => {
    const updates = { status: 'completed' };
    const updated = await storage.updateTask('non-existent', updates);
    
    expect(updated).toBeNull();
  });

  test('should list all tasks', async () => {
    await storage.saveTask('task-1', { id: 'task-1', name: 'Task 1', status: 'pending', createdAt: '2026-03-24T10:00:00Z' });
    await storage.saveTask('task-2', { id: 'task-2', name: 'Task 2', status: 'completed', createdAt: '2026-03-24T11:00:00Z' });
    await storage.saveTask('task-3', { id: 'task-3', name: 'Task 3', status: 'pending', createdAt: '2026-03-24T12:00:00Z' });
    
    const tasks = await storage.listTasks();
    
    expect(tasks.length).toBe(3);
    // Should be sorted by createdAt descending
    expect(tasks[0].id).toBe('task-3');
    expect(tasks[1].id).toBe('task-2');
    expect(tasks[2].id).toBe('task-1');
  });

  test('should list tasks filtered by status', async () => {
    await storage.saveTask('task-1', { id: 'task-1', name: 'Task 1', status: 'pending', createdAt: '2026-03-24T10:00:00Z' });
    await storage.saveTask('task-2', { id: 'task-2', name: 'Task 2', status: 'completed', createdAt: '2026-03-24T11:00:00Z' });
    await storage.saveTask('task-3', { id: 'task-3', name: 'Task 3', status: 'pending', createdAt: '2026-03-24T12:00:00Z' });
    
    const pendingTasks = await storage.listTasks('pending');
    const completedTasks = await storage.listTasks('completed');
    
    expect(pendingTasks.length).toBe(2);
    expect(completedTasks.length).toBe(1);
    expect(completedTasks[0].id).toBe('task-2');
  });

  test('should delete task', async () => {
    await storage.saveTask('task-1', { id: 'task-1', name: 'Task 1' });
    
    await storage.deleteTask('task-1');
    const loaded = await storage.getTask('task-1');
    
    expect(loaded).toBeNull();
  });

  test('should handle empty file gracefully', async () => {
    await storage.ensureDataDir();
    await fs.writeFile(testFile, '');
    
    const tasks = await storage.loadTasks();
    
    expect(tasks).toEqual({});
  });

  test('should handle malformed JSON gracefully', async () => {
    await storage.ensureDataDir();
    await fs.writeFile(testFile, 'this is not valid json {{{');
    
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const tasks = await storage.loadTasks();
    
    expect(tasks).toEqual({});
    expect(consoleSpy).toHaveBeenCalledWith('Warning: Malformed JSON in tasks file, starting fresh');
    
    consoleSpy.mockRestore();
  });

  test('should handle concurrent access with mutex', async () => {
    const tasks = [];
    
    // Simulate concurrent writes
    for (let i = 0; i < 10; i++) {
      tasks.push(storage.saveTask(`task-${i}`, { id: `task-${i}`, index: i }));
    }
    
    await Promise.all(tasks);
    
    const allTasks = await storage.listTasks();
    expect(allTasks.length).toBe(10);
  });
});
