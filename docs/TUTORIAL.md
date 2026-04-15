# Agent Task CLI — Tutorial

## Hello, Multi-Agent Orchestration! 🚀

This tutorial walks you through building your first multi-agent task, from zero to running.

---

## Prerequisites

- Node.js 18+
- An OpenAI API key (for `LLMAgent`; optional — `MockAgent` works without one)

## Step 1: Install

```bash
cd projects/agent-task-cli
npm install
npm link
```

Verify:
```bash
agent-task --help
```

## Step 2: Your First Task (Work Crew)

Create `my-first-task.yaml`:

```yaml
name: "Brainstorm: App Ideas"
pattern: "work-crew"
agents:
  - name: "creative"
    role: "Wild creative ideas"
    focus: "novelty, surprise"
  - name: "practical"
    role: "Practical feasibility check"
    focus: "cost, timeline, tech stack"
  - name: "user-advocate"
    role: "User perspective"
    focus: "UX, accessibility, value"
task: "Generate 5 app ideas for personal productivity in 2026"
convergence:
  strategy: "merge"
```

Run it:
```bash
agent-task run my-first-task.yaml
```

What happens:
1. Three agents receive the **same task**
2. Each produces their own response
3. Results are **merged** into a unified output

## Step 3: Use Mock Agents (No API Key Needed)

Testing without burning tokens? Set agent types to `mock`:

```yaml
agents:
  - name: "creative"
    type: "mock"
    role: "creative thinker"
```

Or use the JavaScript API:

```js
const { Orchestrator, agents: { MockAgent } } = require('agent-task-cli');

const orch = new Orchestrator();

// Create mock agents with predefined responses
const a1 = new MockAgent({ name: 'bot-1', responses: ['Response from bot 1'] });
const a2 = new MockAgent({ name: 'bot-2', responses: ['Response from bot 2'] });

const task = await orch.run({
  name: 'test',
  pattern: 'work-crew',
  agents: [{ name: 'bot-1' }, { name: 'bot-2' }],
  task: 'Hello',
  convergence: { strategy: 'merge' }
});
```

## Step 4: Pipeline — Chain Agents Together

Each stage feeds into the next:

```yaml
name: "Blog Post Pipeline"
pattern: "pipeline"
task: "Write about AI agents in 2026"
stages:
  - agent: "researcher"
    role: "Gather facts and trends"
  - agent: "writer"
    role: "Write the draft based on research"
  - agent: "editor"
    role: "Polish and fact-check"
```

The **researcher's output** becomes the **writer's input**, and so on.

## Step 5: Supervisor — Dynamic Task Decomposition

Let a supervisor agent break down work:

```yaml
name: "Build a Feature"
pattern: "supervisor"
supervisor:
  name: "tech-lead"
  strategy: "adaptive"
workers:
  - name: "backend-dev"
    skills: ["api", "database", "testing"]
  - name: "frontend-dev"
    skills: ["ui", "components", "styling"]
  - name: "devops"
    skills: ["docker", "ci-cd", "monitoring"]
task: "Add user authentication with OAuth2"
```

The supervisor analyzes the task and assigns subtasks to workers based on their skills.

## Step 6: Council — Debate and Vote

Get a more deliberated answer:

```yaml
name: "Architecture Decision"
pattern: "council"
agents:
  - name: "performance-expert"
  - name: "security-expert"
  - name: "maintainer"
task: "Should we use microservices or monolith for a team of 5?"
voting:
  method: "weighted"
  rounds: 2
```

Agents discuss, then vote. The consensus becomes the final answer.

## Step 7: Monitor and Export

```bash
# Watch a running task
agent-task monitor <task-id>

# Export results
agent-task export <task-id> -f markdown -o results.md
agent-task export <task-id> -f json -o results.json

# View history
agent-task history
```

## Step 8: Custom Agent (JavaScript API)

Create your own agent by extending `BaseAgent`:

```js
const { agents: { BaseAgent } } = require('agent-task-cli');

class ScraperAgent extends BaseAgent {
  constructor(config) {
    super(config);
    this.apiUrl = config.apiUrl;
  }

  async execute(task) {
    // Your custom logic
    const response = await fetch(`${this.apiUrl}/search?q=${task}`);
    const data = await response.json();
    
    this.emit('result', { agent: this.name, data });
    return { summary: data.results[0].text };
  }
}

module.exports = { ScraperAgent };
```

Use it:
```js
const scraper = new ScraperAgent({ name: 'web-scraper', apiUrl: 'https://api.example.com' });
```

## Step 9: Programmatic Usage

Full control from JavaScript:

```js
const { Orchestrator, patterns, agents, utils } = require('agent-task-cli');

const orch = new Orchestrator();

// Listen to events
orch.on('task:completed', (taskId, result) => {
  console.log(`✅ Task ${taskId} done!`);
  console.log(result);
});

// Run with options
const task = await orch.run({
  name: 'my-task',
  pattern: 'work-crew',
  agents: [
    { name: 'analyst', type: 'llm', model: 'gpt-4' },
    { name: 'critic', type: 'llm', model: 'gpt-4' }
  ],
  task: 'Analyze the pros and cons of serverless architecture',
  convergence: { strategy: 'consensus', threshold: 0.6 }
}, {
  timeout: 60000,
  verbose: true
});

// Cancel if needed
// await orch.cancel(task.id);
```

## Tips

1. **Start with `work-crew`** — simplest pattern, great for brainstorming
2. **Use `mock` agents for testing** — no API costs
3. **Pipeline for sequential work** — research → write → review
4. **Supervisor for complex tasks** — let AI break it down
5. **Council for decisions** — get debated, not just generated, answers
6. **Set timeouts** — prevent runaway tasks
7. **Export to markdown** — easy to read and share

## Next Steps

- Read the [API Reference](./API_REFERENCE.md) for full method signatures
- Check the `examples/` directory for more configurations
- Try `auto-routing` to let the system pick the best pattern
