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

### Utils (Round 4)
- [x] EventBus: `prependListener(channel, handler)` — add handler to front of subscriber list — **F34** ✅ 2026-05-01
- [x] Cache: `getAndDelete(key)` — atomic pop (get + delete) — **F35** ✅ 2026-05-01
- [x] RetryHandler: `withCircuitBreaker(fn, opts)` — circuit breaker pattern — **F36** ✅ 2026-05-01

### Utils (Round 3)
- [x] Cache: `touch(key, newTTL?)` — refresh TTL without changing value — **F15** ✅ 2026-04-23
- [x] EventBus: `emitBatch(channel, items[])` — emit multiple events with single history entry — **F16** ✅ 2026-04-23
- [x] EventBus: `once(channel, handler)` — subscribe once, auto-unsubscribe after first fire — **F17** ✅ 2026-04-24
- [x] Cache: `getOrSet(key, factory, ttl?)` — memoization pattern, get or compute+cache — **F18** ✅ 2026-04-24
- [x] RetryHandler: `executeUntil(fn, {validate})` — retry until result passes validation — **F19** ✅ 2026-04-24
- [x] Cache: `withNamespace(prefix)` — scoped cache view with auto-prefixed keys — **F20** ✅ 2026-04-25
- [x] TaskChain: `tap(stepName, callback)` — observe specific step lifecycle — **F21** ✅ 2026-04-25
- [x] RetryHandler: `withBackoff(fn, opts)` — exponential backoff convenience method — **F22** ✅ 2026-04-25
- [x] EventBus: `removeChannel(channel)` — remove all subscribers for a channel — **F23** ✅ 2026-04-25
- [x] EventBus: `waitFor(channel, timeout?)` — promise-based wait for next event — **F24** ✅ 2026-04-26
- [x] Cache: `has(key)` — check existence without affecting stats — **F25** ✅ 2026-04-26
- [x] ConcurrencyManager: `executeWithTimeout(fn, ms, taskId?)` — execute with per-task timeout — **F26** ✅ 2026-04-26
- [x] EventBus: `channelNames()` — list all active channel names — **F27** ✅ 2026-04-27
- [x] Cache: `deleteByPattern(pattern)` — delete keys matching glob pattern — **F28** ✅ 2026-04-27
- [x] ConcurrencyManager: `queueSize` getter — expose pending task count — **F29** ✅ 2026-04-27

### Utils (Round 5)
- [x] Cache: `values()` — return all non-expired values — **F38** ✅ 2026-05-02
- [x] TaskChain: `hasStep(name)` — check if step exists — **F39** ✅ 2026-05-02
- [x] EventBus: `clearHistory()` — clear history buffer, return count — **F40** ✅ 2026-05-02

### Utils (Round 6)
- [x] Storage: `clear()` — delete all tasks, return count — **F46** ✅ 2026-05-03
- [x] RetryHandler: `resetCircuitBreaker()` + `getCircuitBreakerState()` — CB state management — **F47** ✅ 2026-05-03
- [x] ConcurrencyManager: `cancelQueued(taskId)` — cancel specific queued task — **F48** ✅ 2026-05-03

### Utils (Round 7)
- [x] Storage: `findByMetadata(key, value)` — find tasks by arbitrary field — **F49** ✅ 2026-05-04
- [x] StreamManager: `getStreamStats(taskId)` — stream stats (duration, chunks, throughput) — **F50** ✅ 2026-05-04
- [x] Cache: `setWithExpiry(key, value, expiresAt)` — set with absolute expiry timestamp — **F51** ✅ 2026-05-04

### Utils (Round 8)
- [x] EventBus: `subscriberCount(channel)` — count subscribers for a channel — **F52** ✅ 2026-05-06
- [x] Cache: `findKeys(predicate)` — find keys by predicate function — **F53** ✅ 2026-05-06
- [x] EventBus: `waitForPattern(pattern, timeout?)` — promise-based wait for pattern-matched event — **F54** ✅ 2026-05-06

### Utils (Round 9)
- [x] Cache: `rename(oldKey, newKey)` — rename key preserving value and TTL — **F55** ✅ 2026-05-07
- [x] EventBus: `emitIf(channel, data, predicate)` — conditional emission — **F56** ✅ 2026-05-07
- [x] TaskChain: `stepNames()` — ordered step name list — **F57** ✅ 2026-05-07

### Utils (Round 11)
- [x] Cache: `nonExpiredSize` getter — count of non-expired entries — **F61** ✅ 2026-05-11
- [x] Storage: `findRecent(count)` — most recently updated tasks — **F62** ✅ 2026-05-11
- [x] EventBus: `peek(channel)` — return last event for channel — **F63** ✅ 2026-05-11

### Utils (Round 12)
- [x] EventBus: `emitAsync(channel, data)` — async emit that awaits all handlers — **F64** ✅ 2026-05-15
- [x] TaskChain: `stepResult(name)` — get specific step result by name — **F65** ✅ 2026-05-15
- [x] Storage: `exists(id)` — check task existence without loading — **F66** ✅ 2026-05-15

### Utils (Round 14)
- [x] Cache: `setNX(key, value, ttl?)` — set only if not exists (NX pattern) — **F70** ✅ 2026-05-20
- [x] EventBus: `throttle(channel, intervalMs)` — rate-limited emit wrapper — **F71** ✅ 2026-05-20
- [x] Storage: `batchUpdate(batch[])` — update multiple tasks atomically — **F72** ✅ 2026-05-20

### Utils (Round 13)
- [x] Storage: `filter(predicate)` — filter tasks by arbitrary predicate function — **F67** ✅ 2026-05-17
- [x] EventBus: `onAny(handler)` — subscribe to all events (global listener) — **F68** ✅ 2026-05-17
- [x] RetryHandler: `try(fn, opts)` — execute with retries returning {ok,result,error,attempts} without throwing — **F69** ✅ 2026-05-17

### Utils (Round 15)
- [x] Cache: `incr(key, delta?)` — atomic increment for numeric values — **F73** ✅ 2026-05-21
- [x] Storage: `findByStatus(status)` — find all tasks with given status — **F74** ✅ 2026-05-21
- [x] EventBus: `off(channel, handler)` — unsubscribe specific handler — **F75** ✅ 2026-05-21

### Utils (Round 16)
- [x] Cache: `decr(key, delta?)` — atomic decrement for numeric values — **F76** ✅ 2026-05-22
- [x] EventBus: `emitAndWait(channel, data, timeout?)` — emit and wait for all handlers to complete — **F77** ✅ 2026-05-22
- [x] Storage: `deleteByStatus(status)` — delete all tasks with given status, return count — **F78** ✅ 2026-05-22

### Utils (Round 18)
- [x] Cache: `keys()` — return all non-expired key names — **F82** ✅ 2026-05-29
- [x] Storage: `countByStatus()` — count tasks grouped by status — **F83** ✅ 2026-05-29
- [x] EventBus: `emitDebounced(channel, data, delay?)` — debounced emit with cancel — **F84** ✅ 2026-05-29

### Utils (Round 17)
- [x] Cache: `swap(key, value, ttl?)` — set new value and return old value — **F79** ✅ 2026-05-23
- [x] EventBus: `pipe(source, targetBus, targetChannel?)` — forward events between buses — **F80** ✅ 2026-05-23
- [x] Storage: `getOrCreate(id, defaults)` — get task or create with defaults — **F81** ✅ 2026-05-23

### Utils (Round 10)
- [x] Cache: `forEach(callback)` — iterate all non-expired entries — **F58** ✅ 2026-05-08
- [x] Storage: `updateField(id, field, value)` — update single field without full replace — **F59** ✅ 2026-05-08
- [x] Cache: `getMany(keys)` — batch get returning Map of found entries — **F60** ✅ 2026-05-08

### Utils (Round 19)
- [x] Cache: `toPairs()` — lightweight [key, value] pairs (vs entries() metadata) — **F88** ✅ 2026-05-31
- [x] EventBus: `removeAllListeners(channel?)` — remove all or channel-specific listeners — **F89** ✅ 2026-05-31
- [x] Storage: `map(fn)` — transform all tasks with mapper function — **F90** ✅ 2026-05-31

### Utils (Round 21)
- [x] EventBus: `intercept(channel, fn)` — interceptor to modify/filter events before subscribers — **F94** ✅ 2026-06-01
- [x] Cache: `getSet(key, factory, ttl?)` — forced refresh, always call factory — **F95** ✅ 2026-06-01
- [x] Storage: `transaction(fn)` — atomic operations with rollback on failure — **F96** ✅ 2026-06-01

### Utils (Round 23)
- [x] Cache: `merge(key, obj, ttl?)` — shallow-merge into existing object value — **F100** ✅ 2026-06-03
- [x] Storage: `ids()` — return all task IDs — **F101** ✅ 2026-06-03
- [x] EventBus: `relay(source, targetBus, filter?)` — filtered event forwarding — **F102** ✅ 2026-06-03

### Utils (Round 24)
- [x] Cache: `type(key)` — return JS type string of cached value — **F103** ✅ 2026-06-04
- [x] EventBus: `eventNames()` — unique channel names from history — **F104** ✅ 2026-06-04
- [x] Storage: `bulkDelete(ids[])` — batch delete multiple tasks — **F105** ✅ 2026-06-04

### Utils (Round 22)
- [x] Cache: `expire(key, ttl)` — set new TTL on existing key — **F97** ✅ 2026-06-02
- [x] Storage: `first(predicate)` — find first matching task — **F98** ✅ 2026-06-02
- [x] EventBus: `channelStats()` — per-channel subscriber + event counts — **F99** ✅ 2026-06-02

### Utils (Round 25)
- [x] Cache: `random()` — get a random non-expired entry — **F106** ✅ 2026-06-05
- [x] Storage: `groupBy(field)` — group tasks by field value — **F107** ✅ 2026-06-05
- [x] EventBus: `race(channels[], timeout?)` — Promise.race across channels — **F108** ✅ 2026-06-05

### Utils (Round 26)
- [x] Cache: `expireAt(key, timestamp)` — set absolute expiry timestamp — **F109** ✅ 2026-06-06
- [x] Storage: `sum(field)` — sum a numeric field across all tasks — **F110** ✅ 2026-06-06
- [x] EventBus: `emitMany(events[])` — batch emit across multiple channels with single history entry — **F111** ✅ 2026-06-06
