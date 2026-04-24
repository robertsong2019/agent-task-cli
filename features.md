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
- [x] TaskChain: `toJSON()` serialization + `fromJSON()` deserialization — **F6+F14** ✅ 2026-04-15/22
- [x] TaskChain: `abort()` — cancel running chain — **F7** ✅ 2026-04-16

### Orchestrator
- [x] Orchestrator: task timeout support — **F11** ✅ 2026-04-19
- [x] Orchestrator: task priority queue (PriorityQueue util) — **F12** ✅ 2026-04-19
- [x] Orchestrator: middleware/plugin hooks for pre/post execution — **F13** ✅ 2026-04-22

### Observability
- [ ] EventBus: `onBatch(channels[], handler)` — subscribe to multiple channels — **F9** ✅ 2026-04-17
- [ ] Logger: structured JSON output mode — **F10** ✅ 2026-04-17
- [x] Cache: `dump()` / `restore()` for persistence across restarts — **F8** ✅ 2026-04-16

### Utils (Round 3)
- [x] Cache: `touch(key, newTTL?)` — refresh TTL without changing value — **F15** ✅ 2026-04-23
- [x] EventBus: `emitBatch(channel, items[])` — emit multiple events with single history entry — **F16** ✅ 2026-04-23
- [x] EventBus: `once(channel, handler)` — subscribe once, auto-unsubscribe after first fire — **F17** ✅ 2026-04-24
- [x] Cache: `getOrSet(key, factory, ttl?)` — memoization pattern, get or compute+cache — **F18** ✅ 2026-04-24
- [x] RetryHandler: `executeUntil(fn, {validate})` — retry until result passes validation — **F19** ✅ 2026-04-24
