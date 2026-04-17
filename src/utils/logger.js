class Logger {
  constructor(level = 'info', options = {}) {
    this.level = level;
    this.levels = { error: 0, warn: 1, info: 2, debug: 3 };
    this.jsonMode = options.json || false;
    this.context = options.context || {};
  }

  _write(level, message, ...args) {
    if (this.levels[level] > this.levels[this.level]) return;

    if (this.jsonMode) {
      const entry = {
        level,
        message,
        timestamp: new Date().toISOString(),
        ...this.context,
        ...(args.length === 1 && typeof args[0] === 'object' ? args[0] : { args })
      };
      console.log(JSON.stringify(entry));
    } else {
      const tag = `[${level.toUpperCase()}]`;
      const fn = { error: console.error, warn: console.warn, info: console.info, debug: console.debug }[level] || console.info;
      fn(tag, message, ...args);
    }
  }

  error(message, ...args) { this._write('error', message, ...args); }
  warn(message, ...args) { this._write('warn', message, ...args); }
  info(message, ...args) { this._write('info', message, ...args); }
  debug(message, ...args) { this._write('debug', message, ...args); }

  /** Create a child logger with extra context merged into JSON output */
  child(context) {
    return new Logger(this.level, {
      json: this.jsonMode,
      context: { ...this.context, ...context }
    });
  }
}

module.exports = { Logger };
