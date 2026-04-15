# Agent Task Orchestrator CLI

A powerful CLI tool for orchestrating multi-agent tasks with different patterns (Work Crew, Supervisor, Pipeline, Council, Auto-Routing).

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [Tutorial](docs/TUTORIAL.md) | Step-by-step guide from zero to running |
| [API Reference](docs/API_REFERENCE.md) | Full method signatures and config schema |
| [Architecture](docs/ARCHITECTURE.md) | Design principles and data flow |

## Features

- 🎯 **Multiple Orchestration Patterns**: Work Crew, Supervisor, Pipeline, Council, Auto-Routing
- 📝 **Task Definition**: YAML/JSON-based task configuration
- 📊 **Real-time Monitoring**: Track agent execution progress
- 💾 **Export Results**: JSON/Markdown report generation
- 🔧 **Modular Design**: Easy to extend and customize
- 🧪 **Test Coverage**: Comprehensive test suite

## Installation

```bash
cd /root/.openclaw/workspace/projects/agent-task-cli
npm install
npm link  # Install globally
```

## Quick Start

### 1. Define a Task

Create a task file `task.yaml`:

```yaml
name: "Research AI Agents"
pattern: "work-crew"
agents:
  - name: "technical-researcher"
    role: "Research technical aspects"
    focus: "architecture, algorithms, implementation"
  - name: "business-analyst"
    role: "Analyze business impact"
    focus: "market, adoption, ROI"
  - name: "security-expert"
    role: "Evaluate security risks"
    focus: "vulnerabilities, best practices"
  - name: "competitor-analyst"
    role: "Compare with competitors"
    focus: "alternatives, differentiation"
task: "Research the current state of AI Agent technology"
convergence:
  strategy: "consensus"
  threshold: 0.7
```

### 2. Execute the Task

```bash
agent-task run task.yaml
```

### 3. Monitor Progress

```bash
agent-task monitor <task-id>
```

### 4. Export Results

```bash
agent-task export <task-id> --format json
agent-task export <task-id> --format markdown
```

## Orchestration Patterns

### Work Crew

Multiple agents work in parallel on the same task, providing different perspectives.

```yaml
pattern: "work-crew"
agents:
  - name: "agent-1"
    role: "Focus area A"
  - name: "agent-2"
    role: "Focus area B"
convergence:
  strategy: "consensus" | "best-of" | "merge"
```

### Supervisor

A supervisor agent dynamically decomposes tasks and assigns to workers.

```yaml
pattern: "supervisor"
supervisor:
  name: "project-manager"
  strategy: "adaptive" | "sequential" | "parallel"
workers:
  - name: "developer"
    skills: ["coding", "testing"]
  - name: "writer"
    skills: ["documentation"]
```

### Pipeline

Sequential stages with validation gates.

```yaml
pattern: "pipeline"
stages:
  - name: "extract"
    agent: "data-collector"
  - name: "transform"
    agent: "data-processor"
  - name: "validate"
    agent: "quality-checker"
  - name: "write"
    agent: "content-writer"
gates:
  - after: "transform"
    validator: "quality-checker"
```

### Council

Multi-expert decision making with discussion rounds.

```yaml
pattern: "council"
experts:
  - name: "skeptic"
    role: "Challenge assumptions"
  - name: "ethicist"
    role: "Evaluate ethical implications"
  - name: "strategist"
    role: "Strategic perspective"
rounds: 3
convergence:
  strategy: "consensus" | "vote" | "average"
```

### Auto-Routing

Automatically route tasks to specialized agents.

```yaml
pattern: "auto-routing"
router:
  confidence_threshold: 0.85
agents:
  - name: "coder"
    specialties: ["programming", "debugging", "refactoring"]
  - name: "researcher"
    specialties: ["research", "analysis", "summarization"]
  - name: "writer"
    specialties: ["documentation", "blog", "tutorial"]
```

## CLI Commands

### `agent-task run <file>`

Execute a task from a YAML/JSON file.

```bash
agent-task run task.yaml
agent-task run task.json
agent-task run task.yaml --dry-run  # Preview without execution
agent-task run task.yaml --timeout 300  # 5 minute timeout
```

### `agent-task list`

List all tasks.

```bash
agent-task list
agent-task list --status running
agent-task list --status completed
```

### `agent-task monitor <task-id>`

Monitor task execution in real-time.

```bash
agent-task monitor abc123
agent-task monitor abc123 --verbose
```

### `agent-task export <task-id>`

Export task results.

```bash
agent-task export abc123 --format json --output results.json
agent-task export abc123 --format markdown --output report.md
```

### `agent-task cancel <task-id>`

Cancel a running task.

```bash
agent-task cancel abc123
```

### `agent-task patterns`

List available orchestration patterns.

```bash
agent-task patterns
```

## Project Structure

```
agent-task-cli/
├── bin/
│   └── agent-task.js          # CLI entry point
├── src/
│   ├── cli.js                 # CLI logic
│   ├── orchestrator.js        # Core orchestrator
│   ├── patterns/
│   │   ├── work-crew.js       # Work Crew pattern
│   │   ├── supervisor.js      # Supervisor pattern
│   │   ├── pipeline.js        # Pipeline pattern
│   │   ├── council.js         # Council pattern
│   │   └── auto-routing.js    # Auto-Routing pattern
│   ├── agents/
│   │   ├── base-agent.js      # Base agent class
│   │   └── mock-agent.js      # Mock agent for testing
│   ├── utils/
│   │   ├── logger.js          # Logging utility
│   │   ├── storage.js         # Task storage
│   │   └── validator.js       # Schema validation
│   └── index.js               # Main export
├── tests/
│   ├── orchestrator.test.js
│   ├── patterns.test.js
│   └── cli.test.js
├── examples/
│   ├── work-crew.yaml
│   ├── supervisor.yaml
│   ├── pipeline.yaml
│   ├── council.yaml
│   └── auto-routing.yaml
├── package.json
└── README.md
```

## API Usage

```javascript
const { Orchestrator } = require('agent-task-cli');

const orchestrator = new Orchestrator();

// Run a task
const task = await orchestrator.run({
  name: "My Task",
  pattern: "work-crew",
  agents: [
    { name: "agent-1", role: "Research" },
    { name: "agent-2", role: "Analysis" }
  ],
  task: "Analyze AI trends"
});

// Monitor progress
task.on('progress', (update) => {
  console.log(update);
});

// Get results
const results = await task.results;
```

## Testing

```bash
npm test
npm run test:coverage
```

## Development

```bash
npm run dev  # Watch mode
npm run lint
npm run format
```

## License

MIT

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md)
