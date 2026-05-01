/**
 * Retry Handler - Implements exponential backoff retry logic
 */
class RetryHandler {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 1000; // 1 second
    this.maxDelay = options.maxDelay || 30000; // 30 seconds
    this.backoffFactor = options.backoffFactor || 2;
    this.retryableErrors = options.retryableErrors || [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'EAI_AGAIN',
      'rate limit',
      'timeout',
      '503',
      '502',
      '500'
    ];
    
    this.stats = {
      totalRetries: 0,
      successfulRetries: 0,
      failedAfterRetries: 0,
      avgRetryDelay: 0
    };
  }

  /**
   * Execute a function with retry logic
   * @param {Function} fn - Async function to execute
   * @param {Object} options - Execution options
   * @returns {Promise} - Result of the function
   */
  async executeUntil(fn, { maxRetries = this.maxRetries, validate = (r) => !!r } = {}) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const result = await fn();
      if (validate(result)) return result;
      if (attempt < maxRetries) {
        const delay = this.calculateDelay(attempt);
        await new Promise(r => setTimeout(r, delay));
      }
    }
    return null;
  }

  async execute(fn, options = {}) {
    const maxRetries = options.maxRetries ?? this.maxRetries;
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await fn();
        return result;
      } catch (error) {
        lastError = error;
        
        // Check if error is retryable
        if (!this.isRetryable(error)) {
          throw error;
        }
        
        // Don't retry if this was the last attempt
        if (attempt === maxRetries) {
          this.stats.failedAfterRetries++;
          throw error;
        }
        
        // Calculate delay with exponential backoff
        const delay = this.calculateDelay(attempt);
        this.stats.totalRetries++;
        this._updateAvgRetryDelay(delay);
        
        // Wait before retrying
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }

  /**
   * Check if an error is retryable
   */
  isRetryable(error) {
    const errorString = error.message.toLowerCase();
    return this.retryableErrors.some(retryableError => 
      errorString.includes(retryableError.toLowerCase())
    );
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  calculateDelay(attempt) {
    const exponentialDelay = this.baseDelay * Math.pow(this.backoffFactor, attempt);
    const cappedDelay = Math.min(exponentialDelay, this.maxDelay);
    
    // Add jitter (±25%) to prevent thundering herd
    const jitter = cappedDelay * 0.25 * (Math.random() * 2 - 1);
    const delayWithJitter = cappedDelay + jitter;
    
    return Math.round(delayWithJitter);
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Update average retry delay
   */
  _updateAvgRetryDelay(delay) {
    const alpha = 0.2;
    if (this.stats.avgRetryDelay === 0) {
      this.stats.avgRetryDelay = delay;
    } else {
      this.stats.avgRetryDelay = alpha * delay + (1 - alpha) * this.stats.avgRetryDelay;
    }
  }

  /**
   * Convenience method: execute fn with exponential backoff.
   * @param {Function} fn - Async function to execute
   * @param {object} [options] - Options
   * @param {number} [options.maxRetries] - Max retries (default: from constructor)
   * @param {number} [options.baseDelay] - Base delay ms (default: from constructor)
   * @param {Function} [options.onRetry] - Callback(attempt, error) before each retry
   * @returns {Promise<*>} Result of fn()
   */
  async withBackoff(fn, options = {}) {
    const maxRetries = options.maxRetries ?? this.maxRetries;
    const baseDelay = options.baseDelay ?? this.baseDelay;
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          const delay = Math.min(baseDelay * Math.pow(this.backoffFactor, attempt), this.maxDelay);
          if (options.onRetry) options.onRetry(attempt + 1, error);
          await this.sleep(delay);
        }
      }
    }
    throw lastError;
  }

  /**
   * Get retry statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Mark a retry as successful (call this after successful retry)
   */
  markSuccessfulRetry() {
    this.stats.successfulRetries++;
  }
  /**
   * Circuit breaker pattern: track failures and short-circuit when threshold is reached.
   * @param {Function} fn - Async function to execute
   * @param {object} [opts]
   * @param {number} [opts.failureThreshold=5] - Failures before opening circuit
   * @param {number} [opts.resetTimeoutMs=30000] - Time before trying again (half-open)
   * @returns {Promise<*>} Result of fn()
   */
  async withCircuitBreaker(fn, opts = {}) {
    if (!this._circuitBreaker) {
      this._circuitBreaker = { failures: 0, state: 'closed', openedAt: 0 };
    }
    const cb = this._circuitBreaker;
    const failureThreshold = opts.failureThreshold ?? 5;
    const resetTimeoutMs = opts.resetTimeoutMs ?? 30000;

    // Check if circuit should half-open
    if (cb.state === 'open' && Date.now() - cb.openedAt >= resetTimeoutMs) {
      cb.state = 'half-open';
    }

    if (cb.state === 'open') {
      throw new Error('Circuit breaker is open');
    }

    try {
      const result = await fn();
      // Success: reset
      cb.failures = 0;
      cb.state = 'closed';
      return result;
    } catch (error) {
      cb.failures++;
      if (cb.failures >= failureThreshold) {
        cb.state = 'open';
        cb.openedAt = Date.now();
      }
      throw error;
    }
  }
}

module.exports = { RetryHandler };
