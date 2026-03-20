const { AgentFactory } = require('../agents/agent-factory');

class WorkCrewPattern {
  constructor(config, options = {}) {
    this.config = config;
    this.options = options;
    this.agents = [];
  }

  initializeAgents() {
    this.agents = AgentFactory.createAgents(this.config.agents, this.options);
    return this.agents;
  }

  async execute(updateCallback) {
    const task = this.config.task;
    
    // Execute all agents in parallel
    const promises = this.agents.map(async (agent) => {
      updateCallback(agent.id, 'running', null);
      
      try {
        const output = await agent.execute(task);
        updateCallback(agent.id, 'completed', output);
        return { agent, output, success: true };
      } catch (error) {
        updateCallback(agent.id, 'failed', error.message);
        return { agent, error: error.message, success: false };
      }
    });

    const results = await Promise.all(promises);
    
    // Apply convergence strategy
    const convergedResult = this.converge(results);
    
    return {
      pattern: 'work-crew',
      task: task,
      agentResults: results,
      converged: convergedResult,
      strategy: this.config.convergence?.strategy || 'merge'
    };
  }

  converge(results) {
    const strategy = this.config.convergence?.strategy || 'merge';
    
    switch (strategy) {
    case 'consensus':
      return this.consensusConvergence(results);
      
    case 'best-of':
      return this.bestOfConvergence(results);
      
    case 'merge':
    default:
      return this.mergeConvergence(results);
    }
  }

  consensusConvergence(results) {
    const successfulResults = results.filter(r => r.success);
    const threshold = this.config.convergence?.threshold || 0.7;
    
    // Check if all agents agree (simplified)
    const agreementRate = successfulResults.length / results.length;
    
    return {
      agreed: agreementRate >= threshold,
      agreementRate,
      summary: 'Consensus reached among agents',
      outputs: successfulResults.map(r => ({
        agent: r.agent.name,
        output: r.output
      }))
    };
  }

  bestOfConvergence(results) {
    // Select the longest/most detailed output as "best"
    const successfulResults = results.filter(r => r.success);
    const best = successfulResults.reduce((prev, current) => 
      (current.output.length > prev.output.length) ? current : prev
    );
    
    return {
      selectedAgent: best.agent.name,
      output: best.output,
      rationale: 'Selected based on output comprehensiveness'
    };
  }

  mergeConvergence(results) {
    const successfulResults = results.filter(r => r.success);
    
    return {
      summary: 'Merged outputs from all agents',
      sections: successfulResults.map(r => ({
        agent: r.agent.name,
        role: r.agent.role,
        output: r.output
      }))
    };
  }
}

module.exports = WorkCrewPattern;
