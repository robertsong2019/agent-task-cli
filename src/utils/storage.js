const fs = require('fs').promises;
const path = require('path');

class Storage {
  constructor(dataDir = './data') {
    this.dataDir = dataDir;
    this.tasksFile = path.join(dataDir, 'tasks.json');
    this.mutex = Promise.resolve();
  }

  // Mutex lock for atomic operations
  async withLock(fn) {
    const currentMutex = this.mutex;
    let release;
    this.mutex = new Promise(resolve => {
      release = resolve;
    });
    
    try {
      await currentMutex;
      return await fn();
    } finally {
      release();
    }
  }

  async ensureDataDir() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }

  async loadTasks() {
    return this.withLock(async () => {
      await this.ensureDataDir();
      try {
        const data = await fs.readFile(this.tasksFile, 'utf8');
        // Handle empty file case
        if (!data || data.trim() === '') {
          return {};
        }
        return JSON.parse(data);
      } catch (error) {
        if (error.code === 'ENOENT') return {};
        // Handle malformed JSON by returning empty object
        if (error instanceof SyntaxError) {
          console.warn('Warning: Malformed JSON in tasks file, starting fresh');
          return {};
        }
        throw error;
      }
    });
  }

  async saveTasks(tasks) {
    return this.withLock(async () => {
      await this.ensureDataDir();
      await fs.writeFile(this.tasksFile, JSON.stringify(tasks, null, 2));
    });
  }

  async saveTask(taskId, taskData) {
    return this.withLock(async () => {
      await this.ensureDataDir();
      
      // Read current tasks
      let tasks = {};
      try {
        const data = await fs.readFile(this.tasksFile, 'utf8');
        if (data && data.trim() !== '') {
          tasks = JSON.parse(data);
        }
      } catch (error) {
        if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) {
          throw error;
        }
      }
      
      // Update task
      tasks[taskId] = taskData;
      
      // Write back
      await fs.writeFile(this.tasksFile, JSON.stringify(tasks, null, 2));
      
      return taskData;
    });
  }

  async getTask(taskId) {
    const tasks = await this.loadTasks();
    return tasks[taskId] || null;
  }

  /**
   * Check if a task exists without loading its full data.
   * @param {string} taskId
   * @returns {Promise<boolean>}
   */
  async exists(taskId) {
    const tasks = await this.loadTasks();
    return taskId in tasks;
  }

  async updateTask(taskId, updates) {
    const tasks = await this.loadTasks();
    if (tasks[taskId]) {
      tasks[taskId] = { ...tasks[taskId], ...updates };
      await this.saveTasks(tasks);
      return tasks[taskId];
    }
    return null;
  }

  async listTasks(status = null) {
    const tasks = await this.loadTasks();
    let taskList = Object.values(tasks);
    
    if (status) {
      taskList = taskList.filter(t => t.status === status);
    }
    
    return taskList.sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );
  }

  async deleteTask(taskId) {
    const tasks = await this.loadTasks();
    delete tasks[taskId];
    await this.saveTasks(tasks);
  }

  /** Clear all tasks — deletes the tasks file. Returns number of tasks removed. */
  async clear() {
    const tasks = await this.loadTasks();
    const count = Object.keys(tasks).length;
    await this.saveTasks({});
    return count;
  }

  /** Find tasks by arbitrary metadata field */
  async findByMetadata(key, value) {
    const tasks = await this.loadTasks();
    return Object.values(tasks).filter(t => t[key] === value);
  }

  /** Update a single field on a task without replacing the entire object. */
  async updateField(taskId, field, value) {
    const tasks = await this.loadTasks();
    if (!tasks[taskId]) return null;
    tasks[taskId][field] = value;
    await this.saveTasks(tasks);
    return tasks[taskId];
  }

  /** Count tasks, optionally filtered by status */
  async countTasks(status = null) {
    const tasks = await this.loadTasks();
    const values = Object.values(tasks);
    if (status) {
      return values.filter(t => t.status === status).length;
    }
    return values.length;
  }

  /** Filter tasks by arbitrary predicate function. */
  async filter(predicate) {
    const tasks = await this.loadTasks();
    return Object.entries(tasks)
      .map(([id, t]) => ({ id, ...t }))
      .filter(predicate);
  }

  /** Return the N most recently updated tasks (by updatedAt desc). */
  async findRecent(count = 10) {
    const tasks = await this.loadTasks();
    return Object.entries(tasks)
      .map(([id, t]) => ({ id, ...t }))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .slice(0, count);
  }

  /**
   * Batch update multiple tasks atomically.
   * @param {Array<{id: string, updates: object}>} batch - Array of {id, updates}
   * @returns {Array<object>} Updated task data for found tasks (missing ids skipped)
   */
  async batchUpdate(batch) {
    return this.withLock(async () => {
      await this.ensureDataDir();
      let tasks = {};
      try {
        const data = await fs.readFile(this.tasksFile, 'utf8');
        if (data && data.trim() !== '') tasks = JSON.parse(data);
      } catch (e) {
        if (e.code !== 'ENOENT' && !(e instanceof SyntaxError)) throw e;
      }
      const results = [];
      for (const { id, updates } of batch) {
        if (tasks[id]) {
          tasks[id] = { ...tasks[id], ...updates, updatedAt: new Date().toISOString() };
          results.push({ id, ...tasks[id] });
        }
      }
      await fs.writeFile(this.tasksFile, JSON.stringify(tasks, null, 2));
      return results;
    });
  }

  /** F74: Find all tasks with given status. */
  async findByStatus(status) {
    const tasks = await this.loadTasks();
    return Object.entries(tasks)
      .filter(([, t]) => t.status === status)
      .map(([id, t]) => ({ id, ...t }));
  }
}

module.exports = { Storage };
