/**
 * Cache - Simple in-memory cache with TTL support
 */
class Cache {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 100;
    this.defaultTTL = options.defaultTTL || 3600000; // 1 hour
    this.cache = new Map();
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
   * Stop the cleanup interval and release resources.
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
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
   * Check if a key exists in cache without affecting stats
   * @param {string} key
   * @returns {boolean}
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
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.size = this.cache.size;
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
   * Get cache keys
   */
  keys() {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache size
   */
  size() {
    return this.cache.size;
  }

  /**
   * Get multiple values at once
   * @param {string[]} keys - Cache keys
   * @returns {object} Key-value map (missing keys omitted)
   */
  async getOrSet(key, factory, ttl = this.defaultTTL) {
    const existing = this.get(key);
    if (existing !== undefined) return existing;
    const value = typeof factory === 'function' ? await factory() : factory;
    this.set(key, value, ttl);
    return value;
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
  mset(entries, ttl = this.defaultTTL) {
    for (const [key, value] of Object.entries(entries)) {
      this.set(key, value, ttl);
    }
  }

  /**
   * Delete multiple keys at once
   * @param {string[]} keys - Cache keys
   * @returns {number} Number of keys actually deleted
   */
  mdelete(keys) {
    let deleted = 0;
    for (const key of keys) {
      if (this.delete(key)) deleted++;
    }
    return deleted;
  }

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
   * Refresh TTL on an existing key without changing its value.
   * @param {string} key - Cache key
   * @param {number} [newTTL] - New TTL in ms (defaults to this.defaultTTL)
   * @returns {boolean} true if key existed and was refreshed
   */
  touch(key, newTTL) {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.delete(key);
      return false;
    }
    const ttl = newTTL != null ? newTTL : this.defaultTTL;
    entry.expiresAt = ttl ? Date.now() + ttl : null;
    entry.lastAccessed = Date.now();
    return true;
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
   * Rename a key, preserving its value and TTL.
   * @param {string} oldKey
   * @param {string} newKey
   * @returns {boolean} true if renamed, false if oldKey not found/expired
   */
  rename(oldKey, newKey) {
    const entry = this.cache.get(oldKey);
    if (!entry) return false;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.delete(oldKey);
      return false;
    }
    this.cache.delete(oldKey);
    this.cache.set(newKey, entry);
    return true;
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

  /** F79: Swap — set new value and return old value (undefined if key didn't exist). */
  swap(key, value, ttl = this.defaultTTL) {
    const old = this.get(key);
    this.set(key, value, ttl);
    return old;
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

  /** F97: expire(key, ttl) — set new TTL on an existing key. Returns true if key existed and was updated. */
  expire(key, ttl) {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.delete(key);
      return false;
    }
    entry.expiresAt = ttl ? Date.now() + ttl : null;
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
}

/**
 * Generate cache key from task configuration
 */

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
