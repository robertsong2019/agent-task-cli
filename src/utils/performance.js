const { Logger } = require('./logger');

/**
 * Performance optimization utilities for the agent orchestrator
 * Includes caching, retry mechanisms, and performance monitoring
 */
class PerformanceManager {
  constructor(options = {}) {
    this.logger = new Logger();
    this.cache = new Map();
    this.prefixIndex = new Map(); // Cache prefix index for faster lookups
    this.metrics = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      retryCount: 0,
      executionTimes: []
    };
    this.options = {
      maxCacheSize: options.maxCacheSize || 100,
      cacheTTL: options.cacheTTL || 5 * 60 * 1000, // 5 minutes
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      ...options
    };
  }

  /**
   * Cache function results with TTL
   */
  async cachedExecute(key, fn, ...args) {
    const cacheKey = this._generateCacheKey(key, args);
    const now = Date.now();
    
    // Check cache
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (now - cached.timestamp < this.options.cacheTTL) {
        this.metrics.cacheHits++;
        this.logger.debug(`Cache hit for key: ${cacheKey}`);
        return cached.data;
      } else {
        // Expired cache entry
        this.cache.delete(cacheKey);
        this._removeFromPrefixIndex(cacheKey);
      }
    }
    
    // Cache miss - execute function
    this.metrics.cacheMisses++;
    this.metrics.totalRequests++;
    
    const startTime = Date.now();
    let result;
    let attempts = 0;
    
    while (attempts <= this.options.maxRetries) {
      try {
        result = await fn(...args);
        break;
      } catch (error) {
        attempts++;
        this.metrics.retryCount++;
        
        if (attempts > this.options.maxRetries) {
          throw error;
        }
        
        this.logger.warn(`Attempt ${attempts} failed for key: ${cacheKey}, retrying...`);
        await this._sleep(this.options.retryDelay * attempts);
      }
    }
    
    const endTime = Date.now();
    const executionTime = endTime - startTime;
    this.metrics.executionTimes.push(executionTime);
    
    // Cache the result
    this._addToCache(cacheKey, result, now);
    
    return result;
  }

  /**
   * Execute with timeout and performance monitoring
   */
  async executeWithTimeout(fn, timeout, context = '') {
    const startTime = Date.now();
    
    try {
      const result = await Promise.race([
        fn(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout)
        )
      ]);
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      this.logger.debug(`${context} completed in ${executionTime}ms`);
      
      return result;
    } catch (error) {
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      this.logger.error(`${context} failed after ${executionTime}ms:`, error);
      throw error;
    }
  }

  /**
   * Batch execute multiple agents with optimized resource usage
   */
  async batchExecute(agents, tasks, options = {}) {
    const batchSize = options.batchSize || 3;
    const concurrency = options.concurrency || batchSize;
    
    const results = [];
    
    for (let i = 0; i < agents.length; i += batchSize) {
      const batchAgents = agents.slice(i, i + batchSize);
      const batchTasks = tasks.slice(i, i + batchSize);
      
      const batchPromises = batchAgents.map(async (agent, index) => {
        return this.executeWithTimeout(
          () => agent.execute(batchTasks[index]),
          options.agentTimeout || 30000,
          `Agent ${agent.name}`
        );
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    return results;
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    const avgExecutionTime = this.metrics.executionTimes.length > 0
      ? this.metrics.executionTimes.reduce((a, b) => a + b, 0) / this.metrics.executionTimes.length
      : 0;
    
    const hitRate = this.metrics.totalRequests > 0
      ? (this.metrics.cacheHits / this.metrics.totalRequests) * 100
      : 0;
    
    return {
      ...this.metrics,
      avgExecutionTime: Math.round(avgExecutionTime),
      cacheHitRate: Math.round(hitRate * 100) / 100,
      cacheSize: this.cache.size,
      prefixIndexSize: this.prefixIndex.size,
      uptime: Date.now()
    };
  }

  /**
   * Get cached value by key (without args). Returns undefined if not found or expired.
   */
  getCached(key) {
    const prefix = key + ':';
    let candidates = this._getKeysByPrefix(prefix);
    if (candidates.length === 0) {
      // Index miss: entry may exist via direct cache writes that bypass the index.
      for (const k of this.cache.keys()) {
        if (k.startsWith(prefix)) candidates.push(k);
      }
    }
    const now = Date.now();
    let firstFresh;
    for (const k of candidates) {
      const entry = this.cache.get(k);
      if (!entry) continue; // stale index entry, ignore
      if (now - entry.timestamp < this.options.cacheTTL) {
        if (firstFresh === undefined) firstFresh = k;
      } else {
        // Lazily purge expired entries encountered during lookup.
        this.cache.delete(k);
        this._removeFromPrefixIndex(k);
      }
    }
    return firstFresh === undefined ? undefined : this.cache.get(firstFresh).data;
  }

  /**
   * Remove cached entries matching key prefix
   */
  invalidateCache(key) {
    const keysToDelete = this._getKeysByPrefix(key + ':');
    keysToDelete.forEach(k => {
      this.cache.delete(k);
      this._removeFromPrefixIndex(k);
    });
  }

  /**
   * Remove all cached entries whose key starts with prefix
   */
  invalidateCacheByPrefix(prefix) {
    const keysToDelete = this._getKeysByPrefix(prefix);
    keysToDelete.forEach(k => {
      this.cache.delete(k);
      this._removeFromPrefixIndex(k);
    });
  }

  /**
   * Clear cache and reset metrics
   */
  reset() {
    this.cache.clear();
    this.prefixIndex.clear();
    this.metrics = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      retryCount: 0,
      executionTimes: []
    };
  }

  /**
   * Generate cache key from function arguments
   */
  _generateCacheKey(key, args) {
    const serializedArgs = JSON.stringify(args);
    return `${key}:${this._hash(serializedArgs)}`;
  }

  /**
   * Add item to cache with size limit
   */
  _addToCache(key, data, timestamp) {
    // Simple LRU eviction
    if (this.cache.size >= this.options.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      this._removeFromPrefixIndex(firstKey);
    }
    
    this.cache.set(key, {
      data,
      timestamp
    });
    
    // Update prefix index
    this._addToPrefixIndex(key);
  }

  /**
   * Add key to prefix index
   */
  _addToPrefixIndex(key) {
    // Add the full key as a prefix (for exact matches)
    if (!this.prefixIndex.has(key)) {
      this.prefixIndex.set(key, new Set());
    }
    this.prefixIndex.get(key).add(key);
    
    // Extract all possible prefixes from the key
    const parts = key.split(':');
    // Add all intermediate prefixes (including base prefix without trailing colon)
    for (let i = 1; i < parts.length; i++) {
      const prefix = parts.slice(0, i).join(':');
      if (!this.prefixIndex.has(prefix)) {
        this.prefixIndex.set(prefix, new Set());
      }
      this.prefixIndex.get(prefix).add(key);
    }
    // Add prefix with colon for matching getCached and invalidateCache patterns
    const basePrefix = parts[0];
    if (!this.prefixIndex.has(basePrefix + ':')) {
      this.prefixIndex.set(basePrefix + ':', new Set());
    }
    this.prefixIndex.get(basePrefix + ':').add(key);
  }

  /**
   * Remove key from prefix index
   */
  _removeFromPrefixIndex(key) {
    // Full-key self-entry (registered by _addToPrefixIndex)
    if (this.prefixIndex.has(key)) {
      const keys = this.prefixIndex.get(key);
      keys.delete(key);
      if (keys.size === 0) {
        this.prefixIndex.delete(key);
      }
    }
    const parts = key.split(':');
    for (let i = 1; i < parts.length; i++) {
      const prefix = parts.slice(0, i).join(':');
      if (this.prefixIndex.has(prefix)) {
        const keys = this.prefixIndex.get(prefix);
        keys.delete(key);
        if (keys.size === 0) {
          this.prefixIndex.delete(prefix);
        }
      }
    }
    // Base prefix with colon (registered for getCached/invalidateCache matching)
    const basePrefix = parts[0] + ':';
    if (this.prefixIndex.has(basePrefix)) {
      const keys = this.prefixIndex.get(basePrefix);
      keys.delete(key);
      if (keys.size === 0) {
        this.prefixIndex.delete(basePrefix);
      }
    }
  }

  /**
   * Get keys matching prefix using index
   */
  _getKeysByPrefix(prefix) {
    if (this.prefixIndex.has(prefix)) {
      return Array.from(this.prefixIndex.get(prefix));
    }
    return [];
  }

  /**
   * Simple hash function
   */
  _hash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Sleep utility
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = PerformanceManager;