const { MockAgent } = require('./mock-agent');
const { LLMAgent } = require('./llm-agent');

/**
 * Agent Factory - Creates agents based on configuration
 */
class AgentFactory {
  /**
   * Create an agent based on configuration
   * @param {Object} config - Agent configuration
   * @param {Object} options - Global options
   * @returns {BaseAgent} - The created agent
   */
  static createAgent(config, options = {}) {
    const agentType = config.type || options.defaultAgentType || 'mock';
    
    switch (agentType) {
    case 'llm':
    case 'openai':
    case 'glm':
    case 'deepseek':
      return new LLMAgent({
        ...config,
        provider: agentType === 'llm' ? undefined : agentType,
        ...options.llmConfig
      });
        
    case 'mock':
    default:
      return new MockAgent({
        ...config,
        delay: options.verbose ? 1500 : 1000
      });
    }
  }
  
  /**
   * Create multiple agents from configuration array
   * @param {Array} agentConfigs - Array of agent configurations
   * @param {Object} options - Global options
   * @returns {Array<BaseAgent>} - Array of created agents
   */
  static createAgents(agentConfigs, options = {}) {
    return agentConfigs.map(config => AgentFactory.createAgent(config, options));
  }
  
  /**
   * Detect agent type from configuration
   * @param {Object} config - Agent configuration
   * @returns {string} - Detected agent type
   */
  static detectAgentType(config) {
    // Explicit type
    if (config.type) return config.type;
    
    // Has LLM configuration
    if (config.apiKey || config.model || config.baseUrl || config.provider) {
      return 'llm';
    }
    
    // Check for environment variables
    if (process.env.LLM_API_KEY || process.env.OPENAI_API_KEY) {
      return 'llm';
    }
    
    return 'mock';
  }
}

module.exports = { AgentFactory };
