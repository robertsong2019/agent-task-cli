/**
 * Base Pattern Class
 * 
 * Abstract base class for all orchestration patterns.
 * Plugin patterns should extend this class.
 * 
 * @module base-pattern
 */

const { EventEmitter } = require('events');
const { Logger } = require('../utils/logger');
const { AgentFactory } = require('../agents/agent-factory');

/**
 * Base class for all orchestration patterns
 * 
 * @abstract
 * @example
 * class MyCustomPattern extends BasePattern {
 *   initializeAgents() {
 *     return this.config.agents.map(cfg => this.createAgent(cfg));
 *   }
 *   
 *   async execute(progressCallback) {
 *     // Custom execution logic
 *     return { results: [...] };
 *   }
 * }
 */
class BasePattern extends EventEmitter {
  /**
   * Create a pattern instance
   * @param {Object} config - Task configuration
   * @param {Object} options - Runtime options
   */
  constructor(config, options = {}) {
    super();
    
    if (new.target === BasePattern) {
      throw new Error('BasePattern is abstract and cannot be instantiated directly');
    }
    
    this.config = config;
    this.options = options;
    this.logger = new Logger({ prefix: config.pattern || 'pattern' });
    this.agentFactory = new AgentFactory();
    this.agents = [];
    this.results = [];
    this.errors = [];
    this.startTime = null;
    this.endTime = null;
  }

  /**
   * Initialize agents for this pattern
   * Must be implemented by subclass
   * 
   * @abstract
   * @returns {Array<Agent>} Array of initialized agents
   * @throws {Error} If not implemented
   */
  initializeAgents() {
    throw new Error('initializeAgents() must be implemented by subclass');
  }

  /**
   * Execute the pattern
   * Must be implemented by subclass
   * 
   * @abstract
   * @param {Function} progressCallback - Callback for progress updates (agentId, status, output)
   * @returns {Promise<Object>} Execution results
   * @throws {Error} If not implemented
   */
  async execute(progressCallback) {
    throw new Error('execute() must be implemented by subclass');
  }

  /**
   * Create an agent from configuration
   * @param {Object} agentConfig - Agent configuration
   * @returns {Agent} Created agent instance
   */
  createAgent(agentConfig) {
    const agent = this.agentFactory.createAgent(agentConfig);
    this.agents.push(agent);
    return agent;
  }

  /**
   * Get agent by ID or name
   * @param {string} idOrName - Agent ID or name
   * @returns {Agent|null} Agent instance or null
   */
  getAgent(idOrName) {
    return this.agents.find(a => a.id === idOrName || a.name === idOrName) || null;
  }

  /**
   * Execute all agents in parallel
   * @param {Function} progressCallback - Progress callback
   * @returns {Promise<Array>} Results from all agents
   */
  async executeAllParallel(progressCallback) {
    this.startTime = Date.now();
    
    const promises = this.agents.map(async (agent) => {
      try {
        const result = await agent.execute(this.config.task);
        
        if (progressCallback) {
          progressCallback(agent.id, 'completed', result);
        }
        
        this.results.push({
          agentId: agent.id,
          agentName: agent.name,
          status: 'completed',
          output: result
        });
        
        return result;
      } catch (error) {
        if (progressCallback) {
          progressCallback(agent.id, 'failed', error.message);
        }
        
        this.errors.push({
          agentId: agent.id,
          agentName: agent.name,
          error: error.message
        });
        
        this.results.push({
          agentId: agent.id,
          agentName: agent.name,
          status: 'failed',
          error: error.message
        });
        
        throw error;
      }
    });
    
    const results = await Promise.allSettled(promises);
    this.endTime = Date.now();
    
    return results;
  }

  /**
   * Execute agents sequentially
   * @param {Function} progressCallback - Progress callback
   * @returns {Promise<Array>} Results from all agents
   */
  async executeAllSequential(progressCallback) {
    this.startTime = Date.now();
    const results = [];
    
    for (const agent of this.agents) {
      try {
        if (progressCallback) {
          progressCallback(agent.id, 'running', null);
        }
        
        const result = await agent.execute(this.config.task);
        
        if (progressCallback) {
          progressCallback(agent.id, 'completed', result);
        }
        
        results.push({
          agentId: agent.id,
          agentName: agent.name,
          status: 'completed',
          output: result
        });
        
        this.results.push(results[results.length - 1]);
      } catch (error) {
        if (progressCallback) {
          progressCallback(agent.id, 'failed', error.message);
        }
        
        this.errors.push({
          agentId: agent.id,
          agentName: agent.name,
          error: error.message
        });
        
        results.push({
          agentId: agent.id,
          agentName: agent.name,
          status: 'failed',
          error: error.message
        });
        
        this.results.push(results[results.length - 1]);
      }
    }
    
    this.endTime = Date.now();
    return results;
  }

  /**
   * Execute agents with a concurrency limit
   * @param {number} concurrency - Max concurrent agents
   * @param {Function} progressCallback - Progress callback
   * @returns {Promise<Array>} Results from all agents
   */
  async executeWithConcurrency(concurrency, progressCallback) {
    this.startTime = Date.now();
    const results = [];
    const executing = new Set();
    
    for (const agent of this.agents) {
      // Wait if at concurrency limit
      while (executing.size >= concurrency) {
        await Promise.race(executing);
      }
      
      const promise = (async () => {
        try {
          if (progressCallback) {
            progressCallback(agent.id, 'running', null);
          }
          
          const result = await agent.execute(this.config.task);
          
          if (progressCallback) {
            progressCallback(agent.id, 'completed', result);
          }
          
          const agentResult = {
            agentId: agent.id,
            agentName: agent.name,
            status: 'completed',
            output: result
          };
          
          results.push(agentResult);
          this.results.push(agentResult);
          
          return agentResult;
        } catch (error) {
          if (progressCallback) {
            progressCallback(agent.id, 'failed', error.message);
          }
          
          const errorResult = {
            agentId: agent.id,
            agentName: agent.name,
            status: 'failed',
            error: error.message
          };
          
          results.push(errorResult);
          this.results.push(errorResult);
          this.errors.push({
            agentId: agent.id,
            agentName: agent.name,
            error: error.message
          });
          
          return errorResult;
        } finally {
          executing.delete(promise);
        }
      })();
      
      executing.add(promise);
    }
    
    // Wait for all remaining
    await Promise.all(executing);
    
    this.endTime = Date.now();
    return results;
  }

  /**
   * Merge results from multiple agents
   * @param {Array} results - Agent results
   * @param {Object} options - Merge options
   * @returns {Object} Merged results
   */
  mergeResults(results, options = {}) {
    const strategy = options.strategy || 'combine';
    const successfulResults = results.filter(r => r.status === 'completed');
    
    switch (strategy) {
      case 'combine':
        return {
          success: true,
          data: successfulResults.map(r => r.output),
          metadata: {
            totalAgents: this.agents.length,
            successfulAgents: successfulResults.length,
            failedAgents: results.length - successfulResults.length,
            duration: this.endTime - this.startTime
          }
        };
        
      case 'best':
        // Return the result with highest score/confidence
        const best = successfulResults.reduce((prev, curr) => {
          const prevScore = prev.output?.score || prev.output?.confidence || 0;
          const currScore = curr.output?.score || curr.output?.confidence || 0;
          return currScore > prevScore ? curr : prev;
        }, successfulResults[0] || null);
        
        return {
          success: !!best,
          data: best?.output || null,
          metadata: {
            selectedAgent: best?.agentName,
            totalAgents: this.agents.length,
            duration: this.endTime - this.startTime
          }
        };
        
      case 'consensus':
        // Find consensus among results (simple voting for now)
        const outputs = successfulResults.map(r => JSON.stringify(r.output));
        const counts = {};
        let maxCount = 0;
        let consensus = null;
        
        for (const output of outputs) {
          counts[output] = (counts[output] || 0) + 1;
          if (counts[output] > maxCount) {
            maxCount = counts[output];
            consensus = output;
          }
        }
        
        const consensusRatio = maxCount / successfulResults.length;
        
        return {
          success: consensusRatio >= (options.threshold || 0.5),
          data: consensus ? JSON.parse(consensus) : null,
          metadata: {
            consensusRatio,
            agreeingAgents: maxCount,
            totalAgents: this.agents.length,
            duration: this.endTime - this.startTime
          }
        };
        
      default:
        return {
          success: true,
          data: results,
          metadata: {
            duration: this.endTime - this.startTime
          }
        };
    }
  }

  /**
   * Validate pattern configuration
   * Override in subclass for custom validation
   * 
   * @returns {Object} Validation result { valid, errors }
   */
  validate() {
    const errors = [];
    
    if (!this.config.task && !this.config.tasks) {
      errors.push('Task configuration requires "task" or "tasks" field');
    }
    
    if (!this.config.agents || this.config.agents.length === 0) {
      errors.push('At least one agent must be defined');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get pattern execution summary
   * @returns {Object} Execution summary
   */
  getSummary() {
    return {
      pattern: this.config.pattern,
      totalAgents: this.agents.length,
      completedAgents: this.results.filter(r => r.status === 'completed').length,
      failedAgents: this.errors.length,
      duration: this.endTime && this.startTime ? this.endTime - this.startTime : null,
      errors: this.errors.length > 0 ? this.errors : undefined
    };
  }

  /**
   * Emit a custom event
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  emitEvent(event, data) {
    this.emit(event, data);
    this.emit('any', { event, data });
  }
}

module.exports = {
  BasePattern
};
