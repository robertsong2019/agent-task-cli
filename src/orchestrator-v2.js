const { v4: uuidv4 } = require('uuid');
const { EventEmitter } = require('events');
const { Storage } = require('./utils/storage');
const { Logger } = require('./utils/logger');
const { ConcurrencyManager } = require('./utils/concurrency-manager');
const { RetryHandler } = require('./utils/retry-handler');
const { Cache, generateTaskCacheKey } = require('./utils/cache');
const WorkCrewPattern = require('./patterns/work-crew');
const SupervisorPattern = require('./patterns/supervisor');
const PipelinePattern = require('./patterns/pipeline');
const CouncilPattern = require('./patterns/council');
const AutoRoutingPattern = require('./patterns/auto-routing');

class Orchestrator {
  constructor(options = {}) {
    this.storage = new Storage();
    this.logger = new Logger();
    this.concurrencyManager = new ConcurrencyManager({
      maxConcurrent: options.maxConcurrent || 10
    });
    this.retryHandler = new RetryHandler({
      maxRetries: options.maxRetries || 3
    });
    this.cache = new Cache({
      maxSize: options.cacheSize || 100,
      defaultTTL: options.cacheTTL || 3600000 // 1 hour
    });
    
    this.patterns = {
      'work-crew': WorkCrewPattern,
      'supervisor': SupervisorPattern,
      'pipeline': PipelinePattern,
      'council': CouncilPattern,
      'auto-routing': AutoRoutingPattern
    };
    this.activeTasks = new Map();
    this.taskDependencies = new Map(); // Track task dependencies
    this.taskPriority = new Map(); // Track task priorities
    
    this.options = options;
  }

  /**
   * Run a task with enhanced features
   */
  async run(config, options = {}) {
    const taskId = uuidv4();
    
    // Check dependencies
    if (config.dependencies && config.dependencies.length > 0) {
      const unmetDeps = await this.checkDependencies(config.dependencies);
      if (unmetDeps.length > 0) {
        throw new Error(`Unmet dependencies: ${unmetDeps.join(', ')}`);
      }
      this.taskDependencies.set(taskId, config.dependencies);
    }
    
    // Set priority (default: normal)
    const priority = config.priority || options.priority || 'normal';
    this.taskPriority.set(taskId, priority);
    
    // Check cache
    if (options.useCache !== false && !options.dryRun) {
      const cacheKey = generateTaskCacheKey(config);
      const cached = this.cache.get(cacheKey);
      
      if (cached) {
        this.logger.info(`Using cached result for task ${taskId}`);
        return {
          id: taskId,
          ...cached,
          fromCache: true
        };
      }
    }
    
    const task = new Task(taskId, config, this, options);
    
    this.activeTasks.set(taskId, task);
    await this.storage.saveTask(taskId, task.toJSON());
    
    // Execute with concurrency control and retry
    setImmediate(() => {
      this._executeWithRetry(task, options)
        .catch(error => {
          this.logger.error(`Task ${taskId} failed after retries:`, error);
          if (this.activeTasks.has(taskId)) {
            this.activeTasks.delete(taskId);
          }
        });
    });

    return task;
  }

  /**
   * Execute task with retry logic
   */
  async _executeWithRetry(task, options) {
    const maxRetries = options.maxRetries ?? this.options.maxRetries ?? 3;
    
    return this.concurrencyManager.execute(async () => {
      return this.retryHandler.execute(
        () => task.execute(),
        { maxRetries }
      );
    }, task.id);
  }

  /**
   * Check if dependencies are met
   */
  async checkDependencies(dependencies) {
    const unmetDeps = [];
    
    for (const depId of dependencies) {
      const depTask = await this.storage.getTask(depId);
      
      if (!depTask || depTask.status !== 'completed') {
        unmetDeps.push(depId);
      }
    }
    
    return unmetDeps;
  }

  /**
   * Cancel a running task
   */
  async cancel(taskId) {
    const task = this.activeTasks.get(taskId);
    if (task) {
      task.cancel();
      this.activeTasks.delete(taskId);
    }
    
    // Clean up dependencies and priority
    this.taskDependencies.delete(taskId);
    this.taskPriority.delete(taskId);
    
    await this.storage.updateTask(taskId, { status: 'cancelled' });
    return task;
  }

  /**
   * Get orchestrator statistics
   */
  getStats() {
    return {
      activeTasks: this.activeTasks.size,
      concurrency: this.concurrencyManager.getStatus(),
      cache: this.cache.getStats(),
      retries: this.retryHandler.getStats()
    };
  }

  /**
   * Get pattern class
   */
  getPattern(patternName) {
    const PatternClass = this.patterns[patternName];
    if (!PatternClass) {
      throw new Error(`Unknown pattern: ${patternName}`);
    }
    return PatternClass;
  }

  /**
   * Clear cache
   */
  clearCache() {
    return this.cache.clear();
  }

  /**
   * Shutdown gracefully
   */
  async shutdown() {
    // Cancel all active tasks
    for (const [_taskId, task] of this.activeTasks) {
      task.cancel();
      task.removeAllListeners();
    }
    this.activeTasks.clear();
    
    // Wait for concurrent operations to complete
    await this.concurrencyManager.drain();
    
    // Destroy cache
    this.cache.destroy();
    
    this.logger.info('Orchestrator shutdown complete');
  }
}

class Task extends EventEmitter {
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
    this.startedAt = null;
    this.completedAt = null;
    this.cancelled = false;
    this.progress = 0;
    this.currentStage = null;
    this.retryCount = 0;
  }

  async execute() {
    try {
      this.status = 'running';
      this.startedAt = new Date().toISOString();
      await this.orchestrator.storage.updateTask(this.id, { 
        status: 'running',
        startedAt: this.startedAt
      });
      
      this.emit('progress', { 
        message: 'Initializing task...', 
        taskId: this.id,
        progress: 0
      });
      
      // Get pattern implementation
      const PatternClass = this.orchestrator.getPattern(this.config.pattern);
      const pattern = new PatternClass(this.config, this.options);
      
      // Initialize agents
      this.currentStage = 'initialization';
      this.progress = 10;
      this.agents = pattern.initializeAgents();
      
      await this.orchestrator.storage.updateTask(this.id, { 
        agents: this.agents.map(a => a.toJSON()),
        progress: this.progress,
        currentStage: this.currentStage
      });
      
      this.emit('progress', { 
        message: `Executing ${this.config.pattern} pattern...`, 
        taskId: this.id,
        progress: 20,
        stage: this.currentStage
      });
      
      // Execute pattern with enhanced progress tracking
      this.currentStage = 'execution';
      this.results = await pattern.execute((agentId, status, output) => {
        // Update agent status
        const agent = this.agents.find(a => a.id === agentId);
        if (agent) {
          agent.status = status;
          agent.output = output;
        }
        
        // Calculate progress
        const completedAgents = this.agents.filter(a => 
          a.status === 'completed' || a.status === 'failed'
        ).length;
        this.progress = 20 + (completedAgents / this.agents.length) * 70;
        
        this.emit('progress', {
          message: `Agent ${agentId}: ${status}`,
          taskId: this.id,
          agentId,
          status,
          output,
          progress: Math.round(this.progress),
          stage: this.currentStage
        });
        
        // Persist update
        this.orchestrator.storage.updateTask(this.id, {
          agents: this.agents.map(a => a.toJSON()),
          progress: this.progress,
          currentStage: this.currentStage
        }).catch(err => this.orchestrator.logger.error('Failed to update task:', err));
      });
      
      if (this.cancelled) {
        this.status = 'cancelled';
      } else {
        this.status = 'completed';
        this.progress = 100;
        this.currentStage = 'completed';
      }
      
      this.completedAt = new Date().toISOString();
      
      // Cache results
      if (this.options.useCache !== false) {
        const cacheKey = generateTaskCacheKey(this.config);
        this.orchestrator.cache.set(cacheKey, this.results);
      }
      
      await this.orchestrator.storage.updateTask(this.id, {
        status: this.status,
        results: this.results,
        progress: this.progress,
        currentStage: this.currentStage,
        completedAt: this.completedAt
      });
      
      this.emit('complete', this.results);
      
    } catch (error) {
      this.status = 'failed';
      this.error = error.message;
      this.retryCount++;
      
      await this.orchestrator.storage.updateTask(this.id, {
        status: 'failed',
        error: error.message,
        retryCount: this.retryCount
      });
      
      this.emit('error', error);
      throw error;
    }
  }

  cancel() {
    this.cancelled = true;
    this.status = 'cancelled';
    this.emit('cancelled');
  }

  toJSON() {
    return {
      id: this.id,
      name: this.config.name,
      pattern: this.config.pattern,
      status: this.status,
      progress: this.progress,
      currentStage: this.currentStage,
      agents: this.agents.map(a => a.toJSON()),
      results: this.results,
      error: this.error,
      createdAt: this.createdAt,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      retryCount: this.retryCount
    };
  }
}

module.exports = { Orchestrator, Task };
