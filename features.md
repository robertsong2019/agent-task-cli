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
- [x] EventBus: `onBatch(channels[], handler)` — subscribe to multiple channels — **F9** ✅ 2026-04-17
- [x] Logger: structured JSON output mode — **F10** ✅ 2026-04-17
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

### Utils (Round 28)
- [x] Cache: `watch(key, callback)` — reactive watch on key changes (set/delete), returns unwatch fn — **F115** ✅ 2026-06-08
- [x] Storage: `min(field)` / `max(field)` — min/max of numeric field — **F116+F117** ✅ 2026-06-08
- [x] EventBus: `last(channel, n?)` — get last N events from history for a channel — **F118** ✅ 2026-06-08

### Utils (Round 27)
- [x] Cache: `getWithMeta(key)` — return value + full metadata (createdAt, accessedAt, expiresAt, ttlRemaining) — **F112** ✅ 2026-06-07
- [x] Storage: `pluck(field)` — extract single field values across all tasks — **F113** ✅ 2026-06-07
- [x] EventBus: `sample(channel, intervalMs, handler)` — rate-limited subscription (first event per window) — **F114** ✅ 2026-06-07

### Utils (Round 29)
- [x] Cache: `shuffle()` — Fisher-Yates shuffle of all non-expired entries — **F119** ✅ 2026-06-09
- [x] Storage: `reverse()` — return all tasks in reverse insertion order — **F120** ✅ 2026-06-09
- [x] EventBus: `waitUntil(channel, predicate, timeout?)` — resolve when event passes predicate — **F121** ✅ 2026-06-09

### Utils (Round 30)
- [x] Cache: `diff(otherCache)` — compare two caches, return {added, removed, changed} — **F122** ✅ 2026-06-11
- [x] Storage: `sample(n)` — return N random tasks (Fisher-Yates) — **F123** ✅ 2026-06-11
- [x] EventBus: `afterAll(channel, handler)` — post-emit hook after all subscribers fire — **F124** ✅ 2026-06-11

### Utils (Round 31)
- [x] Cache: `lock(key, fn)` — exclusive mutex per key, serializes concurrent access — **F125** ✅ 2026-06-11
- [x] Storage: `distinct(field)` — return unique values for a field — **F126** ✅ 2026-06-11
- [x] EventBus: `channels()` — list channels with active subscribers — **F127** ✅ 2026-06-11

### Utils (Round 32)
- [x] Cache: `withTTL(key, fn, ttl)` — compute & cache with explicit TTL, skip if cached — **F128** ✅ 2026-06-12
- [x] Cache: `snapshot()` — plain-object of all non-expired entries for serialization — **F129** ✅ 2026-06-12

### Utils (Round 35)
- [x] Storage: `create(id, data)` — insert-only, returns false if exists (NX pattern) — **F136** ✅ 2026-06-15
- [x] Cache: `incrTo(key, target, delta?)` — increment towards ceiling, stops at target — **F137** ✅ 2026-06-15
- [x] PriorityQueue: `peekAt(n)` — peek at Nth item (0-indexed) without dequeuing — **F138** ✅ 2026-06-15

### Utils (Round 34)
- [x] Storage: `sort(field, order)` — sort tasks by any field, asc/desc, undefined last — **F133** ✅ 2026-06-14
- [x] PriorityQueue: `isEmpty()` + `remove(item, cmp?)` — empty check + remove by ref/comparator — **F134** ✅ 2026-06-14
- [x] ConcurrencyManager: `isIdle()` — true when no active tasks and queue empty — **F135** ✅ 2026-06-14

### Utils (Round 33)
- [x] Cache: `copy(srcKey, destKey, ttl?)` — copy value to new key with optional new TTL — **F130** ✅ 2026-06-13
- [x] EventBus: `before(channel, handler)` — pre-emit hook, can cancel emission — **F131** ✅ 2026-06-13
- [x] Storage: `avg(field)` — average of numeric field across all tasks — **F132** ✅ 2026-06-13

### Utils (Round 36)
- [x] Cache: `mget(keys[])` — Redis MGET, batch get preserving order — **F147** ✅ 2026-06-25
- [x] Storage: `bulkUpdate(updates{})` — batch update multiple tasks by ID map — **F148** ✅ 2026-06-25
- [x] EventBus: `onceAny(channels[], handler)` — first-event-wins across channels, auto-unsub — **F149** ✅ 2026-06-25

### Utils (Round 37)
- [x] Cache: `replace(key, value, ttl?)` — set only if key exists, return old value (Redis REPLACE) — **F150** ✅ 2026-06-26
- [x] Cache: `retain(predicate)` — filter-in-place, remove non-matching, return count — **F151** ✅ 2026-06-26
- [x] Storage: `rename(id, newId)` — rename task ID, collision-safe — **F152** ✅ 2026-06-26

### Utils (Round 39)
- [x] Storage: `paginate(page, pageSize, opts?)` — pagination with metadata (total, totalPages, hasMore, status filter, sort) — **F157** ✅ 2026-07-06
- [x] EventBus: `emitWithRetry(channel, data, retries)` — async emit with per-handler retry on throw — **F158** ✅ 2026-07-06
- [x] Cache: `touchMany(keys[], ttl?)` — batch refresh TTL for multiple keys — **F159** ✅ 2026-07-06

### Utils (Round 38)
- [x] Cache: `withDefault(key, defaultValue, ttl?)` — get or set default (not factory) — **F153** ✅ 2026-07-05
- [x] Cache: `incrBy(key, amount, opts)` — increment by amount with min/max bounds — **F154** ✅ 2026-07-05
- [x] Storage: `upsert(id, data)` — insert or merge-update, returns {created, task} — **F155** ✅ 2026-07-05
- [x] EventBus: `emitWithMeta(channel, data, meta)` — emit with metadata attached to event — **F156** ✅ 2026-07-05

### Utils (Round 40)
- [x] PriorityQueue: `drain(n?)` — remove and return up to N highest-priority items — **F160** ✅ 2026-07-07
- [x] Storage: `findOne(filter)` — return first task matching predicate — **F161** ✅ 2026-07-07
- [x] EventBus: `merge(buses[])` — merge multiple event buses into one — **F162** ✅ 2026-07-07
- [x] ConcurrencyManager: `map(items, fn, concurrency?)` — parallel map with concurrency limit — **F163** ✅ 2026-07-07
- [x] Cache: `rename(oldKey, newKey)` — rename key preserving value and TTL — **F164** ✅ 2026-07-07
- [x] RetryHandler: `withFallback(primaryFn, fallbackFn, retries?)` — try primary, fallback on failure — **F165** ✅ 2026-07-07

### Utils (Round 42)
- [x] PriorityQueue: `toSortedArray()` — return all items in priority order without draining — **F172** ✅ 2026-07-08
- [x] ConcurrencyManager: `activeTasks()` — return IDs of currently executing tasks — **F173** ✅ 2026-07-08
- [x] Storage: `countWhere(predicate)` — count tasks matching a predicate function — **F174** ✅ 2026-07-08

### Utils (Round 43)
- [x] Cache: `pop(key)` — get value and delete key atomically — **F175** ✅ 2026-07-09
- [x] Storage: `mapReduce(mapFn, reduceFn, initial)` — map-reduce over all tasks — **F176** ✅ 2026-07-09
- [x] EventBus: `forward(channel, targetBus, transform?)` — relay events to another bus with optional transform — **F177** ✅ 2026-07-09

### Utils (Round 44)
- [x] Cache: `mpop(keys[], n?)` — pop multiple keys at once — **F178** ✅ 2026-07-09
- [x] Storage: `flatMap(mapFn)` — map then flatten results — **F179** ✅ 2026-07-09
- [x] EventBus: `forwardMany(channels[], targetBus)` — forward multiple channels to target bus — **F180** ✅ 2026-07-09

### Utils (Round 45)
- [x] Cache: `getTTL(key)` — Redis PTTL semantics: -2 missing, -1 no expiry, >0 ms remaining — **F181** ✅ 2026-07-09
- [x] Storage: `except(ids[])` — return all tasks except those with specified IDs — **F182** ✅ 2026-07-09
- [x] EventBus: `broadcast(data)` — emit same event to all active channels — **F183** ✅ 2026-07-09

### Utils (Round 47)
- [x] PriorityQueue: `contains(item, cmp?)` — check if item exists in queue — **F189** ✅ 2026-07-13
- [x] PriorityQueue: `updatePriority(item, newPriority, cmp?)` — update priority of existing item, re-sorts — **F190** ✅ 2026-07-13
- [x] ConcurrencyManager: `getQueuedIds()` — return task IDs of queued tasks (companion to activeTasks) — **F191** ✅ 2026-07-13

### Utils (Round 48)
- [x] PriorityQueue: `removeAt(index)` — remove item at specific index — **F192** ✅ 2026-07-14
- [x] Cache: `peek(key)` — get value without updating LRU or stats — **F193** ✅ 2026-07-14
- [x] Storage: `batchCreate(records)` — insert-only bulk create, skip existing — **F194** ✅ 2026-07-14

## Utils (Round 49)
- [x] Storage: `countByField(field)` — count tasks grouped by any field value (generalized countByStatus) — **F195** ✅ 2026-07-15
- [x] Cache: `toggle(key, initial?)` — boolean toggle, flips truthy↔falsy — **F196** ✅ 2026-07-15
- [x] EventBus: `emitWithAck(channel, data, timeout?)` — emit and collect {results, errors} from all handlers — **F197** ✅ 2026-07-15

## Utils (Round 46)
- [x] Cache: `serialize()` — JSON-safe snapshot that strips functions/undefined — **F184** ✅ 2026-07-09
- [x] Storage: `random(n=1)` — return n random tasks via Fisher-Yates partial shuffle — **F185** ✅ 2026-07-09
- [x] EventBus: `size()` — total subscriber count across all channels (excludes wildcard) — **F186** ✅ 2026-07-09

## Utils (Round 50)
- [x] ConcurrencyManager: `awaitIdle(timeout?)` — Promise resolving true when idle, false on timeout — **F198** ✅ 2026-07-17
- [x] Cache: `shift()` — evict and return oldest LRU entry, skip expired — **F199** ✅ 2026-07-17
- [x] EventBus: `hasListeners(channel)` — check if channel has direct subscribers — **F200** ✅ 2026-07-17

## Utils (Round 52)
- [x] Cache: `incrByEx(key, amount, ttl)` — increment + set new TTL atomically (Redis INCR+EX pipeline) — **F204** ✅ 2026-07-26
- [x] Storage: `replace(id, data)` — full data replacement preserving id/createdAt, returns old data — **F205** ✅ 2026-07-26
- [x] EventBus: `emitThrow(channel, data)` — synchronous emit that aggregates handler errors into single throw — **F206** ✅ 2026-07-26

## Utils (Round 53)
- [x] Cache: `memo(fn, opts)` — wrap any function with cache-backed memoization, auto key from args or custom keyFn, TTL support — **F207** ✅ 2026-07-27
- [x] Storage: `difference(otherStorage)` — set operation returning IDs in self but not in other — **F208** ✅ 2026-07-27

## Utils (Round 54)
- [x] Storage: `upsertMany(records)` — bulk upsert: insert new + merge-update existing, returns {created, updated} — **F209** ✅ 2026-07-28
- [x] Cache: `touch(key, ttl?)` — extend TTL without fetching value or updating LRU/stats — **F210** ✅ 2026-07-28
- [x] EventBus: `emitBatch(channel, items, opts)` — emit multiple events in sequence with optional delay and atomic mode — **F211** ✅ 2026-07-28

## Utils (Round 55)
- [x] Cache: `mset(entries, ttl?)` — Redis MSET, batch set multiple key-value pairs — **F212** ✅ 2026-07-29
- [x] Storage: `intersect(otherStorage)` — return task IDs present in both storages — **F213** ✅ 2026-07-29
- [x] EventBus: `emitWithDelay(channel, data, delayMs)` — emit after setTimeout delay, returns cancelable handle — **F214** ✅ 2026-07-29
- [x] **Bug fix**: F211 `emitBatch` renamed to `emitSeries` — was silently overriding F16 sync `emitBatch` — ✅ 2026-07-29

## Utils (Round 56)
- [x] Cache: `mdelete(keys[])` — Redis DEL, batch delete multiple keys returning count — **F215** ✅ 2026-07-30
- [x] Storage: `union(otherStorage)` — merge two storages into combined task map, other wins on conflict — **F216** ✅ 2026-07-30
- [x] EventBus: `drainChannel(channel)` — remove and return all history events for a specific channel — **F217** ✅ 2026-07-30

## Utils (Round 51)
- [x] Cache: `getAndTouch(key, ttl?)` — get value + refresh TTL atomically, LRU update — **F201** ✅ 2026-07-22
- [x] EventBus: `emitIfChanged(channel, data, keyFn?)` — dedup emissions, only emit when data differs — **F202** ✅ 2026-07-22
- [x] Storage: `ensureIndex(field)` + `findByIndex(field, value)` — in-memory index for O(1) field lookups — **F203** ✅ 2026-07-22

## Utils (Round 58)
- [x] PriorityQueue: `merge(otherQueue)` — merge another PQ, preserving priority, empties source — **F227** ✅ 2026-08-03
- [x] Storage: `toJSON(fields?)` — serialize tasks to JSON string with optional field whitelist — **F228** ✅ 2026-08-03
- [x] Cache: `count(predicate?)` — count non-expired entries matching optional predicate — **F229** ✅ 2026-08-03

## Utils (Round 57)
- [x] Storage: `forEach(callback)` — iterate all tasks with early-exit support — **F224** ✅ 2026-08-02
- [x] EventBus: `eventAge(channel)` — ms since last event on channel, -1 if none — **F225** ✅ 2026-08-02
- [x] Cache: `getOrThrow(key)` — get value or throw if missing/expired — **F226** ✅ 2026-08-02

## Utils (Round 59)
- [x] Cache: `incrIfLess(key, max, delta=1)` — atomic increment bounded by max, Redis-style — **F230** ✅ 2026-08-10
- [x] Storage: `getField(id, field, default?)` — get single field from task with default fallback — **F231** ✅ 2026-08-10
- [x] ConcurrencyManager: `wrap(fn, opts?)` — wrap async fn with concurrency + retry support — **F232** ✅ 2026-08-10

## Utils (Round 60)
- [x] Storage: `getMany(ids[])` — batch get tasks by ID, returns Map of found tasks — **F235** ✅ 2026-08-12
- [x] PriorityQueue: `getValues()` — return raw items in priority order without wrapper — **F236** ✅ 2026-08-12
- [x] EventBus: `emitOnce(channel, data, keyFn)` — dedup emit, skip if same key already emitted — **F237** ✅ 2026-08-12

## Utils (Round 61)
- [x] Storage: `every(predicate)` — true only if ALL tasks match (vacuously true on empty) — **F238** ✅ 2026-08-22
- [x] Storage: `some(predicate)` — true if at least one task matches — **F239** ✅ 2026-08-22
- [x] PriorityQueue: `batch(n)` — dequeue up to n items in priority order, returns array — **F240** ✅ 2026-08-22
- [x] Storage: `updateWhere(predicate, updates)` — SQL UPDATE...WHERE bulk update, returns count — **F241** ✅ 2026-08-23
- [x] PriorityQueue: `priorities()` — distinct priorities present, sorted ascending — **F242** ✅ 2026-08-23
- [x] PriorityQueue: `enqueueAll(items, priority)` — bulk enqueue (inverse of batch), returns new size — **F243** ✅ 2026-08-23

## Utils (Round 63)
- [x] ConcurrencyManager: `waterfall(tasks, initialValue?)` — sequential async chain, each task receives previous result, fail-fast on error — **F244** ✅ 2026-08-26
- [x] Cache: `deleteMany(keys[])` — batch delete (inverse of getMany), returns count; expired entries purged but not counted — **F245** ✅ 2026-08-26
- [x] EventBus: `onOnce(channel, handler)` — one-shot listener, auto-removed after first fire, returns unsubscribe handle — **F246** ✅ 2026-08-26

## Utils (Round 64)
- [x] EventBus: `waitForMatch(channel, predicate, timeoutMs)` — like waitFor but only resolves on events matching predicate(event); non-matching ignored, listener stays attached; rejects on timeout — **F247** ✅ 2026-08-27
- [x] Storage: `partition(predicate)` — split tasks into `{ passing: [], failing: [] }` (full task objects with id); empty storage → both empty — **F248** ✅ 2026-08-27
- [x] Storage: `minBy(field)` / `maxBy(field)` — task with smallest/largest finite numeric field value (null if none); non-numeric/missing fields ignored — **F249** ✅ 2026-08-27

## Utils (Round 65) + performance bugfix
- [x] Cache: `getCached(key)` — prefix-index acceleration with linear-scan fallback for direct cache writes; returns first FRESH match (was: bailed on first expired match); lazy purge of expired candidates — ✅ 2026-08-28 (97e4602)
- [x] Bug fix: `_removeFromPrefixIndex` now symmetric with `_addToPrefixIndex` (full-key self-entry + basePrefix+':') — fixes index leak leaving phantom keys — ✅ 2026-08-28 (97e4602)
- [x] Cache: `incrByFloat(key, amount)` — Redis INCRBYFLOAT; missing key starts at 0; TypeError on non-finite amount/value — **F250** ✅ 2026-08-28
- [x] Storage: `sample(n, rng?)` — n random distinct tasks (full objects with id) via partial Fisher-Yates; injectable rng for deterministic tests — **F251** ✅ 2026-08-28
- [x] EventBus: `replayLast(channel, handler)` — late-join: subscribe + immediately replay most recent exact-channel history event — **F252** ✅ 2026-08-28

## Utils (Round 66)
- [x] EventBus: `replayAll(channel, handler)` — F252 sibling: full history replay oldest-first then live; drained channels replay nothing — **F253** ✅ 2026-08-28
- [x] Storage: `updateMany(ids, updates)` — bulk merge-update; returns `{ updated, missing }` id lists; missing ids not created — **F254** ✅ 2026-08-28
- [x] Cache: `getStale(key)` — soft read `{ value, expired }` without purging expired entries; no stats side effects — **F255** ✅ 2026-08-28

## Utils (Round 67) + twin purge
- [x] Cache: `getOrSet(key, factory, ttl)` single-flight upgrade — concurrent callers on a missing key share one in-flight promise (factory runs once); static-value contract preserved — **F18b** ✅ 2026-08-29 (c05513c)
- [x] Storage: `pluck(field, ids?)` ids-whitelist upgrade — with ids: only listed tasks in ids order, missing skipped; keeps duplicates and insertion order (distinct() dedupes, pluck doesn't) — **F113b** ✅ 2026-08-29 (d8bd58b)
- [x] EventBus: `onceAll(channels, timeout?)` — Promise resolving with collected payloads once EVERY channel has fired; timeout rejects listing missing channels and unsubscribes — **F258** ✅ 2026-08-29 (c05513c)
- [x] Bug fix: Cache.swap TTL-blindness — returned stale values for expired keys (raw map read); now treats expired as missing + purges, matching get/has/keys/size contract — ✅ 2026-08-29 (7247329)
- [x] Twin purge: 12 dead shadowed definitions removed across cache.js (7), storage.js (2), event-bus.js (1), priority-queue.js (1), concurrency-manager.js (1); JS classes silently shadow same-name methods (later wins, earlier dead); census certified clean sync+async — ✅ 2026-08-29 (7247329, 60c7d3a)

## Utils (Round 68) — StreamManager
- [x] Bug fix: `iterate()` late-subscriber hang — subscribing to an already-completed/errored stream awaited a promise no future event could resolve (infinite hang); now flushes the buffer then terminates cleanly — **F259** ✅ 2026-08-30
- [x] Bug fix: `iterate()` on a missing stream now rejects `stream '<id>' does not exist` instead of hanging; unsubscribe handle made null-safe (subscribe returns null for unknown streams) — **F259** ✅ 2026-08-30
- [x] StreamManager: `listStreams({ includeCompleted })` — stream ids in creation order; completed/errored excluded by default — **F260** ✅ 2026-08-30
- [x] StreamManager: `destroyAll()` — bulk teardown of every stream (active + completed); returns count, emits `stream:destroyAll` only when non-empty — **F260** ✅ 2026-08-30
