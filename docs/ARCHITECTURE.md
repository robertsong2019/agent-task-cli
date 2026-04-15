# Agent Task CLI — Architecture

## Overview

```
┌─────────────────────────────────────────┐
│              CLI (bin/agent-task.js)      │
├─────────────────────────────────────────┤
│           Orchestrator (core)            │
│  ┌─────────────────────────────────┐    │
│  │     Pattern Registry            │    │
│  │  ┌──────┐ ┌──────────┐ ┌────┐  │    │
│  │  │Crew  │ │Supervisor│ │Pipe│  │    │
│  │  └──────┘ └──────────┘ └────┘  │    │
│  │  ┌──────┐ ┌──────────┐         │    │
│  │  │Council│ │AutoRoute│         │    │
│  │  └──────┘ └──────────┘         │    │
│  └─────────────────────────────────┘    │
├─────────────────────────────────────────┤
│            Agent Layer                   │
│  BaseAgent → MockAgent | LLMAgent       │
│            ↗ AgentFactory               │
├─────────────────────────────────────────┤
│            Utilities                     │
│     Logger  |  Storage  |  Monitoring   │
└─────────────────────────────────────────┘
```

## Design Principles

1. **Pattern-first** — orchestration patterns are pluggable classes
2. **Agent-agnostic** — agents implement a simple `execute(task)` interface
3. **Event-driven** — tasks emit events for monitoring and composition
4. **File-based persistence** — task state saved as JSON, no database needed

## Data Flow

```
Config (YAML/JSON)
  → Orchestrator.run(config)
    → Create Task
    → Select Pattern
    → Create Agents (AgentFactory)
    → Pattern.execute(agents, task)
      → Agent.execute(subtask) × N
        → Emit 'result' events
      → Convergence/Voting/Merge
    → Task complete
    → Persist to Storage
```

## File Structure

```
src/
├── index.js              # Public API exports
├── orchestrator.js        # Core: Orchestrator + Task classes
├── patterns/
│   ├── work-crew.js       # Parallel execution + convergence
│   ├── supervisor.js      # Dynamic decomposition
│   ├── pipeline.js        # Sequential chain
│   ├── council.js         # Debate + voting
│   └── auto-routing.js    # Heuristic pattern selection
├── agents/
│   ├── base-agent.js      # Abstract base (EventEmitter)
│   ├── mock-agent.js      # Predefined responses
│   ├── llm-agent.js       # OpenAI-compatible LLM calls
│   └── agent-factory.js   # Config → Agent instantiation
├── utils/
│   ├── logger.js          # Leveled logging
│   └── storage.js         # JSON file persistence
├── monitoring/
│   └── ...                # Progress tracking
└── plugins/
    └── ...                # Extension points
```

## Adding a New Pattern

1. Create `src patterns/my-pattern.js`
2. Export a class with `async execute(agents, task, options)`
3. Register in `orchestrator.js`: `this.patterns['my-pattern'] = MyPattern`
4. Add to `index.js` exports

## Adding a New Agent Type

1. Extend `BaseAgent` in `src/agents/my-agent.js`
2. Implement `async execute(task)`
3. Add case to `AgentFactory.create()`
