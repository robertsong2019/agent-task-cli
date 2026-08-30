const { StreamManager } = require('../src/utils/stream-manager');

describe('F259: StreamManager.iterate() termination semantics (late-subscriber hang fix)', () => {
  test('iterating an already-completed stream yields buffered data then terminates', async () => {
    const sm = new StreamManager();
    sm.createStream('done1');
    sm.append('done1', 'hello ');
    sm.append('done1', 'world');
    sm.complete('done1', '!');
    const chunks = [];
    for await (const chunk of sm.iterate('done1')) chunks.push(chunk);
    expect(chunks).toEqual(['hello world!']);
  });

  test('iterating an errored stream yields buffered data then terminates without throwing', async () => {
    const sm = new StreamManager();
    sm.createStream('e1');
    sm.append('e1', 'partial ');
    sm.append('e1', 'output');
    sm.error('e1', new Error('boom'));
    const chunks = [];
    for await (const chunk of sm.iterate('e1')) chunks.push(chunk);
    expect(chunks).toEqual(['partial output']);
  });

  test('iterating a missing stream rejects immediately instead of hanging', async () => {
    const sm = new StreamManager();
    const collect = async () => {
      const out = [];
      for await (const chunk of sm.iterate('ghost')) out.push(chunk);
      return out;
    };
    await expect(collect()).rejects.toThrow(/ghost/);
  });

  test('live stream iteration still ends on complete (regression guard)', async () => {
    const sm = new StreamManager();
    sm.createStream('live1');
    const collected = [];
    const iterDone = (async () => {
      for await (const chunk of sm.iterate('live1')) collected.push(chunk);
    })();
    await new Promise((r) => setTimeout(r, 10));
    sm.append('live1', 'a');
    sm.append('live1', 'b');
    await new Promise((r) => setTimeout(r, 10));
    sm.complete('live1');
    await iterDone;
    expect(collected).toEqual(['a', 'b']);
  });
});

describe('F260: StreamManager lifecycle — listStreams() + destroyAll()', () => {
  test('listStreams returns [] when no streams exist', () => {
    const sm = new StreamManager();
    expect(sm.listStreams()).toEqual([]);
  });

  test('listStreams returns active stream ids in creation order', () => {
    const sm = new StreamManager();
    sm.createStream('a');
    sm.createStream('b');
    sm.createStream('c');
    expect(sm.listStreams()).toEqual(['a', 'b', 'c']);
  });

  test('listStreams excludes completed/errored streams by default; includeCompleted lists all', () => {
    const sm = new StreamManager();
    sm.createStream('a');
    sm.createStream('b');
    sm.createStream('c');
    sm.complete('a');
    sm.error('c', new Error('nope'));
    expect(sm.listStreams()).toEqual(['b']);
    expect(sm.listStreams({ includeCompleted: true })).toEqual(['a', 'b', 'c']);
  });

  test('destroyAll removes every stream, returns count, and emits stream:destroyAll', (done) => {
    const sm = new StreamManager();
    sm.createStream('a');
    sm.createStream('b');
    sm.complete('b');
    sm.once('stream:destroyAll', (payload) => {
      try {
        expect(payload.count).toBe(2);
        done();
      } catch (err) {
        done(err);
      }
    });
    const count = sm.destroyAll();
    expect(count).toBe(2);
    expect(sm.getStream('a')).toBeNull();
    expect(sm.getStream('b')).toBeNull();
    expect(sm.listStreams({ includeCompleted: true })).toEqual([]);
  });

  test('destroyAll on empty manager returns 0 without emitting', () => {
    const sm = new StreamManager();
    let emitted = false;
    sm.on('stream:destroyAll', () => { emitted = true; });
    expect(sm.destroyAll()).toBe(0);
    expect(emitted).toBe(false);
  });
});
