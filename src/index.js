const { Orchestrator, Task } = require('./orchestrator');
const WorkCrewPattern = require('./patterns/work-crew');
const SupervisorPattern = require('./patterns/supervisor');
const PipelinePattern = require('./patterns/pipeline');
const CouncilPattern = require('./patterns/council');
const AutoRoutingPattern = require('./patterns/auto-routing');
const { BaseAgent } = require('./agents/base-agent');
const { MockAgent } = require('./agents/mock-agent');
const { LLMAgent } = require('./agents/llm-agent');
const { AgentFactory } = require('./agents/agent-factory');
const { Logger } = require('./utils/logger');
const { Storage } = require('./utils/storage');
const { EventBus, globalBus } = require('./utils/event-bus');
const { TaskChain } = require('./task-chain');

module.exports = {
  Orchestrator,
  Task,
  TaskChain,
  EventBus,
  globalBus,
  patterns: {
    WorkCrewPattern,
    SupervisorPattern,
    PipelinePattern,
    CouncilPattern,
    AutoRoutingPattern
  },
  agents: {
    BaseAgent,
    MockAgent,
    LLMAgent,
    AgentFactory
  },
  utils: {
    Logger,
    Storage,
    EventBus
  }
};
