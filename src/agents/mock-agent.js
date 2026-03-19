const { BaseAgent } = require('./base-agent');

class MockAgent extends BaseAgent {
  constructor(config) {
    super(config);
    this.delay = config.delay || 1000; // Default 1 second delay
  }

  async execute(task) {
    this.status = 'running';
    
    // Simulate work with delay
    await new Promise(resolve => setTimeout(resolve, this.delay));
    
    // Generate mock output based on role
    this.output = this.generateMockOutput(task);
    this.status = 'completed';
    
    return this.output;
  }

  generateMockOutput(task) {
    const outputs = {
      'technical-researcher': `Technical Analysis: ${task}\n\nKey findings:\n- Architecture uses modular design\n- Implements ReAct pattern for reasoning\n- Supports function calling for tool integration`,
      
      'business-analyst': `Business Impact Analysis: ${task}\n\nMarket insights:\n- Growing adoption in enterprise sector\n- ROI potential: 3-5x productivity gains\n- Key success factors: proper training, clear use cases`,
      
      'security-expert': `Security Assessment: ${task}\n\nRisks identified:\n- Data privacy concerns with LLM APIs\n- Prompt injection vulnerabilities\n- Recommendations: implement input validation, use secure API keys`,
      
      'competitor-analyst': `Competitive Analysis: ${task}\n\nMarket landscape:\n- LangChain: comprehensive but complex\n- AutoGen: Microsoft-backed, research-focused\n- CrewAI: newer, developer-friendly\n\nDifferentiation: focus on simplicity and modularity`,
      
      'default': `Analysis completed for: ${task}\n\nRole: ${this.role}\nFocus: ${this.focus || 'General'}\n\nThis is a mock output for testing purposes.`
    };
    
    return outputs[this.name] || outputs['default'];
  }
}

module.exports = { MockAgent };
