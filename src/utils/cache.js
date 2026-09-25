/**
 * Cache - Simple in-memory cache with TTL support
 */
class Cache {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 100;
    this.defaultTTL = options.defaultTTL ?? 3600000; // 1 hour (F271: explicit 0 = "no default expiry"; null/undefined fall back)
    this.cache = new Map();
    this._inflight = new Map(); // F256: single-flight getOrSet promises per key
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0
    };
    
    // Start cleanup interval (unref so it doesn't block process exit)
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Get a value from cache
   * @param {string} key - Cache key
   * @returns {*} - Cached value or undefined
   */
  get(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return undefined;
    }
    
    // Check if expired
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.delete(key);
      this.stats.misses++;
      return undefined;
    }
    
    // Update access time for LRU
    entry.lastAccessed = Date.now();
    this.stats.hits++;
    
    return entry.value;
  }

  /**
   * F193: peek(key) — get value without updating LRU position or access stats.
   * Returns undefined for missing or expired keys. Does NOT count as a hit or miss.
   * @param {string} key
   * @returns {*} value or undefined
   */
  peek(key) {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.delete(key);
      return undefined;
    }
    return entry.value;
  }

  /**
   * F255: getStale(key) — soft read: returns { value, expired } without purging
   * expired entries (unlike get/peek which delete them). Returns undefined if
   * the key is missing. Metadata read: no hit/miss stats, no LRU update.
   * @param {string} key
   * @returns {{value: *, expired: boolean}|undefined}
   */
  getStale(key) {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    const expired = !!(entry.expiresAt && Date.now() > entry.expiresAt);
    return { value: entry.value, expired };
  }

  /**
   * Set a value in cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} ttl - Time to live in milliseconds
   */
  set(key, value, ttl = this.defaultTTL) {
    // Evict if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }
    
    const entry = {
      value,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      expiresAt: ttl ? Date.now() + ttl : null
    };
    
    this.cache.set(key, entry);
    this.stats.size = this.cache.size;
    this._notifyWatchers(key, 'set', value);
  }

  /** Set with absolute expiry timestamp instead of relative TTL */
  setWithExpiry(key, value, expiresAt) {
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }
    const entry = {
      value,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      expiresAt: expiresAt || null
    };
    this.cache.set(key, entry);
    this.stats.size = this.cache.size;
  }

  /**
   * Check if key exists in cache
   */
  has(key) {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Delete a key from cache
   */
  delete(key) {
    const entry = this.cache.get(key);
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.size = this.cache.size;
      this._notifyWatchers(key, 'delete', entry ? entry.value : undefined);
    }
    return deleted;
  }

  /**
   * Clear all cache entries
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    this.stats.size = 0;
    return size;
  }

  /**
   * Evict least recently used entry
   */
  evictLRU() {
    let oldest = null;
    let oldestKey = null;
    
    for (const [key, entry] of this.cache.entries()) {
      if (!oldest || entry.lastAccessed < oldest.lastAccessed) {
        oldest = entry;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  /**
   * Clean up expired entries
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.delete(key);
        cleaned++;
      }
    }
    
    return cleaned;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? this.stats.hits / (this.stats.hits + this.stats.misses)
      : 0;
    
    return {
      ...this.stats,
      hitRate: hitRate.toFixed(2)
    };
  }

  /**
   * Get multiple values at once
   * @param {string[]} keys - Cache keys
   * @returns {object} Key-value map (missing keys omitted)
   */
  async getOrSet(key, factory, ttl = this.defaultTTL) {
    const existing = this.get(key);
    if (existing !== undefined) return existing;
    // F18b (R67): single-flight — concurrent misses share ONE factory invocation
    // (cache-stampede protection). A rejected factory clears the in-flight entry
    // and leaves the cache untouched, so the next call retries cleanly.
    if (this._inflight.has(key)) return this._inflight.get(key);
    const p = (async () => {
      try {
        const value = typeof factory === 'function' ? await factory() : factory;
        this.set(key, value, ttl);
        return value;
      } finally {
        this._inflight.delete(key);
      }
    })();
    this._inflight.set(key, p);
    return p;
  }

  mget(keys) {
    const result = {};
    for (const key of keys) {
      const value = this.get(key);
      if (value !== undefined) {
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * Set multiple values at once
   * @param {object} entries - Key-value pairs to set
   * @param {number} ttl - TTL in milliseconds
   */
  // NOTE: mset/mdelete are defined later (F212/F215) with unified object+array support.

  /**
   * Invalidate all keys matching a prefix
   * @param {string} prefix - Key prefix
   * @returns {number} Number of keys invalidated
   */
  invalidateByPrefix(prefix) {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Atomically get a value and delete it from cache (pop).
   * @param {string} key - Cache key
   * @returns {*} - Cached value or undefined
   */
  getAndDelete(key) {
    const value = this.get(key);
    if (value !== undefined) {
      this.delete(key);
    }
    return value;
  }

  /**
   * Dump all non-expired cache entries as a serializable object.
   * @returns {object[]} Array of { key, value, ttlRemaining }
   */
  dump() {
    const now = Date.now();
    const entries = [];
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) continue;
      entries.push({
        key,
        value: entry.value,
        ttlRemaining: entry.expiresAt ? Math.max(0, entry.expiresAt - now) : null
      });
    }
    return entries;
  }

  /**
   * Restore cache entries from a dump.
   * @param {object[]} entries - Array of { key, value, ttlRemaining }
   */
  restore(entries) {
    if (!Array.isArray(entries)) throw new Error('restore requires an array');
    for (const { key, value, ttlRemaining } of entries) {
      const ttl = ttlRemaining != null ? ttlRemaining : this.defaultTTL;
      this.set(key, value, ttl);
    }
  }

  /**
   * Create a namespace-scoped view of this cache.
   * All keys are auto-prefixed with `prefix:`.
   * Shares the same underlying cache store.
   * @param {string} prefix - Namespace prefix
   * @returns {object} Scoped cache interface { get, set, has, delete, clear, keys, size }
   */
  withNamespace(prefix) {
    const pfx = (key) => `${prefix}:${key}`;
    return {
      get: (key) => this.get(pfx(key)),
      set: (key, value, ttl) => this.set(pfx(key), value, ttl),
      has: (key) => this.has(pfx(key)),
      delete: (key) => this.delete(pfx(key)),
      clear: () => this.invalidateByPrefix(prefix + ':'),
      keys: () => this.keys().filter(k => k.startsWith(prefix + ':')).map(k => k.slice(prefix.length + 1)),
      size: () => this.keys().filter(k => k.startsWith(prefix + ':')).length
    };
  }

  /**
   * Delete all keys matching a glob-like pattern.
   * Supports `*` as wildcard.
   * @param {string} pattern - Glob pattern (e.g., 'user:*:profile')
   * @returns {number} Number of keys deleted
   */
  deleteByPattern(pattern) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    let count = 0;
    for (const key of [...this.cache.keys()]) {
      if (regex.test(key)) {
        this.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Find cache keys matching a predicate function.
   * @param {function} predicate - (key, value) => boolean
   * @returns {string[]} Matching keys
   */
  findKeys(predicate) {
    const now = Date.now();
    const result = [];
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) continue;
      if (predicate(key, entry.value)) result.push(key);
    }
    return result;
  }

  /** F82: Return all non-expired keys from cache.
   * @returns {string[]}
   */
  keys() {
    const now = Date.now();
    const result = [];
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) continue;
      result.push(key);
    }
    return result;
  }

  /**
   * Return all non-expired values from cache.
   * @returns {Array}
   */
  values() {
    const now = Date.now();
    const result = [];
    for (const [, entry] of this.cache.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) continue;
      result.push(entry.value);
    }
    return result;
  }

  /**
   * Destroy cache and cleanup interval
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }

  /**
   * Reset hit/miss/eviction statistics counters to zero.
   * @returns {void}
   */
  resetStats() {
    this.stats = { hits: 0, misses: 0, evictions: 0, size: this.cache.size };
  }

  /**
   * Return all non-expired entries with full metadata.
   * @returns {Array<{key: string, value: *, createdAt: number, lastAccessed: number, expiresAt: number|null}>}
   */
  entries() {
    const now = Date.now();
    const result = [];
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) continue;
      result.push({ key, value: entry.value, createdAt: entry.createdAt, lastAccessed: entry.lastAccessed, expiresAt: entry.expiresAt });
    }
    return result;
  }

  /**
   * Iterate all non-expired entries.
   * @param {(value: *, key: string, cache: Cache) => void} callback
   * @returns {void}
   */
  forEach(callback) {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) continue;
      callback(entry.value, key, this);
    }
  }

  /**
   * Batch get multiple keys, returning a Map of found entries.
   * @param {string[]} keys
   * @returns {Map<string, *>}
   */
  getMany(keys) {
    const result = new Map();
    for (const key of keys) {
      const val = this.get(key);
      if (val !== undefined) result.set(key, val);
    }
    return result;
  }

  /**
   * Set only if key does not exist (NX pattern). Returns true if set, false if key existed.
   * @param {string} key
   * @param {*} value
   * @param {number} [ttl]
   * @returns {boolean}
   */
  setNX(key, value, ttl = this.defaultTTL) {
    if (this.has(key)) return false;
    this.set(key, value, ttl);
    return true;
  }

  /** F263: SET ... XX — set only if the key already exists (fresh). Expired
   * keys count as missing (has() purges them) and are never overwritten.
   * Mirror of setNX. */
  setXX(key, value, ttl = this.defaultTTL) {
    if (!this.has(key)) return false;
    this.set(key, value, ttl);
    return true;
  }

  /** Return count of non-expired entries. */
  get nonExpiredSize() {
    const now = Date.now();
    let count = 0;
    for (const entry of this.cache.values()) {
      if (!entry.expiresAt || entry.expiresAt > now) count++;
    }
    return count;
  }

  /** F73: Atomic increment for numeric cached values */
  incr(key, delta = 1) {
    const current = this.get(key);
    if (current === undefined) {
      this.set(key, delta);
      return delta;
    }
    if (typeof current !== 'number') {
      throw new TypeError(`Cache.incr: value at '${key}' is not a number`);
    }
    const newVal = current + delta;
    this.set(key, newVal);
    return newVal;
  }

  /** F76: Atomic decrement for numeric values. */
  decr(key, delta = 1) {
    return this.incr(key, -delta);
  }

  /**
   * F250: incrByFloat(key, amount) — Redis INCRBYFLOAT semantics for float deltas.
   * Missing key starts from 0; non-numeric or non-finite current value throws
   * TypeError; non-finite amount throws TypeError. Returns the new value (raw
   * float addition, no rounding). Stores with default TTL (same as incr family).
   * @param {string} key
   * @param {number} amount
   * @returns {number} new value
   */
  incrByFloat(key, amount) {
    if (typeof amount !== 'number' || !Number.isFinite(amount)) {
      throw new TypeError('incrByFloat: amount must be a finite number');
    }
    const current = this.get(key);
    if (current === undefined) {
      this.set(key, amount);
      return amount;
    }
    if (typeof current !== 'number' || !Number.isFinite(current)) {
      throw new TypeError(`Cache.incrByFloat: value at '${key}' is not a finite number`);
    }
    const newVal = current + amount;
    this.set(key, newVal);
    return newVal;
  }

  /** F137: incrTo(key, target, delta=1) — increment towards a target ceiling, stops at target. Returns new value. */
  incrTo(key, target, delta = 1) {
    if (typeof target !== 'number' || typeof delta !== 'number') {
      throw new TypeError('incrTo: target and delta must be numbers');
    }
    if (delta <= 0) throw new RangeError('incrTo: delta must be positive');
    const current = this.get(key);
    if (current === undefined) {
      const val = Math.min(delta, target);
      this.set(key, val);
      return val;
    }
    if (typeof current !== 'number') {
      throw new TypeError(`Cache.incrTo: value at '${key}' is not a number`);
    }
    if (current >= target) return current;
    const newVal = Math.min(current + delta, target);
    this.set(key, newVal);
    return newVal;
  }

  /** F204: incrByEx(key, amount, ttl) — increment by amount AND set new TTL atomically.
   * Combines incr + expire in a single operation (Redis INCR + EX pipeline semantics).
   * If key doesn't exist, initializes to amount. Throws TypeError if existing value isn't a number.
   * @param {string} key
   * @param {number} amount — increment amount (default 1)
   * @param {number} ttl — new TTL in ms
   * @returns {number} new value after increment
   */
  incrByEx(key, amount = 1, ttl = this.defaultTTL) {
    if (typeof amount !== 'number') throw new TypeError('incrByEx: amount must be a number');
    if (typeof ttl !== 'number' || ttl <= 0) throw new TypeError('incrByEx: ttl must be a positive number');
    const current = this.get(key);
    if (current !== undefined && typeof current !== 'number') {
      throw new TypeError(`Cache.incrByEx: value at '${key}' is not a number`);
    }
    const newVal = (current || 0) + amount;
    this.set(key, newVal, ttl); // set with new TTL
    return newVal;
  }

  /** F91: shrink(maxSize) — evict oldest non-expired entries to shrink cache to maxSize, return count of evicted entries. */
  shrink(maxSize) {
    if (typeof maxSize !== 'number' || maxSize < 0) throw new Error('maxSize must be a non-negative number');
    const now = Date.now();
    const entries = [];
    for (const [k, entry] of this.cache) {
      if (!entry.expiresAt || entry.expiresAt > now) {
        entries.push({ key: k, createdAt: entry.createdAt || 0 });
      }
    }
    if (entries.length <= maxSize) return 0;
    entries.sort((a, b) => a.createdAt - b.createdAt);
    const toEvict = entries.slice(0, entries.length - maxSize);
    for (const { key } of toEvict) {
      this.cache.delete(key);
      this.stats.evictions++;
    }
    return toEvict.length;
  }

  /** F93: Cache.compact() — remove all expired entries, return count removed. */
  compact() {
    const now = Date.now();
    let removed = 0;
    for (const [k, entry] of this.cache) {
      if (entry.expiresAt && entry.expiresAt <= now) {
        this.cache.delete(k);
        removed++;
      }
    }
    return removed;
  }

  /**
   * F97/F141: expire(key, ttl) — set or update TTL on an existing key.
   * Returns true if key exists and was updated, false otherwise.
   * - ttl > 0: sets new TTL
   * - ttl = 0 or negative: immediately deletes the key (F141 semantics)
   * - ttl = null: makes key never expire (F97 semantics)
   * Returns false for missing or already-expired keys.
   */
  /**
   * F97: expire(key, ttl) — set TTL (ms) on an existing key.
   * F265: options.mode adds Redis 7 EXPIRE parity —
   *   NX: apply only if key has NO TTL (persistent)
   *   XX: apply only if key HAS a TTL
   *   GT: apply only if new ttl > remaining (persistent = infinite → fails)
   *   LT: apply only if new ttl < remaining (persistent = infinite → succeeds)
   * Returns false for missing/expired keys or when the mode condition fails.
   * ttl = null: makes key never expire (F97 semantics); illegal with a mode.
   */
  expire(key, ttl = this.defaultTTL, options = {}) {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.delete(key);
      return false;
    }
    const mode = options && options.mode ? String(options.mode).toUpperCase() : null;
    if (mode !== null) {
      if (!['NX', 'XX', 'GT', 'LT'].includes(mode)) {
        throw new TypeError(`expire: unknown mode '${mode}' (NX|XX|GT|LT)`);
      }
      if (ttl === null || ttl === undefined) {
        throw new TypeError('expire: ttl is required when a mode is set');
      }
      const hasTTL = entry.expiresAt !== null && entry.expiresAt !== undefined;
      const current = hasTTL ? entry.expiresAt - Date.now() : Infinity;
      let pass = false;
      if (mode === 'NX') pass = !hasTTL;
      else if (mode === 'XX') pass = hasTTL;
      else if (mode === 'GT') pass = ttl > current;
      else pass = ttl < current; // LT
      if (!pass) return false;
    }
    if (ttl === null) {
      entry.expiresAt = null;
    } else if (ttl <= 0) {
      this.cache.delete(key);
      this.stats.evictions++;
    } else {
      entry.expiresAt = Date.now() + ttl;
    }
    return true;
  }

  /** F109: expireAt(key, timestamp) — set absolute expiry timestamp (ms since epoch). Returns true if key existed and was updated. */
  expireAt(key, timestamp) {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.delete(key);
      return false;
    }
    if (typeof timestamp !== 'number' || isNaN(timestamp) || timestamp <= 0) {
      throw new Error('expireAt: timestamp must be a positive number (ms since epoch)');
    }
    entry.expiresAt = timestamp;
    return true;
  }

  /** F88: toPairs() — return all non-expired entries as [[key, value], ...] (lightweight alternative to entries() metadata). */
  toPairs() {
    const result = [];
    const now = Date.now();
    for (const [k, entry] of this.cache) {
      if (!entry.expiresAt || entry.expiresAt > now) {
        result.push([k, entry.value]);
      }
    }
    return result;
  }

  /** F100: merge(key, obj, ttl?) — shallow-merge obj into existing cached value (must be an object). Returns true if merged, false if key missing/value not object. */
  merge(key, obj, ttl) {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.delete(key);
      return false;
    }
    if (typeof entry.value !== 'object' || entry.value === null || Array.isArray(entry.value)) return false;
    Object.assign(entry.value, obj);
    if (ttl !== undefined) entry.expiresAt = ttl ? Date.now() + ttl : null;
    return true;
  }

  /** F95: getSet(key, factory, ttl?) — always call factory to get fresh value, set it, return it (forced refresh). */
  async getSet(key, factory, ttl) {
    const value = await factory(key);
    this.set(key, value, ttl);
    return value;
  }


  /** F106: random() — return a random non-expired entry as { key, value }, or null if cache is empty.
   */
  random() {
    const keys = [];
    for (const [key, entry] of this.cache) {
      if (!entry.expiresAt || Date.now() <= entry.expiresAt) {
        keys.push(key);
      }
    }
    if (keys.length === 0) return null;
    const pickedKey = keys[Math.floor(Math.random() * keys.length)];
    return { key: pickedKey, value: this.cache.get(pickedKey).value };
  }
  /** F112: getWithMeta(key) — return { value, createdAt, accessedAt, expiresAt, ttlRemaining } or null if missing/expired. */
  getWithMeta(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.delete(key);
      return null;
    }
    const now = Date.now();
    return {
      value: entry.value,
      createdAt: entry.createdAt || null,
      accessedAt: entry.lastAccessed || null,
      expiresAt: entry.expiresAt || null,
      ttlRemaining: entry.expiresAt ? entry.expiresAt - now : null,
    };
  }

  /** F103: type(key) — return JS type string of cached value ('string', 'number', 'boolean', 'object', 'array', 'null', 'undefined'). Returns 'undefined' if key missing/expired. */
  type(key) {
    const entry = this.cache.get(key);
    if (!entry) return 'undefined';
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.delete(key);
      return 'undefined';
    }
    const v = entry.value;
    if (v === null) return 'null';
    if (Array.isArray(v)) return 'array';
    return typeof v;
  }

  /** F115: watch(key, callback) — watch a key for changes. Callback receives {key, event, value} where event is 'set'|'delete'|'expire'. Returns unwatch function. */
  watch(key, callback) {
    if (!this._watchers) this._watchers = new Map();
    if (!this._watchers.has(key)) this._watchers.set(key, new Set());
    this._watchers.get(key).add(callback);
    return () => {
      const watchers = this._watchers.get(key);
      if (watchers) {
        watchers.delete(callback);
        if (watchers.size === 0) this._watchers.delete(key);
      }
    };
  }

  /** Internal: notify watchers for a key */
  _notifyWatchers(key, event, value) {
    if (!this._watchers) return;
    const watchers = this._watchers.get(key);
    if (watchers) {
      for (const cb of watchers) {
        try { cb({ key, event, value }); } catch {}
      }
    }
  }

  /** F119: shuffle() — return all non-expired values in random order */
  shuffle() {
    const entries = [];
    const now = Date.now();
    for (const [k, v] of this.cache) {
      if (!v.expiresAt || v.expiresAt > now) entries.push({ key: k, value: v.value });
    }
    for (let i = entries.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [entries[i], entries[j]] = [entries[j], entries[i]];
    }
    return entries;
  }

  /** F122: diff(otherCache) — compare this cache with another. Returns { added: keys in this not in other, removed: keys in other not in this, changed: keys in both but different values } */
  diff(otherCache) {
    const thisKeys = new Set(this.cache.keys());
    const otherKeys = new Set(otherCache.cache.keys());
    const added = [];
    const removed = [];
    const changed = [];
    for (const k of thisKeys) {
      if (!otherKeys.has(k)) added.push(k);
      else if (JSON.stringify(this.cache.get(k)?.value) !== JSON.stringify(otherCache.cache.get(k)?.value)) changed.push(k);
    }
    for (const k of otherKeys) {
      if (!thisKeys.has(k)) removed.push(k);
    }
    return { added, removed, changed };
  }

  /** F125: Cache.lock(key, fn) — exclusive mutex on a key. Queue concurrent ops. Returns fn result. */
  async lock(key, fn) {
    if (!this._keyLocks) this._keyLocks = new Map();
    const prev = this._keyLocks.get(key) || Promise.resolve();
    let release;
    const next = new Promise(r => { release = r; });
    this._keyLocks.set(key, next);
    await prev;
    try {
      return await fn();
    } finally {
      release();
      if (this._keyLocks.get(key) === next) this._keyLocks.delete(key);
    }
  }

  /**
   * Compute and cache a value with explicit TTL.
   * If the key already holds a non-expired value, return it without calling fn.
   * Otherwise call fn(), cache the result with the given TTL, and return it.
   * @param {string} key - Cache key
   * @param {function} fn - Value producer (sync or async)
   * @param {number} ttl - TTL in seconds
   * @returns {Promise<*>} The cached or freshly computed value
   */
  async withTTL(key, fn, ttl) {
    const existing = this.get(key);
    if (existing !== undefined) return existing;
    const value = await fn();
    this.set(key, value, ttl);
    return value;
  }

  /** F130: copy(srcKey, destKey, ttl?) — copy value from srcKey to destKey with optional new TTL.
   * If destKey already exists it is overwritten. Returns false if srcKey doesn't exist or is expired.
   * If ttl not provided, inherits remaining TTL from source entry.
   * @returns {boolean} success
   */
  copy(srcKey, destKey, ttl) {
    const now = Date.now();
    const entry = this.cache.get(srcKey);
    if (!entry) return false;
    if (entry.expiresAt !== null && entry.expiresAt <= now) {
      this.cache.delete(srcKey);
      this.stats.misses++;
      return false;
    }
    let newExpiresAt;
    if (ttl !== undefined) {
      newExpiresAt = ttl === null ? null : now + ttl;
    } else {
      newExpiresAt = entry.expiresAt; // inherit remaining TTL
    }
    this.cache.set(destKey, {
      value: entry.value,
      createdAt: entry.createdAt,
      accessedAt: now,
      expiresAt: newExpiresAt,
      ttl: newExpiresAt === null ? null : (newExpiresAt - now)
    });
    this.stats.sets++;
    this._notifyWatchers(destKey, 'copy', entry.value);
    return true;
  }

  /**
   * Return a plain-object snapshot of all non-expired entries.
   * Shallow copy of { key: value } pairs — useful for serialization/debugging.
   * @returns {Record<string, *>}
   */
  snapshot() {
    const result = {};
    const now = Date.now();
    for (const [k, entry] of this.cache) {
      if (entry.expiresAt === null || entry.expiresAt > now) {
        result[k] = entry.value;
      }
    }
    return result;
  }

  /**
   * Find all keys matching a prefix.
   * @param {string} prefix
   * @returns {string[]}
   */
  keysByPrefix(prefix) {
    const result = [];
    const now = Date.now();
    for (const [k, entry] of this.cache) {
      if (k.startsWith(prefix)) {
        if (entry.expiresAt === null || entry.expiresAt > now) {
          result.push(k);
        }
      }
    }
    return result;
  }

  /**
   * Export cache contents as JSON string (only non-expired entries).
   * Includes metadata (createdAt, ttl) for restoration.
   * @returns {string}
   */
  exportJSON() {
    const now = Date.now();
    const entries = [];
    for (const [k, entry] of this.cache) {
      if (entry.expiresAt !== null && entry.expiresAt <= now) continue;
      const remainingTtl = entry.expiresAt === null ? null : entry.expiresAt - now;
      entries.push({
        key: k,
        value: entry.value,
        createdAt: entry.createdAt,
        remainingTtl,
      });
    }
    return JSON.stringify({ version: 1, exportedAt: now, entries });
  }

  /**
   * Import cache contents from JSON string produced by exportJSON().
   * @param {string} json
   * @param {object} opts - { merge: true (default) appends, false replaces all }
   * @returns {number} count of imported entries
   */
  importJSON(json, opts = { merge: true }) {
    const data = JSON.parse(json);
    if (!data.entries || !Array.isArray(data.entries)) {
      throw new Error('Invalid cache JSON: missing entries array');
    }
    if (!opts.merge) this.clear();
    const now = Date.now();
    let count = 0;
    for (const { key, value, remainingTtl } of data.entries) {
      const ttl = remainingTtl === null ? null : (remainingTtl > 0 ? remainingTtl : 0);
      if (ttl !== null && ttl <= 0) continue; // skip already-expired
      this.set(key, value, ttl === null ? 0 : ttl);
      count++;
    }
    return count;
  }

  /**
   * F142: persist(key) — remove TTL from a key, making it non-expiring.
   * Returns true if the key exists, false otherwise.
   */
  persist(key) {
    const entry = this.cache.get(key);
    if (!entry) return false;
    entry.expiresAt = null;
    return true;
  }

  /**
   * F143: swap(key, value, ttl) — atomically set a new value and return the previous value.
   * Like Redis GETSET. Returns undefined if the key didn't exist.
   */
  swap(key, value, ttl = this.defaultTTL) {
    const entry = this.cache.get(key);
    // R67 twin-purge fix: F143 was TTL-blind (raw map read returned stale values
    // for expired keys, violating its own GETSET contract + the TTL-filtering
    // get/has/keys/size contract). Expired → treat as missing, purge the entry.
    const expired = !!entry && entry.expiresAt !== null && entry.expiresAt !== undefined && Date.now() > entry.expiresAt;
    const oldValue = entry && !expired ? entry.value : undefined;
    if (expired) this.cache.delete(key);
    this.set(key, value, ttl);
    return oldValue;
  }

  /**
   * F143: ttl(key) — return remaining TTL in ms for a key.
   * Returns -1 if key has no expiry (persistent). Returns -2 if key doesn't exist.
   * Like Redis TTL.
   */
  ttl(key) {
    const entry = this.cache.get(key);
    if (!entry) return -2;
    if (!entry.expiresAt) return -1;
    const remaining = entry.expiresAt - Date.now();
    return remaining > 0 ? remaining : -2;
  }

  /** F267: append(key, suffix) — Redis APPEND parity.
   * Missing key → value becomes suffix (fresh set, current default TTL).
   * Existing string → concatenated; existing TTL preserved (Redis APPEND keeps TTL).
   * Returns new string length. Non-string value or suffix → TypeError (Redis WRONGTYPE). */
  append(key, suffix) {
    if (typeof suffix !== 'string') {
      throw new TypeError('append: suffix must be a string');
    }
    const entry = this.cache.get(key);
    const expired = !!entry && entry.expiresAt && Date.now() > entry.expiresAt;
    if (expired) {
      this.delete(key);
      this.stats.misses++;
    }
    if (!entry || expired) {
      this.set(key, suffix);
      return suffix.length;
    }
    if (typeof entry.value !== 'string') {
      throw new TypeError(`append: value at '${key}' is not a string`);
    }
    const merged = entry.value + suffix;
    if (entry.expiresAt) {
      this.setWithExpiry(key, merged, entry.expiresAt);
    } else {
      this.set(key, merged, 0);
    }
    return merged.length;
  }

  /** F267: strlen(key) — Redis STRLEN parity. Missing → 0; non-string → TypeError. */
  strlen(key) {
    const v = this.get(key);
    if (v === undefined) return 0;
    if (typeof v !== 'string') {
      throw new TypeError(`strlen: value at '${key}' is not a string`);
    }
    return v.length;
  }

  /** F267: getrange(key, start, end) — Redis GETRANGE parity.
   * Inclusive end; negative indices count from the end (-1 = last char);
   * out-of-range clamps; start > end after normalization → ''.
   * Missing key → ''. Non-string value or non-integer indices → TypeError. */
  getrange(key, start, end) {
    if (!Number.isInteger(start) || !Number.isInteger(end)) {
      throw new TypeError('getrange: start and end must be integers');
    }
    const v = this.get(key);
    if (v === undefined) return '';
    if (typeof v !== 'string') {
      throw new TypeError(`getrange: value at '${key}' is not a string`);
    }
    const len = v.length;
    const s = start < 0 ? Math.max(len + start, 0) : Math.min(start, len);
    const e = end < 0 ? len + end : Math.min(end, len - 1);
    if (s > e || s >= len) return '';
    return v.slice(s, e + 1);
  }

  /** F269: incrByInt(key, delta) — Redis INCRBY integer parity (sibling of F250 incrByFloat,
   * distinct from F154 incrBy which is float-tolerant number-only).
   * Missing/expired key → base 0. Integer deltas only (TypeError otherwise);
   * existing value must be a JS integer or integer-representable string
   * (leading/trailing spaces allowed, like Redis string2ll) — else TypeError
   * (WRONGTYPE family). Result beyond ±2^53-1 → RangeError (64-bit overflow
   * analog). TTL preserved on increment (Redis INCR keeps TTL). */
  incrByInt(key, delta) {
    if (!Number.isInteger(delta)) {
      throw new TypeError('incrByInt: delta must be an integer');
    }
    const entry = this.cache.get(key);
    const expired = !!entry && entry.expiresAt && Date.now() > entry.expiresAt;
    if (expired) {
      this.delete(key);
      this.stats.misses++;
    }
    let base = 0;
    if (entry && !expired) {
      const v = entry.value;
      if (typeof v === 'number') {
        if (!Number.isInteger(v)) {
          throw new TypeError(`incrByInt: value at '${key}' is not an integer`);
        }
        base = v;
      } else if (typeof v === 'string') {
        const s = v.trim();
        if (!/^-?\d+$/.test(s)) {
          throw new TypeError(`incrByInt: value at '${key}' is not an integer or out of range`);
        }
        base = Number(s);
      } else {
        throw new TypeError(`incrByInt: value at '${key}' is not an integer`);
      }
    }
    if (!Number.isSafeInteger(base) || !Number.isSafeInteger(base + delta)) {
      throw new RangeError('incrByInt: increment or decrement would overflow');
    }
    const result = base + delta;
    if (entry && !expired) {
      if (entry.expiresAt) {
        this.setWithExpiry(key, result, entry.expiresAt);
      } else {
        this.set(key, result, 0);
      }
    } else {
      this.set(key, result);
    }
    return result;
  }

  /** F269: decrByInt(key, delta) — Redis DECRBY parity. incrByInt with negated
   * delta (delta validated as integer before negation). */
  decrByInt(key, delta) {
    if (!Number.isInteger(delta)) {
      throw new TypeError('decrByInt: delta must be an integer');
    }
    return this.incrByInt(key, -delta);
  }

  /** F272: setrange(key, offset, value) — Redis SETRANGE parity.
   * Overwrites the string at `key` starting at `offset`; the gap between the
   * current length and `offset` is zero-filled ('\0', Redis zero-bytes).
   * Missing/expired key → fresh base '' written with the current default TTL
   * (same F267 append convention); existing key keeps its TTL.
   * Returns the new total length (UTF-16 code units, strlen-consistent).
   * Empty value: no-op — returns current length, missing key NOT created
   * (Redis parity). Non-string value/existing → TypeError (WRONGTYPE);
   * non-integer offset → TypeError; negative offset or offset beyond the
   * Redis 512MB string limit (2^29) → RangeError. */
  setrange(key, offset, value) {
    if (typeof value !== 'string') {
      throw new TypeError('setrange: value must be a string');
    }
    if (!Number.isInteger(offset)) {
      throw new TypeError('setrange: offset must be an integer');
    }
    if (offset < 0) {
      throw new RangeError('setrange: offset out of range');
    }
    if (offset > 2 ** 29) {
      throw new RangeError('setrange: offset out of range (exceeds 512MB string limit)');
    }

    const entry = this.cache.get(key);
    const expired = !!entry && entry.expiresAt && Date.now() > entry.expiresAt;
    if (expired) {
      this.delete(key);
      this.stats.misses++;
    }

    if (entry && !expired) {
      if (typeof entry.value !== 'string') {
        throw new TypeError(`setrange: value at '${key}' is not a string`);
      }
      if (value === '') {
        return entry.value.length; // Redis: empty value never creates/modifies
      }
      const base = entry.value;
      const next = base.length >= offset
        ? base.slice(0, offset) + value + base.slice(offset + value.length)
        : base + '\0'.repeat(offset - base.length) + value;
      if (entry.expiresAt) {
        this.setWithExpiry(key, next, entry.expiresAt);
      } else {
        this.set(key, next, 0);
      }
      return next.length;
    }

    // Missing (or expired-purged) key: fresh base ''. Redis does not create
    // the key for an empty write.
    if (value === '') return 0;
    const next = '\0'.repeat(offset) + value;
    this.set(key, next);
    this._notifyWatchers(key, 'set', next);
    return next.length;
  }

  // ---------- F274-F284: Redis hash family ----------

  /** Internal: live hash entry for `key`, or null if missing/expired (expired
   * entries are purged like get()). Throws TypeError (WRONGTYPE analog, same
   * family as strlen/append/setrange) if the stored value is not a hash.
   * A "hash" is a non-null, non-array object (plain objects set via set()
   * qualify — JS objects ARE hashes). No stats/LRU side effects. */
  _liveHashEntry(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.delete(key);
      return null;
    }
    if (
      typeof entry.value !== 'object' ||
      entry.value === null ||
      Array.isArray(entry.value) ||
      entry.value instanceof Set // set-family keys are not hashes (F290+)
    ) {
      throw new TypeError(`h*: value at '${key}' is not a hash`);
    }
    return entry;
  }

  /** Internal: copy-on-write re-store of a hash entry, preserving its TTL
   * (setWithExpiry for absolute expiry, set(key, v, 0) for no-expiry — same
   * convention as append/setrange). */
  _rewriteHash(key, entry, next) {
    if (entry.expiresAt) {
      this.setWithExpiry(key, next, entry.expiresAt);
    } else {
      this.set(key, next, 0);
    }
  }

  /** F274: hset(key, field, value, ttl?) — Redis HSET parity.
   * Sets `field` to `value` in the hash at `key`; creates the hash when the
   * key is missing or expired (using `ttl`, default this.defaultTTL).
   * Returns 1 when a new field was created, 0 when an existing field was
   * overwritten. Existing hashes keep their TTL (Redis HSET never touches
   * TTL). Copy-on-write: the stored object is replaced, never mutated.
   * Non-string field → TypeError; non-hash value at key → TypeError. */
  hset(key, field, value, ttl = this.defaultTTL) {
    if (typeof field !== 'string') {
      throw new TypeError('hset: field must be a string');
    }
    const entry = this._liveHashEntry(key);
    if (!entry) {
      this.set(key, { [field]: value }, ttl);
      return 1;
    }
    const isNew = !Object.prototype.hasOwnProperty.call(entry.value, field);
    this._rewriteHash(key, entry, { ...entry.value, [field]: value });
    return isNew ? 1 : 0;
  }

  /** F275: hget(key, field) — Redis HGET parity.
   * Returns the field value, or undefined for missing key/field (Redis nil).
   * Non-hash value at key → TypeError. Metadata-neutral read: no stats. */
  hget(key, field) {
    const entry = this._liveHashEntry(key);
    if (!entry) return undefined;
    return entry.value[field];
  }

  /** F276: hgetall(key) — Redis HGETALL parity.
   * Returns a shallow copy of all fields ({} for a missing key — Redis
   * empty-list parity). Non-hash → TypeError. The copy is mutation-safe:
   * editing the result never corrupts the stored hash. */
  hgetall(key) {
    const entry = this._liveHashEntry(key);
    if (!entry) return {};
    return { ...entry.value };
  }

  /** F277: hdel(key, ...fields) — Redis HDEL parity.
   * Removes fields from the hash at `key`; returns how many were actually
   * removed. Duplicate field names count once (Redis parity). When the hash
   * becomes empty the key is deleted entirely (Redis: empty hash = key gone);
   * a no-op delete (0 removed) leaves the key and its TTL untouched.
   * Partial delete preserves TTL. Missing key → 0. Non-hash → TypeError;
   * non-string field → TypeError. */
  hdel(key, ...fields) {
    for (const f of fields) {
      if (typeof f !== 'string') {
        throw new TypeError('hdel: fields must be strings');
      }
    }
    const entry = this._liveHashEntry(key);
    if (!entry) return 0;
    const next = { ...entry.value };
    let removed = 0;
    for (const f of new Set(fields)) {
      if (Object.prototype.hasOwnProperty.call(next, f)) {
        delete next[f];
        removed++;
      }
    }
    if (removed === 0) return 0;
    if (Object.keys(next).length === 0) {
      this.delete(key);
    } else {
      this._rewriteHash(key, entry, next);
    }
    return removed;
  }

  /** F278: hexists(key, field) — Redis HEXISTS parity.
   * True iff `field` exists in the hash at `key`; false for missing key.
   * Non-hash → TypeError. */
  hexists(key, field) {
    const entry = this._liveHashEntry(key);
    if (!entry) return false;
    return Object.prototype.hasOwnProperty.call(entry.value, field);
  }

  /** F279: hlen(key) — Redis HLEN parity.
   * Number of fields in the hash at `key`; 0 for a missing key.
   * Non-hash → TypeError. */
  hlen(key) {
    const entry = this._liveHashEntry(key);
    if (!entry) return 0;
    return Object.keys(entry.value).length;
  }

  /** F280: hkeys(key) — Redis HKEYS parity.
   * All field names in insertion order; [] for a missing key.
   * Returns a fresh array (mutation-safe). Non-hash → TypeError. */
  hkeys(key) {
    const entry = this._liveHashEntry(key);
    if (!entry) return [];
    return Object.keys(entry.value);
  }

  /** F281: hvals(key) — Redis HVALS parity.
   * All values aligned with field insertion order; [] for a missing key.
   * Returns a fresh array (mutation-safe). Non-hash → TypeError. */
  hvals(key) {
    const entry = this._liveHashEntry(key);
    if (!entry) return [];
    return Object.values(entry.value);
  }

  /** F282: hincrby(key, field, delta = 1) — Redis HINCRBY parity.
   * Increments the integer value at `field` by `delta`. Missing key →
   * hash created with {field: delta} (default TTL); missing field → field
   * set to delta. Current value must be an integer or integer-representable
   * string (string2ll analog, F269 incrByInt convention) — else TypeError.
   * Result beyond ±(2^53-1) → RangeError (safe-integer overflow). Existing
   * hashes keep their TTL. Returns the new value. Non-string field or
   * non-integer delta → TypeError. */
  hincrby(key, field, delta = 1) {
    if (typeof field !== 'string') {
      throw new TypeError('hincrby: field must be a string');
    }
    if (!Number.isInteger(delta)) {
      throw new TypeError('hincrby: delta must be an integer');
    }
    const entry = this._liveHashEntry(key);
    if (!entry) {
      this.set(key, { [field]: delta }, this.defaultTTL);
      return delta;
    }
    const hash = entry.value;
    let base = 0;
    if (Object.prototype.hasOwnProperty.call(hash, field)) {
      const cur = hash[field];
      if (typeof cur === 'number') {
        if (!Number.isInteger(cur)) {
          throw new TypeError(`hincrby: field '${field}' is not an integer`);
        }
        base = cur;
      } else if (typeof cur === 'string' && /^-?\d+$/.test(cur.trim())) {
        base = parseInt(cur.trim(), 10);
      } else {
        throw new TypeError(`hincrby: field '${field}' is not an integer`);
      }
    }
    const result = base + delta;
    if (result > Number.MAX_SAFE_INTEGER || result < -Number.MAX_SAFE_INTEGER) {
      throw new RangeError('hincrby: increment produces value beyond ±(2^53-1)');
    }
    this._rewriteHash(key, entry, { ...hash, [field]: result });
    return result;
  }

  /** F283: hmget(key, fields) — Redis HMGET parity.
   * Values aligned with the `fields` array (mget convention); undefined
   * slots for missing fields; missing key → all-undefined array.
   * Non-array input, non-string member, or non-hash value → TypeError. */
  hmget(key, fields) {
    if (!Array.isArray(fields)) {
      throw new TypeError('hmget: fields must be an array');
    }
    for (const f of fields) {
      if (typeof f !== 'string') {
        throw new TypeError('hmget: fields must be strings');
      }
    }
    const entry = this._liveHashEntry(key);
    if (!entry) return fields.map(() => undefined);
    const hash = entry.value;
    return fields.map((f) =>
      Object.prototype.hasOwnProperty.call(hash, f) ? hash[f] : undefined
    );
  }

  /** F284: hmset(key, obj, ttl?) — Redis HMSET parity (Redis 4+ HSET
   * return semantics). Bulk-sets every field of plain object `obj` into the
   * hash at `key`; returns the count of NEW fields added (overwrites don't
   * count). Missing key → hash created with `ttl` (default defaultTTL);
   * existing hashes keep their TTL. Empty obj → no-op returning 0, key NOT
   * created (an empty hash cannot exist — F277 hdel emptiness parity).
   * Null/array/non-object input or non-hash value at key → TypeError. */
  hmset(key, obj, ttl = this.defaultTTL) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
      throw new TypeError('hmset: obj must be a plain object');
    }
    const keys = Object.keys(obj);
    if (keys.length === 0) return 0;
    const entry = this._liveHashEntry(key);
    if (!entry) {
      this.set(key, { ...obj }, ttl);
      return keys.length;
    }
    const next = { ...entry.value, ...obj };
    const added = keys.filter(
      (k) => !Object.prototype.hasOwnProperty.call(entry.value, k)
    ).length;
    this._rewriteHash(key, entry, next);
    return added;
  }

  /** F285: hsetnx(key, field, value, ttl?) — Redis HSETNX parity.
 * Sets `field` only when it does NOT yet exist in the hash at `key`.
 * Returns 1 when set (field created, hash possibly created with `ttl`,
 * default this.defaultTTL), 0 when the field already existed — in which
 * case this is a strict no-op: value, TTL and LRU state untouched.
 * Falsy values (0, '', false, null) still occupy the NX slot. Non-string
 * field → TypeError; non-hash value at key → TypeError; rejected calls
 * create nothing. */
  hsetnx(key, field, value, ttl = this.defaultTTL) {
    if (typeof field !== 'string') {
      throw new TypeError('hsetnx: field must be a string');
    }
    const entry = this._liveHashEntry(key);
    if (!entry) {
      this.set(key, { [field]: value }, ttl);
      return 1;
    }
    if (Object.prototype.hasOwnProperty.call(entry.value, field)) {
      return 0;
    }
    this._rewriteHash(key, entry, { ...entry.value, [field]: value });
    return 1;
  }

  /** F286: hincrbyfloat(key, field, delta = 1) — Redis HINCRBYFLOAT parity.
 * Increments the float value at `field` by `delta` (IEEE754 double, no
 * decimal rounding — 0.1 + 0.2 yields 0.30000000000000004, Redis parity).
 * Missing key → hash created with {field: delta} (default TTL); missing
 * field → field set to delta. Current value must be a finite number or a
 * float-representable string (strtod analog: optional sign, digits with
 * optional fraction, optional exponent; hex/NaN/Inf strings rejected) —
 * else TypeError. Non-number or non-finite delta → TypeError. Result
 * beyond finite double range → RangeError with the hash unchanged.
 * Existing hashes keep their TTL. Returns the new value. */
  hincrbyfloat(key, field, delta = 1) {
    if (typeof field !== 'string') {
      throw new TypeError('hincrbyfloat: field must be a string');
    }
    if (typeof delta !== 'number' || !Number.isFinite(delta)) {
      throw new TypeError('hincrbyfloat: delta must be a finite number');
    }
    const FLOAT_STR = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;
    const entry = this._liveHashEntry(key);
    if (!entry) {
      this.set(key, { [field]: delta }, this.defaultTTL);
      return delta;
    }
    const hash = entry.value;
    let base = 0;
    if (Object.prototype.hasOwnProperty.call(hash, field)) {
      const cur = hash[field];
      if (typeof cur === 'number') {
        if (!Number.isFinite(cur)) {
          throw new TypeError(`hincrbyfloat: field '${field}' is not a float`);
        }
        base = cur;
      } else if (typeof cur === 'string' && FLOAT_STR.test(cur.trim())) {
        base = parseFloat(cur.trim());
      } else {
        throw new TypeError(`hincrbyfloat: field '${field}' is not a float`);
      }
    }
    const result = base + delta;
    if (!Number.isFinite(result)) {
      throw new RangeError(
        'hincrbyfloat: increment produces value beyond double range'
      );
    }
    this._rewriteHash(key, entry, { ...hash, [field]: result });
    return result;
  }

  /** F287: hstrlen(key, field) — Redis HSTRLEN parity.
   * String length of the value stored at field, in UTF-16 code units (the
   * JS analog of Redis byte-length). 0 for missing key or missing field.
   * Numeric/boolean values are coerced via String() (hgetall display parity).
   * Non-hash value at key → TypeError. Metadata-neutral read: no stats. */
  hstrlen(key, field) {
    if (typeof field !== 'string') {
      throw new TypeError('hstrlen: field must be a string');
    }
    const entry = this._liveHashEntry(key);
    if (!entry) return 0;
    if (!Object.prototype.hasOwnProperty.call(entry.value, field)) return 0;
    return String(entry.value[field]).length;
  }

  /** F288: hrandfield(key, [count[, withValues]]) — Redis HRANDFIELD parity.
   * No count → one random field name (undefined on missing/empty key, Redis
   * nil). count > 0 → distinct fields capped at hlen; count < 0 → |count|
   * draws with repetition allowed; count 0 → []. withValues → flat RESP2
   * shape [field, value, field, value, ...]. Missing key + count → [].
   * Non-hash value at key → TypeError. Metadata-neutral read: no stats. */
  hrandfield(key, count, withValues = false) {
    if (count !== undefined && (!Number.isInteger(count))) {
      throw new TypeError('hrandfield: count must be an integer');
    }
    const entry = this._liveHashEntry(key);
    if (!entry) {
      return count === undefined ? undefined : [];
    }
    const fields = Object.keys(entry.value);
    if (count === undefined) {
      return fields[Math.floor(Math.random() * fields.length)];
    }
    if (count === 0) return [];
    let picked;
    if (count > 0) {
      // Fisher-Yates partial shuffle: distinct fields, capped at hlen.
      const order = [...fields];
      const take = Math.min(count, order.length);
      for (let i = 0; i < take; i++) {
        const j = i + Math.floor(Math.random() * (order.length - i));
        [order[i], order[j]] = [order[j], order[i]];
      }
      picked = order.slice(0, take);
    } else {
      // Negative count: repetition allowed, |count| independent draws.
      picked = [];
      for (let i = 0; i < -count; i++) {
        picked.push(fields[Math.floor(Math.random() * fields.length)]);
      }
    }
    if (!withValues) return picked;
    const flat = [];
    for (const f of picked) {
      flat.push(f, entry.value[f]);
    }
    return flat;
  }

  /** F289: hscan(key, cursor, {match, count}) — Redis HSCAN parity.
   * Offset-based cursor: returns [nextCursor, [field, value, ...]] flat.
   * Round-trip pagination (cursor → 0) always yields the full (optionally
   * MATCH-filtered) hash in field insertion order. Cursor '0' as string marks
   * complete iteration (Redis wire shape). MATCH uses the codebase *
   * wildcard convention (deleteByPattern). count defaults to 10 (Redis
   * default); must be integer ≥ 1. Missing/expired key → ['0', []].
   * Non-hash value at key → TypeError. Metadata-neutral read: no stats. */
  hscan(key, cursor, { match, count = 10 } = {}) {
    if (!Number.isInteger(cursor) || cursor < 0) {
      throw new TypeError('hscan: cursor must be a non-negative integer');
    }
    if (!Number.isInteger(count) || count < 1) {
      throw new TypeError('hscan: count must be an integer >= 1');
    }
    const entry = this._liveHashEntry(key);
    if (!entry) return ['0', []];
    let fields = Object.keys(entry.value);
    if (match !== undefined) {
      if (typeof match !== 'string') {
        throw new TypeError('hscan: match must be a string pattern');
      }
      const regex = new RegExp('^' + match.split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
      fields = fields.filter((f) => regex.test(f));
    }
    const page = fields.slice(cursor, cursor + count);
    const nextCursor = cursor + count < fields.length ? cursor + count : 0;
    const flat = [];
    for (const f of page) {
      flat.push(f, entry.value[f]);
    }
    return [String(nextCursor), flat];
  }

  // ---------- F290+: Redis set family ----------

  /** Internal: live set entry for `key`, or null if missing/expired (expired
   * entries are purged like get()). Throws TypeError (WRONGTYPE analog) if
   * the stored value is not a JS Set — including plain objects (hashes) and
   * strings. No stats/LRU side effects. */
  _liveSetEntry(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.delete(key);
      return null;
    }
    if (!(entry.value instanceof Set)) {
      throw new TypeError(`s*: value at '${key}' is not a set`);
    }
    return entry;
  }

  /** F290: sadd(key, member, ttl?) — Redis SADD parity (single member,
   * mirroring hset's single-field signature). Adds `member` to the set at
   * `key`; creates the set when the key is missing or expired (using `ttl`,
   * default this.defaultTTL). Returns 1 when a new member was added, 0 when
   * it already existed. Existing sets keep their TTL (Redis SADD never
   * touches TTL). Copy-on-write: the stored Set is replaced, never mutated.
   * Non-string member → TypeError; non-set value at key → TypeError.
   * Note: Set-family keys are runtime-only values — not JSON-exportable via
   * exportJSON/dump (members would serialize as {}). */
  sadd(key, member, ttl = this.defaultTTL) {
    if (typeof member !== 'string') {
      throw new TypeError('sadd: member must be a string');
    }
    const entry = this._liveSetEntry(key);
    if (!entry) {
      this.set(key, new Set([member]), ttl);
      return 1;
    }
    const isNew = !entry.value.has(member);
    if (isNew) {
      const next = new Set(entry.value);
      next.add(member);
      this._rewriteHash(key, entry, next);
    }
    return isNew ? 1 : 0;
  }

  /** F291: srem(key, ...members) — Redis SREM parity.
   * Removes members from the set at `key`; returns how many were actually
   * removed (duplicate args count once — a member leaves at most once).
   * When the set becomes empty the key is deleted entirely (Redis: empty
   * set = key gone); a no-op removal (0 removed) leaves the key and its TTL
   * untouched. Partial removal preserves TTL. Missing key → 0.
   * Non-set → TypeError; non-string member → TypeError. */
  srem(key, ...members) {
    for (const m of members) {
      if (typeof m !== 'string') {
        throw new TypeError('srem: members must be strings');
      }
    }
    const entry = this._liveSetEntry(key);
    if (!entry) return 0;
    let removed = 0;
    const next = new Set(entry.value);
    for (const m of members) {
      if (next.delete(m)) removed++;
    }
    if (removed === 0) return 0;
    if (next.size === 0) {
      this.delete(key);
    } else {
      this._rewriteHash(key, entry, next);
    }
    return removed;
  }

  /** F292: smembers(key) — Redis SMEMBERS parity.
   * All members in insertion order; [] for a missing key. Returns a fresh
   * array (mutation-safe). Non-set → TypeError. */
  smembers(key) {
    const entry = this._liveSetEntry(key);
    if (!entry) return [];
    return [...entry.value];
  }

  /** F293: sismember(key, member) — Redis SISMEMBER parity (boolean shape,
   * matching hexists). True iff `member` is in the set; false for missing
   * key/absent member. Non-string member → false (writes reject non-strings,
   * so a non-string can never be a member). Non-set → TypeError. */
  sismember(key, member) {
    const entry = this._liveSetEntry(key);
    if (!entry) return false;
    return typeof member === 'string' && entry.value.has(member);
  }

  /** F294: scard(key) — Redis SCARD parity.
   * Number of members in the set at `key`; 0 for a missing key.
   * Non-set → TypeError. */
  scard(key) {
    const entry = this._liveSetEntry(key);
    if (!entry) return 0;
    return entry.value.size;
  }

  /** F295: smove(source, destination, member) — Redis SMOVE parity.
   * Moves `member` from the set at `source` to the set at `destination`.
   * Returns 1 on success; 0 when `member` is not in `source` (or `source` is
   * missing) — in that case `destination` is never created or modified.
   * On success: `source` emptied → key deleted (Redis parity); `destination`
   * created with defaultTTL when missing; existing `destination` keeps its
   * TTL. source === destination with member present → 1 (no-op move).
   * Non-set value at either key → TypeError; non-string member → TypeError. */
  smove(source, destination, member) {
    if (typeof member !== 'string') {
      throw new TypeError('smove: member must be a string');
    }
    const srcEntry = this._liveSetEntry(source);
    const dstEntry = this._liveSetEntry(destination);
    if (!srcEntry || !srcEntry.value.has(member)) return 0;
    if (destination === source) return 1; // no-op move: member stays, key untouched

    const srcNext = new Set(srcEntry.value);
    srcNext.delete(member);
    if (srcNext.size === 0) {
      this.delete(source);
    } else {
      this._rewriteHash(source, srcEntry, srcNext);
    }

    if (dstEntry) {
      const dstNext = new Set(dstEntry.value);
      dstNext.add(member);
      this._rewriteHash(destination, dstEntry, dstNext);
    } else {
      this.set(destination, new Set([member]), this.defaultTTL);
    }
    return 1;
  }

  /** Internal: read-only live set views for `keys` (arity-checked).
   * Each key resolves via _liveSetEntry: expired keys are purged and read
   * as empty, non-set values throw the WRONGTYPE-analog TypeError. */
  _setViewsFor(keys, op) {
    if (keys.length === 0) {
      throw new TypeError(`${op}: at least one key is required`);
    }
    return keys.map((k) => {
      const entry = this._liveSetEntry(k);
      return entry ? entry.value : null; // null = missing/expired → empty set
    });
  }

  /** F296: sinter(...keys) — Redis SINTER parity.
   * Members present in every listed set, in the first key's insertion
   * order. Missing/expired keys read as empty sets (so any missing key →
   * empty result). Read-only: no stats/LRU side effects beyond the
   * expired-purge in _liveSetEntry; returns a fresh array.
   * Non-set value at any key → TypeError; zero keys → TypeError
   * (Redis arity error analog). */
  sinter(...keys) {
    const views = this._setViewsFor(keys, 'sinter');
    const first = views[0];
    if (!first) return [];
    const rest = views.slice(1);
    const out = [];
    for (const member of first) {
      if (rest.every((s) => s === null ? false : s.has(member))) out.push(member);
    }
    return out;
  }

  /** F297: sunion(...keys) — Redis SUNION parity.
   * All unique members across the listed sets in first-seen order (earlier
   * keys' insertion order wins). Missing/expired keys contribute nothing;
   * all missing → []. Read-only; fresh array; non-set → TypeError;
   * zero keys → TypeError. */
  sunion(...keys) {
    const views = this._setViewsFor(keys, 'sunion');
    const seen = new Set();
    const out = [];
    for (const view of views) {
      if (!view) continue;
      for (const member of view) {
        if (!seen.has(member)) {
          seen.add(member);
          out.push(member);
        }
      }
    }
    return out;
  }

  /** F298: sdiff(key, ...keys) — Redis SDIFF parity.
   * Members of the first set not present in any of the others, in the
   * first set's insertion order. Missing/expired keys read as empty sets:
   * missing first key → [], missing others contribute nothing. Read-only
   * (unlike srem, an emptied result never deletes the key). Fresh array;
   * non-set → TypeError; zero keys → TypeError. */
  sdiff(key, ...keys) {
    if (key === undefined) {
      throw new TypeError('sdiff: at least one key is required');
    }
    const views = this._setViewsFor([key, ...keys], 'sdiff');
    const first = views[0];
    if (!first) return [];
    const rest = views.slice(1);
    const out = [];
    for (const member of first) {
      if (rest.every((s) => (s === null ? true : !s.has(member)))) out.push(member);
    }
    return out;
  }

  /** Internal: write a *store result into `destination` (Redis empty-result
   * parity: an empty result deletes the destination key; a non-empty result
   * overwrites whatever was there — any type — with a fresh Set at
   * defaultTTL, mirroring Redis's SET-semantics TTL reset). Returns the
   * result size for the S*STORE return value. */
  _setStoreResult(destination, members) {
    if (members.length === 0) {
      this.delete(destination);
    } else {
      this.set(destination, new Set(members), this.defaultTTL);
    }
    return members.length;
  }

  /** Internal: uniform random index into a pool of `len` items. The rng
   * contract is Math.random's ([0, 1)); a degenerate rng() === 1 is clamped
   * by % len so an out-of-range pick is structurally impossible. */
  _pickIndex(len, rng) {
    return Math.floor(rng() * len) % len;
  }

  /** F299: sinterstore(destination, ...keys) — Redis SINTERSTORE parity.
   * Computes sinter(...keys) and stores the result at `destination`,
   * overwriting any pre-existing value (any type — Redis *STORE treats
   * destination as SET semantics) with a fresh Set at defaultTTL. Empty
   * result → destination key deleted (Redis parity). Returns the result
   * size. Compute-then-store: destination may alias a source key. Source
   * semantics (missing → empty, non-set → TypeError, zero keys →
   * TypeError) inherited from sinter/_setViewsFor. */
  sinterstore(destination, ...keys) {
    if (typeof destination !== 'string') {
      throw new TypeError('sinterstore: destination key must be a string');
    }
    return this._setStoreResult(destination, this.sinter(...keys));
  }

  /** F300: sunionstore(destination, ...keys) — Redis SUNIONSTORE parity.
   * Same store semantics as sinterstore (overwrite / empty → delete /
   * defaultTTL / alias-safe); returns the union size. */
  sunionstore(destination, ...keys) {
    if (typeof destination !== 'string') {
      throw new TypeError('sunionstore: destination key must be a string');
    }
    return this._setStoreResult(destination, this.sunion(...keys));
  }

  /** F301: sdiffstore(destination, key, ...keys) — Redis SDIFFSTORE parity.
   * Same store semantics as sinterstore; returns the difference size.
   * Zero keys → TypeError (first source key mandatory, like sdiff). */
  sdiffstore(destination, key, ...keys) {
    if (typeof destination !== 'string') {
      throw new TypeError('sdiffstore: destination key must be a string');
    }
    return this._setStoreResult(destination, this.sdiff(key, ...keys));
  }

  /** F302: spop(key, count?, rng = Math.random) — Redis SPOP parity.
   * Removes and returns random members. Without count: one member or null
   * for a missing/empty key. With a non-negative integer count: an array
   * of min(count, size) distinct members (missing key → []). Popping the
   * set empty deletes the key (Redis parity); a partial pop preserves the
   * key's TTL (copy-on-write, like srem). count = 0 → [] (no-op). Negative
   * or non-integer count → TypeError. RNG hook: trailing `rng` parameter
   * (default Math.random) so tests can pin selection — see module notes. */
  spop(key, count, rng = Math.random) {
    const entry = this._liveSetEntry(key);
    if (!entry) return count === undefined ? null : [];
    if (count === undefined) {
      const member = [...entry.value][this._pickIndex(entry.value.size, rng)];
      this._spopMembers(key, entry, new Set([member]));
      return member;
    }
    if (!Number.isInteger(count) || count < 0) {
      throw new TypeError('spop: count must be a non-negative integer');
    }
    if (count === 0) return [];
    const pool = [...entry.value];
    const picked = [];
    for (let i = 0; i < count && pool.length > 0; i++) {
      picked.push(pool.splice(this._pickIndex(pool.length, rng), 1)[0]);
    }
    this._spopMembers(key, entry, new Set(picked));
    return picked;
  }

  /** Internal: copy-on-write removal of `picked` members for spop; the set
   * becoming empty deletes the key, a partial pop preserves TTL. */
  _spopMembers(key, entry, picked) {
    const next = new Set(entry.value);
    for (const m of picked) next.delete(m);
    if (next.size === 0) {
      this.delete(key);
    } else {
      this._rewriteHash(key, entry, next);
    }
  }

  /** F303: srandmember(key, count?, rng = Math.random) — Redis SRANDMEMBER
   * parity. Read-only random sampling. Without count: one member or null
   * (missing key). count > 0: up to count distinct members (never repeats,
   * capped at set size). count < 0: exactly |count| picks with replacement
   * — repeats allowed and may exceed set size (Redis semantics). count = 0
   * → []. No key mutation, no stats side effects. Non-integer count →
   * TypeError. RNG hook: same trailing-`rng` convention as spop. */
  srandmember(key, count, rng = Math.random) {
    const entry = this._liveSetEntry(key);
    if (count === undefined) {
      if (!entry) return null;
      const members = [...entry.value];
      return members[this._pickIndex(members.length, rng)];
    }
    if (!Number.isInteger(count)) {
      throw new TypeError('srandmember: count must be an integer');
    }
    if (count === 0 || !entry) return []; // -0 === 0: falls through naturally
    if (count > 0) {
      const pool = [...entry.value];
      const out = [];
      for (let i = 0; i < count && pool.length > 0; i++) {
        out.push(pool.splice(this._pickIndex(pool.length, rng), 1)[0]);
      }
      return out;
    }
    const members = [...entry.value];
    const out = [];
    for (let i = 0; i < -count; i++) {
      out.push(members[this._pickIndex(members.length, rng)]);
    }
    return out;
  }

  /** F273: touchLru(keys) — Redis TOUCH parity: refresh LRU recency (lastAccessed)))
   * for existing keys without reading their values. Returns the count of keys
   * that existed and were refreshed. Expired keys are purged (like get()) and
   * not counted; TTLs are untouched. Metadata op like peek: no hit/miss stats,
   * no watcher notifications. Accepts an array of keys.
   * (Named touchLru, not touch: F210 touch(key, ttl) extends TTL — different
   * axis; collision avoided per the F269 incrByInt naming lesson.) */
  touchLru(keys) {
    if (!Array.isArray(keys)) {
      throw new TypeError('touch: keys must be an array');
    }
    let touched = 0;
    for (const key of keys) {
      const entry = this.cache.get(key);
      if (!entry) continue;
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        this.delete(key); // purge, mirroring get()'s expired handling
        continue;
      }
      entry.lastAccessed = Date.now();
      touched++;
    }
    return touched;
  }

  /**
   * F139: renameKey(oldKey, newKey) — rename a cache key preserving value and TTL.
   * Returns true if renamed, false if oldKey doesn't exist.
   */
  renameKey(oldKey, newKey) {
    if (!this.cache.has(oldKey)) return false;
    const entry = this.cache.get(oldKey);
    this.cache.delete(oldKey);
    this.cache.set(newKey, entry);
    return true;
  }

  /**
   * F144: compute(key, computer, ttl) — atomically transform a value in-place.
   * computer receives current value (or undefined if missing), returns new value.
   * If computer returns undefined, the key is deleted.
   */
  compute(key, computer, ttl = this.defaultTTL) {
    const current = this.get(key);
    const result = computer(current);
    if (result === undefined) {
      this.delete(key);
    } else {
      this.set(key, result, ttl);
    }
    return result;
  }

  /**
   * F150: replace(key, value, ttl?) — Set only if key already exists (non-expired).
   * Returns old value if replaced, undefined if key was missing/expired.
   * @param {string} key
   * @param {*} value
   * @param {number} [ttl] - TTL in ms (default: this.defaultTTL)
   * @returns {*} old value or undefined
   */
  replace(key, value, ttl = this.defaultTTL) {
    if (!this.has(key)) return undefined;
    const old = this.get(key); // has() already confirmed existence, get() returns value
    this.set(key, value, ttl);
    return old;
  }

  /**
   * F151: retain(predicate) — Remove all non-expired entries that do NOT match the predicate.
   * Mutates the cache in-place. Returns count of removed entries.
   * @param {Function} predicate - (value, key) => boolean
   * @returns {number} count of removed entries
   */
  retain(predicate) {
    if (typeof predicate !== 'function') throw new TypeError('retain requires a predicate function');
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt && entry.expiresAt <= now) continue; // skip expired
      if (!predicate(entry.value, key)) {
        this.cache.delete(key);
        removed++;
      }
    }
    this.stats.size = this.cache.size;
    return removed;
  }

  /**
   * F153: withDefault(key, defaultValue)
   * Get value; if missing or expired, set and return defaultValue.
   * Unlike getOrSet, this always resets to default (not factory).
   */
  withDefault(key, defaultValue, ttl = this.defaultTTL) {
    const existing = this.get(key);
    if (existing !== undefined) return existing;
    this.set(key, defaultValue, ttl);
    return defaultValue;
  }

  /**
   * F154: incrBy(key, amount, opts)
   * Increment numeric value by arbitrary amount with optional min/max bounds.
   * If key doesn't exist, starts from 0.
   * Returns the new value after increment.
   */
  incrBy(key, amount, opts = {}) {
    if (typeof amount !== 'number' || !Number.isFinite(amount)) {
      throw new TypeError('incrBy: amount must be a finite number');
    }
    const { min, max, ttl = this.defaultTTL } = opts;
    const current = this.get(key);
    const base = typeof current === 'number' ? current : 0;
    let next = base + amount;
    if (typeof min === 'number') next = Math.max(min, next);
    if (typeof max === 'number') next = Math.min(max, next);
    this.set(key, next, ttl);
    return next;
  }

  /**
   * F159: touchMany(keys[], ttl?) — batch refresh TTL for multiple keys.
   * Only refreshes keys that exist and are non-expired.
   * Returns count of keys actually refreshed.
   */
  touchMany(keys, ttl) {
    if (!Array.isArray(keys)) {
      throw new TypeError('touchMany: keys must be an array');
    }
    const useTTL = ttl !== undefined ? ttl : this.defaultTTL;
    let refreshed = 0;
    for (const key of keys) {
      const entry = this.cache.get(key);
      if (!entry) continue;
      // Skip already-expired entries
      if (entry.expiresAt && Date.now() > entry.expiresAt) continue;
      entry.expiresAt = Date.now() + useTTL;
      entry.ttl = useTTL;
      refreshed++;
    }
    return refreshed;
  }

  /**
   * F164: rename(oldKey, newKey, opts?) — rename a key, preserving value and remaining TTL.
   * opts.keepOriginal: if true, keeps the old key too (copy semantics).
   * Returns true if renamed, false if old key doesn't exist.
   */
  rename(oldKey, newKey, opts = {}) {
    const { keepOriginal = false } = opts;
    const entry = this.cache.get(oldKey);
    if (!entry) return false;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.delete(oldKey);
      return false;
    }
    this.cache.set(newKey, { ...entry });
    if (!keepOriginal) this.cache.delete(oldKey);
    return true;
  }

  /**
   * F169: msetnx(entries, ttl?) — multiple set if not exist (atomic).
   * Sets all keys only if none of them already exist. Returns true if set, false if any exist.
   * If ttl provided, applies to all entries. Empty entries object returns true.
   */
  msetnx(entries, ttl) {
    // F169b (R76c): reject arrays — a pair-array used to slip past the typeof
    // check and silently land as junk key '0' (family convention: hmset F284).
    if (typeof entries !== 'object' || entries === null || Array.isArray(entries)) {
      throw new TypeError('msetnx: entries must be a plain object');
    }
    
    // Check if any key already exists
    for (const key of Object.keys(entries)) {
      if (this.has(key)) {
        return false;
      }
    }
    
    // All keys are safe to set
    const useTTL = ttl !== undefined ? ttl : this.defaultTTL;
    for (const [key, value] of Object.entries(entries)) {
      this.set(key, value, useTTL);
    }
    return true;
  }

  /**
   * F175: pop(key) — atomically get and delete. Returns value or undefined.
   */
  pop(key) {
    const value = this.get(key);
    if (value !== undefined) this.delete(key);
    return value;
  }

  /**
   * F181: getTTL(key) — return remaining TTL in ms (Redis PTTL semantics).
   * Returns -1 if key exists but has no expiry.
   * Returns -2 if key does not exist.
   */
  getTTL(key) {
    if (!this.cache.has(key)) return -2;
    const entry = this.cache.get(key);
    if (!entry.expiresAt) return -1;
    const remaining = entry.expiresAt - Date.now();
    return remaining > 0 ? remaining : -2;
  }

  /**
   * F178: mpop(keys[]) — batch pop. Returns object mapping key to value (misses omitted).
   */
  mpop(keys) {
    const result = {};
    for (const key of keys) {
      const val = this.pop(key);
      if (val !== undefined) result[key] = val;
    }
    return result;
  }

  /**
   * F184: serialize() — return a JSON-safe plain object of all non-expired entries.
   * Unlike snapshot(), this cleans non-serializable values (functions, symbols, undefined).
   */
  serialize() {
    const now = Date.now();
    const out = {};
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt && entry.expiresAt <= now) continue;
      out[key] = this._safeJSON(entry.value);
    }
    return out;
  }

  /**
   * Helper: make a value JSON-safe (recursive). Removes functions, symbols, undefined keys.
   */
  _safeJSON(value) {
    if (value === null || typeof value !== 'object') {
      if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'undefined') return null;
      return value;
    }
    if (Array.isArray(value)) {
      return value.map(v => this._safeJSON(v)).filter(v => v !== null || typeof value !== 'function');
    }
    const out = {};
    for (const k of Object.keys(value)) {
      if (typeof value[k] === 'function' || typeof value[k] === 'undefined') continue;
      out[k] = this._safeJSON(value[k]);
    }
    return out;
  }

  /**
   * F187: validate(key, schema) — validate cached value against a simple schema.
   * Schema: { type: 'object'|'array'|'string'|'number'|'boolean', required?: string[] }
   * Returns { valid: boolean, errors: string[] }
   */
  validate(key, schema) {
    const errors = [];
    const entry = this.get(key);
    if (entry === undefined) {
      return { valid: false, errors: ['Key not found or expired'] };
    }
    if (schema.type) {
      const actual = Array.isArray(entry) ? 'array' : typeof entry;
      if (actual !== schema.type) {
        errors.push(`Type mismatch: expected ${schema.type}, got ${actual}`);
      }
    }
    if (schema.required && typeof entry === 'object' && !Array.isArray(entry)) {
      for (const field of schema.required) {
        if (!(field in entry)) {
          errors.push(`Missing required field: ${field}`);
        }
      }
    }
    return { valid: errors.length === 0, errors };
  }

  /**
   * F188: countType() — count entries by their JS type.
   * Returns { object, array, string, number, boolean, other }
   */
  /**
   * F196: toggle(key, initial) — boolean toggle: flips truthy↔falsy, returns new value.
   * If key doesn't exist or is expired, sets to !initial (default initial=false → starts true).
   * Does not count as hit or miss. Evicts expired entry if found.
   */
  toggle(key, initial = false) {
    const entry = this.cache.get(key);
    let newVal;
    if (entry && !(entry.expiresAt && Date.now() > entry.expiresAt)) {
      newVal = !entry.value;
      entry.value = newVal;
      entry.lastAccessed = Date.now();
    } else {
      if (entry) this.delete(key); // expired
      if (this.cache.size >= this.maxSize) this.evictLRU();
      newVal = !initial;
      this.cache.set(key, {
        value: newVal,
        createdAt: Date.now(),
        lastAccessed: Date.now(),
        expiresAt: this.defaultTTL ? Date.now() + this.defaultTTL : null
      });
      this.stats.size = this.cache.size;
    }
    return newVal;
  }

  countType() {
    const counts = { object: 0, array: 0, string: 0, number: 0, boolean: 0, other: 0 };
    const now = Date.now();
    for (const [, entry] of this.cache) {
      if (entry.expiresAt && now > entry.expiresAt) continue;
      const t = Array.isArray(entry.value) ? 'array' : typeof entry.value;
      counts[t] = (counts[t] || 0) + 1;
    }
    return counts;
  }

  /**
   * F199: shift() — Evict and return the least-recently-used (oldest in insertion order)
   * non-expired entry. Returns undefined if cache is empty or all expired.
   * Increments eviction counter. Useful for manual eviction policies.
   * @returns {{ key: string, value: * } | undefined}
   */
  shift() {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.cache.delete(key);
        this.stats.size = this.cache.size;
        continue;
      }
      const value = entry.value;
      this.cache.delete(key);
      this.stats.size = this.cache.size;
      this.stats.evictions++;
      return { key, value };
    }
    return undefined;
  }

  /**
   * F201: Get value and refresh TTL in one atomic call.
   * Returns undefined if key missing/expired.
   * @param {string} key - Cache key
   * @param {number} ttl - New TTL in ms (default: refresh existing)
   * @returns {*} The value or undefined
   */
  getAndTouch(key, ttl) {
    const entry = this.cache.get(key);
    if (entry === undefined) {
      this.stats.misses++;
      return undefined;
    }
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.size = this.cache.size;
      this.stats.evictions++;
      this.stats.misses++;
      return undefined;
    }
    // Refresh TTL
    const newTTL = ttl !== undefined ? ttl : (entry.expiresAt ? entry.expiresAt - entry.createdAt : this.defaultTTL);
    if (newTTL > 0) {
      entry.expiresAt = Date.now() + newTTL;
    }
    entry.accessedAt = Date.now();
    // LRU: move to end
    this.cache.delete(key);
    this.cache.set(key, entry);
    this.stats.hits++;
    return entry.value;
  }

  /**
   * F210: touch(key, ttl?) — extend TTL of a key without fetching its value.
   * Companion to getAndTouch (which also returns the value) and touchMany.
   * Does not update LRU position or stats.
   * @param {string} key - Cache key
   * @param {number} [ttl] - New TTL in ms (default: refresh with defaultTTL)
   * @returns {boolean} true if key existed and was touched, false if missing/expired
   */
  touch(key, ttl) {
    const entry = this.cache.get(key);
    if (entry === undefined) return false;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.size = this.cache.size;
      this.stats.evictions++;
      return false;
    }
    const newTTL = ttl !== undefined ? ttl : this.defaultTTL;
    if (newTTL > 0) {
      entry.expiresAt = Date.now() + newTTL;
    }
    return true;
  }

  /**
   * F207: memo(fn, opts) — wrap a function with cache-backed memoization.
   * Cache keys are auto-generated from serialized args unless keyFn is provided.
   * @param {Function} fn - The function to memoize.
   * @param {object} [opts]
   * @param {Function} [opts.keyFn] - Custom key generator (receives ...args, returns string).
   * @param {number} [opts.ttl] - TTL in ms (defaults to cache defaultTTL).
   * @returns {Function} Memoized function with `.cache` property pointing to the Cache instance.
   */
  memo(fn, opts = {}) {
    const { keyFn, ttl = this.defaultTTL } = opts;
    const cacheInstance = this;
    const memoized = function (...args) {
      const key = keyFn ? keyFn(...args) : `memo:${JSON.stringify(args)}`;
      const existing = cacheInstance.get(key);
      if (existing !== undefined) return existing;
      const result = fn.apply(this, args);
      cacheInstance.set(key, result, ttl);
      return result;
    };
    memoized.cache = cacheInstance;
    return memoized;
  }

  /**
   * F212: mset(entries, ttl?) — batch set multiple key-value pairs (Redis MSET).
   * Accepts both object format {a:1, b:2} and array format [['a',1],['b',2]].
   * @param {Object|Array<[string, any]>} entries — key-value pairs to set
   * @param {number} [ttl] — optional TTL in ms applied to all entries
   * @returns {number} number of entries set
   */
  mset(entries, ttl = this.defaultTTL) {
    if (!entries || typeof entries !== 'object') return 0;
    let count = 0;
    if (Array.isArray(entries)) {
      for (const [key, value] of entries) {
        if (key === undefined || key === null) continue;
        this.set(key, value, ttl);
        count++;
      }
    } else {
      for (const [key, value] of Object.entries(entries)) {
        this.set(key, value, ttl);
        count++;
      }
    }
    return count;
  }

  /**
   * F215: mdelete(keys[]) — batch delete multiple keys (Redis DEL).
   * @param {string[]} keys — array of keys to delete
   * @returns {number} count of keys actually deleted (skips non-existent)
   */
  mdelete(keys) {
    if (!keys) return 0;
    // Accept both array format ['a','b'] and single string 'a'
    const keyList = Array.isArray(keys) ? keys : [keys];
    let count = 0;
    for (const key of keyList) {
      if (this.delete(key)) count++;
    }
    return count;
  }

  /**
   * F218: withExpiry(key, value, expiresAt) — set with absolute expiry timestamp.
   * Returns this for chaining. Thin wrapper over setWithExpiry.
   * @param {string} key
   * @param {*} value
   * @param {number} expiresAt — absolute epoch ms
   */
  withExpiry(key, value, expiresAt) {
    this.setWithExpiry(key, value, expiresAt);
    return this;
  }

  /**
   * F219: getEntries(pattern?) — return [key, entry-copy] pairs for non-expired entries.
   * Optional wildcard pattern filters keys (e.g. 'user:*').
   * @param {string} [pattern] — optional wildcard pattern
   * @returns {Array<[string, {value:*, createdAt:number, lastAccessed:number, expiresAt:number|null}]>}
   */
  getEntries(pattern) {
    const now = Date.now();
    const result = [];
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt && now > entry.expiresAt) continue;
      if (pattern) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
        if (!regex.test(key)) continue;
      }
      result.push([key, { ...entry }]);
    }
    return result;
  }

  /**
   * F220: size() — return number of non-expired entries currently in cache.
   * Differs from stats.size (which includes expired entries until cleanup).
   * @returns {number}
   */
  size() {
    let n = 0;
    const now = Date.now();
    for (const [, entry] of this.cache) {
      if (!entry.expiresAt || now <= entry.expiresAt) n++;
    }
    return n;
  }

  /**
   * F222: expireAll() — immediately expire all entries that have TTL.
   * Entries without TTL (null expiresAt) are kept. Returns count expired.
   * @returns {number} count of entries expired
   */
  expireAll() {
    let count = 0;
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt !== null) {
        this.cache.delete(key);
        count++;
      }
    }
    this.stats.size = this.cache.size;
    return count;
  }

  /**
   * F223: oldest() — return the key with the oldest lastAccessed time.
   * Excludes expired entries. Returns undefined for empty cache.
   * @returns {string|undefined}
   */
  oldest() {
    let oldestKey = undefined;
    let oldestTime = Infinity;
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt && now > entry.expiresAt) continue;
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }
    return oldestKey;
  }

  /**
   * F226: getOrThrow(key) — get value or throw if missing/expired.
   * Useful for required config values where absence is an error.
   * @param {string} key — cache key
   * @returns {*} cached value
   * @throws {Error} if key is missing or expired
   */
  getOrThrow(key) {
    const val = this.get(key);
    if (val === null || val === undefined) {
      throw new Error(`Cache key not found or expired: ${key}`);
    }
    return val;
  }

  /**
   * F229: count(predicate?) — count non-expired entries matching an optional predicate.
   * Without a predicate, returns count of all non-expired entries.
   * @param {(value: *, key: string) => boolean} [predicate] — filter function
   * @returns {number} count of matching non-expired entries
   */
  count(predicate) {
    const now = Date.now();
    let n = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) continue;
      if (!predicate || predicate(entry.value, key)) n++;
    }
    return n;
  }

  /**
   * F230: incrIfLess(key, max, delta=1) — conditional bounded increment.
   * Increments key by delta only if the resulting value would be ≤ max.
   * Returns true if incremented, false if current value + delta > max.
   * Creates the key with value=delta if it doesn't exist (and delta ≤ max).
   * @param {string} key — cache key
   * @param {number} max — upper bound (inclusive)
   * @param {number} [delta=1] — increment amount
   * @returns {boolean} true if increment succeeded
   */
  incrIfLess(key, max, delta = 1) {
    const current = this.get(key) || 0;
    if (typeof current !== 'number' || isNaN(current)) {
      throw new TypeError('Cannot incrIfLess on non-numeric value for key: ' + key);
    }
    if (current + delta > max) return false;
    this.set(key, current + delta);
    return true;
  }

  /**
   * F233: decrIfGreater(key, min, delta=1) — conditional bounded decrement.
   * Decrements key by delta only if the resulting value would be ≥ min.
   * Returns true if decremented, false if current value - delta < min.
   * Missing keys are treated as 0.
   * @param {string} key — cache key
   * @param {number} min — lower bound (inclusive)
   * @param {number} [delta=1] — decrement amount
   * @returns {boolean} true if decrement succeeded
   */
  decrIfGreater(key, min, delta = 1) {
    const current = this.get(key);
    const val = current === undefined ? 0 : current;
    if (typeof val !== 'number' || isNaN(val)) {
      throw new TypeError('Cannot decrIfGreater on non-numeric value for key: ' + key);
    }
    if (val - delta < min) return false;
    this.set(key, val - delta);
    return true;
  }

  /**
   * F245: deleteMany(keys) — batch delete (inverse of getMany).
   * Returns the number of keys actually deleted. Expired entries are
   * purged but not counted as deleted.
   * @param {string[]} keys
   * @returns {number}
   */
  deleteMany(keys) {
    if (!Array.isArray(keys)) throw new TypeError('deleteMany: keys must be an array');
    const now = Date.now();
    let deleted = 0;
    for (const key of keys) {
      const entry = this.cache.get(key);
      if (!entry) continue;
      if (entry.expiresAt !== null && entry.expiresAt !== undefined && entry.expiresAt <= now) {
        // expired: purge but do not count as deleted
        this.cache.delete(key);
        this.stats.size = this.cache.size;
        continue;
      }
      this.delete(key);
      deleted++;
    }
    return deleted;
  }
}

/**
 * Generate cache key from task configuration
 */
function generateTaskCacheKey(config) {
  const hash = require('crypto')
    .createHash('md5')
    .update(JSON.stringify({
      pattern: config.pattern,
      task: config.task,
      agents: config.agents.map(a => ({ name: a.name, role: a.role }))
    }))
    .digest('hex');
  
  return `task-${hash}`;
}

module.exports = { Cache, generateTaskCacheKey };
