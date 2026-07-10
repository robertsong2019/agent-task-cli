# Agent Task Orchestrator CLI

[![npm version](https://badge.fury.io/js/agent-task-cli.svg)](https://badge.fury.io/js/agent-task-cli)
[![Build Status](https://github.com/robertsong2019/agent-task-cli/workflows/CI/badge.svg)](https://github.com/robertsong2019/agent-task-cli/actions)
[![Test Coverage](https://codecov.io/gh/robertsong2019/agent-task-cli/branch/main/graph/badge.svg)](https://codecov.io/gh/robertsong2019/agent-task-cli)
[![License](https://img.shields.io/npm/l/agent-task-cli.svg)](LICENSE)
[![Node Version](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)](https://nodejs.org/en/)

A powerful CLI tool for orchestrating multi-agent tasks with different patterns (Work Crew, Supervisor, Pipeline, Council, Auto-Routing).

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [📖 Tutorial](docs/TUTORIAL.md) | Step-by-step guide from zero to running |
| [🔌 API Reference](docs/API_REFERENCE.md) | Full method signatures and config schema |
| [🏗️ Architecture](docs/ARCHITECTURE.md) | Design principles and data flow |

## ✨ Features

- 🎯 **Multiple Orchestration Patterns**: Work Crew, Supervisor, Pipeline, Council, Auto-Routing
- 📝 **Task Definition**: YAML/JSON-based task configuration
- 📊 **Real-time Monitoring**: Track agent execution progress
- 💾 **Export Results**: JSON/Markdown report generation
- 🔧 **Modular Design**: Easy to extend and customize
- 🧪 **Test Coverage**: 1209 tests across 122 suites
- 🔌 **Plugin System**: Extend with custom patterns and agents
- ⚡ **High Performance**: Concurrent execution with caching

## 🚀 Installation

```bash
npm install -g agent-task-cli
```

## 🚀 Quick Start

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

## Utility Classes

### Cache (`src/utils/cache.js`)

In-memory cache with TTL, LRU eviction, and hit/miss stats.

```javascript
const { Cache } = require('./src/utils/cache');

const cache = new Cache({ maxSize: 100, defaultTTL: 3600000 });

cache.set('key', 'value', 5000);  // TTL in ms
cache.get('key');                  // → 'value'

// F150: Replace only if key exists (Redis REPLACE semantics)
const old = cache.replace('key', 'new_value', 10000);
// → 'value' (old value), or undefined if key was missing/expired

// F151: Retain only matching entries (filter-in-place)
const removed = cache.retain((value, key) => key.startsWith('task:'));
// → 5 (count of removed entries)

// F153: Get with fallback default (auto-set)
const val = cache.withDefault('missing', 'default-value');
// → 'default-value' (also sets it with defaultTTL)

// F154: Increment (or initialise then increment) a numeric value
cache.incrBy('counter', 5);         // → 5 (initialised from 0)
cache.incrBy('counter', 3);         // → 8
cache.incrBy('counter', -2, { min: 0 }); // → 6 (clamped to min)

// F159: Batch refresh TTL for multiple keys
cache.touchMany(['k1', 'k2', 'k3'], 60000);
// → 3 (count of keys successfully refreshed)

// F164: Rename a key, preserving value and remaining TTL
cache.rename('old-key', 'new-key'); // → true
cache.rename('k1', 'k2', { keepOriginal: true }); // copy semantics
```

### Storage (`src/utils/storage.js`)

File-based task storage with JSON persistence.

```javascript
const { Storage } = require('./src/utils/storage');

const storage = new Storage({ dataDir: './data' });
await storage.save(task);
await storage.load(id);

// F152: Rename a task's ID (collision-safe)
const ok = await storage.rename('old-id', 'new-id');
// → true if renamed, false if source missing or target already exists

// F155: Upsert — insert or update in one call
const task = await storage.upsert('task-42', { name: 'Updated', status: 'running' });
// → creates if not exists, updates if exists

// F157: Paginate tasks with metadata
const page = await storage.paginate(2, 10, { status: 'done' });
// → { items: [...], page: 2, pageSize: 10, total: 42, totalPages: 5 }
```

### EventBus (`src/utils/event-bus.js`)

Channel-based pub/sub event system.

```javascript
const { EventBus } = require('./src/utils/event-bus');

const bus = new EventBus();
bus.on('task:progress', (data) => console.log(data));
bus.emit('task:progress', { taskId: 'abc', percent: 50 });

// F156: Emit with metadata envelope
bus.emitWithMeta('task:done', { result: 'success' }, { duration: 1200, agent: 'bot' });
// listeners receive { data: { result: 'success' }, meta: { duration: 1200, agent: 'bot' } }

// F158: Emit with automatic retry on listener errors
await bus.emitWithRetry('task:save', data, 2);
// retries up to 2 times if listeners throw, with exponential backoff

// F162: Merge another bus's subscribers and history into this one
const bus2 = new EventBus();
bus2.on('task:alert', handler);
bus.merge(bus2); // bus now receives events from both buses
// → count of subscribers merged
```

### PriorityQueue (`src/utils/priority-queue.js`)

Binary heap priority queue with FIFO fallback for equal priorities.

```javascript
const { PriorityQueue } = require('./src/utils/priority-queue');

const pq = new PriorityQueue();
pq.push('urgent', 1);
pq.push('normal', 5);
pq.pop(); // → 'urgent'

// F160: Drain all items in priority order, leaving the queue empty
const all = pq.drain(); // → ['urgent', 'normal'] (priority order)
```

### ConcurrencyManager (`src/utils/concurrency-manager.js`)

Promise-based concurrency limiter for controlling parallel async operations.

```javascript
const { ConcurrencyManager } = require('./src/utils/concurrency-manager');

const cm = new ConcurrencyManager(3); // max 3 concurrent

// F163: Map over items with concurrency limit
const results = await cm.map([1, 2, 3, 4, 5], async (item) => {
  return await fetch(`/api/${item}`).then(r => r.json());
}, { stopOnError: false });
// → array of results in same order as input
```

### RetryHandler (`src/utils/retry-handler.js`)

Configurable retry with exponential backoff and error classification.

```javascript
const { RetryHandler } = require('./src/utils/retry-handler');

const retry = new RetryHandler({ maxRetries: 3, baseDelay: 100 });

// F165: Execute with fallback function on final failure
const result = await retry.withFallback(
  async () => await fetchPrimary(),
  async () => await fetchCache(), // called if all retries fail
  { maxRetries: 2 }
);

// F169: Retry only while predicate returns true
const data = await retry.retryIf(
  async () => await pollApi(),
  (value) => value.status === 'pending', // keep retrying if still pending
  5 // max retries
);
```

### EventBus (additional methods)

```javascript
const { EventBus } = require('./src/utils/event-bus');

const bus = new EventBus();

// F166: Pause event emission (events queued, not lost)
bus.pause();

// F167: Resume paused emission — queued events fire in order
bus.resume();
```

### Cache (additional methods)

```javascript
// F164: Rename a key, preserving value and remaining TTL
const ok = cache.rename('old-key', 'new-key');
// → true if renamed, false if old key doesn't exist
cache.rename('k1', 'k2', { keepOriginal: true }); // copy semantics

// F168: Set multiple keys only if ALL are absent (atomic)
const setAll = cache.msetnx({ a: 1, b: 2, c: 3 });
// → true if all set, false if any key already exists (no changes)
```

### Storage (additional methods)

```javascript
// F161: Find first task matching all key-value pairs in filter
const task = await storage.findOne({ status: 'pending', priority: 'high' });
// → matching task (with id) or null if none found

// F170: Aggregate a field across all tasks
const totalPriority = storage.aggregate(
  'priority',
  (acc, v) => acc + v,  // reducer
  0                      // initial value
);
// Also supports prefix filtering:
storage.aggregate('price', (sum, v) => sum + v, 0, 'order:');

// F173: Get all active (non-completed) tasks
const active = storage.activeTasks();
// → array of tasks where status !== 'completed'

// F174: Count tasks matching a predicate
const n = await storage.countWhere((task) => task.priority > 5);
// → number of matching tasks
```

### Cache (advanced)

```javascript
// F175: Atomically get and delete a key
const val = cache.pop('temp-key');
// → value or undefined if key doesn't exist

// F178: Batch pop — atomically get and delete multiple keys
const vals = cache.mpop(['k1', 'k2', 'k3']);
// → { k1: <value>, k3: <value> } (misses omitted)

// F181: Get remaining TTL in milliseconds (Redis PTTL semantics)
const ttl = cache.getTTL('session-token');
// → ms remaining, -1 if no expiry, -2 if key doesn't exist

// F184: Serialize all non-expired entries to JSON-safe plain object
const snapshot = cache.serialize();
// → { key1: value1, key2: value2, ... }
// Cleans non-serializable values (functions, symbols, undefined)

// F187: Validate cached value against a schema
const result = cache.validate('user-session', {
  type: 'object',
  required: ['userId', 'token']
});
// → { valid: true } or { valid: false, errors: ['Missing required field: token'] }

// F188: Count entries by JavaScript type
const typeCounts = cache.countType();
// → { object: 15, array: 3, string: 8, number: 2, boolean: 1, other: 0 }
```

### Storage (advanced)

```javascript
// F176: Map each task and reduce results
const totalCost = await storage.mapReduce(
  (task) => task.cost,
  (acc, cost) => acc + cost,
  0
);
// → sum of all task costs

// F179: Flat-map a field (must be array) across all tasks
const allTags = await storage.flatMap('tags');
// → ['urgent', 'backend', 'frontend', ...] (flattened)

// F182: Get all tasks except the given IDs
const others = await storage.except(['task-1', 'task-2']);
// → all tasks NOT matching the given IDs

// F185: Get n random tasks (Fisher-Yates partial shuffle)
const sample = await storage.random(3);
// → array of 3 random tasks
```

### EventBus (advanced)

```javascript
// F177: Forward events from one channel to another bus
const unsub = bus.forward('alerts', targetBus, (event) => ({
  ...event,
  forwarded: true
}));
// transform optional; returns unsubscribe function

// F180: Forward multiple channels at once
const unsub = bus.forwardMany([
  { channel: 'alerts', targetBus },
  { channel: 'logs', targetBus, transform: fn }
]);
// Returns unsubscribe function that stops all forwards

// F183: Emit the same data to all active channels
const channels = bus.broadcast({ level: 'critical' });
// → list of channel names that received the event

// F186: Total subscriber count across all channels
const count = bus.size();
// → number (excludes wildcard subscribers)
```

```javascript
// F171: Drain until a condition is met
const taken = queue.drainUntil(item => item.priority >= 5);
// → array of items with priority ≥ 5, removed from queue
// Remaining items stay in the queue

// F172: Get items as a sorted array (without removing)
const sorted = queue.toSortedArray();
// → items sorted by priority (highest first)
```

## 🛠️ Development

```bash
git clone https://github.com/robertsong2019/agent-task-cli.git
cd agent-task-cli
npm install

npm run dev    # Watch mode
npm run lint   # Code linting
npm run format # Code formatting
npm test       # Run tests
```

## 🤝 Contributing

Contributions welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## 📋 Changelog

See [CHANGELOG.md](CHANGELOG.md) for details on changes between versions.

## 📄 License

[MIT License](LICENSE) - see the [LICENSE](LICENSE) file for details.

## 🌐 Support

- 📚 [Documentation](https://github.com/robertsong2019/agent-task-cli#readme)
- 🐛 [Bug Reports](https://github.com/robertsong2019/agent-task-cli/issues)
- 💡 [Feature Requests](https://github.com/robertsong2019/agent-task-cli/issues)
- 💬 [Discussions](https://github.com/robertsong2019/agent-task-cli/discussions)
