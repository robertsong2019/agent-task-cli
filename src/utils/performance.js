const { Logger } = require('./logger');

/**
 * Performance optimization utilities for the agent orchestrator
 * Includes caching, retry mechanisms, and performance monitoring
 */
class PerformanceManager {
  constructor(options = {}) {
    this.logger = new Logger();
    this.cache = new Map();
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
      uptime: Date.now()
    };
  }

  /**
   * Clear cache and reset metrics
   */
  reset() {
    this.cache.clear();
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
    }
    
    this.cache.set(key, {
      data,
      timestamp
    });
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