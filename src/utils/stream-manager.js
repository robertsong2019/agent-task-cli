/**
 * Stream Manager - Handles streaming responses from agents
 * Provides real-time output via SSE, callbacks, and async iterators
 */

const { EventEmitter } = require('events');

class StreamManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.streams = new Map();
    this.maxBufferSize = options.maxBufferSize || 1024 * 1024; // 1MB
    this.throttleMs = options.throttleMs || 16; // ~60fps
  }

  /**
   * Create a new stream for a task
   */
  createStream(taskId) {
    const stream = {
      id: taskId,
      buffer: '',
      chunks: [],
      startedAt: Date.now(),
      completed: false,
      error: null,
      listeners: new Set()
    };
    this.streams.set(taskId, stream);
    this.emit('stream:created', { taskId });
    return stream;
  }

  /**
   * Append data to a stream
   */
  append(taskId, data) {
    const stream = this.streams.get(taskId);
    if (!stream || stream.completed) return;

    stream.buffer += data;
    stream.chunks.push({ data, timestamp: Date.now() });

    // Enforce buffer limit
    if (stream.buffer.length > this.maxBufferSize) {
      stream.buffer = stream.buffer.slice(-Math.floor(this.maxBufferSize / 2));
    }

    this.emit('stream:data', { taskId, data });
    
    // Notify all listeners (callbacks)
    for (const listener of stream.listeners) {
      try {
        listener({ type: 'data', data, taskId });
      } catch (_) { /* swallow */ }
    }
  }

  /**
   * Complete a stream
   */
  complete(taskId, finalData) {
    const stream = this.streams.get(taskId);
    if (!stream) return;

    if (finalData) {
      stream.buffer += finalData;
      stream.chunks.push({ data: finalData, timestamp: Date.now() });
    }

    stream.completed = true;
    stream.completedAt = Date.now();
    stream.duration = stream.completedAt - stream.startedAt;

    this.emit('stream:complete', { taskId, duration: stream.duration });

    for (const listener of stream.listeners) {
      try {
        listener({ type: 'complete', taskId, duration: stream.duration });
      } catch (_) { /* swallow */ }
    }
  }

  /**
   * Mark stream as errored
   */
  error(taskId, err) {
    const stream = this.streams.get(taskId);
    if (!stream) return;

    stream.error = err.message || String(err);
    stream.completed = true;
    stream.completedAt = Date.now();

    this.emit('stream:error', { taskId, error: err });

    for (const listener of stream.listeners) {
      try {
        listener({ type: 'error', taskId, error: err });
      } catch (_) { /* swallow */ }
    }
  }

  /**
   * Subscribe a callback to a stream
   */
  subscribe(taskId, callback) {
    const stream = this.streams.get(taskId);
    if (!stream) return null;

    stream.listeners.add(callback);

    // Return unsubscribe function
    return () => stream.listeners.delete(callback);
  }

  /**
   * Get stream state
   */
  getStream(taskId) {
    return this.streams.get(taskId) || null;
  }

  /**
   * Get the full buffered content
   */
  getBuffer(taskId) {
    const stream = this.streams.get(taskId);
    return stream ? stream.buffer : '';
  }

  /**
   * Destroy a stream
   */
  destroy(taskId) {
    const stream = this.streams.get(taskId);
    if (stream) {
      stream.listeners.clear();
      this.streams.delete(taskId);
    }
  }

  /**
   * Create an async iterator for consuming stream chunks
   * Useful for piping to HTTP SSE responses
   */
  async *iterate(taskId) {
    const queue = [];
    let resolve = null;
    let done = false;

    const unsub = this.subscribe(taskId, (event) => {
      if (event.type === 'data') {
        if (resolve) {
          const r = resolve;
          resolve = null;
          r({ done: false, value: event.data });
        } else {
          queue.push(event.data);
        }
      } else {
        done = true;
        if (resolve) {
          const r = resolve;
          resolve = null;
          r({ done: true, value: undefined });
        }
        unsub();
      }
    });

    // Flush existing buffer
    const stream = this.streams.get(taskId);
    if (stream && stream.buffer) {
      // Send existing buffer as first chunk
      yield stream.buffer;
      stream.buffer = ''; // consumed
    }

    try {
      while (!done) {
        if (queue.length > 0) {
          yield queue.shift();
        } else {
          const result = await new Promise((r) => { resolve = r; });
          if (result.done) break;
          yield result.value;
        }
      }
    } finally {
      unsub();
    }
  }

  /**
   * Format stream as SSE strings
   */
  async *sse(taskId) {
    for await (const chunk of this.iterate(taskId)) {
      yield `data: ${JSON.stringify({ chunk, taskId })}\n\n`;
    }
    yield `data: [DONE]\n\n`;
  }
}

/**
 * Stream an agent's execute() or executeStream() into a StreamManager
 */
async function streamAgentOutput(streamManager, taskId, agent, task, context = {}) {
  streamManager.createStream(taskId);

  try {
    if (typeof agent.executeStream === 'function') {
      for await (const chunk of agent.executeStream(task, context)) {
        streamManager.append(taskId, chunk);
      }
    } else {
      const result = await agent.execute(task, context);
      streamManager.append(taskId, typeof result === 'string' ? result : JSON.stringify(result));
    }
    streamManager.complete(taskId);
    return streamManager.getBuffer(taskId);
  } catch (err) {
    streamManager.error(taskId, err);
    throw err;
  }
}

module.exports = { StreamManager, streamAgentOutput };
