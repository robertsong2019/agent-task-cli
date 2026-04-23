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
    
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Clean every minute
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
   * Destroy cache and cleanup interval
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
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
