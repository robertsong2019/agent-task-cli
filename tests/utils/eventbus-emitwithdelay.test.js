const { EventBus } = require('../../src/utils/event-bus');

describe('F214: EventBus.emitWithDelay(channel, data, delayMs)', () => {
  let bus;
  beforeEach(() => { bus = new EventBus(); });

  test('emits after the specified delay', (done) => {
    const received = [];
    bus.on('late', e => received.push(e.data));
    bus.emitWithDelay('late', { msg: 'hello' }, 50);
    expect(received).toHaveLength(0);
    setTimeout(() => {
      expect(received).toHaveLength(1);
      expect(received[0].msg).toBe('hello');
      done();
    }, 80);
  });

  test('returns a handle with cancel()', (done) => {
    const received = [];
    bus.on('ch', e => received.push(e.data));
    const handle = bus.emitWithDelay('ch', 'val', 50);
    expect(typeof handle.cancel).toBe('function');
    expect(handle.timer).toBeDefined();
    handle.cancel();
    setTimeout(() => {
      expect(received).toHaveLength(0);
      done();
    }, 80);
  });

  test('cancel prevents emission', (done) => {
    const received = [];
    bus.on('x', e => received.push(e.data));
    const h = bus.emitWithDelay('x', 42, 30);
    h.cancel();
    setTimeout(() => {
      expect(received).toHaveLength(0);
      done();
    }, 60);
  });

  test('emits to correct channel', (done) => {
    const aReceived = [];
    const bReceived = [];
    bus.on('a', e => aReceived.push(e.data));
    bus.on('b', e => bReceived.push(e.data));
    bus.emitWithDelay('a', 1, 30);
    bus.emitWithDelay('b', 2, 30);
    setTimeout(() => {
      expect(aReceived).toEqual([1]);
      expect(bReceived).toEqual([2]);
      done();
    }, 60);
  });

  test('fires wildcard listeners', (done) => {
    const all = [];
    bus.on('*', e => all.push(e.channel));
    bus.emitWithDelay('event', 'data', 30);
    setTimeout(() => {
      expect(all).toEqual(['event']);
      done();
    }, 60);
  });

  test('multiple delayed emissions fire independently', (done) => {
    const received = [];
    bus.on('ch', e => received.push(e.data));
    bus.emitWithDelay('ch', 1, 20);
    bus.emitWithDelay('ch', 2, 40);
    bus.emitWithDelay('ch', 3, 60);
    setTimeout(() => {
      expect(received).toEqual([1]);
    }, 30);
    setTimeout(() => {
      expect(received).toEqual([1, 2]);
    }, 50);
    setTimeout(() => {
      expect(received).toEqual([1, 2, 3]);
      done();
    }, 80);
  });

  test('records event in history after firing', (done) => {
    bus.emitWithDelay('hist', { v: 1 }, 30);
    expect(bus.getHistory()).toHaveLength(0);
    setTimeout(() => {
      const hist = bus.getHistory();
      expect(hist).toHaveLength(1);
      expect(hist[0].channel).toBe('hist');
      done();
    }, 60);
  });
});
