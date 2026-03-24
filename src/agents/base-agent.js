const { v4: uuidv4 } = require('uuid');
const { EventEmitter } = require('events');

class BaseAgent extends EventEmitter {
  constructor(config) {
    super();
    this.id = uuidv4();
    this.name = config.name;
    this.role = config.role;
    this.focus = config.focus || null;
    this.skills = config.skills || [];
    this.status = 'idle';
    this.output = null;
  }

  async execute(_task) {
    throw new Error('execute() must be implemented by subclass');
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      role: this.role,
      focus: this.focus,
      skills: this.skills,
      status: this.status,
      output: this.output
    };
  }
}

module.exports = { BaseAgent };
