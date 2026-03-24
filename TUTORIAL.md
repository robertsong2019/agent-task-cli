# Tutorial - Agent Task Orchestrator CLI

> 从零开始掌握多 Agent 任务编排

## 📚 目录

- [介绍](#介绍)
- [第一部分: 快速开始](#第一部分-快速开始-10-分钟)
- [第二部分: 编排模式详解](#第二部分-编排模式详解)
- [第三部分: 实战案例](#第三部分-实战案例)
- [第四部分: 高级特性](#第四部分-高级特性)
- [第五部分: 集成和扩展](#第五部分-集成和扩展)
- [故障排除](#故障排除)

---

## 介绍

### 什么是 Agent Task Orchestrator?

这是一个 CLI 工具,让你可以**协调多个 AI Agent** 完成复杂任务。不同的编排模式适用于不同的场景。

**为什么需要这个?**

单个 AI Agent 有局限性:
- 单一视角,缺乏多样性
- 上下文窗口限制
- 复杂任务难以分解
- 缺乏验证机制

**多 Agent 协作的优势:**
- ✅ 多视角分析
- ✅ 专业分工
- ✅ 交叉验证
- ✅ 并行处理
- ✅ 容错能力

### 你将学到什么

通过本教程,你将掌握:

1. 5 种编排模式的使用场景
2. 如何定义任务和 Agent
3. 如何监控和调试任务执行
4. 真实世界的应用案例
5. 如何扩展和自定义

---

## 第一部分: 快速开始 (10 分钟)

### 步骤 1: 安装

```bash
# 进入项目目录
cd projects/agent-task-cli

# 安装依赖
npm install

# 全局安装 CLI
npm link

# 验证安装
agent-task --version
```

### 步骤 2: 查看可用模式

```bash
agent-task patterns
```

输出:
```
可用的编排模式:

1. work-crew      - 多个 Agent 并行处理同一任务,提供不同视角
2. supervisor     - 监督者动态分解任务并分配给工作者
3. pipeline       - 顺序执行阶段,带有验证门
4. council        - 多专家决策,带有讨论轮次
5. auto-routing   - 自动路由任务到专业 Agent

使用 'agent-task run <file>' 运行任务
```

### 步骤 3: 运行第一个任务

让我们运行一个简单的 Work Crew 任务:

```bash
# 查看示例
cat examples/work-crew.yaml
```

内容:
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
task: "Research the current state of AI Agent technology and provide insights"
convergence:
  strategy: "consensus"
  threshold: 0.7
```

```bash
# 试运行(不实际执行)
agent-task run examples/work-crew.yaml --dry-run

# 实际运行
agent-task run examples/work-crew.yaml
```

### 步骤 4: 监控任务

```bash
# 列出所有任务
agent-task list

# 监控特定任务
agent-task monitor <task-id>

# 查看详细输出
agent-task monitor <task-id> --verbose
```

### 步骤 5: 导出结果

```bash
# JSON 格式
agent-task export <task-id> --format json --output results.json

# Markdown 格式
agent-task export <task-id> --format markdown --output report.md
```

**🎉 恭喜!** 你已经运行了第一个多 Agent 任务。

---

## 第二部分: 编排模式详解

### 模式 1: Work Crew (工作团队)

**适用场景:**
- 需要多个视角的复杂分析
- 创意生成和头脑风暴
- 多维度评估

**工作原理:**

```
        ┌─────────────────┐
        │   任务描述       │
        └────────┬────────┘
                 │
        ┌────────┴────────┐
        │                 │
   ┌────▼────┐      ┌────▼────┐
   │ Agent 1 │      │ Agent 2 │
   │技术视角  │      │商业视角  │
   └────┬────┘      └────┬────┘
        │                │
        └────────┬───────┘
                 │
           ┌─────▼─────┐
           │  收敛结果  │
           └───────────┘
```

**示例配置:**

```yaml
name: "Product Analysis"
pattern: "work-crew"
agents:
  - name: "user-advocate"
    role: "Represent user perspective"
    focus: "usability, user experience, accessibility"
  - name: "technical-architect"
    role: "Evaluate technical feasibility"
    focus: "architecture, scalability, performance"
  - name: "business-strategist"
    role: "Assess business viability"
    focus: "market fit, revenue potential, competition"
  - name: "legal-compliance"
    role: "Check legal and compliance"
    focus: "regulations, privacy, terms of service"
task: "Analyze the proposed feature: AI-powered content recommendations"
convergence:
  strategy: "consensus"  # 或 "best-of" 或 "merge"
  threshold: 0.7
```

**收敛策略:**
- `consensus` - 寻找共同点
- `best-of` - 选择最佳结果
- `merge` - 合并所有结果

---

### 模式 2: Supervisor (监督者)

**适用场景:**
- 大型复杂任务
- 需要动态分解
- 不确定工作量

**工作原理:**

```
        ┌──────────────┐
        │  Supervisor  │ ← 动态分配任务
        └──────┬───────┘
               │
      ┌────────┼────────┐
      │        │        │
  ┌───▼───┐ ┌──▼──┐ ┌──▼───┐
  │Worker1│ │Work2│ │Work3 │
  │编码    │ │测试 │ │文档   │
  └───────┘ └─────┘ └──────┘
```

**示例配置:**

```yaml
name: "Build Feature"
pattern: "supervisor"
supervisor:
  name: "project-manager"
  strategy: "adaptive"  # 或 "sequential" 或 "parallel"
  max_subtasks: 10
workers:
  - name: "backend-developer"
    skills: ["api", "database", "authentication"]
    capacity: 3
  - name: "frontend-developer"
    skills: ["ui", "components", "styling"]
    capacity: 3
  - name: "qa-engineer"
    skills: ["testing", "validation", "bugs"]
    capacity: 2
  - name: "technical-writer"
    skills: ["documentation", "tutorials", "api-docs"]
    capacity: 2
task: "Implement user authentication with OAuth2"
```

**监督者策略:**
- `adaptive` - 根据负载动态调整
- `sequential` - 按顺序分配
- `parallel` - 并行分配

---

### 模式 3: Pipeline (流水线)

**适用场景:**
- 数据处理流程
- 内容生成流程
- 需要质量控制的场景

**工作原理:**

```
┌─────┐   ┌─────┐   ┌─────┐   ┌─────┐
│Stage│──▶│Gate │──▶│Stage│──▶│Gate │──▶ 输出
│  1  │   │  ✓  │   │  2  │   │  ✓  │
└─────┘   └─────┘   └─────┘   └─────┘
```

**示例配置:**

```yaml
name: "Content Pipeline"
pattern: "pipeline"
stages:
  - name: "research"
    agent: "researcher"
    description: "Gather information"
    timeout: 300
  - name: "outline"
    agent: "planner"
    description: "Create content outline"
    depends_on: ["research"]
  - name: "draft"
    agent: "writer"
    description: "Write first draft"
    depends_on: ["outline"]
  - name: "review"
    agent: "editor"
    description: "Review and edit"
    depends_on: ["draft"]
  - name: "publish"
    agent: "publisher"
    description: "Format and publish"
    depends_on: ["review"]
gates:
  - after: "research"
    validator: "quality-checker"
    criteria: "sufficient sources, relevant information"
  - after: "draft"
    validator: "editor"
    criteria: "clear structure, no errors"
  - after: "review"
    validator: "approver"
    criteria: "meets quality standards"
```

**验证门:**
- 每个门可以阻止或允许流程继续
- 失败时可以回退到前一阶段
- 支持重试机制

---

### 模式 4: Council (委员会)

**适用场景:**
- 重要决策
- 伦理评估
- 战略规划

**工作原理:**

```
        ┌──────────────┐
        │    问题      │
        └──────┬───────┘
               │
    ┌──────────┼──────────┐
    │          │          │
┌───▼───┐  ┌──▼──┐  ┌───▼───┐
│Expert1│  │Exp2 │  │Expert3│
│怀疑者  │  │伦理  │  │战略家  │
└───┬───┘  └──┬──┘  └───┬───┘
    │          │          │
    └──────────┼──────────┘
               │
        ┌──────▼───────┐
        │   讨论轮次    │
        └──────┬───────┘
               │
        ┌──────▼───────┐
        │   最终决策    │
        └──────────────┘
```

**示例配置:**

```yaml
name: "Strategic Decision"
pattern: "council"
experts:
  - name: "skeptic"
    role: "Challenge assumptions and identify risks"
    personality: "cautious, analytical"
  - name: "ethicist"
    role: "Evaluate ethical implications"
    personality: "principled, thoughtful"
  - name: "strategist"
    role: "Provide strategic perspective"
    personality: "visionary, forward-thinking"
  - name: "practitioner"
    role: "Offer practical insights"
    personality: "experienced, realistic"
rounds: 3
discussion:
  format: "structured"  # 或 "free-form"
  time_limit: 60  # 每轮
convergence:
  strategy: "consensus"  # 或 "vote" 或 "average"
  min_agreement: 0.75
task: "Should we implement AI-powered decision making in our product?"
```

**讨论轮次:**
- Round 1: 每个专家发表初始观点
- Round 2: 专家回应彼此的观点
- Round 3: 形成最终立场

---

### 模式 5: Auto-Routing (自动路由)

**适用场景:**
- 混合类型的任务流
- 需要专业化的场景
- 动态任务分配

**工作原理:**

```
        ┌──────────────┐
        │   输入任务    │
        └──────┬───────┘
               │
        ┌──────▼───────┐
        │    Router    │ ← 分析任务,路由到合适的 Agent
        └──────┬───────┘
               │
    ┌──────────┼──────────┐
    │          │          │
┌───▼───┐  ┌──▼──┐  ┌───▼───┐
│ Coder │  │Writer│  │Analyst│
└───────┘  └─────┘  └───────┘
```

**示例配置:**

```yaml
name: "Intelligent Assistant"
pattern: "auto-routing"
router:
  confidence_threshold: 0.85
  fallback_agent: "generalist"
agents:
  - name: "coder"
    specialties: ["programming", "debugging", "refactoring", "code-review"]
    examples:
      - "Fix this bug in the authentication module"
      - "Refactor the database layer"
  - name: "researcher"
    specialties: ["research", "analysis", "summarization", "fact-checking"]
    examples:
      - "Research the latest trends in AI"
      - "Analyze this market data"
  - name: "writer"
    specialties: ["documentation", "blog", "tutorial", "creative-writing"]
    examples:
      - "Write a tutorial for beginners"
      - "Create API documentation"
  - name: "data-analyst"
    specialties: ["statistics", "visualization", "insights", "reporting"]
    examples:
      - "Analyze user behavior patterns"
      - "Create a dashboard for metrics"
```

**路由决策:**
- 基于任务描述和 Agent 专业匹配
- 如果置信度低于阈值,使用 fallback Agent
- 可以手动覆盖路由决策

---

## 第三部分: 实战案例

### 案例 1: 产品发布准备

**场景:** 准备一个新功能的发布

```yaml
name: "Feature Launch Preparation"
pattern: "pipeline"
stages:
  - name: "code-review"
    agent: "senior-developer"
    description: "Review code changes"
  - name: "testing"
    agent: "qa-lead"
    description: "Comprehensive testing"
  - name: "documentation"
    agent: "tech-writer"
    description: "Update documentation"
  - name: "marketing"
    agent: "marketing-manager"
    description: "Prepare marketing materials"
  - name: "support"
    agent: "support-lead"
    description: "Prepare support team"
gates:
  - after: "code-review"
    validator: "cto"
    criteria: "no critical issues, approved by tech lead"
  - after: "testing"
    validator: "qa-lead"
    criteria: "all tests pass, no regressions"
```

**运行:**

```bash
agent-task run feature-launch.yaml
agent-task monitor <task-id> --verbose
agent-task export <task-id> --format markdown --output launch-report.md
```

---

### 案例 2: 技术调研报告

**场景:** 深入研究一个技术方向

```yaml
name: "AI Agent Framework Research"
pattern: "work-crew"
agents:
  - name: "architect"
    role: "Analyze architecture patterns"
    focus: "system design, scalability, performance"
  - name: "developer"
    role: "Evaluate developer experience"
    focus: "API design, documentation, ease of use"
  - name: "security-expert"
    role: "Assess security implications"
    focus: "vulnerabilities, data protection, compliance"
  - name: "cost-analyst"
    role: "Calculate cost implications"
    focus: "infrastructure, API costs, maintenance"
task: "Research and compare leading AI Agent frameworks: LangChain, AutoGen, CrewAI"
convergence:
  strategy: "merge"
  include_all_perspectives: true
```

---

### 案例 3: 内容创作流水线

**场景:** 从研究到发布的完整内容创作流程

```yaml
name: "Blog Post Creation"
pattern: "pipeline"
stages:
  - name: "topic-research"
    agent: "researcher"
    description: "Research topic and gather sources"
    output: "research-notes.md"
  - name: "outline"
    agent: "editor"
    description: "Create content outline"
    input: "research-notes.md"
    output: "outline.md"
  - name: "draft"
    agent: "writer"
    description: "Write first draft"
    input: "outline.md"
    output: "draft.md"
  - name: "edit"
    agent: "senior-editor"
    description: "Edit and improve"
    input: "draft.md"
    output: "edited.md"
  - name: "seo-optimize"
    agent: "seo-specialist"
    description: "Optimize for SEO"
    input: "edited.md"
    output: "final.md"
gates:
  - after: "topic-research"
    validator: "fact-checker"
    criteria: "at least 5 credible sources"
  - after: "edit"
    validator: "editor-in-chief"
    criteria: "meets editorial standards"
```

---

### 案例 4: 伦理决策委员会

**场景:** 评估一个敏感功能

```yaml
name: "AI Feature Ethics Review"
pattern: "council"
experts:
  - name: "privacy-advocate"
    role: "Protect user privacy"
    personality: "protective, cautious"
  - name: "business-representative"
    role: "Represent business interests"
    personality: "pragmatic, growth-oriented"
  - name: "user-advocate"
    role: "Represent user interests"
    personality: "empathetic, user-centric"
  - name: "legal-expert"
    role: "Ensure legal compliance"
    personality: "careful, thorough"
rounds: 3
discussion:
  format: "structured"
  anonymous: false
convergence:
  strategy: "consensus"
  min_agreement: 0.8
  allow_dissent: true
task: "Should we implement AI-powered sentiment analysis on user messages to improve recommendations?"
```

---

### 案例 5: 智能客服系统

**场景:** 自动路由用户请求

```yaml
name: "Customer Support Router"
pattern: "auto-routing"
router:
  confidence_threshold: 0.80
  fallback_agent: "general-support"
  learn_from_feedback: true
agents:
  - name: "technical-support"
    specialties: ["bugs", "errors", "installation", "configuration"]
    priority: 1
  - name: "billing-support"
    specialties: ["invoices", "payments", "refunds", "subscriptions"]
    priority: 2
  - name: "account-support"
    specialties: ["login", "password", "permissions", "settings"]
    priority: 2
  - name: "feature-support"
    specialties: ["how-to", "features", "best-practices", "tutorials"]
    priority: 3
```

---

## 第四部分: 高级特性

### 特性 1: 任务依赖和条件

```yaml
name: "Complex Workflow"
pattern: "pipeline"
stages:
  - name: "stage-a"
    agent: "agent-a"
  - name: "stage-b"
    agent: "agent-b"
    depends_on: ["stage-a"]
    condition: "stage-a.status == 'success'"
  - name: "stage-c"
    agent: "agent-c"
    depends_on: ["stage-a"]
    condition: "stage-a.output.needs_review == true"
```

### 特性 2: 超时和重试

```yaml
stages:
  - name: "slow-task"
    agent: "agent"
    timeout: 300  # 5 分钟
    retry:
      max_attempts: 3
      backoff: "exponential"  # 或 "linear"
      initial_delay: 10
```

### 特性 3: 并行执行

```yaml
stages:
  - name: "parallel-tasks"
    parallel:
      - agent: "agent-1"
        task: "Task 1"
      - agent: "agent-2"
        task: "Task 2"
      - agent: "agent-3"
        task: "Task 3"
    wait_for: "all"  # 或 "any"
```

### 特性 4: 状态持久化

```bash
# 保存任务状态
agent-task save <task-id>

# 恢复任务
agent-task resume <task-id>

# 从检查点继续
agent-task resume <task-id> --from-checkpoint stage-3
```

### 特性 5: 动态 Agent 分配

```yaml
pattern: "supervisor"
supervisor:
  name: "dynamic-allocator"
  strategy: "adaptive"
  scaling:
    min_workers: 2
    max_workers: 10
    scale_up_threshold: 0.8  # CPU/负载阈值
    scale_down_after: 300    # 空闲 5 分钟后缩减
```

---

## 第五部分: 集成和扩展

### 集成 1: Node.js API

```javascript
const { Orchestrator, Patterns } = require('agent-task-cli');

async function main() {
  const orchestrator = new Orchestrator();
  
  // 方式 1: 从文件加载
  const task = await orchestrator.loadFromFile('task.yaml');
  
  // 方式 2: 编程定义
  const task = await orchestrator.run({
    name: "Custom Task",
    pattern: "work-crew",
    agents: [
      { name: "agent-1", role: "Research" },
      { name: "agent-2", role: "Analysis" }
    ],
    task: "Analyze this topic"
  });
  
  // 监听事件
  task.on('started', () => console.log('Task started'));
  task.on('stage-complete', (stage) => console.log(`Stage ${stage.name} done`));
  task.on('agent-response', (response) => console.log(response));
  task.on('complete', (results) => console.log('Task complete', results));
  task.on('error', (error) => console.error('Error:', error));
  
  // 等待结果
  const results = await task.results;
  console.log(results);
}

main();
```

### 集成 2: 自定义 Agent

```javascript
const { BaseAgent } = require('agent-task-cli');

class CustomAgent extends BaseAgent {
  constructor(config) {
    super(config);
    this.specialty = config.specialty;
  }
  
  async execute(task, context) {
    // 自定义执行逻辑
    const result = await this.processTask(task, context);
    
    return {
      agent: this.name,
      task: task,
      result: result,
      confidence: this.calculateConfidence(result),
      metadata: {
        processingTime: Date.now() - startTime,
        model: this.model
      }
    };
  }
  
  calculateConfidence(result) {
    // 自定义置信度计算
    return 0.85;
  }
}

// 使用自定义 Agent
const orchestrator = new Orchestrator();
orchestrator.registerAgent('custom', CustomAgent);

const task = await orchestrator.run({
  pattern: "work-crew",
  agents: [
    { type: "custom", name: "my-agent", specialty: "domain-expert" }
  ],
  task: "..."
});
```

### 集成 3: Webhook 集成

```yaml
name: "Webhook Enabled Task"
pattern: "pipeline"
webhooks:
  on_start: "https://api.example.com/tasks/start"
  on_complete: "https://api.example.com/tasks/complete"
  on_error: "https://api.example.com/tasks/error"
  on_stage_complete: "https://api.example.com/tasks/stage"
stages:
  - name: "process"
    agent: "agent"
```

### 集成 4: 监控集成

```javascript
const { Orchestrator } = require('agent-task-cli');
const { PrometheusExporter } = require('./monitoring');

const orchestrator = new Orchestrator({
  monitoring: {
    enabled: true,
    exporter: new PrometheusExporter({
      port: 9090,
      prefix: 'agent_task_'
    })
  }
});

// 指标会自动暴露在 /metrics 端点
```

---

## 故障排除

### 问题 1: 任务卡住

**症状:** 任务状态一直是 "running"

**诊断:**

```bash
agent-task monitor <task-id> --verbose
agent-task logs <task-id> --tail 50
```

**解决方案:**

```bash
# 取消任务
agent-task cancel <task-id>

# 检查 Agent 日志
agent-task debug <task-id>

# 增加超时
# 在 YAML 中添加 timeout 字段
```

### 问题 2: Agent 无响应

**症状:** Agent 不返回结果

**检查:**

```bash
# 检查 Agent 状态
agent-task agents --status

# 测试单个 Agent
agent-task test-agent <agent-name> --input "test"
```

**解决方案:**

```yaml
# 添加健康检查
agents:
  - name: "agent"
    health_check:
      enabled: true
      interval: 30
      timeout: 5
```

### 问题 3: 结果不符合预期

**症状:** Agent 输出质量差

**优化策略:**

1. **改进提示词**

```yaml
agents:
  - name: "agent"
    role: "Expert in X"
    instructions: |
      You are an expert in X.
      When analyzing:
      1. Consider A
      2. Evaluate B
      3. Provide C
    examples:
      - input: "..."
        output: "..."
```

2. **使用收敛策略**

```yaml
convergence:
  strategy: "consensus"
  threshold: 0.8
  min_agreeing_agents: 3
```

3. **添加验证**

```yaml
gates:
  - after: "stage"
    validator: "quality-checker"
    criteria: "must be comprehensive and accurate"
```

### 问题 4: 性能问题

**症状:** 任务执行缓慢

**优化:**

```yaml
# 并行化
stages:
  - name: "parallel"
    parallel:
      - agent: "a"
      - agent: "b"

# 缓存
caching:
  enabled: true
  ttl: 3600

# 批处理
batching:
  enabled: true
  size: 10
```

---

## 最佳实践

### 1. 选择合适的模式

| 场景 | 推荐模式 |
|------|---------|
| 多视角分析 | Work Crew |
| 大型复杂任务 | Supervisor |
| 流程化任务 | Pipeline |
| 重要决策 | Council |
| 混合任务 | Auto-Routing |

### 2. 定义清晰的 Agent

```yaml
agents:
  - name: "descriptive-name"
    role: "Clear role description"
    focus: "Specific areas of expertise"
    constraints: ["limitation 1", "limitation 2"]
    examples:
      - "Example task 1"
      - "Example task 2"
```

### 3. 设置合理的超时

```yaml
stages:
  - name: "stage"
    timeout: 300  # 根据任务复杂度设置
    retry:
      max_attempts: 3
```

### 4. 监控和日志

```bash
# 实时监控
agent-task monitor <task-id> --verbose

# 导出日志
agent-task logs <task-id> --export logs.json

# 分析结果
agent-task analyze <task-id>
```

### 5. 测试和验证

```bash
# 干运行
agent-task run task.yaml --dry-run

# 测试单个 Agent
agent-task test-agent <agent-name>

# 验证配置
agent-task validate task.yaml
```

---

## 总结

你学到了:

✅ 5 种编排模式的使用场景  
✅ 如何定义任务和 Agent  
✅ 真实世界的应用案例  
✅ 高级特性(依赖、超时、并行)  
✅ 集成和扩展方法  
✅ 故障排除技巧  

**下一步:**

1. 运行所有示例任务
2. 创建自己的任务定义
3. 尝试不同的编排模式
4. 集成到你的工作流
5. 开发自定义 Agent

---

## 额外资源

- [README.md](README.md) - 项目概览
- [API Reference](README.md#api-usage) - 完整 API 文档
- [Examples](examples/) - 示例任务文件
- [Contributing](CONTRIBUTING.md) - 贡献指南

---

**Questions? Issues?**

Open an issue on GitHub or check the documentation!

---

*Last updated: 2026-03-24*  
*Tutorial version: 1.0*
