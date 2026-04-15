# agent-task-cli Feature Backlog

## ✅ Existing Features
- Orchestrator with 5 patterns (work-crew, supervisor, pipeline, council, auto-routing)
- TaskChain with dependency resolution, conditions, transforms
- Cache with TTL, LRU eviction, stats
- EventBus with history, wildcard, pattern matching
- Agent system (Base, Mock, LLM, Factory)
- Plugin manager, retry handler, concurrency manager
- Storage, Logger, Stream manager

## 🔲 Feature Backlog

### Utils
- [x] Cache: batch operations (`mget`, `mset`, `mdelete`) — **F1** ✅ 2026-04-14
- [x] Cache: `invalidateByPrefix` for namespace-level invalidation — **F2** ✅ 2026-04-14
- [x] EventBus: `emitAfter(delay, channel, data)` — delayed emission — **F4** ✅ 2026-04-15

### TaskChain
- [x] TaskChain: `retry(stepName, maxRetries)` — retry failed steps — **F3** ✅ 2026-04-14
- [x] TaskChain: `onStepComplete(callback)` — progress hooks — **F5** ✅ 2026-04-15
- [x] TaskChain: `toJSON()` serialization (fromJSON pending) — **F6** ✅ 2026-04-15
- [ ] TaskChain: `abort()` — cancel running chain

### Orchestrator
- [ ] Orchestrator: task timeout support
- [ ] Orchestrator: task priority queue
- [ ] Orchestrator: middleware/plugin hooks for pre/post execution

### Observability
- [ ] EventBus: `onBatch(channels[], handler)` — subscribe to multiple channels
- [ ] Logger: structured JSON output mode
- [ ] Cache: `dump()` / `restore()` for persistence across restarts
