class Logger {
  constructor(level = 'info') {
    this.level = level;
    this.levels = { error: 0, warn: 1, info: 2, debug: 3 };
  }

  error(message, ...args) {
    if (this.levels.error <= this.levels[this.level]) {
      console.error('[ERROR]', message, ...args);
    }
  }

  warn(message, ...args) {
    if (this.levels.warn <= this.levels[this.level]) {
      console.warn('[WARN]', message, ...args);
    }
  }

  info(message, ...args) {
    if (this.levels.info <= this.levels[this.level]) {
      console.info('[INFO]', message, ...args);
    }
  }

  debug(message, ...args) {
    if (this.levels.debug <= this.levels[this.level]) {
      console.debug('[DEBUG]', message, ...args);
    }
  }
}

module.exports = { Logger };
