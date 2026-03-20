const { AgentFactory } = require('../agents/agent-factory');

class PipelinePattern {
  constructor(config, options = {}) {
    this.config = config;
    this.options = options;
    this.agents = [];
  }

  initializeAgents() {
    this.agents = this.config.stages.map(stage =>
      AgentFactory.createAgent({
        name: stage.agent,
        role: `${stage.name} specialist`,
        ...stage
      }, this.options)
    );
    return this.agents;
  }

  async execute(updateCallback) {
    const stages = this.config.stages;
    const gates = this.config.gates || [];
    const results = [];
    let currentData = this.config.task;

    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      const agent = this.agents[i];
      
      updateCallback(agent.id, 'running', null);
      
      try {
        // Execute stage
        const stageInput = i === 0 ? currentData : results[i - 1].output;
        const output = await agent.execute(`[${stage.name}] Process: ${stageInput}`);
        
        updateCallback(agent.id, 'completed', output);
        
        const stageResult = {
          stage: stage.name,
          agent: agent.name,
          input: stageInput,
          output,
          success: true
        };
        
        results.push(stageResult);
        
        // Check validation gates
        const gate = gates.find(g => g.after === stage.name);
        if (gate) {
          const gatePassed = await this.validateGate(gate, output);
          if (!gatePassed) {
            return {
              pattern: 'pipeline',
              success: false,
              failedAt: stage.name,
              results,
              error: `Validation gate failed after stage: ${stage.name}`
            };
          }
        }
        
      } catch (error) {
        updateCallback(agent.id, 'failed', error.message);
        results.push({
          stage: stage.name,
          agent: agent.name,
          error: error.message,
          success: false
        });
        
        // Handle failure
        const failureStrategy = this.config.failureStrategy || 'stop';
        if (failureStrategy === 'stop') {
          return {
            pattern: 'pipeline',
            success: false,
            failedAt: stage.name,
            results,
            error: error.message
          };
        }
      }
    }

    return {
      pattern: 'pipeline',
      success: true,
      stages: results,
      finalOutput: results[results.length - 1]?.output
    };
  }

  async validateGate(gate, output) {
    // Simplified gate validation
    // In real implementation, this would use a validator agent
    return output && output.length > 10; // Basic validation
  }
}

module.exports = PipelinePattern;
