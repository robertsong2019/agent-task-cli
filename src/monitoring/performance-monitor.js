/**
 * Performance Monitor - Collects and analyzes performance metrics
 * Integrates with Orchestrator for automatic tracking
 */

const { performance, PerformanceObserver } = require('perf_hooks');
const EventEmitter = require('events');

class PerformanceMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      sampleInterval: options.sampleInterval || 60000, // 1 minute
      maxSamples: options.maxSamples || 1000,
      enableProfiling: options.enableProfiling || false,
      ...options
    };
    
    // Metrics storage
    this.metrics = {
      tasks: new Map(),
      agents: new Map(),
      patterns: new Map(),
      system: {
        cpu: [],
        memory: [],
        eventLoop: []
      }
    };
    
    // Performance marks
    this.marks = new Map();
    
    // Aggregated stats
    this.stats = {
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      totalAgents: 0,
      avgTaskDuration: 0,
      avgAgentDuration: 0,
      throughput: 0, // tasks per minute
      errorRate: 0
    };
    
    // Start system monitoring
    this.startSystemMonitoring();
    
    // Setup performance observer
    if (this.options.enableProfiling) {
      this.setupPerformanceObserver();
    }
  }

  /**
   * Start monitoring a task
   */
  startTask(taskId, config) {
    const mark = `task-${taskId}-start`;
    performance.mark(mark);
    
    this.marks.set(taskId, {
      startMark: mark,
      config,
      startTime: Date.now(),
      agentMetrics: new Map()
    });
    
    this.metrics.tasks.set(taskId, {
      id: taskId,
      pattern: config.pattern,
      name: config.name,
      status: 'running',
      startTime: Date.now(),
      agents: config.agents?.length || 0
    });
    
    this.emit('task:start', { taskId, config });
  }

  /**
   * End monitoring a task
   */
  endTask(taskId, result, error = null) {
    const taskMark = this.marks.get(taskId);
    if (!taskMark) return;
    
    const endMark = `task-${taskId}-end`;
    performance.mark(endMark);
    
    try {
      performance.measure(`task-${taskId}`, taskMark.startMark, endMark);
    } catch (e) {
      // Measure might already exist
    }
    
    const duration = Date.now() - taskMark.startTime;
    
    // Update task metrics
    const taskMetric = this.metrics.tasks.get(taskId);
    if (taskMetric) {
      taskMetric.status = error ? 'failed' : 'completed';
      taskMetric.endTime = Date.now();
      taskMetric.duration = duration;
      taskMetric.error = error?.message;
      taskMetric.resultSize = JSON.stringify(result).length;
    }
    
    // Update pattern metrics
    this.updatePatternMetrics(taskMark.config.pattern, duration, !error);
    
    // Update stats
    this.stats.totalTasks++;
    if (error) {
      this.stats.failedTasks++;
    } else {
      this.stats.successfulTasks++;
    }
    this.updateAverages();
    
    // Cleanup
    this.marks.delete(taskId);
    
    this.emit('task:end', { taskId, duration, error });
    
    return {
      taskId,
      duration,
      success: !error
    };
  }

  /**
   * Track agent execution
   */
  trackAgent(taskId, agentId, agentName) {
    const taskMark = this.marks.get(taskId);
    if (!taskMark) return;
    
    const mark = `agent-${agentId}-start`;
    performance.mark(mark);
    
    taskMark.agentMetrics.set(agentId, {
      startMark: mark,
      agentName,
      startTime: Date.now()
    });
    
    // Update agent metrics
    if (!this.metrics.agents.has(agentName)) {
      this.metrics.agents.set(agentName, {
        name: agentName,
        executions: 0,
        totalDuration: 0,
        avgDuration: 0,
        successRate: 0,
        successes: 0,
        failures: 0
      });
    }
    
    this.emit('agent:start', { taskId, agentId, agentName });
  }

  /**
   * End agent tracking
   */
  endAgent(taskId, agentId, success = true) {
    const taskMark = this.marks.get(taskId);
    if (!taskMark) return;
    
    const agentMetric = taskMark.agentMetrics.get(agentId);
    if (!agentMetric) return;
    
    const endMark = `agent-${agentId}-end`;
    performance.mark(endMark);
    
    try {
      performance.measure(`agent-${agentId}`, agentMetric.startMark, endMark);
    } catch (e) {
      // Measure might already exist
    }
    
    const duration = Date.now() - agentMetric.startTime;
    
    // Update agent metrics
    const agentStats = this.metrics.agents.get(agentMetric.agentName);
    if (agentStats) {
      agentStats.executions++;
      agentStats.totalDuration += duration;
      agentStats.avgDuration = agentStats.totalDuration / agentStats.executions;
      
      if (success) {
        agentStats.successes++;
      } else {
        agentStats.failures++;
      }
      agentStats.successRate = agentStats.successes / agentStats.executions;
    }
    
    this.emit('agent:end', { taskId, agentId, duration, success });
    
    return { agentId, duration, success };
  }

  /**
   * Update pattern metrics
   */
  updatePatternMetrics(pattern, duration, success) {
    if (!this.metrics.patterns.has(pattern)) {
      this.metrics.patterns.set(pattern, {
        name: pattern,
        executions: 0,
        totalDuration: 0,
        avgDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        successRate: 0,
        successes: 0,
        failures: 0
      });
    }
    
    const patternStats = this.metrics.patterns.get(pattern);
    patternStats.executions++;
    patternStats.totalDuration += duration;
    patternStats.avgDuration = patternStats.totalDuration / patternStats.executions;
    patternStats.minDuration = Math.min(patternStats.minDuration, duration);
    patternStats.maxDuration = Math.max(patternStats.maxDuration, duration);
    
    if (success) {
      patternStats.successes++;
    } else {
      patternStats.failures++;
    }
    patternStats.successRate = patternStats.successes / patternStats.executions;
  }

  /**
   * Update average calculations
   */
  updateAverages() {
    // Calculate average task duration
    let totalDuration = 0;
    let count = 0;
    
    for (const [_id, task] of this.metrics.tasks) {
      if (task.duration) {
        totalDuration += task.duration;
        count++;
      }
    }
    
    this.stats.avgTaskDuration = count > 0 ? totalDuration / count : 0;
    
    // Calculate average agent duration
    totalDuration = 0;
    count = 0;
    
    for (const [_name, agent] of this.metrics.agents) {
      totalDuration += agent.totalDuration;
      count += agent.executions;
    }
    
    this.stats.avgAgentDuration = count > 0 ? totalDuration / count : 0;
    
    // Calculate error rate
    this.stats.errorRate = this.stats.totalTasks > 0
      ? this.stats.failedTasks / this.stats.totalTasks
      : 0;
    
    // Calculate throughput (tasks per minute)
    const oneMinuteAgo = Date.now() - 60000;
    const recentTasks = Array.from(this.metrics.tasks.values())
      .filter(t => t.startTime > oneMinuteAgo);
    this.stats.throughput = recentTasks.length;
  }

  /**
   * Start system resource monitoring
   */
  startSystemMonitoring() {
    this.systemMonitorInterval = setInterval(() => {
      // CPU usage
      const cpuUsage = process.cpuUsage();
      const memoryUsage = process.memoryUsage();
      
      // Event loop lag
      const start = performance.now();
      setImmediate(() => {
        const lag = performance.now() - start;
        this.metrics.system.eventLoop.push({
          timestamp: Date.now(),
          lag
        });
        
        // Keep only last 100 samples
        if (this.metrics.system.eventLoop.length > 100) {
          this.metrics.system.eventLoop.shift();
        }
      });
      
      // Memory
      this.metrics.system.memory.push({
        timestamp: Date.now(),
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        rss: memoryUsage.rss
      });
      
      // Keep only last 100 samples
      if (this.metrics.system.memory.length > 100) {
        this.metrics.system.memory.shift();
      }
      
      // CPU
      this.metrics.system.cpu.push({
        timestamp: Date.now(),
        user: cpuUsage.user,
        system: cpuUsage.system
      });
      
      if (this.metrics.system.cpu.length > 100) {
        this.metrics.system.cpu.shift();
      }
      
      this.emit('system:sample', {
        cpu: cpuUsage,
        memory: memoryUsage
      });
      
    }, this.options.sampleInterval);
  }

  /**
   * Setup performance observer for detailed profiling
   */
  setupPerformanceObserver() {
    const obs = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach(entry => {
        this.emit('performance:entry', {
          name: entry.name,
          duration: entry.duration,
          startTime: entry.startTime,
          entryType: entry.entryType
        });
      });
    });
    
    obs.observe({ entryTypes: ['measure'], buffered: true });
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      stats: { ...this.stats },
      tasks: Array.from(this.metrics.tasks.values()),
      agents: Array.from(this.metrics.agents.values()),
      patterns: Array.from(this.metrics.patterns.values()),
      system: {
        memory: this.metrics.system.memory.slice(-10),
        cpu: this.metrics.system.cpu.slice(-10),
        eventLoop: this.metrics.system.eventLoop.slice(-10)
      }
    };
  }

  /**
   * Get performance summary
   */
  getSummary() {
    const metrics = this.getMetrics();
    
    return {
      overview: {
        totalTasks: metrics.stats.totalTasks,
        successRate: ((metrics.stats.successfulTasks / metrics.stats.totalTasks) * 100).toFixed(2) + '%',
        avgTaskDuration: metrics.stats.avgTaskDuration.toFixed(2) + 'ms',
        throughput: metrics.stats.throughput + ' tasks/min'
      },
      patterns: metrics.patterns.map(p => ({
        name: p.name,
        executions: p.executions,
        avgDuration: p.avgDuration.toFixed(2) + 'ms',
        successRate: (p.successRate * 100).toFixed(2) + '%'
      })),
      topAgents: metrics.agents
        .sort((a, b) => b.executions - a.executions)
        .slice(0, 5)
        .map(a => ({
          name: a.name,
          executions: a.executions,
          avgDuration: a.avgDuration.toFixed(2) + 'ms',
          successRate: (a.successRate * 100).toFixed(2) + '%'
        })),
      system: {
        avgEventLoopLag: this.average(metrics.system.eventLoop.map(e => e.lag)).toFixed(2) + 'ms',
        currentMemoryUsage: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2) + 'MB'
      }
    };
  }

  /**
   * Generate performance report
   */
  generateReport() {
    const summary = this.getSummary();
    const metrics = this.getMetrics();
    
    return {
      generatedAt: new Date().toISOString(),
      summary,
      details: metrics,
      recommendations: this.generateRecommendations(summary)
    };
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations(summary) {
    const recommendations = [];
    
    // Check error rate
    const errorRate = parseFloat(summary.overview.successRate);
    if (errorRate < 95) {
      recommendations.push({
        type: 'reliability',
        severity: 'high',
        message: `High error rate detected (${(100 - errorRate).toFixed(2)}%). Review failed tasks and improve error handling.`
      });
    }
    
    // Check average task duration
    const avgDuration = parseFloat(summary.overview.avgTaskDuration);
    if (avgDuration > 5000) {
      recommendations.push({
        type: 'performance',
        severity: 'medium',
        message: `Average task duration is high (${avgDuration}ms). Consider optimizing agent prompts or using caching.`
      });
    }
    
    // Check event loop lag
    const eventLoopLag = parseFloat(summary.system.avgEventLoopLag);
    if (eventLoopLag > 100) {
      recommendations.push({
        type: 'performance',
        severity: 'medium',
        message: `Event loop lag detected (${eventLoopLag}ms). Consider reducing concurrent operations or optimizing CPU-intensive tasks.`
      });
    }
    
    // Check pattern performance
    summary.patterns.forEach(pattern => {
      const avgDur = parseFloat(pattern.avgDuration);
      if (avgDur > 10000) {
        recommendations.push({
          type: 'optimization',
          severity: 'low',
          message: `Pattern "${pattern.name}" has high average duration (${pattern.avgDuration}). Consider optimizing or parallelizing.`
        });
      }
    });
    
    return recommendations;
  }

  /**
   * Clear all metrics
   */
  clear() {
    this.metrics.tasks.clear();
    this.metrics.agents.clear();
    this.metrics.patterns.clear();
    this.metrics.system.cpu = [];
    this.metrics.system.memory = [];
    this.metrics.system.eventLoop = [];
    this.marks.clear();
    
    this.stats = {
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      totalAgents: 0,
      avgTaskDuration: 0,
      avgAgentDuration: 0,
      throughput: 0,
      errorRate: 0
    };
    
    this.emit('cleared');
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.systemMonitorInterval) {
      clearInterval(this.systemMonitorInterval);
    }
    this.emit('stopped');
  }

  /**
   * Utility: Calculate average
   */
  average(arr) {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
}

module.exports = { PerformanceMonitor };
