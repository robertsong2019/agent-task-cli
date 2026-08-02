const { EventBus } = require('../src/utils/event-bus');

describe('F225: EventBus.eventAge()', () => {
  let bus;

  beforeEach(() => {
    bus = new EventBus({ recordHistory: true });
  });

  test('returns -1 when channel has no events', () => {
    expect(bus.eventAge('nope')).toBe(-1);
  });

  test('returns ms since last event', async () => {
    bus.emit('test', { val: 1 });
    // Small delay to ensure measurable age
    await new Promise(r => setTimeout(r, 10));
    const age = bus.eventAge('test');
    expect(age).toBeGreaterThanOrEqual(10);
    expect(age).toBeLessThan(5000);
  });

  test('updates after new emit', async () => {
    bus.emit('ch', { a: 1 });
    await new Promise(r => setTimeout(r, 30));
    const age1 = bus.eventAge('ch');
    expect(age1).toBeGreaterThanOrEqual(25);

    bus.emit('ch', { a: 2 });
    const age2 = bus.eventAge('ch');
    expect(age2).toBeLessThan(age1);
    expect(age2).toBeGreaterThanOrEqual(0);
  });

  test('tracks channels independently', async () => {
    bus.emit('alpha', { x: 1 });
    await new Promise(r => setTimeout(r, 20));
    bus.emit('beta', { x: 2 });

    const ageAlpha = bus.eventAge('alpha');
    const ageBeta = bus.eventAge('beta');
    expect(ageAlpha).toBeGreaterThan(ageBeta);
  });

  test('returns age of most recent event when multiple exist', async () => {
    bus.emit('multi', { n: 1 });
    await new Promise(r => setTimeout(r, 20));
    bus.emit('multi', { n: 2 });
    await new Promise(r => setTimeout(r, 10));

    const age = bus.eventAge('multi');
    expect(age).toBeGreaterThanOrEqual(10);
    expect(age).toBeLessThan(20);
  });

  test('returns -1 for wildcard-matched events only', () => {
    bus.emit('user.created', { id: 1 });
    // Direct channel 'user' was never emitted to
    expect(bus.eventAge('user')).toBe(-1);
  });
});
