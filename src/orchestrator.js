const { v4: uuidv4 } = require('uuid');
const { EventEmitter } = require('events');
const { Storage } = require('./utils/storage');
const { Logger } = require('./utils/logger');
const WorkCrewPattern = require('./patterns/work-crew');
const SupervisorPattern = require('./patterns/supervisor');
const PipelinePattern = require('./patterns/pipeline');
const CouncilPattern = require('./patterns/council');
const AutoRoutingPattern = require('./patterns/auto-routing');

class Orchestrator {
  constructor() {
    this.storage = new Storage();
    this.logger = new Logger();
    this.patterns = {
      'work-crew': WorkCrewPattern,
      'supervisor': SupervisorPattern,
      'pipeline': PipelinePattern,
      'council': CouncilPattern,
      'auto-routing': AutoRoutingPattern
    };
    this.activeTasks = new Map();
  }

  async run(config, options = {}) {
    const taskId = uuidv4();
    const task = new Task(taskId, config, this, options);
    
    this.activeTasks.set(taskId, task);
    await this.storage.saveTask(taskId, task.toJSON());
    
    // Execute task
    const executePromise = task.execute().catch(error => {
      this.logger.error(`Task ${taskId} failed:`, error);
      // Ensure task is cleaned up on error
      if (this.activeTasks.has(taskId)) {
        this.activeTasks.delete(taskId);
      }
      // Error is already emitted on the task; don't re-throw to avoid unhandled rejection
    });

    // If wait option is true, await execution
    if (options.wait) {
      await executePromise;
      this.activeTasks.delete(taskId);
    } else {
      // Execute asynchronously for non-blocking behavior
      setImmediate(() => {
        executePromise.finally(() => {
          if (this.activeTasks.has(taskId)) {
            this.activeTasks.delete(taskId);
          }
        });
      });
    }

    return task;
  }

  async cancel(taskId) {
    const task = this.activeTasks.get(taskId);
    if (task) {
      task.cancel();
      this.activeTasks.delete(taskId);
    }
    await this.storage.updateTask(taskId, { status: 'cancelled' });
    return task;
  }

  getPattern(patternName) {
    const PatternClass = this.patterns[patternName];
    if (!PatternClass) {
      throw new Error(`Unknown pattern: ${patternName}`);
    }
    return PatternClass;
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
    this.cancelled = false;
  }

  async execute() {
    try {
      this.status = 'running';
      await this.orchestrator.storage.updateTask(this.id, { status: 'running' });
      
      this.emit('progress', { message: 'Initializing task...', taskId: this.id });
      
      // Get pattern implementation
      const PatternClass = this.orchestrator.getPattern(this.config.pattern);
      const pattern = new PatternClass(this.config, this.options);
      
      // Initialize agents
      this.agents = pattern.initializeAgents();
      await this.orchestrator.storage.updateTask(this.id, { 
        agents: this.agents.map(a => a.toJSON()) 
      });
      
      // Execute pattern
      this.emit('progress', { 
        message: `Executing ${this.config.pattern} pattern...`, 
        taskId: this.id 
      });
      
      this.results = await pattern.execute((agentId, status, output) => {
        // Update agent status
        const agent = this.agents.find(a => a.id === agentId);
        if (agent) {
          agent.status = status;
          agent.output = output;
        }
        
        this.emit('progress', {
          message: `Agent ${agentId}: ${status}`,
          taskId: this.id,
          agentId,
          status,
          output
        });
        
        // Persist update
        this.orchestrator.storage.updateTask(this.id, {
          agents: this.agents.map(a => a.toJSON())
        }).catch(err => this.orchestrator.logger.error('Failed to update task:', err));
      });
      
      if (this.cancelled) {
        this.status = 'cancelled';
      } else {
        this.status = 'completed';
      }
      
      await this.orchestrator.storage.updateTask(this.id, {
        status: this.status,
        results: this.results
      });
      
      this.emit('complete', this.results);
      
    } catch (error) {
      this.status = 'failed';
      this.error = error.message;
      
      await this.orchestrator.storage.updateTask(this.id, {
        status: 'failed',
        error: error.message
      });
      
      this.emit('error', error);
      throw error;
    }
  }

  cancel() {
    this.cancelled = true;
    this.emit('cancelled');
  }

  toJSON() {
    return {
      id: this.id,
      name: this.config.name,
      pattern: this.config.pattern,
      status: this.status,
      agents: this.agents.map(a => a.toJSON()),
      results: this.results,
      error: this.error,
      createdAt: this.createdAt
    };
  }
}

module.exports = { Orchestrator, Task };
