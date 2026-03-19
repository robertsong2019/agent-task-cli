const { MockAgent } = require('../agents/mock-agent');

class CouncilPattern {
  constructor(config, options = {}) {
    this.config = config;
    this.options = options;
    this.agents = [];
  }

  initializeAgents() {
    this.agents = this.config.experts.map(expert =>
      new MockAgent({
        name: expert.name,
        role: expert.role,
        delay: this.options.verbose ? 1500 : 1000
      })
    );
    return this.agents;
  }

  async execute(updateCallback) {
    const task = this.config.task;
    const rounds = this.config.rounds || 3;
    const discussionRounds = [];

    for (let round = 1; round <= rounds; round++) {
      const roundOutputs = [];
      
      // Each expert provides their perspective
      for (const agent of this.agents) {
        updateCallback(agent.id, 'running', `Round ${round}`);
        
        try {
          const context = this.buildContext(round, roundOutputs, discussionRounds);
          const output = await agent.execute(
            `[Round ${round}] ${agent.role}'s perspective on: ${task}\nContext: ${context}`
          );
          
          updateCallback(agent.id, 'completed', output);
          roundOutputs.push({
            expert: agent.name,
            role: agent.role,
            perspective: output
          });
        } catch (error) {
          updateCallback(agent.id, 'failed', error.message);
        }
      }
      
      discussionRounds.push({
        round,
        perspectives: roundOutputs
      });
    }

    // Converge to final decision
    const converged = this.converge(discussionRounds);

    return {
      pattern: 'council',
      task: task,
      rounds: rounds,
      discussion: discussionRounds,
      decision: converged
    };
  }

  buildContext(currentRound, currentRoundOutputs, previousRounds) {
    if (currentRound === 1) {
      return 'Initial discussion - no prior context';
    }
    
    // Include summary of previous round
    const previousRound = previousRounds[previousRounds.length - 1];
    const summary = previousRound.perspectives
      .map(p => `${p.expert}: ${p.perspective.substring(0, 100)}...`)
      .join('\n');
    
    return `Previous round summary:\n${summary}`;
  }

  converge(discussionRounds) {
    const strategy = this.config.convergence?.strategy || 'consensus';
    
    const finalRound = discussionRounds[discussionRounds.length - 1];
    const perspectives = finalRound.perspectives;
    
    switch (strategy) {
      case 'consensus':
        return this.consensusDecision(perspectives);
      
      case 'vote':
        return this.voteDecision(perspectives);
      
      case 'average':
      default:
        return this.averageDecision(perspectives);
    }
  }

  consensusDecision(perspectives) {
    // Simplified consensus - check if all experts agree
    const themes = perspectives.map(p => this.extractTheme(p.perspective));
    const uniqueThemes = [...new Set(themes)];
    
    const consensusReached = uniqueThemes.length <= Math.ceil(perspectives.length / 2);
    
    return {
      strategy: 'consensus',
      consensusReached,
      themes: uniqueThemes,
      summary: consensusReached 
        ? 'Council reached consensus' 
        : 'Council remains divided',
      perspectives: perspectives
    };
  }

  voteDecision(perspectives) {
    // Simplified voting - count themes
    const themeCounts = {};
    perspectives.forEach(p => {
      const theme = this.extractTheme(p.perspective);
      themeCounts[theme] = (themeCounts[theme] || 0) + 1;
    });
    
    const winningTheme = Object.entries(themeCounts)
      .sort((a, b) => b[1] - a[1])[0];
    
    return {
      strategy: 'vote',
      winner: winningTheme[0],
      votes: winningTheme[1],
      totalVoters: perspectives.length,
      perspectives: perspectives
    };
  }

  averageDecision(perspectives) {
    // Combine all perspectives
    const combinedView = perspectives.map(p => 
      `${p.expert} (${p.role}): ${p.perspective}`
    ).join('\n\n');
    
    return {
      strategy: 'average',
      combinedView,
      participantCount: perspectives.length,
      perspectives: perspectives
    };
  }

  extractTheme(perspective) {
    // Simplified theme extraction
    const keywords = ['positive', 'negative', 'neutral', 'concerned', 'supportive'];
    for (const keyword of keywords) {
      if (perspective.toLowerCase().includes(keyword)) {
        return keyword;
      }
    }
    return 'neutral';
  }
}

module.exports = CouncilPattern;
