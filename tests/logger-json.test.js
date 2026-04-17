const { Logger } = require('../src/utils/logger');

describe('Logger JSON mode', () => {
  let output;
  let origLog;

  beforeEach(() => {
    output = [];
    origLog = console.log;
    console.log = (...args) => output.push(args.join(' '));
  });
  afterEach(() => { console.log = origLog; });

  test('outputs JSON string with level, message, timestamp', () => {
    const logger = new Logger('debug', { json: true });
    logger.info('hello');
    const parsed = JSON.parse(output[0]);
    expect(parsed.level).toBe('info');
    expect(parsed.message).toBe('hello');
    expect(parsed.timestamp).toBeDefined();
  });

  test('merges object arg into JSON entry', () => {
    const logger = new Logger('debug', { json: true });
    logger.info('test', { userId: 42 });
    const parsed = JSON.parse(output[0]);
    expect(parsed.userId).toBe(42);
  });

  test('respects level filtering', () => {
    const logger = new Logger('warn', { json: true });
    logger.debug('hidden');
    logger.info('hidden');
    logger.warn('visible');
    expect(output.length).toBe(1);
    expect(JSON.parse(output[0]).level).toBe('warn');
  });

  test('child logger merges context', () => {
    const logger = new Logger('debug', { json: true, context: { service: 'api' } });
    const child = logger.child({ requestId: 'abc' });
    child.info('child msg');
    const parsed = JSON.parse(output[0]);
    expect(parsed.service).toBe('api');
    expect(parsed.requestId).toBe('abc');
  });

  test('non-JSON mode uses console methods directly', () => {
    const origInfo = console.info;
    let called = false;
    console.info = () => { called = true; };
    const logger = new Logger('info');
    logger.info('plain');
    console.info = origInfo;
    expect(called).toBe(true);
    expect(output.length).toBe(0); // console.info was mocked, not console.log
  });
});
