const fs = require('fs').promises;
const path = require('path');

class Storage {
  constructor(dataDir = './data') {
    this.dataDir = dataDir;
    this.tasksFile = path.join(dataDir, 'tasks.json');
  }

  async ensureDataDir() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }

  async loadTasks() {
    await this.ensureDataDir();
    try {
      const data = await fs.readFile(this.tasksFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') return {};
      throw error;
    }
  }

  async saveTasks(tasks) {
    await this.ensureDataDir();
    await fs.writeFile(this.tasksFile, JSON.stringify(tasks, null, 2));
  }

  async saveTask(taskId, taskData) {
    const tasks = await this.loadTasks();
    tasks[taskId] = taskData;
    await this.saveTasks(tasks);
    return taskData;
  }

  async getTask(taskId) {
    const tasks = await this.loadTasks();
    return tasks[taskId] || null;
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
}

module.exports = { Storage };
