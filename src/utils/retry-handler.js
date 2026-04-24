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
}

module.exports = { RetryHandler };
