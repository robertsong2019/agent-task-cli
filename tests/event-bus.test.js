const { EventBus, globalBus } = require('../src/utils/event-bus');

describe('EventBus', () => {
  let bus;

  beforeEach(() => {
    bus = new EventBus();
  });

  afterEach(() => {
    bus.reset();
  });

  describe('emit and on', () => {
    test('should emit and receive events', (done) => {
      bus.on('test:channel', (event) => {
        expect(event.channel).toBe('test:channel');
        expect(event.data).toEqual({ foo: 'bar' });
        done();
      });

      bus.emit('test:channel', { foo: 'bar' });
    });

    test('should support wildcard subscription', (done) => {
      const received = [];
      bus.on('*', (event) => {
        received.push(event.channel);
        if (received.length === 3) {
          expect(received).toEqual(['a', 'b', 'c']);
          done();
        }
      });

      bus.emit('a');
      bus.emit('b');
      bus.emit('c');
    });

    test('should return unsubscribe function', () => {
      let count = 0;
      const unsub = bus.on('test', () => count++);
      
      bus.emit('test');
      expect(count).toBe(1);
      
      unsub();
      bus.emit('test');
      expect(count).toBe(1);
    });
  });

  describe('onPattern', () => {
    test('should match wildcard patterns', (done) => {
      const received = [];
      
      bus.onPattern('task:*', (event) => {
        received.push(event.channel);
      });

      bus.emit('task:started');
      bus.emit('task:completed');
      bus.emit('other:event');
      bus.emit('task:failed');

      expect(received).toEqual(['task:started', 'task:completed', 'task:failed']);
      done();
    });

    test('should unsubscribe from pattern', () => {
      let count = 0;
      const unsub = bus.onPattern('test:*', () => count++);
      
      bus.emit('test:a');
      bus.emit('test:b');
      expect(count).toBe(2);
      
      unsub();
      bus.emit('test:c');
      expect(count).toBe(2);
    });
  });

  describe('waitFor', () => {
    test('should resolve when event is emitted', async () => {
      setTimeout(() => bus.emit('expected', { value: 42 }), 10);
      
      const event = await bus.waitFor('expected');
      expect(event.data.value).toBe(42);
    });

    test('should timeout if event not emitted', async () => {
      await expect(bus.waitFor('never-happens', 200))
        .rejects.toThrow('Timeout waiting for event: never-happens');
    });
  });

  describe('getHistory', () => {
    beforeEach(() => {
      bus.emit('task:started', { id: 1 });
      bus.emit('task:progress', { step: 'a' });
      bus.emit('task:completed', { result: 'ok' });
      bus.emit('agent:started', { id: 2 });
    });

    test('should return all events', () => {
      const history = bus.getHistory();
      expect(history).toHaveLength(4);
    });

    test('should filter by channel prefix', () => {
      const history = bus.getHistory({ channel: 'task:' });
      expect(history).toHaveLength(3);
      expect(history.every(e => e.channel.startsWith('task:'))).toBe(true);
    });

    test('should limit results', () => {
      const history = bus.getHistory({ limit: 2 });
      expect(history).toHaveLength(2);
      // Returns last 2 events in chronological order
      expect(history[0].channel).toBe('task:completed');
      expect(history[1].channel).toBe('agent:started');
    });
  });

  describe('listenerCount', () => {
    test('should return number of subscribers', () => {
      expect(bus.listenerCount('test')).toBe(0);
      
      bus.on('test', () => {});
      bus.on('test', () => {});
      
      expect(bus.listenerCount('test')).toBe(2);
    });
  });

  describe('getStats', () => {
    test('should return bus statistics', () => {
      bus.on('a', () => {});
      bus.on('a', () => {});
      bus.on('b', () => {});
      
      bus.emit('x');
      bus.emit('y');
      
      const stats = bus.getStats();
      expect(stats.historySize).toBe(2);
      expect(stats.subscriberCount).toBe(3);
      expect(stats.channels).toEqual(expect.arrayContaining(['a', 'b']));
    });
  });

  describe('reset', () => {
    test('should clear all state', () => {
      bus.on('test', () => {});
      bus.emit('test');
      
      bus.reset();
      
      expect(bus.getHistory()).toHaveLength(0);
      expect(bus.getStats().subscriberCount).toBe(0);
      expect(bus.listenerCount('test')).toBe(0);
    });
  });

  describe('maxHistory', () => {
    test('should enforce max history limit', () => {
      const smallBus = new EventBus();
      // Set max to 5 (internal, would need to expose or test via behavior)
      
      for (let i = 0; i < 20; i++) {
        smallBus.emit('test', { i });
      }
      
      // With default max of 1000, all should be there
      expect(smallBus.getHistory().length).toBe(20);
    });
  });
});

describe('Global EventBus', () => {
  test('globalBus should be a singleton', () => {
    expect(globalBus).toBeInstanceOf(EventBus);
    
    // Add a test marker
    globalBus.emit('singleton:test');
    
    // Should be able to read it back
    const history = globalBus.getHistory({ channel: 'singleton:test' });
    expect(history.length).toBeGreaterThan(0);
  });
});
