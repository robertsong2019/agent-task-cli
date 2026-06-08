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
    // Run interceptors if any
    if (this._interceptors && this._interceptors.has(channel)) {
      for (const fn of this._interceptors.get(channel)) {
        const result = fn(data);
        if (result === false) return; // interceptor blocked
        if (result !== undefined) data = result;
      }
    }
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
   * Emit only if predicate returns true. Returns whether emitted.
   * @param {string} channel
   * @param {*} data
   * @param {function} predicate - (channel, data) => boolean
   * @returns {boolean}
   */
  emitIf(channel, data, predicate) {
    if (predicate(channel, data)) {
      this.emit(channel, data);
      return true;
    }
    return false;
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

  /**
   * Add a handler to the FRONT of the subscriber list for a channel.
   * It will be called before any handlers added via `on()`.
   * @param {string} channel - Event channel
   * @param {function} handler - Event handler
   * @returns {function} Unsubscribe function
   */
  prependListener(channel, handler) {
    // Use EventEmitter.prependListener for correct ordering
    this._emitter.prependListener(channel, handler);

    if (!this._subscribers.has(channel)) {
      this._subscribers.set(channel, new Set());
    }
    this._subscribers.get(channel).add(handler);

    return () => {
      this._emitter.off(channel, handler);
      const subs = this._subscribers.get(channel);
      if (subs) {
        subs.delete(handler);
        if (subs.size === 0) this._subscribers.delete(channel);
      }
    };
  }

  /** Subscribe to ALL events (global listener via '*' channel). */
  onAny(handler) {
    return this.on('*', handler);
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
   * Subscribe to events matching a wildcard pattern, auto-unsubscribe after first match.
   * @param {string} pattern - Wildcard pattern (e.g. 'task:*')
   * @param {function} handler - Event handler
   * @returns {function} Unsubscribe function (cancel before first match)
   */
  oncePattern(pattern, handler) {
    const unsub = this.onPattern(pattern, (event) => {
      unsub();
      handler(event);
    });
    return unsub;
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
  /**
   * Clear the event history buffer.
   * @returns {number} Number of history entries cleared
   */
  clearHistory() {
    const count = this._history.length;
    this._history = [];
    return count;
  }

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
   * Get subscriber count for a specific channel.
   * @param {string} channel
   * @returns {number}
   */
  subscriberCount(channel) {
    const subs = this._subscribers.get(channel);
    return subs ? subs.size : 0;
  }

  /**
   * Wait for an event matching a glob pattern (promise-based).
   * @param {string} pattern - Glob pattern (e.g., 'task:*')
   * @param {number} timeoutMs - Timeout in milliseconds (default 30s)
   * @returns {Promise<object>} The matched event
   */
  waitForPattern(pattern, timeoutMs = 30000) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        unsub();
        reject(new Error(`Timeout waiting for pattern: ${pattern}`));
      }, timeoutMs);
      const unsub = this.onPattern(pattern, (event) => {
        clearTimeout(timer);
        unsub();
        resolve(event);
      });
    });
  }

  /**
   * Get all active channel names.
   * @returns {string[]}
   */
  channelNames() {
    return [...this._subscribers.keys()];
  }

  /**
   * Return the last emitted event for a given channel, or null.
   * @param {string} channel
   * @returns {object|null}
   */
  peek(channel) {
    for (let i = this._history.length - 1; i >= 0; i--) {
      if (this._history[i].channel === channel) return this._history[i];
    }
    return null;
  }

  /**
   * Emit an event and wait for all async handlers to resolve.
   * Sync handlers are called normally; async handlers (returning Promises) are awaited.
   * @param {string} channel - Event channel
   * @param {object} data - Event payload
   * @returns {Promise<{event: object, results: Array}>} Event and handler results
   */
  async emitAsync(channel, data = {}) {
    const event = {
      channel,
      data,
      timestamp: Date.now(),
      id: `${channel}:${Date.now()}`
    };

    if (this._history.length >= this._maxHistory) this._history.shift();
    this._history.push(event);

    // Collect handler results from both channel-specific and wildcard listeners
    const listeners = [
      ...this._emitter.listeners(channel),
      ...this._emitter.listeners('*')
    ];

    const results = await Promise.all(
      listeners.map(fn => {
        try {
          return fn(event);
        } catch (err) {
          return undefined;
        }
      })
    );

    return { event, results };
  }

  /**
   * Create a throttled emit function for a channel.
   * Ensures at most one emission per `intervalMs`, dropping intermediate calls.
   * @param {string} channel - Event channel
   * @param {number} intervalMs - Minimum interval between emissions in ms
   * @returns {function} Throttled emit function `(data) => boolean`
   */
  throttle(channel, intervalMs) {
    let lastEmit = 0;
    return (data) => {
      const now = Date.now();
      if (now - lastEmit < intervalMs) return false;
      lastEmit = now;
      this.emit(channel, data);
      return true;
    };
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
  /** F99: channelStats() — per-channel subscriber count + event count from history. */
  channelStats() {
    const stats = {};
    for (const [ch, subs] of this._subscribers) {
      stats[ch] = { subscribers: subs.size, events: 0 };
    }
    for (const evt of this._history) {
      if (!stats[evt.channel]) stats[evt.channel] = { subscribers: 0, events: 0 };
      stats[evt.channel].events++;
    }
    return stats;
  }

  /** F77: Emit event and wait for all async handlers to complete. Returns handler results. */
  async emitAndWait(channel, data, timeoutMs) {
    const subs = this._subscribers.get(channel);
    if (!subs || subs.size === 0) return [];
    const promises = [...subs].map(handler => {
      const result = handler(data);
      return Promise.resolve(result);
    });
    if (timeoutMs) {
      const results = await Promise.all(promises.map(p =>
        Promise.race([
          p,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Handler timeout')), timeoutMs))
        ])
      ));
      return results;
    }
    return Promise.all(promises);
  }

  /** F75: Unsubscribe a specific handler from a channel. Returns true if removed. */
  off(channel, handler) {
    const subs = this._subscribers.get(channel);
    if (!subs) return false;
    const deleted = subs.delete(handler);
    if (deleted) this._emitter.off(channel, handler);
    if (subs.size === 0) this._subscribers.delete(channel);
    return deleted;
  }

  /** F84: Debounced emit — coalesce rapid emits, only fire last one after delay. Returns cancel fn. */
  emitDebounced(channel, data, delayMs = 100) {
    if (!this._debounceTimers) this._debounceTimers = new Map();
    const key = channel;
    if (this._debounceTimers.has(key)) {
      clearTimeout(this._debounceTimers.get(key));
    }
    const timer = setTimeout(() => {
      this._debounceTimers.delete(key);
      this.emit(channel, data);
    }, delayMs);
    this._debounceTimers.set(key, timer);
    return () => {
      clearTimeout(timer);
      this._debounceTimers.delete(key);
    };
  }

  /** F80: Pipe — forward events from one channel to another EventBus. Returns unsubscribe fn. */
  pipe(sourceChannel, targetBus, targetChannel) {
    const dest = targetChannel || sourceChannel;
    const handler = (evt) => targetBus.emit(dest, evt.data);
    this.on(sourceChannel, handler);
    return () => this.off(sourceChannel, handler);
  }

  /** F89: removeAllListeners(channel?) — remove all listeners for a channel, or all channels if omitted. Returns count removed. */
  removeAllListeners(channel) {
    if (channel !== undefined) {
      const subs = this._subscribers.get(channel);
      if (!subs) return 0;
      const count = subs.size;
      if (this._emitter) {
        for (const h of subs) this._emitter.off(channel, h);
      }
      subs.clear();
      this._subscribers.delete(channel);
      return count;
    }
    // Remove all
    let total = 0;
    for (const [ch, subs] of this._subscribers) {
      total += subs.size;
      if (this._emitter) {
        for (const h of subs) this._emitter.off(ch, h);
      }
      subs.clear();
    }
    this._subscribers.clear();
    return total;
  }

  /** F94: intercept(channel, fn) — add interceptor called before subscribers; fn(data) => data|false. Return removeFn. */
  intercept(channel, fn) {
    if (!this._interceptors) this._interceptors = new Map();
    if (!this._interceptors.has(channel)) this._interceptors.set(channel, []);
    const list = this._interceptors.get(channel);
    list.push(fn);
    return () => {
      const idx = list.indexOf(fn);
      if (idx !== -1) list.splice(idx, 1);
    };
  }

  // Override emit to run interceptors
  _emitOriginal = EventBus.prototype.emit;

  // Patch emit to support interceptors (done in constructor below via _patchEmit)

  /** F92: onceAsync(event, timeout) — promise-based once() that resolves with [args], rejects on timeout. */
  onceAsync(event, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.off(event, handler);
        reject(new Error(`onceAsync timeout for event "${event}"`));
      }, timeout);
      const handler = (...args) => {
        clearTimeout(timer);
        resolve(args);
      };
      this.on(event, handler);
    });
  }
  /** F102: relay(source, targetBus, filter?) — forward events matching filter predicate to target bus. Returns unsubscribe fn. */
  relay(source, targetBus, filter) {
    const handler = (event) => {
      if (!filter || filter(event.data)) {
        targetBus.emit(source, event.data);
      }
    };
    this._emitter.on(source, handler);
    return () => this._emitter.off(source, handler);
  }


  /** F108: race(channels[], timeout?) — Promise.race across multiple channels. Resolves with { channel, data }. Rejects on timeout.
   */
  race(channels, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timers = [];
      const handlers = [];
      const cleanup = () => {
        timers.forEach(t => clearTimeout(t));
        handlers.forEach(({ ch, fn }) => this._emitter.off(ch, fn));
      };
      if (timeout > 0) {
        const timer = setTimeout(() => {
          cleanup();
          reject(new Error('race timeout waiting for channels: ' + channels.join(', ')));
        }, timeout);
        timers.push(timer);
      }
      for (const ch of channels) {
        const fn = (event) => {
          cleanup();
          resolve({ channel: ch, data: event.data });
        };
        handlers.push({ ch, fn });
        this._emitter.on(ch, fn);
      }
    });
  }

  /** F114: sample(channel, intervalMs, handler) — subscribe to a channel but only fire at most once per interval window (first event wins, rest are dropped until window resets). Returns unsubscribe function. */
  sample(channel, intervalMs, handler) {
    let lastFired = 0;
    const wrapper = (event) => {
      const now = Date.now();
      if (now - lastFired >= intervalMs) {
        lastFired = now;
        handler(event);
      }
    };
    this.on(channel, wrapper);
    return () => this.off(channel, wrapper);
  }

  /** F104: eventNames()() — return array of unique channel names that have at least one event in history. */
  eventNames() {
    if (!this._history || this._history.length === 0) return [];
    return [...new Set(this._history.map(e => e.channel))];
  }

  /** F111: emitMany(events) — batch emit [{ channel, data }, ...] across multiple channels with a single consolidated history entry. Returns count emitted. */
  emitMany(events) {
    if (!Array.isArray(events)) throw new Error('emitMany: events must be an array');
    let count = 0;
    const batchEvent = {
      channel: '__batch__',
      data: { count: events.length, channels: [] },
      timestamp: Date.now(),
      id: `__batch__:${Date.now()}`
    };
    for (const { channel, data = {} } of events) {
      if (!channel || typeof channel !== 'string') continue;
      let effectiveData = data;
      let blocked = false;
      if (this._interceptors && this._interceptors.has(channel)) {
        for (const fn of this._interceptors.get(channel)) {
          const result = fn(effectiveData);
          if (result === false) { blocked = true; break; }
          if (result !== undefined) effectiveData = result;
        }
      }
      if (blocked) continue;
      const event = { channel, data: effectiveData, timestamp: Date.now(), id: `${channel}:${Date.now()}` };
      this._emitter.emit(channel, event);
      this._emitter.emit('*', event);
      batchEvent.data.channels.push(channel);
      count++;
    }
    if (this._history.length >= this._maxHistory) this._history.shift();
    this._history.push(batchEvent);
    return count;
  }

  /** F118: last(channel, n?) — return last N events from history for a specific channel. Defaults to 1. */
  last(channel, n = 1) {
    const filtered = this._history.filter(e => e.channel === channel);
    return filtered.slice(-n);
  }
}

// Singleton instance
const globalBus = new EventBus();

module.exports = { EventBus, globalBus };
