const { v4: uuidv4 } = require('uuid');
const { Logger } = require('./utils/logger');
const { globalBus } = require('./utils/event-bus');

const logger = new Logger();

/**
 * TaskChain - Define and execute sequential or conditional task pipelines.
 * Each step can depend on the output of previous steps.
 * 
 * Usage:
 *   const chain = new TaskChain(orchestrator);
 *   chain.add('analyze', { pattern: 'work-crew', ... })
 *   chain.add('summarize', { pattern: 'pipeline', ... }, { dependsOn: 'analyze' })
 *   chain.add('review', { pattern: 'council', ... }, { dependsOn: 'summarize', condition: (ctx) => ctx.summarize.confidence > 0.7 })
 *   await chain.execute()
 */
class TaskChain {
  constructor(orchestrator, options = {}) {
    this.orchestrator = orchestrator;
    this.id = uuidv4();
    this.steps = new Map();
    this.stepOrder = [];
    this.results = {};
    this.status = 'pending';
    this.options = {
      stopOnError: true,
      parallelBranches: true,
      ...options
    };
    this._eventBus = options.eventBus || globalBus;
    this._stepCallbacks = [];
    this._aborted = false;
    this._pendingRejects = new Set();
  }

  /**
   * Tap into a step's lifecycle without modifying it.
   * The callback fires after the step completes (success or fail).
   * Unlike onStepComplete (global), this targets a specific step.
   * @param {string} stepName - Step to observe
   * @param {function} callback - (stepInfo) => void
   * @returns {TaskChain} this
   */
  tap(stepName, callback) {
    if (!this.steps.has(stepName)) {
      throw new Error(`Unknown step: ${stepName}`);
    }
    if (typeof callback !== 'function') {
      throw new Error('tap requires a function argument');
    }
    if (!this._tapCallbacks) this._tapCallbacks = new Map();
    if (!this._tapCallbacks.has(stepName)) this._tapCallbacks.set(stepName, []);
    this._tapCallbacks.get(stepName).push(callback);
    return this;
  }

  /**
   * Register a progress callback, called after each step completes (success or fail).
   * @param {function} callback - (stepInfo) => void
   * @returns {TaskChain} this
   */
  onStepComplete(callback) {
    if (typeof callback !== 'function') {
      throw new Error('onStepComplete requires a function argument');
    }
    this._stepCallbacks.push(callback);
    return this;
  }

  /**
   * Add a step to the chain
   * @param {string} name - Step name (unique within chain)
   * @param {object} taskConfig - Task configuration
   * @param {object} stepOptions - Step options
   * @param {string} stepOptions.dependsOn - Name of prerequisite step(s), comma-separated or array
   * @param {function} stepOptions.condition - Function(ctx) => bool, skip if false
   * @param {function} stepOptions.transform - Transform previous results before passing to this step
   * @returns {TaskChain} this (for chaining)
   */
  add(name, taskConfig, stepOptions = {}) {
    if (this.steps.has(name)) {
      throw new Error(`Step "${name}" already exists in chain`);
    }

    const dependsOn = Array.isArray(stepOptions.dependsOn)
      ? stepOptions.dependsOn
      : stepOptions.dependsOn
        ? stepOptions.dependsOn.split(',').map(s => s.trim())
        : [];

    this.steps.set(name, {
      name,
      taskConfig,
      dependsOn,
      condition: stepOptions.condition || null,
      transform: stepOptions.transform || null,
      status: 'pending',
      result: null,
      error: null,
      startedAt: null,
      completedAt: null
    });

    this.stepOrder.push(name);
    return this;
  }

  /**
   * Execute the chain
   * @returns {Promise<object>} Results keyed by step name
   */
  async execute() {
    this.status = 'running';
    this._aborted = false;
    this._eventBus.emit('chain:started', { chainId: this.id, steps: this.stepOrder });

    try {
      // Build dependency graph
      const graph = this._buildGraph();
      
      // Execute in topological order
      await this._executeSteps(graph);

      this.status = 'completed';
      this._eventBus.emit('chain:completed', { chainId: this.id, results: this.results });
    } catch (error) {
      this.status = 'failed';
      this._eventBus.emit('chain:failed', { chainId: this.id, error: error.message });
      throw error;
    }

    return this.results;
  }

  /**
   * Build dependency graph and detect cycles
   */
  _buildGraph() {
    const graph = new Map();
    const visited = new Set();
    const inStack = new Set();

    const visit = (name) => {
      if (inStack.has(name)) {
        throw new Error(`Circular dependency detected involving step: ${name}`);
      }
      if (visited.has(name)) return;

      const step = this.steps.get(name);
      if (!step) {
        throw new Error(`Unknown step referenced: ${name}`);
      }

      inStack.add(name);
      
      for (const dep of step.dependsOn) {
        visit(dep);
      }

      inStack.delete(name);
      visited.add(name);
      graph.set(name, step);
    };

    for (const name of this.stepOrder) {
      visit(name);
    }

    return graph;
  }

  /**
   * Execute steps respecting dependencies
   */
  async _executeSteps(graph) {
    const completed = new Set();
    const failed = new Set();

    // Keep executing until all steps are done or we can't progress
    while (completed.size + failed.size < this.steps.size) {
      if (this._aborted) {
        throw new Error('Chain aborted');
      }
      // Find steps ready to execute
      const ready = [];
      for (const [name, step] of graph) {
        if (completed.has(name) || failed.has(name) || step.status !== 'pending') continue;
        
        const allDepsMet = step.dependsOn.every(dep => completed.has(dep));
        const anyDepFailed = step.dependsOn.some(dep => failed.has(dep));
        
        if (anyDepFailed) {
          step.status = 'skipped';
          step.error = 'Dependency failed';
          failed.add(name);
          if (this.options.stopOnError) {
            throw new Error(`Step "${name}" skipped due to failed dependency`);
          }
          continue;
        }
        
        if (allDepsMet) {
          // Check condition
          if (step.condition && !step.condition(this.results)) {
            step.status = 'skipped';
            step.result = { skipped: true, reason: 'Condition not met' };
            this.results[name] = step.result;
            completed.add(name);
            continue;
          }
          ready.push(step);
        }
      }

      if (ready.length === 0 && completed.size + failed.size < this.steps.size) {
        throw new Error('Deadlock: no steps can proceed but not all are complete');
      }

      // Execute ready steps (optionally in parallel)
      if (this.options.parallelBranches && ready.length > 1) {
        await Promise.all(ready.map(step => this._executeStep(step)));
        for (const step of ready) {
          if (step.status === 'completed') completed.add(step.name);
          else failed.add(step.name);
        }
      } else {
        for (const step of ready) {
          await this._executeStep(step);
          if (step.status === 'completed') completed.add(step.name);
          else failed.add(step.name);
        }
      }
    }
  }

  /**
   * Execute a single step
   */
  async _executeStep(step) {
    step.status = 'running';
    step.startedAt = new Date().toISOString();
    this._eventBus.emit('chain:step:started', { chainId: this.id, step: step.name });

    try {
      // Transform task config if transform function provided
      let config = { ...step.taskConfig };
      if (step.transform) {
        const transformed = step.transform(this.results);
        config = { ...config, ...transformed };
      }

      // Execute via orchestrator
      const task = await this.orchestrator.run(config);
      
      // Wait for completion
      await new Promise((resolve, reject) => {
        this._pendingRejects.add(reject);
        task.on('complete', () => { this._pendingRejects.delete(reject); resolve(); });
        task.on('error', (err) => { this._pendingRejects.delete(reject); reject(err); });
      });

      step.result = task.results;
      step.status = 'completed';
      step.completedAt = new Date().toISOString();
      this.results[step.name] = task.results;

      this._eventBus.emit('chain:step:completed', { 
        chainId: this.id, 
        step: step.name,
        duration: Date.now() - new Date(step.startedAt).getTime()
      });
      this._fireStepCallback(step);
    } catch (error) {
      step.status = 'failed';
      step.error = error.message;
      step.completedAt = new Date().toISOString();
      this.results[step.name] = { error: error.message };

      this._eventBus.emit('chain:step:failed', { 
        chainId: this.id, 
        step: step.name, 
        error: error.message 
      });
      this._fireStepCallback(step);

      throw error;
    }
  }

  /**
   * Get chain status
   */
  getStatus() {
    return {
      id: this.id,
      status: this.status,
      steps: [...this.steps.values()].map(s => ({
        name: s.name,
        status: s.status,
        dependsOn: s.dependsOn,
        startedAt: s.startedAt,
        completedAt: s.completedAt,
        error: s.error
      })),
      results: this.results
    };
  }

  /**
   * Retry a failed step
   * @param {string} stepName - Name of the step to retry
   * @param {object} options - Retry options
   * @param {number} options.maxRetries - Max retry attempts (default: 1)
   * @param {number} options.delayMs - Delay between retries in ms (default: 0)
   * @param {function} options.transform - Optional new transform for retry
   * @returns {Promise<object>} Step result
   */
  async retry(stepName, options = {}) {
    const maxRetries = options.maxRetries || 1;
    const delayMs = options.delayMs || 0;
    const step = this.steps.get(stepName);

    if (!step) {
      throw new Error(`Unknown step: ${stepName}`);
    }

    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        step.status = 'pending';
        step.error = null;
        if (options.transform) {
          step.transform = options.transform;
        }
        await this._executeStep(step);
        this._eventBus.emit('chain:step:retried', {
          chainId: this.id,
          step: stepName,
          attempt,
          succeeded: true
        });
        return step.result;
      } catch (error) {
        lastError = error;
        this._eventBus.emit('chain:step:retried', {
          chainId: this.id,
          step: stepName,
          attempt,
          succeeded: false,
          error: error.message
        });
        if (attempt < maxRetries && delayMs > 0) {
          await new Promise(r => setTimeout(r, delayMs));
        }
      }
    }

    throw lastError;
  }

  /**
   * Abort a running chain. Pending and running steps are marked as 'aborted'.
   * @returns {boolean} true if abort was triggered, false if chain not running
   */
  abort() {
    if (this.status !== 'running') return false;
    this._aborted = true;
    // Mark pending/running steps as aborted
    for (const step of this.steps.values()) {
      if (step.status === 'pending' || step.status === 'running') {
        step.status = 'aborted';
        step.error = 'Chain aborted';
      }
    }
    this.status = 'aborted';
    this._eventBus.emit('chain:aborted', { chainId: this.id });
    // Reject any pending step promises so execute() unblocks
    for (const reject of this._pendingRejects) {
      reject(new Error('Chain aborted'));
    }
    this._pendingRejects.clear();
    return true;
  }

  /**
   * Export chain as JSON (serializable definition)
   */
  toJSON() {
    return {
      id: this.id,
      status: this.status,
      steps: this.stepOrder.map(name => {
        const step = this.steps.get(name);
        return {
          name: step.name,
          taskConfig: step.taskConfig,
          dependsOn: step.dependsOn,
          condition: step.condition ? step.condition.toString() : null,
          transform: step.transform ? step.transform.toString() : null,
          status: step.status,
          startedAt: step.startedAt,
          completedAt: step.completedAt,
          error: step.error,
          result: step.result
        };
      }),
      results: this.results
    };
  }

  /**
   * Reconstruct a TaskChain from JSON (produced by toJSON()).
   * Note: condition/transform functions are restored from their string representation.
   * @param {object} json - Output from toJSON()
   * @param {object} orchestrator - Orchestrator instance
   * @param {object} options - Chain options
   * @returns {TaskChain}
   */
  static fromJSON(json, orchestrator, options = {}) {
    const chain = new TaskChain(orchestrator, options);
    chain.id = json.id;
    chain.status = json.status;
    chain.results = json.results || {};

    for (const step of json.steps) {
      const condition = step.condition ? eval(`(${step.condition})`) : null;
      const transform = step.transform ? eval(`(${step.transform})`) : null;

      chain.add(step.name, step.taskConfig, {
        dependsOn: step.dependsOn.join(','),
        condition,
        transform,
      });

      // Restore step-level state
      const chainStep = chain.steps.get(step.name);
      chainStep.status = step.status;
      chainStep.startedAt = step.startedAt;
      chainStep.completedAt = step.completedAt;
      chainStep.error = step.error;
      chainStep.result = step.result;
    }

    return chain;
  }

  /**
   * Fire step complete callbacks
   */
  _fireStepCallback(step) {
    const info = { name: step.name, status: step.status, result: step.result, error: step.error };
    for (const cb of this._stepCallbacks) {
      try { cb(info); } catch (_) { /* ignore callback errors */ }
    }
    // Fire tap callbacks for this specific step
    if (this._tapCallbacks) {
      const taps = this._tapCallbacks.get(step.name);
      if (taps) {
        for (const cb of taps) {
          try { cb(info); } catch (_) { /* ignore callback errors */ }
        }
      }
    }
  }
}

module.exports = { TaskChain };
