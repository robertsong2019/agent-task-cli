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
