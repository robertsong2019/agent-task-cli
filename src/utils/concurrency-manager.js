/**
 * Concurrency Manager - Controls parallel execution of agents
 * Prevents resource exhaustion and manages task queues
 */
class ConcurrencyManager {
  constructor(options = {}) {
    this.maxConcurrent = options.maxConcurrent || 5;
    this.activeCount = 0;
    this.queue = [];
    this.stats = {
      totalExecuted: 0,
      totalQueued: 0,
      avgWaitTime: 0,
      peakConcurrency: 0
    };
  }

  /**
   * Execute a function with concurrency control
   * @param {Function} fn - Async function to execute
   * @param {string} taskId - Optional task identifier
   * @returns {Promise} - Result of the function
   */
  async execute(fn, taskId = null) {
    // If at capacity, queue the task
    if (this.activeCount >= this.maxConcurrent) {
      return new Promise((resolve, reject) => {
        const queuedAt = Date.now();
        this.stats.totalQueued++;
        
        this.queue.push({
          fn,
          taskId,
          queuedAt,
          resolve,
          reject
        });
      });
    }

    // Execute immediately
    return this._runTask(fn, taskId);
  }

  /**
   * Run a task with proper tracking
   */
  async _runTask(fn, _taskId) {
    this.activeCount++;
    this.stats.totalExecuted++;
    this.stats.peakConcurrency = Math.max(
      this.stats.peakConcurrency,
      this.activeCount
    );

    try {
      const result = await fn();
      return result;
    } finally {
      this.activeCount--;
      
      // Process next queued task
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        
        // Track wait time
        const waitTime = Date.now() - next.queuedAt;
        this._updateAvgWaitTime(waitTime);
        
        // Execute next task
        this._runTask(next.fn, next.taskId)
          .then(next.resolve)
          .catch(next.reject);
      }
    }
  }

  /**
   * Update average wait time using rolling average
   */
  _updateAvgWaitTime(waitTime) {
    const alpha = 0.1; // Smoothing factor
    if (this.stats.avgWaitTime === 0) {
      this.stats.avgWaitTime = waitTime;
    } else {
      this.stats.avgWaitTime = alpha * waitTime + (1 - alpha) * this.stats.avgWaitTime;
    }
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      activeCount: this.activeCount,
      queuedCount: this.queue.length,
      availableSlots: Math.max(0, this.maxConcurrent - this.activeCount),
      stats: { ...this.stats }
    };
  }

  /**
   * Clear the queue (rejects all queued tasks)
   */
  clearQueue() {
    const count = this.queue.length;
    this.queue.forEach(item => {
      item.reject(new Error('Queue cleared'));
    });
    this.queue = [];
    return count;
  }

  /**
   * Wait for all active tasks to complete
   */
  async drain() {
    while (this.activeCount > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Update max concurrent limit
   */
  setMaxConcurrent(max) {
    this.maxConcurrent = max;
    
    // If we increased the limit, process queued tasks
    while (this.activeCount < this.maxConcurrent && this.queue.length > 0) {
      const next = this.queue.shift();
      this._runTask(next.fn, next.taskId)
        .then(next.resolve)
        .catch(next.reject);
    }
  }
}

module.exports = { ConcurrencyManager };
