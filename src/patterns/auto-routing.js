const { AgentFactory } = require('../agents/agent-factory');

class AutoRoutingPattern {
  constructor(config, options = {}) {
    this.config = config;
    this.options = options;
    this.agents = [];
    this.router = config.router || {};
  }

  initializeAgents() {
    this.agents = this.config.agents.map(agentConfig =>
      AgentFactory.createAgent(agentConfig, this.options)
    );
    return this.agents;
  }

  async execute(updateCallback) {
    const task = this.config.task;
    
    // Analyze task and determine routing
    const routing = this.analyzeTask(task);
    
    // Route to appropriate agent(s)
    const results = [];
    
    for (const route of routing.routes) {
      const agent = this.agents.find(a => a.name === route.agent);
      if (!agent) continue;
      
      updateCallback(agent.id, 'running', `Routed with ${(route.confidence * 100).toFixed(0)}% confidence`);
      
      try {
        const output = await agent.execute(
          `[Auto-routed] Task requiring ${route.specialty}: ${task}`
        );
        
        updateCallback(agent.id, 'completed', output);
        results.push({
          agent: agent.name,
          specialty: route.specialty,
          confidence: route.confidence,
          output,
          success: true
        });
      } catch (error) {
        updateCallback(agent.id, 'failed', error.message);
        results.push({
          agent: agent.name,
          error: error.message,
          success: false
        });
      }
    }

    return {
      pattern: 'auto-routing',
      task: task,
      routing: routing,
      results: results,
      primaryResult: results.find(r => r.success && r.confidence === Math.max(...routing.routes.map(rr => rr.confidence)))
    };
  }

  analyzeTask(task) {
    const taskLower = task.toLowerCase();
    const confidenceThreshold = this.router.confidence_threshold || 0.85;
    
    // Score each agent based on specialty match
    const scores = this.agents.map(agent => {
      const specialtyScores = (agent.skills || []).map(specialty => {
        const keywords = this.getSpecialtyKeywords(specialty);
        const matchCount = keywords.filter(kw => taskLower.includes(kw)).length;
        return {
          specialty,
          score: matchCount / keywords.length
        };
      });
      
      // Handle empty specialtyScores array
      const bestMatch = specialtyScores.length > 0 
        ? specialtyScores.reduce((prev, current) => 
            current.score > prev.score ? current : prev
          )
        : { specialty: 'general', score: 0 };
      
      return {
        agent: agent.name,
        specialty: bestMatch.specialty,
        confidence: bestMatch.score
      };
    });
    
    // Sort by confidence and filter by threshold
    const routes = scores
      .filter(s => s.confidence > 0)
      .sort((a, b) => b.confidence - a.confidence);
    
    // Determine routing strategy
    const topRoute = routes[0];
    
    if (topRoute && topRoute.confidence >= confidenceThreshold) {
      // High confidence - single agent
      return {
        strategy: 'auto',
        routes: [topRoute]
      };
    } else if (topRoute && topRoute.confidence >= confidenceThreshold * 0.7) {
      // Medium confidence - propose to user (simulated)
      return {
        strategy: 'proposed',
        routes: routes.slice(0, 2)
      };
    } else {
      // Low confidence - use backup agents
      return {
        strategy: 'fallback',
        routes: routes.slice(0, 3)
      };
    }
  }

  getSpecialtyKeywords(specialty) {
    const keywordMap = {
      'programming': ['code', 'implement', 'develop', 'build', 'create', 'function', 'class'],
      'debugging': ['bug', 'error', 'fix', 'debug', 'issue', 'problem'],
      'refactoring': ['refactor', 'improve', 'optimize', 'clean', 'restructure'],
      'research': ['research', 'find', 'search', 'investigate', 'explore', 'analyze'],
      'analysis': ['analyze', 'examine', 'evaluate', 'assess', 'study'],
      'summarization': ['summarize', 'summarise', 'overview', 'brief', 'summary'],
      'documentation': ['document', 'docs', 'readme', 'guide', 'tutorial', 'write'],
      'blog': ['blog', 'article', 'post', 'write', 'publish'],
      'tutorial': ['tutorial', 'guide', 'how-to', 'step-by-step', 'learn']
    };
    
    return keywordMap[specialty] || [specialty];
  }
}

module.exports = AutoRoutingPattern;
