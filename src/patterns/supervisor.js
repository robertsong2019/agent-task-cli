const { AgentFactory } = require('../agents/agent-factory');

class SupervisorPattern {
  constructor(config, options = {}) {
    this.config = config;
    this.options = options;
    this.supervisor = null;
    this.workers = [];
  }

  initializeAgents() {
    // Create supervisor
    this.supervisor = AgentFactory.createAgent({
      name: this.config.supervisor.name || 'supervisor',
      role: 'Task decomposition and coordination',
      ...this.config.supervisor
    }, this.options);

    // Create workers
    this.workers = this.config.workers.map(workerConfig =>
      AgentFactory.createAgent(workerConfig, this.options)
    );

    return [this.supervisor, ...this.workers];
  }

  async execute(updateCallback) {
    const task = this.config.task;
    const strategy = this.config.supervisor?.strategy || 'adaptive';
    
    // Supervisor decomposes task
    updateCallback(this.supervisor.id, 'running', null);
    await this.supervisor.execute(`Decompose task: ${task}`);
    updateCallback(this.supervisor.id, 'completed', this.supervisor.output);
    
    // Supervisor creates subtasks
    const subtasks = this.decomposeTask(task, strategy);
    
    // Execute workers based on strategy
    let workerResults;
    if (strategy === 'parallel') {
      workerResults = await this.executeParallel(subtasks, updateCallback);
    } else if (strategy === 'sequential') {
      workerResults = await this.executeSequential(subtasks, updateCallback);
    } else {
      workerResults = await this.executeAdaptive(subtasks, updateCallback);
    }
    
    // Supervisor reviews results
    updateCallback(this.supervisor.id, 'running', null);
    const reviewOutput = await this.supervisor.execute(
      `Review and integrate results: ${JSON.stringify(workerResults.map(r => r.output))}`
    );
    updateCallback(this.supervisor.id, 'completed', reviewOutput);
    
    return {
      pattern: 'supervisor',
      task: task,
      strategy: strategy,
      subtasks: subtasks,
      workerResults: workerResults,
      review: reviewOutput
    };
  }

  decomposeTask(task, _strategy) {
    // Simplified task decomposition
    const subtasks = [
      { description: `Research phase for: ${task}`, type: 'research' },
      { description: `Implementation phase for: ${task}`, type: 'implementation' },
      { description: `Testing phase for: ${task}`, type: 'testing' }
    ];
    
    return subtasks;
  }

  async executeParallel(subtasks, updateCallback) {
    // Assign subtasks to workers
    const assignments = subtasks.map((subtask, index) => ({
      worker: this.workers[index % this.workers.length],
      subtask
    }));

    // Execute all in parallel
    const promises = assignments.map(async ({ worker, subtask }) => {
      updateCallback(worker.id, 'running', null);
      try {
        const output = await worker.execute(subtask.description);
        updateCallback(worker.id, 'completed', output);
        return { worker: worker.name, subtask, output, success: true };
      } catch (error) {
        updateCallback(worker.id, 'failed', error.message);
        return { worker: worker.name, subtask, error: error.message, success: false };
      }
    });

    return await Promise.all(promises);
  }

  async executeSequential(subtasks, updateCallback) {
    const results = [];
    
    for (const subtask of subtasks) {
      const worker = this.workers[results.length % this.workers.length];
      updateCallback(worker.id, 'running', null);
      
      try {
        const output = await worker.execute(subtask.description);
        updateCallback(worker.id, 'completed', output);
        results.push({ worker: worker.name, subtask, output, success: true });
      } catch (error) {
        updateCallback(worker.id, 'failed', error.message);
        results.push({ worker: worker.name, subtask, error: error.message, success: false });
      }
    }
    
    return results;
  }

  async executeAdaptive(subtasks, updateCallback) {
    // Adaptive: sequential with dynamic worker selection
    const results = [];
    const availableWorkers = [...this.workers];
    
    for (const subtask of subtasks) {
      // Select best worker based on skills (simplified)
      const worker = availableWorkers[results.length % availableWorkers.length];
      updateCallback(worker.id, 'running', null);
      
      try {
        const output = await worker.execute(subtask.description);
        updateCallback(worker.id, 'completed', output);
        results.push({ worker: worker.name, subtask, output, success: true });
      } catch (error) {
        updateCallback(worker.id, 'failed', error.message);
        results.push({ worker: worker.name, subtask, error: error.message, success: false });
      }
    }
    
    return results;
  }
}

module.exports = SupervisorPattern;
