const { EventEmitter } = require('events');

/**
 * Global event bus for cross-task communication and monitoring.
 * Provides pub/sub for task lifecycle events, agent updates, and custom channels.
 */
class EventBus {
  constructor() {
    this._emitter = new EventEmitter();
    this._emitter.setMaxListeners(100);
    this._history = [];
    this._maxHistory = 1000;
    this._subscribers = new Map();
  }

  /**
   * Emit an event to the bus
   * @param {string} channel - Event channel (e.g., 'task:started', 'agent:completed')
   * @param {object} data - Event payload
   */
  emit(channel, data = {}) {
    const event = {
      channel,
      data,
      timestamp: Date.now(),
      id: `${channel}:${Date.now()}`
    };

    // Store in history (ring buffer)
    if (this._history.length >= this._maxHistory) {
      this._history.shift();
    }
    this._history.push(event);

    this._emitter.emit(channel, event);
    this._emitter.emit('*', event); // Wildcard listener
  }

  /**
   * Subscribe to events on a channel
   * @param {string} channel - Event channel or '*' for all events
   * @param {function} handler - Event handler
   * @returns {function} Unsubscribe function
   */
  on(channel, handler) {
    this._emitter.on(channel, handler);
    
    // Track subscriber for cleanup
    if (!this._subscribers.has(channel)) {
      this._subscribers.set(channel, new Set());
    }
    this._subscribers.get(channel).add(handler);

    // Return unsubscribe function
    return () => {
      this._emitter.off(channel, handler);
      const subs = this._subscribers.get(channel);
      if (subs) {
        subs.delete(handler);
        if (subs.size === 0) {
          this._subscribers.delete(channel);
        }
      }
    };
  }

  /**
   * Subscribe to multiple channels at once.
   * @param {string[]} channels - Array of event channels
   * @param {function} handler - Event handler (receives event)
   * @returns {function} Unsubscribe function (removes from all channels)
   */
  once(channel, handler) {
    const unsub = this.on(channel, (event) => {
      unsub();
      handler(event);
    });
    return unsub;
  }

  onBatch(channels, handler) {
    const unsubs = channels.map(ch => this.on(ch, handler));
    return () => unsubs.forEach(unsub => unsub());
  }

  /**
   * Subscribe to events matching a pattern (e.g., 'task:*')
   * @param {string} pattern - Glob-like pattern
   * @param {function} handler - Event handler
   * @returns {function} Unsubscribe function
   */
  onPattern(pattern, handler) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    const wrapper = (event) => {
      if (regex.test(event.channel)) {
        handler(event);
      }
    };
    this._emitter.on('*', wrapper);
    return () => this._emitter.off('*', wrapper);
  }

  /**
   * Wait for an event (promise-based)
   * @param {string} channel 
   * @param {number} timeoutMs - Timeout in milliseconds
   * @returns {Promise<object>} The event data
   */
  /**
   * Wait for a specific event with optional timeout
   * Uses `once` for cleaner subscription semantics.
   */
  waitFor(channel, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        unsub();
        reject(new Error(`Timeout waiting for event: ${channel}`));
      }, timeoutMs);

      const unsub = this.once(channel, (event) => {
        clearTimeout(timer);
        resolve(event);
      });
    });
  }

  /**
   * Get recent events from history
   * @param {object} options - Filter options
   * @param {string} options.channel - Filter by channel prefix
   * @param {number} options.limit - Max events to return
   * @param {number} options.since - Timestamp filter
   * @returns {Array<object>} Recent events
   */
  getHistory(options = {}) {
    let events = [...this._history];
    
    if (options.channel) {
      const prefix = options.channel;
      events = events.filter(e => e.channel.startsWith(prefix));
    }
    
    if (options.since) {
      events = events.filter(e => e.timestamp >= options.since);
    }

    if (options.limit) {
      events = events.slice(-options.limit);
    }

    return events;
  }

  /**
   * Get subscriber count for a channel
   * @param {string} channel 
   * @returns {number}
   */
  listenerCount(channel) {
    return this._emitter.listenerCount(channel);
  }

  /**
   * Emit an event after a delay. Returns a cancel function.
   * @param {number} delayMs - Delay in milliseconds
   * @param {string} channel - Event channel
   * @param {object} data - Event payload
   * @returns {function} Cancel function
   */
  emitAfter(delayMs, channel, data = {}) {
    const timer = setTimeout(() => this.emit(channel, data), delayMs);
    return () => clearTimeout(timer);
  }

  /**
   * Emit multiple events to the same channel efficiently.
   * Records a single summary entry in history.
   * @param {string} channel - Event channel
   * @param {Array} items - Array of data payloads
   * @returns {number} Number of events emitted
   */
  emitBatch(channel, items = []) {
    if (!Array.isArray(items) || items.length === 0) return 0;
    const batchId = `${channel}:batch:${Date.now()}`;
    let count = 0;
    for (const data of items) {
      const event = { channel, data, timestamp: Date.now(), id: `${channel}:${Date.now()}:${count}` };
      this._emitter.emit(channel, event);
      this._emitter.emit('*', event);
      count++;
    }
    // Single history entry for the batch
    if (this._history.length >= this._maxHistory) this._history.shift();
    this._history.push({
      channel,
      data: { batchId, count },
      timestamp: Date.now(),
      id: batchId
    });
    return count;
  }

  /**
   * Remove all subscribers for a specific channel
   * @param {string} channel - Channel to clear
   * @returns {number} Number of subscribers removed
   */
  removeChannel(channel) {
    const subs = this._subscribers.get(channel);
    const count = subs ? subs.size : 0;
    if (subs) {
      for (const handler of subs) {
        this._emitter.off(channel, handler);
      }
      this._subscribers.delete(channel);
    }
    return count;
  }

  /**
   * Clear all subscribers and history
   */
  reset() {
    this._emitter.removeAllListeners();
    this._subscribers.clear();
    this._history = [];
  }

  /**
   * Get all active channel names.
   * @returns {string[]}
   */
  channelNames() {
    return [...this._subscribers.keys()];
  }

  /**
   * Get bus stats
   * @returns {object}
   */
  getStats() {
    return {
      historySize: this._history.length,
      channels: [...this._subscribers.keys()],
      subscriberCount: [...this._subscribers.values()].reduce((sum, s) => sum + s.size, 0)
    };
  }
}

// Singleton instance
const globalBus = new EventBus();

module.exports = { EventBus, globalBus };
