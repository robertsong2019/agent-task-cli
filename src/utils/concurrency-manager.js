/**
 * Concurrency Manager - Controls parallel execution of agents
 * Prevents resource exhaustion and manages task queues
 */
class ConcurrencyManager {
  constructor(options = {}) {
    this.maxConcurrent = options.maxConcurrent || 5;
    this.activeCount = 0;
    this._activeIds = new Set();
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
    if (_taskId) this._activeIds.add(_taskId);
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
      if (_taskId) this._activeIds.delete(_taskId);
      
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
   * Get the number of pending tasks in the queue.
   * @returns {number}
   */
  get queueSize() {
    return this.queue.length;
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
   * Execute a function with concurrency control and per-task timeout
   * @param {Function} fn - Async function to execute
   * @param {number} ms - Timeout in milliseconds
   * @param {string} [taskId] - Optional task identifier
   * @returns {Promise}
   */
  async executeWithTimeout(fn, ms, taskId = null) {
    return this.execute(async () => {
      let timer;
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Task ${taskId || 'anonymous'} timed out after ${ms}ms`)), ms);
      });
      try {
        const result = await Promise.race([fn(), timeout]);
        return result;
      } finally {
        clearTimeout(timer);
      }
    }, taskId);
  }

  /**
   * Wait for all active tasks to complete
   */
  async drain() {
    while (this.activeCount > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /** Cancel a queued task by taskId. Returns true if found and cancelled. */
  cancelQueued(taskId) {
    const idx = this.queue.findIndex(item => item.taskId === taskId);
    if (idx === -1) return false;
    const [item] = this.queue.splice(idx, 1);
    item.reject(new Error(`Task ${taskId} cancelled`));
    return true;
  }

  /** F135: isIdle() — true when no tasks are running and queue is empty. */
  isIdle() {
    return this.activeCount === 0 && this.queue.length === 0;
  }

  /**
   * F198: awaitIdle(timeout?) — Promise that resolves true when all tasks complete
   * and queue empties. Returns false if timeout elapses without becoming idle.
   * @param {number} timeout - Max wait in ms (default: Infinity)
   * @returns {Promise<boolean>}
   */
  async awaitIdle(timeout) {
    if (this.isIdle()) return true;
    return new Promise((resolve) => {
      let settled = false;
      let interval = null;
      let timer = null;
      const finish = (val) => {
        if (settled) return;
        settled = true;
        if (interval) clearInterval(interval);
        if (timer) clearTimeout(timer);
        resolve(val);
      };
      interval = setInterval(() => {
        if (this.isIdle()) finish(true);
      }, 10);
      if (timeout !== undefined && timeout !== null) {
        timer = setTimeout(() => finish(false), timeout);
      }
    });
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

  /**
   * F191: getQueuedIds() — return task IDs of queued tasks (companion to activeTasks()).
   * Tasks without IDs are excluded.
   * @returns {string[]} queued task IDs
   */
  getQueuedIds() {
    return this.queue
      .filter(item => item.taskId != null)
      .map(item => item.taskId);
  }

  /**
   * F173: activeTasks() — return array of currently executing task IDs.
   * Tasks without IDs are excluded. Useful for monitoring and debugging.
   * @returns {string[]} active task IDs
   */
  activeTasks() {
    // activeCount tracks the number, but we don't store IDs explicitly.
    // We track them via a Set for O(1) add/remove.
    return Array.from(this._activeIds || []);
  }

  /**
   * F163: map(items, fn, opts?) — process array with concurrency limit.
   * Returns array of results in the same order as input items.
   * opts.stopOnError: if true (default false), rejects on first error and returns partial results.
   */
  async map(items, fn, opts = {}) {
    if (!Array.isArray(items)) throw new TypeError('map: items must be an array');
    const { stopOnError = false } = opts;
    const results = new Array(items.length);
    const errors = new Array(items.length);
    let index = 0;

    const worker = async () => {
      while (index < items.length) {
        const i = index++;
        try {
          results[i] = await fn(items[i], i);
        } catch (err) {
          if (stopOnError) throw err;
          errors[i] = err;
        }
      }
    };

    const workers = [];
    for (let i = 0; i < Math.min(this.maxConcurrent, items.length); i++) {
      workers.push(worker());
    }
    await Promise.all(workers);

    // If any errors and not stopOnError, attach them
    const hasErrors = errors.some(e => e !== undefined);
    if (hasErrors) {
      return { results, errors, partial: true };
    }
    return { results, errors: null, partial: false };
  }

  /**
   * F168: allSettled(items, fn, concurrency?) — like Promise.allSettled but with concurrency limit.
   * Returns array of { status: 'fulfilled'|'rejected', value, reason } objects.
   * Never rejects; handles all errors internally.
   */
  async allSettled(items, fn, concurrency) {
    if (!Array.isArray(items)) throw new TypeError('allSettled: items must be an array');
    if (typeof fn !== 'function') throw new TypeError('allSettled: fn must be a function');
    concurrency = concurrency || this.maxConcurrent;
    if (typeof concurrency !== 'number' || concurrency < 1) {
      throw new TypeError('allSettled: concurrency must be >= 1');
    }

    const results = new Array(items.length);
    const active = [];

    // Process items with concurrency control
    for (let i = 0; i < items.length; i += concurrency) {
      const chunk = items.slice(i, i + concurrency);
      const chunkPromises = chunk.map((item, idx) => {
        const globalIdx = i + idx;
        return Promise.resolve()
          .then(() => fn(item))
          .then(result => {
            results[globalIdx] = { status: 'fulfilled', value: result };
          })
          .catch(err => {
            results[globalIdx] = { status: 'rejected', reason: err };
          });
      });
      await Promise.all(chunkPromises);
    }

    return results;
  }

  /**
   * F187: mapSettled(items, fn, opts) — concurrency-limited map that never throws.
   * Returns { fulfilled: [{index, value}], rejected: [{index, reason}], summary: {total, passed, failed} }.
   */
  async mapSettled(items, fn, opts = {}) {
    if (!Array.isArray(items)) throw new TypeError('mapSettled: items must be an array');
    if (typeof fn !== 'function') throw new TypeError('mapSettled: fn must be a function');

    const raw = await this.allSettled(items, fn, opts.concurrency);
    const fulfilled = [];
    const rejected = [];

    for (let i = 0; i < raw.length; i++) {
      if (raw[i].status === 'fulfilled') {
        fulfilled.push({ index: i, value: raw[i].value });
      } else {
        rejected.push({ index: i, reason: raw[i].reason });
      }
    }

    return {
      fulfilled,
      rejected,
      summary: {
        total: raw.length,
        passed: fulfilled.length,
        failed: rejected.length,
      },
    };
  }

  /**
   * F188: withRetry(fn, retries, taskId?) — execute fn with automatic retry on failure.
   * Retries up to `retries` times. Throws last error if all retries exhausted.
   */
  async withRetry(fn, retries = 3, taskId = null) {
    if (typeof fn !== 'function') throw new TypeError('withRetry: fn must be a function');
    if (typeof retries !== 'number' || retries < 0) throw new TypeError('withRetry: retries must be >= 0');

    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await this.execute(fn, taskId);
      } catch (err) {
        lastError = err;
        if (attempt < retries) {
          // Brief delay before retry (exponential-ish)
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
  }
}

module.exports = { ConcurrencyManager };
