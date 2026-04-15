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
   * One-time subscription
   * @param {string} channel 
   * @param {function} handler 
   * @returns {function} Unsubscribe function
   */
  once(channel, handler) {
    this._emitter.once(channel, handler);
    return () => this._emitter.off(channel, handler);
  }

  /**
   * Wait for an event (promise-based)
   * @param {string} channel 
   * @param {number} timeoutMs - Timeout in milliseconds
   * @returns {Promise<object>} The event data
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
   * Clear all subscribers and history
   */
  reset() {
    this._emitter.removeAllListeners();
    this._subscribers.clear();
    this._history = [];
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
