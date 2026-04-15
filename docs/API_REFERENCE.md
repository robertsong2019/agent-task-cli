# Agent Task CLI — API Reference

> Version: 1.0.0 | Auto-generated from source

## Installation

```bash
npm install
npm link    # makes `agent-task` available globally
```

## Module Entry Point

```js
const { Orchestrator, Task, patterns, agents, utils } = require('agent-task-cli');
```

---

## Core Classes

### `Orchestrator`

Central coordinator. Registers patterns, manages active tasks, persists state.

```js
const orch = new Orchestrator();
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `run` | `async run(config: object, options?: object): Task` | Create and start a task. Returns immediately; execution continues async. |
| `cancel` | `async cancel(taskId: string): Task` | Cancel a running task by ID. |
| `getStatus` | `getStatus(taskId: string): object` | Get current status of a task. |
| `listTasks` | `listTasks(): Task[]` | List all active tasks. |

**Events (via EventEmitter):** `task:started`, `task:completed`, `task:failed`, `task:cancelled`

---

### `Task`

Represents a single orchestration run. Extends `EventEmitter`.

```js
// Created internally by Orchestrator.run()
const task = await orch.run(config);
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `execute` | `async execute(): Promise<void>` | Run the configured pattern. Called automatically. |
| `cancel` | `cancel(): void` | Signal cancellation. |
| `toJSON` | `toJSON(): object` | Serialize task state for storage. |
| `onResult` | `onResult(callback): void` | Listen for agent results. |

**Properties:** `id`, `config`, `status`, `results`, `startTime`, `endTime`

---

## Patterns

Each pattern is a class with `async execute(agents, task, options)`.

### `WorkCrewPattern`

All agents work on the **same task** in parallel. Results merged via convergence strategy.

```js
const { WorkCrewPattern } = patterns;
```

**Config:**
```yaml
pattern: "work-crew"
agents: [...]
convergence:
  strategy: "consensus" | "best-of" | "merge"
  threshold: 0.7          # for consensus
```

### `SupervisorPattern`

A supervisor decomposes the task and assigns subtasks to workers.

```js
const { SupervisorPattern } = patterns;
```

**Config:**
```yaml
pattern: "supervisor"
supervisor:
  name: "pm"
  strategy: "adaptive" | "sequential" | "parallel"
workers: [...]
```

### `PipelinePattern`

Sequential chain — each agent's output feeds the next.

```yaml
pattern: "pipeline"
stages:
  - agent: "researcher"
    input: "raw task"
  - agent: "writer"
  - agent: "reviewer"
```

### `CouncilPattern`

Agents debate, then vote/consensus to produce a final answer.

```yaml
pattern: "council"
agents: [...]
voting:
  method: "majority" | "unanimous" | "weighted"
  rounds: 3
```

### `AutoRoutingPattern`

Automatically selects the best pattern based on task characteristics.

```yaml
pattern: "auto-routing"
agents: [...]
# Routing heuristics configured internally
```

---

## Agents

### `BaseAgent`

Abstract base. Extend to create custom agents.

```js
class MyAgent extends BaseAgent {
  async execute(task) {
    // your logic here
    this.emit('result', { output: '...' });
    return result;
  }
}
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `execute` | `async execute(task): Promise<any>` | **Override this.** Run the agent logic. |

### `MockAgent`

Returns predefined responses. Perfect for testing.

```js
const { MockAgent } = agents;
const mock = new MockAgent({ name: 'test', responses: ['hello'] });
```

### `LLMAgent`

Calls an LLM API (OpenAI-compatible) to generate responses.

```js
const { LLMAgent } = agents;
const agent = new LLMAgent({
  name: 'writer',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4',
  systemPrompt: 'You are a technical writer.'
});
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `execute` | `async execute(task, context?): Promise<object>` | Send task to LLM, return response. |
| `executeStream` | `async *executeStream(task, context?): AsyncGenerator` | Stream LLM response token by token. |
| `callLLM` | `async callLLM(messages): Promise<string>` | Raw LLM call with message array. |

### `AgentFactory`

Create agents from config objects.

```js
const { AgentFactory } = agents;
const agent = AgentFactory.create({
  type: 'llm',     // 'mock' | 'llm'
  name: 'researcher',
  apiKey: '...'
});
```

---

## Utilities

### `Logger`

```js
const { Logger } = utils;
const log = new Logger('debug');  // error | warn | info | debug
log.info('Task started');
```

### `Storage`

File-based task persistence (JSON).

```js
const { Storage } = utils;
const store = new Storage();
await store.saveTask(taskId, data);
await store.updateTask(taskId, { status: 'completed' });
const task = await store.getTask(taskId);
```

---

## CLI Commands

```bash
agent-task run <config.yaml>     # Execute a task
agent-task monitor <task-id>     # Watch progress
agent-task export <task-id> -f json|markdown
agent-task list                   # Show active tasks
agent-task cancel <task-id>       # Cancel a running task
agent-task history                # Show completed tasks
```

### CLI Options

| Flag | Description |
|------|-------------|
| `--verbose` | Debug-level logging |
| `--dry-run` | Parse config without executing |
| `--output, -o` | Output file path for export |
| `--format, -f` | Export format: `json` or `markdown` |
| `--timeout` | Max execution time (ms) |

---

## Task Config Schema (YAML)

```yaml
name: string              # Task name
pattern: string           # work-crew | supervisor | pipeline | council | auto-routing
agents:                   # Agent definitions
  - name: string
    role: string
    focus?: string
    skills?: string[]
task: string              # The actual task description
convergence?: object      # Pattern-specific convergence config
voting?: object           # Council-specific voting config
stages?: object[]         # Pipeline stage definitions
timeout?: number          # Per-task timeout (ms)
retries?: number          # Retry count on failure
```

---

## Error Handling

All methods throw on fatal errors. Catch with try/catch or listen to events:

```js
orch.on('task:failed', (taskId, error) => {
  console.error(`Task ${taskId} failed:`, error.message);
});
```

Task states: `pending` → `running` → `completed` | `failed` | `cancelled`
