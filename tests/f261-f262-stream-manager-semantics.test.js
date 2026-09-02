/**
 * Round 69 — F261/F262
 *
 * F261: missing-stream read semantics unification.
 *   Reads on a missing stream must return null everywhere:
 *   getStream / getStreamStats / subscribe already do; getBuffer used to
 *   return '' which is indistinguishable from a live empty stream.
 *
 * F262: getStreamStats().throughput must be a number.
 *   It used to return toFixed(2) strings ('3.14' / '0'), breaking any
 *   arithmetic consumer.
 */
const { StreamManager } = require('../src/utils/stream-manager');

describe('F261 missing-stream read semantics unification', () => {
  test('every read API returns null for a missing stream', () => {
    const sm = new StreamManager();
    expect(sm.getStream('nope')).toBeNull();
    expect(sm.getStreamStats('nope')).toBeNull();
    expect(sm.subscribe('nope', () => {})).toBeNull();
    expect(sm.getBuffer('nope')).toBeNull();
  });

  test('getBuffer distinguishes a live empty stream from a missing stream', () => {
    const sm = new StreamManager();
    sm.createStream('empty-but-alive');
    expect(sm.getBuffer('empty-but-alive')).toBe('');
    expect(sm.getBuffer('never-created')).toBeNull();
  });

  test('unified contract: mutations on missing streams stay silent no-ops', () => {
    const sm = new StreamManager();
    expect(() => {
      sm.append('nope', 'x');
      sm.complete('nope', 'done');
      sm.error('nope', new Error('boom'));
      sm.destroy('nope');
    }).not.toThrow();
    expect(sm.getBuffer('nope')).toBeNull();
    expect(sm.listStreams()).toEqual([]);
  });

  test('getBuffer returns null after the stream is destroyed', () => {
    const sm = new StreamManager();
    sm.createStream('gone');
    sm.append('gone', 'data');
    sm.destroy('gone');
    expect(sm.getBuffer('gone')).toBeNull();
  });
});

describe('F262 getStreamStats throughput is numeric', () => {
  test('throughput is a finite number for a running stream', () => {
    const sm = new StreamManager();
    sm.createStream('t1');
    sm.append('t1', 'abc'); // duration may be 0ms on fast clocks
    const stats = sm.getStreamStats('t1');
    expect(typeof stats.throughput).toBe('number');
    expect(Number.isFinite(stats.throughput)).toBe(true);
    expect(stats.throughput).toBeGreaterThanOrEqual(0);
  });

  test('throughput is a finite number for a completed stream', () => {
    const sm = new StreamManager({ throttleMs: 0 });
    sm.createStream('t1');
    sm.append('t1', 'abc');
    sm.complete('t1', 'def');
    const stats = sm.getStreamStats('t1');
    expect(typeof stats.throughput).toBe('number');
    expect(Number.isFinite(stats.throughput)).toBe(true);
    // arithmetic must work without coercion surprises
    expect(stats.throughput + 1).toBeGreaterThan(0);
  });

  test('throughput has at most 2 decimal places', () => {
    const sm = new StreamManager();
    sm.createStream('t1');
    sm.append('t1', 'abcdefgh');
    sm.streams.get('t1').startedAt = Date.now() - 3000; // 3s -> 8/3 = 2.67/s
    const stats = sm.getStreamStats('t1');
    expect(Math.round(stats.throughput * 100) / 100).toBe(stats.throughput);
  });
});
