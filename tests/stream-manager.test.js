const { StreamManager, streamAgentOutput } = require('../src/utils/stream-manager');

describe('StreamManager', () => {
  let sm;
  beforeEach(() => { sm = new StreamManager(); });

  test('createStream creates a new stream', () => {
    const s = sm.createStream('t1');
    expect(s.id).toBe('t1');
    expect(s.buffer).toBe('');
    expect(s.completed).toBe(false);
    expect(sm.getStream('t1')).toBe(s);
  });

  test('append adds data to buffer and notifies subscribers', () => {
    sm.createStream('t1');
    const events = [];
    sm.subscribe('t1', (e) => events.push(e));
    sm.append('t1', 'hello');
    expect(sm.getBuffer('t1')).toBe('hello');
    expect(events).toHaveLength(1);
    expect(events[0].data).toBe('hello');
  });

  test('subscribe returns unsubscribe function', () => {
    sm.createStream('t1');
    const events = [];
    const unsub = sm.subscribe('t1', (e) => events.push(e));
    sm.append('t1', 'x');
    unsub();
    sm.append('t1', 'y');
    expect(events).toHaveLength(1);
  });

  test('complete marks stream as completed', () => {
    sm.createStream('t1');
    sm.complete('t1', 'final');
    const s = sm.getStream('t1');
    expect(s.completed).toBe(true);
    expect(s.duration).toBeGreaterThanOrEqual(0);
    expect(s.buffer).toContain('final');
  });

  test('complete emits stream:complete', (done) => {
    sm.createStream('t1');
    sm.on('stream:complete', ({ taskId }) => {
      expect(taskId).toBe('t1');
      done();
    });
    sm.complete('t1');
  });

  test('error marks stream with error', () => {
    sm.createStream('t1');
    sm.error('t1', new Error('boom'));
    const s = sm.getStream('t1');
    expect(s.error).toBe('boom');
    expect(s.completed).toBe(true);
  });

  test('append on completed stream is ignored', () => {
    sm.createStream('t1');
    sm.append('t1', 'before');
    sm.complete('t1');
    sm.append('t1', 'after');
    expect(sm.getBuffer('t1')).toBe('before');
  });

  test('append on unknown stream is ignored', () => {
    expect(() => sm.append('ghost', 'data')).not.toThrow();
  });

  test('destroy removes stream and clears listeners', () => {
    sm.createStream('t1');
    sm.subscribe('t1', () => {});
    sm.destroy('t1');
    expect(sm.getStream('t1')).toBeNull();
    expect(sm.getBuffer('t1')).toBe('');
  });

  test('enforces maxBufferSize by trimming buffer', () => {
    const sm2 = new StreamManager({ maxBufferSize: 10 });
    sm2.createStream('t1');
    sm2.append('t1', '1234567890XYZ');
    expect(sm2.getBuffer('t1').length).toBeLessThanOrEqual(10);
  });

  test('iterate yields async chunks', async () => {
    sm.createStream('t1');
    // Pre-fill buffer so iterate yields it first
    sm.append('t1', 'chunk0');
    const collected = [];
    const iterPromise = (async () => {
      for await (const chunk of sm.iterate('t1')) collected.push(chunk);
    })();
    await new Promise(r => setTimeout(r, 10));
    sm.append('t1', 'chunk1');
    sm.append('t1', 'chunk2');
    sm.complete('t1');
    await iterPromise;
    expect(collected.length).toBeGreaterThanOrEqual(2);
  });

  test('sse formats as Server-Sent Events', async () => {
    sm.createStream('t1');
    const collected = [];
    const p = (async () => {
      for await (const line of sm.sse('t1')) collected.push(line);
    })();
    await new Promise(r => setTimeout(r, 10));
    sm.append('t1', 'hello');
    sm.complete('t1');
    await p;
    expect(collected.length).toBeGreaterThanOrEqual(2);
    expect(collected[0]).toMatch(/^data: /);
    expect(collected[collected.length - 1]).toContain('[DONE]');
  });
});

describe('streamAgentOutput', () => {
  test('streams from agent.execute()', async () => {
    const sm = new StreamManager();
    const agent = { execute: async () => 'result data' };
    const buf = await streamAgentOutput(sm, 't1', agent, {});
    expect(buf).toBe('result data');
    expect(sm.getStream('t1').completed).toBe(true);
  });

  test('streams from agent.executeStream()', async () => {
    const sm = new StreamManager();
    const agent = {
      async *executeStream() { yield 'a'; yield 'b'; }
    };
    const buf = await streamAgentOutput(sm, 't1', agent, {});
    expect(buf).toBe('ab');
    expect(sm.getStream('t1').completed).toBe(true);
  });

  test('handles agent errors', async () => {
    const sm = new StreamManager();
    const agent = { execute: async () => { throw new Error('fail'); } };
    await expect(streamAgentOutput(sm, 't1', agent, {})).rejects.toThrow('fail');
    expect(sm.getStream('t1').error).toBe('fail');
  });
});
