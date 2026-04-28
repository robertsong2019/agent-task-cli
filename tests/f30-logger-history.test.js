const { Logger } = require('../src/utils/logger');

describe('F30: Logger getHistory', () => {
  let logger;

  beforeEach(() => {
    logger = new Logger('debug', { json: false, historySize: 5 });
    // Suppress console output during tests
    logger._origWrite = logger._write.bind(logger);
    logger.history = [];
  });

  test('records log entries to history', () => {
    logger.info('hello');
    logger.warn('world');
    const h = logger.getHistory();
    expect(h).toHaveLength(2);
    expect(h[0]).toMatchObject({ level: 'info', message: 'hello' });
    expect(h[1]).toMatchObject({ level: 'warn', message: 'world' });
  });

  test('respects historySize limit', () => {
    for (let i = 0; i < 8; i++) {
      logger.info(`msg-${i}`);
    }
    const h = logger.getHistory();
    expect(h).toHaveLength(5); // historySize=5
    expect(h[0].message).toBe('msg-3'); // oldest kept
    expect(h[4].message).toBe('msg-7');
  });

  test('includes timestamp in each entry', () => {
    logger.info('ts-test');
    const h = logger.getHistory();
    expect(h[0].timestamp).toBeTruthy();
    expect(new Date(h[0].timestamp).getTime()).toBeLessThanOrEqual(Date.now());
  });

  test('getHistory with level filter', () => {
    logger.info('a');
    logger.error('b');
    logger.debug('c');
    const errors = logger.getHistory({ level: 'error' });
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe('b');
  });

  test('clearHistory removes all entries', () => {
    logger.info('a');
    logger.info('b');
    expect(logger.getHistory()).toHaveLength(2);
    logger.clearHistory();
    expect(logger.getHistory()).toHaveLength(0);
  });

  test('no history when historySize is 0 or undefined', () => {
    const noHist = new Logger('info');
    noHist.info('test');
    expect(typeof noHist.getHistory).toBe('function');
    expect(noHist.getHistory()).toHaveLength(0);
  });
});
