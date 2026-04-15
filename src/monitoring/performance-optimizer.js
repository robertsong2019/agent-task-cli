/**
 * Performance Optimizer - Analyzes and optimizes orchestrator performance
 * Provides tools for identifying bottlenecks and optimizing execution
 */

const { PerformanceMonitor } = require('./performance-monitor');

class PerformanceOptimizer {
  constructor(orchestrator, options = {}) {
    this.orchestrator = orchestrator;
    this.monitor = new PerformanceMonitor(options);
    this.optimizations = new Map();
    this.bottlenecks = [];
  }

  /**
   * Analyze current performance and identify bottlenecks
   */
  async analyze() {
    const analysis = {
      bottlenecks: [],
      recommendations: [],
      optimizations: [],
      metrics: {}
    };
    
    // Get current metrics
    const metrics = this.monitor.getMetrics();
    analysis.metrics = {
      taskCount: metrics.stats.totalTasks,
      avgDuration: metrics.stats.avgTaskDuration,
      throughput: metrics.stats.throughput,
      errorRate: metrics.stats.errorRate
    };
    
    // Analyze patterns
    const patternAnalysis = this.analyzePatterns(metrics.patterns);
    analysis.bottlenecks.push(...patternAnalysis.bottlenecks);
    analysis.recommendations.push(...patternAnalysis.recommendations);
    
    // Analyze agents
    const agentAnalysis = this.analyzeAgents(metrics.agents);
    analysis.bottlenecks.push(...agentAnalysis.bottlenecks);
    analysis.recommendations.push(...agentAnalysis.recommendations);
    
    // Analyze system resources
    const systemAnalysis = this.analyzeSystem(metrics.system);
    analysis.bottlenecks.push(...systemAnalysis.bottlenecks);
    analysis.recommendations.push(...systemAnalysis.recommendations);
    
    // Identify optimization opportunities
    analysis.optimizations = this.identifyOptimizations(analysis);
    
    this.bottlenecks = analysis.bottlenecks;
    
    return analysis;
  }

  /**
   * Analyze pattern performance
   */
  analyzePatterns(patterns) {
    const bottlenecks = [];
    const recommendations = [];
    
    patterns.forEach(pattern => {
      // Check for slow patterns
      if (pattern.avgDuration > 5000) {
        bottlenecks.push({
          type: 'pattern',
          name: pattern.name,
          severity: 'high',
          metric: 'avgDuration',
          value: pattern.avgDuration,
          description: `Pattern "${pattern.name}" has high average duration`
        });
        
        recommendations.push({
          type: 'optimization',
          target: pattern.name,
          action: 'Consider using caching or parallelizing agents',
          priority: 'high'
        });
      }
      
      // Check for low success rate
      if (pattern.successRate < 0.9) {
        bottlenecks.push({
          type: 'pattern',
          name: pattern.name,
          severity: 'medium',
          metric: 'successRate',
          value: pattern.successRate,
          description: `Pattern "${pattern.name}" has low success rate`
        });
        
        recommendations.push({
          type: 'reliability',
          target: pattern.name,
          action: 'Review error handling and retry logic',
          priority: 'medium'
        });
      }
      
      // Check for high variance
      const variance = pattern.maxDuration - pattern.minDuration;
      const avgVariance = variance / pattern.avgDuration;
      if (avgVariance > 2) {
        recommendations.push({
          type: 'stability',
          target: pattern.name,
          action: 'High variance detected. Consider standardizing agent prompts or adding timeouts',
          priority: 'low'
        });
      }
    });
    
    return { bottlenecks, recommendations };
  }

  /**
   * Analyze agent performance
   */
  analyzeAgents(agents) {
    const bottlenecks = [];
    const recommendations = [];
    
    // Sort agents by average duration
    const sortedAgents = Array.from(agents).sort((a, b) => b.avgDuration - a.avgDuration);
    
    // Identify slow agents
    const slowAgents = sortedAgents.slice(0, 5);
    slowAgents.forEach(agent => {
      if (agent.avgDuration > 3000) {
        bottlenecks.push({
          type: 'agent',
          name: agent.name,
          severity: 'medium',
          metric: 'avgDuration',
          value: agent.avgDuration,
          description: `Agent "${agent.name}" is slow`
        });
        
        recommendations.push({
          type: 'optimization',
          target: agent.name,
          action: 'Optimize agent prompts or use faster LLM model',
          priority: 'medium'
        });
      }
    });
    
    // Identify agents with low success rate
    agents.forEach(agent => {
      if (agent.successRate < 0.85 && agent.executions > 5) {
        bottlenecks.push({
          type: 'agent',
          name: agent.name,
          severity: 'high',
          metric: 'successRate',
          value: agent.successRate,
          description: `Agent "${agent.name}" has low success rate`
        });
        
        recommendations.push({
          type: 'reliability',
          target: agent.name,
          action: 'Review agent role definition and improve error handling',
          priority: 'high'
        });
      }
    });
    
    return { bottlenecks, recommendations };
  }

  /**
   * Analyze system resources
   */
  analyzeSystem(system) {
    const bottlenecks = [];
    const recommendations = [];
    
    // Check event loop lag
    const avgLag = this.average(system.eventLoop.map(e => e.lag));
    if (avgLag > 50) {
      bottlenecks.push({
        type: 'system',
        name: 'event-loop',
        severity: avgLag > 100 ? 'high' : 'medium',
        metric: 'eventLoopLag',
        value: avgLag,
        description: 'Event loop lag detected'
      });
      
      recommendations.push({
        type: 'performance',
        target: 'system',
        action: 'Reduce concurrent operations or optimize CPU-intensive tasks',
        priority: 'high'
      });
    }
    
    // Check memory usage
    const latestMemory = system.memory[system.memory.length - 1];
    if (latestMemory) {
      const heapUsageRatio = latestMemory.heapUsed / latestMemory.heapTotal;
      if (heapUsageRatio > 0.9) {
        bottlenecks.push({
          type: 'system',
          name: 'memory',
          severity: 'high',
          metric: 'heapUsage',
          value: heapUsageRatio,
          description: 'High memory usage detected'
        });
        
        recommendations.push({
          type: 'performance',
          target: 'system',
          action: 'Increase maxConcurrent limit or implement task cleanup',
          priority: 'high'
        });
      }
    }
    
    return { bottlenecks, recommendations };
  }

  /**
   * Identify optimization opportunities
   */
  identifyOptimizations(analysis) {
    const optimizations = [];
    
    // Check if caching would help
    const repeatedTasks = this.findRepeatedTasks();
    if (repeatedTasks.length > 0) {
      optimizations.push({
        type: 'caching',
        description: 'Enable caching for repeated tasks',
        impact: 'high',
        tasks: repeatedTasks
      });
    }
    
    // Check if parallelization would help
    const sequentialPatterns = analysis.bottlenecks.filter(
      b => b.type === 'pattern' && b.metric === 'avgDuration'
    );
    if (sequentialPatterns.length > 0) {
      optimizations.push({
        type: 'parallelization',
        description: 'Parallelize agent execution where possible',
        impact: 'medium',
        patterns: sequentialPatterns.map(p => p.name)
      });
    }
    
    // Check if batch processing would help
    if (analysis.metrics.throughput < 10) {
      optimizations.push({
        type: 'batching',
        description: 'Consider batch processing for better throughput',
        impact: 'medium'
      });
    }
    
    return optimizations;
  }

  /**
   * Find repeated tasks that could benefit from caching
   */
  findRepeatedTasks() {
    const taskSignatures = new Map();
    const metrics = this.monitor.getMetrics();
    
    metrics.tasks.forEach(task => {
      const signature = `${task.pattern}:${task.name}`;
      taskSignatures.set(signature, (taskSignatures.get(signature) || 0) + 1);
    });
    
    const repeated = [];
    taskSignatures.forEach((count, signature) => {
      if (count > 2) {
        repeated.push({ signature, count });
      }
    });
    
    return repeated;
  }

  /**
   * Apply automatic optimizations
   */
  async applyOptimizations(optimizations) {
    const results = [];
    
    for (const opt of optimizations) {
      try {
        switch (opt.type) {
        case 'caching':
          // Enable caching in orchestrator
          this.orchestrator.options.useCache = true;
          results.push({ type: opt.type, status: 'applied', description: 'Caching enabled' });
          break;
            
        case 'parallelization':
          // Increase concurrency
          const currentMax = this.orchestrator.concurrencyManager?.maxConcurrent || 5;
          this.orchestrator.concurrencyManager?.setMaxConcurrent(currentMax * 2);
          results.push({ type: opt.type, status: 'applied', description: 'Concurrency increased' });
          break;
            
        case 'batching':
          // Configure for batch processing
          results.push({ type: opt.type, status: 'requires-config', description: 'Manual configuration needed' });
          break;
        }
      } catch (error) {
        results.push({ type: opt.type, status: 'failed', error: error.message });
      }
    }
    
    return results;
  }

  /**
   * Generate optimization report
   */
  generateReport() {
    const analysis = this.analyze();
    
    return {
      timestamp: new Date().toISOString(),
      summary: {
        totalBottlenecks: analysis.bottlenecks.length,
        criticalBottlenecks: analysis.bottlenecks.filter(b => b.severity === 'high').length,
        optimizationOpportunities: analysis.optimizations.length
      },
      bottlenecks: analysis.bottlenecks,
      recommendations: analysis.recommendations.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }),
      optimizations: analysis.optimizations,
      nextSteps: this.generateNextSteps(analysis)
    };
  }

  /**
   * Generate actionable next steps
   */
  generateNextSteps(analysis) {
    const steps = [];
    
    // High priority bottlenecks
    const critical = analysis.bottlenecks.filter(b => b.severity === 'high');
    if (critical.length > 0) {
      steps.push({
        priority: 1,
        action: 'Address critical bottlenecks',
        details: critical.map(b => b.description).join('; ')
      });
    }
    
    // High impact optimizations
    const highImpact = analysis.optimizations.filter(o => o.impact === 'high');
    if (highImpact.length > 0) {
      steps.push({
        priority: 2,
        action: 'Implement high-impact optimizations',
        details: highImpact.map(o => o.description).join('; ')
      });
    }
    
    // High priority recommendations
    const urgentRecs = analysis.recommendations.filter(r => r.priority === 'high');
    if (urgentRecs.length > 0) {
      steps.push({
        priority: 3,
        action: 'Apply urgent recommendations',
        details: urgentRecs.map(r => r.action).join('; ')
      });
    }
    
    return steps;
  }

  /**
   * Utility: Calculate average
   */
  average(arr) {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
}

module.exports = { PerformanceOptimizer };
