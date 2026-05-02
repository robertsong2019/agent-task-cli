const { PerformanceMonitor } = require('../src/monitoring/performance-monitor');

describe('PerformanceMonitor', () => {
  let monitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor({ sampleInterval: 999999, enableProfiling: false });
  });

  afterEach(() => {
    monitor.stop();
  });

  test('initializes with default stats', () => {
    expect(monitor.stats.totalTasks).toBe(0);
    expect(monitor.stats.failedTasks).toBe(0);
    expect(monitor.stats.successfulTasks).toBe(0);
  });

  test('startTask and endTask track a successful task', () => {
    monitor.startTask('t1', { pattern: 'sequential', name: 'test-task' });
    const result = monitor.endTask('t1', { ok: true });
    expect(result.success).toBe(true);
    expect(result.taskId).toBe('t1');
    expect(monitor.stats.totalTasks).toBe(1);
    expect(monitor.stats.successfulTasks).toBe(1);
    expect(monitor.stats.failedTasks).toBe(0);
  });

  test('endTask tracks a failed task', () => {
    monitor.startTask('t2', { pattern: 'parallel', name: 'fail-task' });
    monitor.endTask('t2', null, new Error('boom'));
    expect(monitor.stats.totalTasks).toBe(1);
    expect(monitor.stats.failedTasks).toBe(1);
    expect(monitor.stats.errorRate).toBe(1);
  });

  test('endTask with unknown taskId returns undefined', () => {
    const result = monitor.endTask('nonexistent', null);
    expect(result).toBeUndefined();
  });

  test('trackAgent and endAgent record agent metrics', () => {
    monitor.startTask('t3', { pattern: 'sequential', name: 'agent-task' });
    monitor.trackAgent('t3', 'a1', 'worker');
    const result = monitor.endAgent('t3', 'a1', true);
    expect(result.success).toBe(true);
    expect(result.agentId).toBe('a1');

    const agents = monitor.getMetrics().agents;
    const worker = agents.find(a => a.name === 'worker');
    expect(worker).toBeDefined();
    expect(worker.executions).toBe(1);
    expect(worker.successRate).toBe(1);
  });

  test('endAgent with unknown taskId returns undefined', () => {
    expect(monitor.endAgent('no-task', 'a1')).toBeUndefined();
  });

  test('endAgent with unknown agentId returns undefined', () => {
    monitor.startTask('t4', { pattern: 'sequential', name: 'x' });
    expect(monitor.endAgent('t4', 'ghost')).toBeUndefined();
  });

  test('trackAgent on unknown taskId does nothing', () => {
    monitor.trackAgent('no-task', 'a1', 'worker');
    // Should not throw, and agents map should be empty
    expect(monitor.getMetrics().agents.length).toBe(0);
  });

  test('getMetrics returns structured data', () => {
    monitor.startTask('t5', { pattern: 'map-reduce', name: 'm1' });
    monitor.endTask('t5', { done: true });

    const metrics = monitor.getMetrics();
    expect(metrics.stats.totalTasks).toBe(1);
    expect(Array.isArray(metrics.tasks)).toBe(true);
    expect(Array.isArray(metrics.patterns)).toBe(true);
  });

  test('getSummary formats stats with units', () => {
    monitor.startTask('t6', { pattern: 'sequential', name: 's1' });
    monitor.endTask('t6', {});

    const summary = monitor.getSummary();
    expect(summary.overview.totalTasks).toBe(1);
    expect(summary.overview.successRate).toBe('100.00%');
  });

  test('generateReport includes recommendations', () => {
    const report = monitor.generateReport();
    expect(report.generatedAt).toBeDefined();
    expect(report.summary).toBeDefined();
    expect(Array.isArray(report.recommendations)).toBe(true);
  });

  test('clear resets all metrics', () => {
    monitor.startTask('t7', { pattern: 'sequential', name: 'c1' });
    monitor.endTask('t7', {});

    monitor.clear();
    expect(monitor.stats.totalTasks).toBe(0);
    expect(monitor.getMetrics().tasks.length).toBe(0);
  });

  test('emits task:start and task:end events', () => {
    const starts = [];
    const ends = [];
    monitor.on('task:start', d => starts.push(d));
    monitor.on('task:end', d => ends.push(d));

    monitor.startTask('t8', { pattern: 'sequential', name: 'evt' });
    monitor.endTask('t8', {});

    expect(starts.length).toBe(1);
    expect(ends.length).toBe(1);
    expect(starts[0].taskId).toBe('t8');
  });

  test('pattern metrics aggregate across tasks', () => {
    monitor.startTask('p1', { pattern: 'sequential', name: 'a' });
    monitor.endTask('p1', {});
    monitor.startTask('p2', { pattern: 'sequential', name: 'b' });
    monitor.endTask('p2', null, new Error('fail'));

    const patterns = monitor.getMetrics().patterns;
    const seq = patterns.find(p => p.name === 'sequential');
    expect(seq.executions).toBe(2);
    expect(seq.successes).toBe(1);
    expect(seq.failures).toBe(1);
  });

  test('average utility returns 0 for empty array', () => {
    expect(monitor.average([])).toBe(0);
  });

  test('average utility calculates correctly', () => {
    expect(monitor.average([10, 20, 30])).toBeCloseTo(20);
  });
});
