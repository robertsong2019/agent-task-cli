const { v4: uuidv4 } = require('uuid');
const { EventEmitter } = require('events');
const { Storage } = require('./utils/storage');
const { Logger } = require('./utils/logger');
const PerformanceManager = require('./utils/performance');
const WorkCrewPattern = require('./patterns/work-crew');
const SupervisorPattern = require('./patterns/supervisor');
const PipelinePattern = require('./patterns/pipeline');
const CouncilPattern = require('./patterns/council');
const AutoRoutingPattern = require('./patterns/auto-routing');

/**
 * Enhanced Orchestrator with performance optimizations and advanced features
 */
class EnhancedOrchestrator {
  constructor(options = {}) {
    this.storage = new Storage();
    this.logger = new Logger();
    this.performance = new PerformanceManager(options);
    this.options = {
      enableCache: true,
      enableRetries: true,
      enableBatching: true,
      ...options
    };
    
    this.patterns = {
      'work-crew': WorkCrewPattern,
      'supervisor': SupervisorPattern,
      'pipeline': PipelinePattern,
      'council': CouncilPattern,
      'auto-routing': AutoRoutingPattern
    };
    
    this.activeTasks = new Map();
    this.agentRegistry = new Map();
    this.taskDependencies = new Map();
    
    // Performance monitoring
    this.performanceInterval = null;
    if (this.options.enableMonitoring) {
      this.startPerformanceMonitoring();
    }
  }

  /**
   * Run task with enhanced features and performance optimizations
   */
  async run(config, options = {}) {
    const taskId = uuidv4();
    const enhancedOptions = {
      ...this.options,
      ...options,
      enableCache: this.options.enableCache && !options.disableCache,
      enableRetries: this.options.enableRetries && !options.disableRetries
    };
    
    const task = new EnhancedTask(
      taskId, 
      config, 
      this, 
      enhancedOptions
    );
    
    this.activeTasks.set(taskId, task);
    await this.storage.saveTask(taskId, task.toJSON());
    
    // Execute with error handling and performance monitoring
    const executeFn = async () => {
      try {
        const result = await task.execute();
        await this.storage.updateTask(taskId, { 
          status: 'completed',
          completedAt: new Date().toISOString(),
          results: result
        });
        return result;
      } catch (error) {
        await this.storage.updateTask(taskId, { 
          status: 'failed',
          error: error.message,
          completedAt: new Date().toISOString()
        });
        throw error;
      } finally {
        this.activeTasks.delete(taskId);
      }
    };

    // Execute asynchronously with proper error handling
    const promise = this.performance.cachedExecute(
      `task-${taskId}`,
      executeFn
    );

    // Store reference for monitoring
    task.executionPromise = promise;
    
    // If monitoring is enabled, start progress tracking
    if (this.options.enableMonitoring) {
      this.monitorTaskProgress(task);
    }

    return task;
  }

  /**
   * Cancel task with enhanced error handling
   */
  async cancel(taskId) {
    const task = this.activeTasks.get(taskId);
    if (task && task.status === 'running') {
      task.cancel();
      this.activeTasks.delete(taskId);
      
      await this.storage.updateTask(taskId, { 
        status: 'cancelled',
        cancelledAt: new Date().toISOString()
      });
      
      return true;
    }
    return false;
  }

  /**
   * Get pattern with validation and error handling
   */
  getPattern(patternName) {
    const PatternClass = this.patterns[patternName];
    if (!PatternClass) {
      throw new Error(`Unknown pattern: ${patternName}. Available patterns: ${Object.keys(this.patterns).join(', ')}`);
    }
    return PatternClass;
  }

  /**
   * Register agent for reuse across tasks
   */
  registerAgent(agent) {
    this.agentRegistry.set(agent.id, agent);
    return agent.id;
  }

  /**
   * Get registered agent
   */
  getAgent(agentId) {
    return this.agentRegistry.get(agentId);
  }

  /**
   * Create task dependency graph
   */
  addTaskDependency(parentTaskId, childTaskId) {
    if (!this.taskDependencies.has(parentTaskId)) {
      this.taskDependencies.set(parentTaskId, new Set());
    }
    this.taskDependencies.get(parentTaskId).add(childTaskId);
  }

  /**
   * Check if task dependencies are met
   */
  checkTaskDependencies(taskId) {
    const dependencies = this.taskDependencies.get(taskId);
    if (!dependencies || dependencies.size === 0) {
      return true;
    }

    for (const depId of dependencies) {
      const depTask = this.activeTasks.get(depId);
      if (!depTask || depTask.status !== 'completed') {
        return false;
      }
    }
    return true;
  }

  /**
   * Start performance monitoring
   */
  startPerformanceMonitoring() {
    this.performanceInterval = setInterval(() => {
      const metrics = this.performance.getMetrics();
      this.logger.debug('Performance metrics:', metrics);
    }, 30000); // Every 30 seconds
  }

  /**
   * Stop performance monitoring
   */
  stopPerformanceMonitoring() {
    if (this.performanceInterval) {
      clearInterval(this.performanceInterval);
      this.performanceInterval = null;
    }
  }

  /**
   * Get system health status
   */
  getHealthStatus() {
    return {
      activeTasks: this.activeTasks.size,
      registeredAgents: this.agentRegistry.size,
      taskDependencies: this.taskDependencies.size,
      performanceMetrics: this.performance.getMetrics(),
      uptime: Date.now()
    };
  }
}

/**
 * Enhanced Task with advanced features
 */
class EnhancedTask extends EventEmitter {
  constructor(id, config, orchestrator, options = {}) {
    super();
    this.id = id;
    this.config = config;
    this.orchestrator = orchestrator;
    this.options = options;
    this.status = 'pending';
    this.agents = [];
    this.results = null;
    this.error = null;
    this.createdAt = new Date().toISOString();
    this.cancelled = false;
    this.executionPromise = null;
    this.progressHistory = [];
    this.performanceMetrics = {
      startTime: null,
      endTime: null,
      agentExecutionTimes: {},
      totalExecutionTime: 0
    };
  }

  async execute() {
    const startTime = Date.now();
    this.performanceMetrics.startTime = startTime;
    this.status = 'running';
    
    await this.orchestrator.storage.updateTask(this.id, { status: 'running' });
    
    this.emit('progress', { 
      message: 'Initializing enhanced task...', 
      taskId: this.id,
      timestamp: new Date().toISOString()
    });

    try {
      // Check dependencies before execution
      if (!this.orchestrator.checkTaskDependencies(this.id)) {
        throw new Error('Task dependencies not met');
      }

      // Get pattern implementation with validation
      const PatternClass = this.orchestrator.getPattern(this.config.pattern);
      const pattern = new PatternClass(this.config, this.options);
      
      // Initialize agents with enhanced features
      this.agents = await this.initializeEnhancedAgents(pattern);
      
      await this.orchestrator.storage.updateTask(this.id, { 
        agents: this.agents.map(a => a.toJSON())
      });

      this.emit('progress', { 
        message: `Executing ${this.config.pattern} pattern...`, 
        taskId: this.id,
        stage: 'execution'
      });

      // Execute pattern with performance monitoring
      const result = await this.orchestrator.performance.executeWithTimeout(
        () => pattern.execute(this.updateCallback.bind(this)),
        this.options.taskTimeout || 300000, // 5 minutes default
        `Task ${this.id}`
      );

      // Post-execution analysis
      const analysis = await this.analyzeResults(result);
      
      this.results = {
        ...result,
        analysis,
        performance: this.performanceMetrics,
        executionTime: Date.now() - startTime
      };

      await this.orchestrator.storage.updateTask(this.id, { 
        status: 'completed',
        results: this.results,
        completedAt: new Date().toISOString()
      });

      this.emit('progress', { 
        message: 'Task completed successfully', 
        taskId: this.id,
        stage: 'completed',
        results: this.results
      });

      return this.results;

    } catch (error) {
      this.error = error;
      this.status = 'failed';
      
      await this.orchestrator.storage.updateTask(this.id, { 
        status: 'failed',
        error: error.message,
        completedAt: new Date().toISOString()
      });

      this.emit('progress', { 
        message: `Task failed: ${error.message}`, 
        taskId: this.id,
        stage: 'failed',
        error: error.message
      });

      throw error;

    } finally {
      this.performanceMetrics.endTime = Date.now();
      this.performanceMetrics.totalExecutionTime = 
        this.performanceMetrics.endTime - this.performanceMetrics.startTime;
    }
  }

  async initializeEnhancedAgents(pattern) {
    this.emit('progress', { 
      message: 'Initializing agents with enhanced features...', 
      taskId: this.id,
      stage: 'initialization'
    });

    const agents = pattern.initializeAgents();
    
    // Register agents for reuse
    for (const agent of agents) {
      this.orchestrator.registerAgent(agent);
    }

    return agents;
  }

  updateCallback(agentId, status, message) {
    this.emit('progress', { 
      agentId, 
      status, 
      message, 
      taskId: this.id,
      timestamp: new Date().toISOString()
    });

    // Track progress
    this.progressHistory.push({
      agentId,
      status,
      message,
      timestamp: new Date().toISOString()
    });

    // Update performance metrics
    if (status === 'running' && !this.performanceMetrics.agentExecutionTimes[agentId]) {
      this.performanceMetrics.agentExecutionTimes[agentId] = {
        startTime: Date.now(),
        endTime: null,
        duration: 0
      };
    } else if (status === 'completed' && this.performanceMetrics.agentExecutionTimes[agentId]) {
      this.performanceMetrics.agentExecutionTimes[agentId].endTime = Date.now();
      this.performanceMetrics.agentExecutionTimes[agentId].duration = 
        this.performanceMetrics.agentExecutionTimes[agentId].endTime - 
        this.performanceMetrics.agentExecutionTimes[agentId].startTime;
    }
  }

  async analyzeResults(results) {
    const analysis = {
      totalAgents: this.agents.length,
      successfulAgents: 0,
      failedAgents: 0,
      convergenceQuality: 'unknown',
      recommendations: []
    };

    // Analyze agent performance
    if (results.agentResults) {
      results.agentResults.forEach(agentResult => {
        if (agentResult.success) {
          analysis.successfulAgents++;
        } else {
          analysis.failedAgents++;
        }
      });
    }

    // Analyze convergence quality
    if (results.converged) {
      const successRate = analysis.successfulAgents / this.agents.length;
      if (successRate >= 0.8) {
        analysis.convergenceQuality = 'excellent';
      } else if (successRate >= 0.6) {
        analysis.convergenceQuality = 'good';
      } else if (successRate >= 0.4) {
        analysis.convergenceQuality = 'fair';
      } else {
        analysis.convergenceQuality = 'poor';
      }
    }

    // Generate recommendations
    if (analysis.failedAgents > 0) {
      analysis.recommendations.push(
        `Consider reducing task complexity or increasing timeout for failed agents`
      );
    }

    if (analysis.convergenceQuality === 'poor') {
      analysis.recommendations.push(
        `Consider adjusting convergence strategy or agent roles`
      );
    }

    return analysis;
  }

  cancel() {
    if (!this.cancelled) {
      this.cancelled = true;
      this.status = 'cancelled';
      this.emit('progress', { 
        message: 'Task cancelled', 
        taskId: this.id,
        stage: 'cancelled'
      });
    }
  }

  toJSON() {
    return {
      id: this.id,
      config: this.config,
      status: this.status,
      agents: this.agents.map(a => a.toJSON()),
      results: this.results,
      error: this.error,
      createdAt: this.createdAt,
      progressHistory: this.progressHistory,
      performanceMetrics: this.performanceMetrics
    };
  }
}

module.exports = { EnhancedOrchestrator, EnhancedTask };