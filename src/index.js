const { Orchestrator, Task } = require('./orchestrator');
const WorkCrewPattern = require('./patterns/work-crew');
const SupervisorPattern = require('./patterns/supervisor');
const PipelinePattern = require('./patterns/pipeline');
const CouncilPattern = require('./patterns/council');
const AutoRoutingPattern = require('./patterns/auto-routing');
const { BaseAgent } = require('./agents/base-agent');
const { MockAgent } = require('./agents/mock-agent');
const { Logger } = require('./utils/logger');
const { Storage } = require('./utils/storage');

module.exports = {
  Orchestrator,
  Task,
  patterns: {
    WorkCrewPattern,
    SupervisorPattern,
    PipelinePattern,
    CouncilPattern,
    AutoRoutingPattern
  },
  agents: {
    BaseAgent,
    MockAgent
  },
  utils: {
    Logger,
    Storage
  }
};
