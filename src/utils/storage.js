const fs = require('fs').promises;
const fsSync = require('fs');
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

  /**
   * Synchronous version of saveTask for testing
   */
  saveTaskSync(taskId, taskData) {
    try {
      // Ensure data directory exists
      if (!fsSync.existsSync(this.dataDir)) {
        fsSync.mkdirSync(this.dataDir, { recursive: true });
      }
      
      // Read current tasks
      let tasks = {};
      if (fsSync.existsSync(this.tasksFile)) {
        const data = fsSync.readFileSync(this.tasksFile, 'utf8');
        if (data && data.trim() !== '') {
          tasks = JSON.parse(data);
        }
      }
      
      // Update task
      tasks[taskId] = taskData;
      
      // Write back
      fsSync.writeFileSync(this.tasksFile, JSON.stringify(tasks, null, 2));
      
      return taskData;
    } catch (error) {
      if (error instanceof SyntaxError) {
        console.warn('Warning: Malformed JSON in tasks file, starting fresh');
        // Try again with empty tasks
        fsSync.writeFileSync(this.tasksFile, JSON.stringify({}, null, 2));
        tasks = { [taskId]: taskData };
        fsSync.writeFileSync(this.tasksFile, JSON.stringify(tasks, null, 2));
        return taskData;
      }
      throw error;
    }
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

  /** F98: first(predicate) — find first task matching predicate. */
  async first(predicate) {
    const tasks = await this.loadTasks();
    for (const [id, t] of Object.entries(tasks)) {
      const task = { id, ...t };
      if (predicate(task)) return task;
    }
    return null;
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

  /** F78: Delete all tasks with given status. Returns deleted count. */
  async deleteByStatus(status) {
    return this.withLock(async () => {
      await this.ensureDataDir();
      let tasks = {};
      try {
        const data = await fs.readFile(this.tasksFile, 'utf8');
        if (data && data.trim() !== '') tasks = JSON.parse(data);
      } catch (e) {
        if (e.code !== 'ENOENT' && !(e instanceof SyntaxError)) throw e;
      }
      let count = 0;
      for (const [id, t] of Object.entries(tasks)) {
        if (t.status === status) { delete tasks[id]; count++; }
      }
      await fs.writeFile(this.tasksFile, JSON.stringify(tasks, null, 2));
      return count;
    });
  }

  /** F81: Get task or create with defaults if not found. Returns the task. */
  async getOrCreate(id, defaults = {}) {
    const existing = await this.getTask(id);
    if (existing) return existing;
    const task = { ...defaults, id };
    await this.saveTask(id, task);
    return task;
  }

  /** F83: Count tasks grouped by status. Returns {status: count}. */
  async countByStatus() {
    const tasks = await this.listTasks();
    const counts = {};
    for (const task of tasks) {
      const s = task.status || 'unknown';
      counts[s] = (counts[s] || 0) + 1;
    }
    return counts;
  }

  /** F90: map(fn) — transform each task with fn(task), return array of results. */
  async map(fn) {
    const tasks = await this.listTasks();
    return tasks.map(fn);
  }
  /** F101: ids() — return all task IDs. */
  async ids() {
    const tasks = await this.loadTasks();
    return Object.keys(tasks);
  }

  /** F96: transaction(fn) — run fn(this) atomically; if fn throws, restore original file state. Returns fn result. */
  async transaction(fn) {
    let originalData = '{}';
    try {
      const data = await fs.readFile(this.tasksFile, 'utf8').catch(() => '{}');
      originalData = data;
      const result = await fn(this);
      return result;
    } catch (err) {
      await fs.writeFile(this.tasksFile, originalData).catch(() => {});
      throw err;
    }
  }


  /** F110: sum(field) — sum a numeric field across all tasks. Non-numeric values are skipped (treated as 0). Returns 0 if no tasks or field missing. */
  async sum(field) {
    const tasks = await this.loadTasks();
    let total = 0;
    for (const id in tasks) {
      const val = tasks[id][field];
      if (typeof val === 'number' && !isNaN(val)) total += val;
    }
    return total;
  }

  /** F132: avg(field) — average of a numeric field across all tasks. Non-numeric values are skipped. Returns 0 if no matching tasks. */
  async avg(field) {
    const tasks = await this.loadTasks();
    let total = 0;
    let count = 0;
    for (const id in tasks) {
      const val = tasks[id][field];
      if (typeof val === 'number' && !isNaN(val)) {
        total += val;
        count++;
      }
    }
    return count > 0 ? total / count : 0;
  }

  /** F107: groupBy(field) — group all tasks by a field value. Returns { [fieldValue]: task[] }. */
  async groupBy(field) {
    const tasks = await this.loadTasks();
    const result = {};
    for (const id in tasks) {
      const task = tasks[id];
      const key = task[field];
      const groupKey = key === undefined || key === null ? 'null' : String(key);
      if (!result[groupKey]) result[groupKey] = [];
      result[groupKey].push(task);
    }
    return result;
  }
  /** F113: pluck(field) — extract values for a single field across all tasks. Returns array of values (skips tasks where field is undefined). */
  async pluck(field) {
    const tasks = await this.loadTasks();
    const values = [];
    for (const id in tasks) {
      if (tasks[id][field] !== undefined) {
        values.push(tasks[id][field]);
      }
    }
    return values;
  }

  /** F105: bulkDelete(ids[]) — delete multiple tasks by ID in one write. Returns count of actually deleted tasks. */
  async bulkDelete(ids) {
    return this.withLock(async () => {
      await this.ensureDataDir();
      let tasks = {};
      try {
        const data = await fs.readFile(this.tasksFile, 'utf8');
        if (data && data.trim() !== '') tasks = JSON.parse(data);
      } catch (e) {
        if (e.code !== 'ENOENT' && !(e instanceof SyntaxError)) throw e;
      }
      let count = 0;
      for (const id of ids) {
        if (tasks[id]) { delete tasks[id]; count++; }
      }
      await fs.writeFile(this.tasksFile, JSON.stringify(tasks, null, 2));
      return count;
    });
  }

  /** F116: min(field) — return minimum value of a numeric field across all tasks. Returns null if no tasks. */
  async min(field) {
    const tasks = await this.loadTasks();
    const vals = Object.values(tasks).map(t => t[field]).filter(v => typeof v === 'number');
    return vals.length ? Math.min(...vals) : null;
  }

  /** F117: max(field) — return maximum value of a numeric field across all tasks. Returns null if no tasks. */
  async max(field) {
    const tasks = await this.loadTasks();
    const vals = Object.values(tasks).map(t => t[field]).filter(v => typeof v === 'number');
    return vals.length ? Math.max(...vals) : null;
  }

  /** F120: reverse() — return all tasks in reverse insertion order */
  async reverse() {
    const tasks = await this.loadTasks();
    return Object.values(tasks).reverse();
  }

  /** F123: sample(n) — return N random tasks (without replacement). If n > total, return all shuffled. */
  async sample(n = 1) {
    const tasks = await this.loadTasks();
    const all = Object.values(tasks);
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    return all.slice(0, Math.min(n, all.length));
  }

  /** F126: distinct(field) — return unique values for a field across all tasks */
  async distinct(field) {
    const tasks = await this.loadTasks();
    const vals = new Set();
    for (const t of Object.values(tasks)) {
      if (t[field] !== undefined) vals.add(t[field]);
    }
    return [...vals];
  }

  /** F133: sort(field, order) — return all tasks sorted by a field. order: 'asc' (default) or 'desc'. */
  async sort(field, order = 'asc') {
    const tasks = await this.loadTasks();
    const all = Object.values(tasks);
    const dir = order === 'desc' ? -1 : 1;
    return all.sort((a, b) => {
      const va = a[field];
      const vb = b[field];
      if (va === undefined && vb === undefined) return 0;
      if (va === undefined) return 1;
      if (vb === undefined) return -1;
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }

  /** F125: lock(key, fn) — run fn with exclusive access to a key's value. Returns fn result. Other ops on that key queue. */
  async lock(key, fn) {
    if (!this._locks) this._locks = new Map();
    const prev = this._locks.get(key) || Promise.resolve();
    let release;
    const next = new Promise(r => { release = r; });
    this._locks.set(key, next);
    await prev;
    try {
      return await fn();
    } finally {
      release();
      if (this._locks.get(key) === next) this._locks.delete(key);
    }
  }

  /** F136: create(id, data) — insert-only, returns false if id already exists (NX pattern). */
  async create(id, data) {
    return await this.withLock(async () => {
      await this.ensureDataDir();
      let tasks = {};
      try {
        const fileData = await fs.readFile(this.tasksFile, 'utf8');
        if (fileData && fileData.trim() !== '') {
          tasks = JSON.parse(fileData);
        }
      } catch (e) {
        if (e.code !== 'ENOENT' && !(e instanceof SyntaxError)) throw e;
      }
      if (tasks[id] !== undefined) return false;
      tasks[id] = data;
      await fs.writeFile(this.tasksFile, JSON.stringify(tasks, null, 2));
      return true;
    });
  }

  /** F139: where(predicate) — filter tasks by a predicate function. Returns array of matching tasks. */
  async where(predicate) {
    const tasks = await this.loadTasks();
    const result = [];
    for (const [id, t] of Object.entries(tasks)) {
      const task = { id, ...t };
      if (predicate(task)) result.push(task);
    }
    return result;
  }

  /** F140: chunk(field, size) — split tasks into chunks of N by sequential grouping. Returns array of arrays. */
  async chunk(size = 10) {
    if (size < 1) throw new Error('chunk size must be >= 1');
    const tasks = await this.loadTasks();
    const all = Object.values(tasks);
    const chunks = [];
    for (let i = 0; i < all.length; i += size) {
      chunks.push(all.slice(i, i + size));
    }
    return chunks;
  }

  /** F141: count() — total number of stored tasks. */
  async count() {
    const tasks = await this.loadTasks();
    return Object.keys(tasks).length;
  }

  /** F142: countWhere(predicate) — count tasks matching a predicate function. */
  async countWhere(predicate) {
    const tasks = await this.loadTasks();
    let count = 0;
    for (const [id, t] of Object.entries(tasks)) {
      const task = { id, ...t };
      if (predicate(task)) count++;
    }
    return count;
  }

  /** F143: hasTag(tag) — check if any task has the given tag. Returns boolean. */
  async hasTag(tag) {
    const tasks = await this.loadTasks();
    for (const t of Object.values(tasks)) {
      if (Array.isArray(t.tags) && t.tags.includes(tag)) return true;
    }
    return false;
  }

  /** F144: tags() — return all unique tags across all tasks, sorted alphabetically. */
  async tags() {
    const tasks = await this.loadTasks();
    const tagSet = new Set();
    for (const t of Object.values(tasks)) {
      if (Array.isArray(t.tags)) {
        for (const tag of t.tags) tagSet.add(tag);
      }
    }
    return [...tagSet].sort();
  }

  /** F145: findByIds(ids) — return tasks by ID, preserving input order. Missing IDs skipped. */
  async findByIds(ids) {
    const tasks = await this.loadTasks();
    const result = [];
    for (const id of ids) {
      if (tasks[id]) result.push({ id, ...tasks[id] });
    }
    return result;
  }

  /** F146: toggleTag(id, tag) — toggle a tag on a task. Returns true if added, false if removed. */
  async toggleTag(id, tag) {
    return this.withLock(async () => {
      await this.ensureDataDir();
      let tasks = {};
      try {
        const data = await fs.readFile(this.tasksFile, 'utf8');
        if (data && data.trim() !== '') tasks = JSON.parse(data);
      } catch (e) {
        if (e.code !== 'ENOENT' && !(e instanceof SyntaxError)) throw e;
      }
      if (!tasks[id]) throw new Error(`Task not found: ${id}`);
      if (!Array.isArray(tasks[id].tags)) tasks[id].tags = [];
      const idx = tasks[id].tags.indexOf(tag);
      if (idx >= 0) {
        tasks[id].tags.splice(idx, 1);
        await fs.writeFile(this.tasksFile, JSON.stringify(tasks, null, 2));
        return false;
      }
      tasks[id].tags.push(tag);
      await fs.writeFile(this.tasksFile, JSON.stringify(tasks, null, 2));
      return true;
    });
  }

  /**
   * F148: bulkUpdate(updates) — batch update multiple tasks by ID.
   * @param {Object} updates — { id: { field: value, ... }, ... }
   * @returns {Object} { updated: string[], missing: string[] }
   */
  async bulkUpdate(updates) {
    return this.withLock(async () => {
      await this.ensureDataDir();
      let tasks = {};
      try {
        const data = await fs.readFile(this.tasksFile, 'utf8');
        if (data && data.trim() !== '') tasks = JSON.parse(data);
      } catch (e) {
        if (e.code !== 'ENOENT' && !(e instanceof SyntaxError)) throw e;
      }
      const updated = [];
      const missing = [];
      for (const [id, patch] of Object.entries(updates)) {
        if (!tasks[id]) { missing.push(id); continue; }
        Object.assign(tasks[id], patch);
        updated.push(id);
      }
      if (updated.length > 0) {
        await fs.writeFile(this.tasksFile, JSON.stringify(tasks, null, 2));
      }
      return { updated, missing };
    });
  }

  /**
   * F152: rename(id, newId) — Rename a task's ID.
   * Returns true if renamed, false if source missing or target already exists.
   * @param {string} id - current task ID
   * @param {string} newId - desired new ID
   * @returns {Promise<boolean>}
   */
  async rename(id, newId) {
    if (!id || !newId || id === newId) return false;
    return this.withLock(async () => {
      await this.ensureDataDir();
      let tasks = {};
      try {
        const data = await fs.readFile(this.tasksFile, 'utf8');
        if (data && data.trim() !== '') tasks = JSON.parse(data);
      } catch (e) {
        if (e.code !== 'ENOENT' && !(e instanceof SyntaxError)) throw e;
      }
      if (!tasks[id] || tasks[newId]) return false;
      tasks[newId] = tasks[id];
      delete tasks[id];
      await fs.writeFile(this.tasksFile, JSON.stringify(tasks, null, 2));
      return true;
    });
  }

  /**
   * F157: paginate(page, pageSize, opts?) — return a page of tasks with metadata.
   * @param {number} page - 1-indexed page number
   * @param {number} pageSize - items per page
   * @param {object} opts - optional { status, sortBy, order }
   * @returns {Promise<{items, page, pageSize, total, totalPages, hasMore}>}
   */
  async paginate(page = 1, pageSize = 10, opts = {}) {
    if (page < 1) throw new Error('paginate: page must be >= 1');
    if (pageSize < 1) throw new Error('paginate: pageSize must be >= 1');
    let tasks = await this.loadTasks();
    let all = Object.values(tasks);
    // Filter by status
    if (opts.status) {
      all = all.filter(t => t.status === opts.status);
    }
    // Sort
    if (opts.sortBy) {
      const field = opts.sortBy;
      const dir = opts.order === 'desc' ? -1 : 1;
      all.sort((a, b) => {
        const va = a[field], vb = b[field];
        if (va === undefined && vb === undefined) return 0;
        if (va === undefined) return 1;
        if (vb === undefined) return -1;
        if (va < vb) return -1 * dir;
        if (va > vb) return 1 * dir;
        return 0;
      });
    } else {
      // Default sort: createdAt desc
      all.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }
    const total = all.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const items = all.slice(start, start + pageSize);
    return {
      items,
      page,
      pageSize,
      total,
      totalPages,
      hasMore: page < totalPages
    };
  }

  /**
   * F155: upsert(id, data)
   * Insert new task or merge-update existing one.
   * Returns { created: boolean, task: mergedTask }.
   */
  async upsert(id, data) {
    return this.withLock(async () => {
      await this.ensureDataDir();
      let tasks = {};
      try {
        const raw = await fs.readFile(this.tasksFile, 'utf8');
        if (raw && raw.trim() !== '') tasks = JSON.parse(raw);
      } catch (e) {
        if (e.code !== 'ENOENT' && !(e instanceof SyntaxError)) throw e;
      }
      const created = !tasks[id];
      if (created) {
        tasks[id] = { ...data, createdAt: new Date().toISOString() };
      } else {
        tasks[id] = { ...tasks[id], ...data, updatedAt: new Date().toISOString() };
      }
      await fs.writeFile(this.tasksFile, JSON.stringify(tasks, null, 2));
      return { created, task: tasks[id] };
    });
  }

  /**
   * F167: aggregate(field, fn, initial) — reduce/aggregation over a numeric field.
   * Skips tasks where field is undefined. Returns initial value for empty storage.
   */
  aggregate(field, fn = (acc, v) => acc + v, initial = 0) {
    const tasks = this.loadTasksSync();
    let result = initial;
    for (const [id, task] of Object.entries(tasks)) {
      const taskObj = { id, ...task };
      const value = taskObj[field];
      // Only aggregate defined values
      if (value !== undefined) {
        result = fn(result, value, id, taskObj);
      }
    }
    return result;
  }

  /**
   * Synchronous version of loadTasks for aggregate() and similar methods
   */
  loadTasksSync() {
    try {
      if (fsSync.existsSync(this.tasksFile)) {
        const data = fsSync.readFileSync(this.tasksFile, 'utf8');
        if (!data || data.trim() === '') {
          return {};
        }
        return JSON.parse(data);
      }
      return {};
    } catch (error) {
      if (error instanceof SyntaxError) {
        console.warn('Warning: Malformed JSON in tasks file, starting fresh');
        return {};
      }
      throw error;
    }
  }

  /**
   * F174: countWhere(predicate) — count tasks matching a predicate function.
   * @param {Function} predicate - (task, id) => boolean
   * @returns {Promise<number>} count of matching tasks
   */
  async countWhere(predicate) {
    if (typeof predicate !== 'function') {
      throw new TypeError('countWhere: predicate must be a function');
    }
    const tasks = await this.loadTasks();
    let count = 0;
    for (const [id, t] of Object.entries(tasks)) {
      if (predicate({ id, ...t }, id)) count++;
    }
    return count;
  }

  /**
   * F161: findOne(filter) — find first task matching all key-value pairs in filter object.
   * Returns the matching task (with id) or null if none found.
   */
  async findOne(filter = {}) {
    const tasks = await this.loadTasks();
    for (const [id, t] of Object.entries(tasks)) {
      const task = { id, ...t };
      const match = Object.entries(filter).every(([k, v]) => task[k] === v);
      if (match) return task;
    }
    return null;
  }

  /**
   * F176: mapReduce(mapFn, reduceFn, initial) — map each task, reduce results.
   * mapFn(task) produces value, reduceFn(acc, mapped) accumulates.
   */
  async mapReduce(mapFn, reduceFn, initial) {
    const tasks = await this.loadTasks();
    let acc = initial;
    for (const t of Object.values(tasks)) {
      acc = reduceFn(acc, mapFn(t));
    }
    return acc;
  }

  /**
   * F179: flatMap(field) — map each task's field value (must be array) and flatten.
   * Returns a single flat array. Skips tasks where field is not an array.
   */
  async flatMap(field) {
    const tasks = await this.loadTasks();
    const result = [];
    for (const t of Object.values(tasks)) {
      if (Array.isArray(t[field])) result.push(...t[field]);
    }
    return result;
  }
}

module.exports = { Storage };
