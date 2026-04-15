/**
 * Orchestrator Middleware - Integrates PerformanceMonitor with Orchestrator
 * Provides automatic performance tracking for all orchestrator operations
 */

const { PerformanceMonitor } = require('./performance-monitor');

class OrchestratorMiddleware {
  constructor(orchestrator, options = {}) {
    this.orchestrator = orchestrator;
    this.monitor = new PerformanceMonitor(options);
    this.enabled = true;
    
    // Hook into orchestrator events
    this.setupHooks();
  }

  /**
   * Setup hooks into orchestrator lifecycle
   */
  setupHooks() {
    // Wrap the run method
    const originalRun = this.orchestrator.run.bind(this.orchestrator);
    
    this.orchestrator.run = (config, options = {}) => {
      if (!this.enabled) {
        return originalRun(config, options);
      }
      
      const task = originalRun(config, options);
      
      // Start monitoring
      this.monitor.startTask(task.id, config);
      
      // Track task lifecycle
      task.on('progress', (update) => {
        if (update.agentId) {
          // Track agent execution
          if (update.status === 'running') {
            this.monitor.trackAgent(task.id, update.agentId, update.agentId);
          } else if (update.status === 'completed' || update.status === 'failed') {
            this.monitor.endAgent(task.id, update.agentId, update.status === 'completed');
          }
        }
      });
      
      task.on('complete', (result) => {
        this.monitor.endTask(task.id, result);
      });
      
      task.on('error', (error) => {
        this.monitor.endTask(task.id, null, error);
      });
      
      return task;
    };
    
    // Wrap the cancel method
    const originalCancel = this.orchestrator.cancel.bind(this.orchestrator);
    
    this.orchestrator.cancel = (taskId) => {
      if (this.enabled) {
        this.monitor.endTask(taskId, null, new Error('Task cancelled'));
      }
      return originalCancel(taskId);
    };
  }

  /**
   * Enable monitoring
   */
  enable() {
    this.enabled = true;
  }

  /**
   * Disable monitoring
   */
  disable() {
    this.enabled = false;
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return this.monitor.getMetrics();
  }

  /**
   * Get performance summary
   */
  getSummary() {
    return this.monitor.getSummary();
  }

  /**
   * Generate performance report
   */
  generateReport() {
    return this.monitor.generateReport();
  }

  /**
   * Clear metrics
   */
  clearMetrics() {
    this.monitor.clear();
  }

  /**
   * Stop monitoring
   */
  stop() {
    this.monitor.stop();
    this.enabled = false;
  }

  /**
   * Export metrics for external monitoring systems
   */
  exportMetrics(format = 'json') {
    const report = this.generateReport();
    
    switch (format) {
    case 'prometheus':
      return this.toPrometheusFormat(report);
    case 'json':
    default:
      return JSON.stringify(report, null, 2);
    }
  }

  /**
   * Convert metrics to Prometheus format
   */
  toPrometheusFormat(report) {
    const lines = [];
    const { summary } = report;
    
    // Task metrics
    lines.push('# HELP orchestrator_tasks_total Total number of tasks');
    lines.push('# TYPE orchestrator_tasks_total counter');
    lines.push(`orchestrator_tasks_total ${summary.overview.totalTasks}`);
    
    lines.push('# HELP orchestrator_tasks_success_rate Task success rate');
    lines.push('# TYPE orchestrator_tasks_success_rate gauge');
    lines.push(`orchestrator_tasks_success_rate ${parseFloat(summary.overview.successRate) / 100}`);
    
    lines.push('# HELP orchestrator_tasks_avg_duration_ms Average task duration in milliseconds');
    lines.push('# TYPE orchestrator_tasks_avg_duration_ms gauge');
    lines.push(`orchestrator_tasks_avg_duration_ms ${parseFloat(summary.overview.avgTaskDuration)}`);
    
    lines.push('# HELP orchestrator_tasks_throughput Tasks per minute');
    lines.push('# TYPE orchestrator_tasks_throughput gauge');
    lines.push(`orchestrator_tasks_throughput ${summary.overview.throughput}`);
    
    // Pattern metrics
    lines.push('# HELP orchestrator_pattern_executions Pattern execution count');
    lines.push('# TYPE orchestrator_pattern_executions counter');
    
    summary.patterns.forEach(pattern => {
      const patternName = pattern.name.replace(/-/g, '_');
      lines.push(`orchestrator_pattern_executions{pattern="${patternName}"} ${pattern.executions}`);
      lines.push(`orchestrator_pattern_avg_duration_ms{pattern="${patternName}"} ${parseFloat(pattern.avgDuration)}`);
      lines.push(`orchestrator_pattern_success_rate{pattern="${patternName}"} ${parseFloat(pattern.successRate) / 100}`);
    });
    
    // Agent metrics
    lines.push('# HELP orchestrator_agent_executions Agent execution count');
    lines.push('# TYPE orchestrator_agent_executions counter');
    
    summary.topAgents.forEach(agent => {
      const agentName = agent.name.replace(/[^a-zA-Z0-9_]/g, '_');
      lines.push(`orchestrator_agent_executions{agent="${agentName}"} ${agent.executions}`);
      lines.push(`orchestrator_agent_avg_duration_ms{agent="${agentName}"} ${parseFloat(agent.avgDuration)}`);
      lines.push(`orchestrator_agent_success_rate{agent="${agentName}"} ${parseFloat(agent.successRate) / 100}`);
    });
    
    // System metrics
    lines.push('# HELP orchestrator_event_loop_lag_ms Event loop lag in milliseconds');
    lines.push('# TYPE orchestrator_event_loop_lag_ms gauge');
    lines.push(`orchestrator_event_loop_lag_ms ${parseFloat(summary.system.avgEventLoopLag)}`);
    
    lines.push('# HELP orchestrator_memory_usage_bytes Current memory usage');
    lines.push('# TYPE orchestrator_memory_usage_bytes gauge');
    lines.push(`orchestrator_memory_usage_bytes ${parseFloat(summary.system.currentMemoryUsage) * 1024 * 1024}`);
    
    return lines.join('\n');
  }

  /**
   * Create real-time dashboard data
   */
  getDashboardData() {
    const summary = this.getSummary();
    const metrics = this.getMetrics();
    
    return {
      timestamp: Date.now(),
      overview: summary.overview,
      recentTasks: metrics.tasks.slice(-10),
      patternStats: summary.patterns,
      agentStats: summary.topAgents,
      systemHealth: {
        eventLoopLag: summary.system.avgEventLoopLag,
        memoryUsage: summary.system.currentMemoryUsage,
        status: this.assessSystemHealth(summary)
      },
      recommendations: summary.recommendations || []
    };
  }

  /**
   * Assess system health
   */
  assessSystemHealth(summary) {
    const issues = [];
    
    const errorRate = parseFloat(summary.overview.successRate);
    const eventLoopLag = parseFloat(summary.system.avgEventLoopLag);
    
    if (errorRate < 90) {
      issues.push('critical');
    } else if (errorRate < 95) {
      issues.push('warning');
    }
    
    if (eventLoopLag > 100) {
      issues.push('critical');
    } else if (eventLoopLag > 50) {
      issues.push('warning');
    }
    
    if (issues.includes('critical')) {
      return 'critical';
    } else if (issues.includes('warning')) {
      return 'warning';
    }
    return 'healthy';
  }
}

/**
 * Helper function to add monitoring to an orchestrator
 */
function addMonitoring(orchestrator, options = {}) {
  return new OrchestratorMiddleware(orchestrator, options);
}

module.exports = { OrchestratorMiddleware, addMonitoring };
