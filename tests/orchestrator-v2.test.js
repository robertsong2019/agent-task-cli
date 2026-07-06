/**
 * Tests for orchestrator-v2.js — OrchestratorV2 and Task classes
 * Previously completely untested (0 references in test suite).
 */
const { Orchestrator, Task } = require('../src/orchestrator-v2');

describe('OrchestratorV2', () => {
  let orch;

  beforeEach(() => {
    orch = new Orchestrator({ maxConcurrent: 5, maxRetries: 2 });
  });

  afterEach(async () => {
    if (orch && orch.shutdown) {
      try { await orch.shutdown(); } catch {}
    }
  });

  describe('constructor', () => {
    test('creates instance with default options', () => {
      const o = new Orchestrator();
      expect(o.storage).toBeDefined();
      expect(o.logger).toBeDefined();
      expect(o.concurrencyManager).toBeDefined();
      expect(o.retryHandler).toBeDefined();
      expect(o.cache).toBeDefined();
      expect(o.activeTasks).toBeInstanceOf(Map);
      expect(o.taskDependencies).toBeInstanceOf(Map);
      expect(o.taskPriority).toBeInstanceOf(Map);
    });

    test('accepts custom options', () => {
      const o = new Orchestrator({ maxConcurrent: 20, maxRetries: 5, cacheSize: 50 });
      expect(o.options.maxConcurrent).toBe(20);
      expect(o.options.maxRetries).toBe(5);
    });

    test('registers all built-in patterns', () => {
      expect(orch.patterns['work-crew']).toBeDefined();
      expect(orch.patterns['supervisor']).toBeDefined();
      expect(orch.patterns['pipeline']).toBeDefined();
      expect(orch.patterns['council']).toBeDefined();
      expect(orch.patterns['auto-routing']).toBeDefined();
    });
  });

  describe('getPattern()', () => {
    test('returns pattern class for valid name', () => {
      const PatternClass = orch.getPattern('work-crew');
      expect(PatternClass).toBeDefined();
    });

    test('throws for unknown pattern', () => {
      expect(() => orch.getPattern('nonexistent')).toThrow(/Unknown pattern/);
    });
  });

  describe('getStats()', () => {
    test('returns stats object with expected keys', () => {
      const stats = orch.getStats();
      expect(stats).toHaveProperty('activeTasks');
      expect(stats).toHaveProperty('concurrency');
      expect(stats).toHaveProperty('cache');
      expect(stats).toHaveProperty('retries');
      expect(stats.activeTasks).toBe(0);
    });
  });

  describe('clearCache()', () => {
    test('clears the cache', () => {
      const result = orch.clearCache();
      // cache.clear() returns count or undefined; just verify no throw
      expect(orch.cache.getStats().size).toBe(0);
    });
  });

  describe('checkDependencies()', () => {
    test('returns empty array when all deps are completed', async () => {
      // Save a completed task
      const taskId = 'dep-1';
      await orch.storage.saveTask(taskId, { id: taskId, status: 'completed' });
      const unmet = await orch.checkDependencies([taskId]);
      expect(unmet).toEqual([]);
    });

    test('returns unmet deps for non-existent tasks', async () => {
      const unmet = await orch.checkDependencies(['nonexistent']);
      expect(unmet).toEqual(['nonexistent']);
    });

    test('returns unmet deps for non-completed tasks', async () => {
      const taskId = 'dep-pending';
      await orch.storage.saveTask(taskId, { id: taskId, status: 'pending' });
      const unmet = await orch.checkDependencies([taskId]);
      expect(unmet).toEqual([taskId]);
    });

    test('handles mixed deps', async () => {
      await orch.storage.saveTask('done', { id: 'done', status: 'completed' });
      await orch.storage.saveTask('running', { id: 'running', status: 'running' });
      const unmet = await orch.checkDependencies(['done', 'running', 'missing']);
      expect(unmet).toContain('running');
      expect(unmet).toContain('missing');
      expect(unmet).not.toContain('done');
    });
  });

  describe('cancel()', () => {
    test('cleans up dependencies and priority for cancelled task', async () => {
      // Manually put a task in the maps
      orch.taskDependencies.set('fake-id', ['dep1']);
      orch.taskPriority.set('fake-id', 'high');
      
      await orch.cancel('fake-id');
      
      expect(orch.taskDependencies.has('fake-id')).toBe(false);
      expect(orch.taskPriority.has('fake-id')).toBe(false);
    });

    test('updates storage with cancelled status', async () => {
      await orch.storage.saveTask('cancel-test', { id: 'cancel-test', status: 'running' });
      await orch.cancel('cancel-test');
      const task = await orch.storage.getTask('cancel-test');
      expect(task.status).toBe('cancelled');
    });
  });

  describe('run() with dependencies', () => {
    test('throws on unmet dependencies', async () => {
      const config = {
        name: 'test-task',
        pattern: 'work-crew',
        agents: [{ name: 'A', role: 'worker' }],
        task: 'do something',
        dependencies: ['nonexistent-dep']
      };

      await expect(orch.run(config)).rejects.toThrow(/Unmet dependencies/);
    });
  });

  describe('shutdown()', () => {
    test('clears active tasks and drains resources', async () => {
      // Should complete without error
      await orch.shutdown();
      expect(orch.activeTasks.size).toBe(0);
    });

    test('can be called when no active tasks exist', async () => {
      const o = new Orchestrator();
      await o.shutdown();
      expect(o.activeTasks.size).toBe(0);
    });
  });
});

describe('Task (from orchestrator-v2)', () => {
  let orch;

  beforeEach(() => {
    orch = new Orchestrator();
  });

  afterEach(async () => {
    try { await orch.shutdown(); } catch {}
  });

  describe('constructor', () => {
    test('initializes with correct defaults', () => {
      const task = new Task('test-id', { name: 'test', pattern: 'work-crew' }, orch, {});
      expect(task.id).toBe('test-id');
      expect(task.status).toBe('pending');
      expect(task.progress).toBe(0);
      expect(task.agents).toEqual([]);
      expect(task.results).toBeNull();
      expect(task.error).toBeNull();
      expect(task.cancelled).toBe(false);
      expect(task.retryCount).toBe(0);
      expect(task.createdAt).toBeDefined();
    });

    test('sets config and orchestrator references', () => {
      const config = { name: 'test', pattern: 'work-crew' };
      const task = new Task('id-1', config, orch, { foo: 'bar' });
      expect(task.config).toBe(config);
      expect(task.orchestrator).toBe(orch);
      expect(task.options).toEqual({ foo: 'bar' });
    });
  });

  describe('cancel()', () => {
    test('sets cancelled flag and status', () => {
      const task = new Task('id', {}, orch, {});
      task.cancel();
      expect(task.cancelled).toBe(true);
      expect(task.status).toBe('cancelled');
    });

    test('emits cancelled event', (done) => {
      const task = new Task('id', {}, orch, {});
      task.on('cancelled', () => done());
      task.cancel();
    });
  });

  describe('toJSON()', () => {
    test('serializes task to plain object', () => {
      const config = { name: 'my-task', pattern: 'work-crew' };
      const task = new Task('id-42', config, orch, {});
      task.status = 'completed';
      task.progress = 100;
      task.results = { output: 'done' };

      const json = task.toJSON();
      expect(json.id).toBe('id-42');
      expect(json.name).toBe('my-task');
      expect(json.pattern).toBe('work-crew');
      expect(json.status).toBe('completed');
      expect(json.progress).toBe(100);
      expect(json.results).toEqual({ output: 'done' });
      expect(json.error).toBeNull();
      expect(json.agents).toEqual([]);
    });
  });
});
