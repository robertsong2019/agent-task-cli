#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const { Table } = require('cli-table3');
const fs = require('fs').promises;
const path = require('path');
const { EnhancedOrchestrator } = require('./orchestrator-enhanced');
const PerformanceManager = require('./utils/performance');

const program = new Command();
const orchestrator = new EnhancedOrchestrator({
  enableCache: true,
  enableRetries: true,
  enableMonitoring: true
});

// Global settings
let settings = {
  format: 'table',
  timeout: 300000,
  verbose: false,
  autoCleanup: true
};

// Task storage
let taskHistory = [];

program
  .name('agent-task')
  .description('Enhanced CLI for orchestrating multi-agent tasks')
  .version('2.0.0');

// Settings command
program
  .command('config')
  .description('Configure CLI settings')
  .option('-f, --format <format>', 'Output format (table|json|yaml)', 'table')
  .option('-t, --timeout <timeout>', 'Default timeout in milliseconds', '300000')
  .option('-v, --verbose', 'Verbose output')
  .option('--no-auto-cleanup', 'Disable automatic task cleanup')
  .action(async (options) => {
    settings = {
      ...settings,
      ...options
    };
    
    console.log(chalk.green('✓ Configuration updated:'));
    console.log(`  Format: ${settings.format}`);
    console.log(`  Timeout: ${settings.timeout}ms`);
    console.log(`  Verbose: ${settings.verbose}`);
    console.log(`  Auto-cleanup: ${settings.autoCleanup}`);
  });

// Enhanced run command with more features
program
  .command('run <file>')
  .description('Run a task from file with enhanced features')
  .option('-d, --dry-run', 'Preview task without execution')
  .option('-f, --format <format>', 'Output format (table|json|yaml)', settings.format)
  .option('-t, --timeout <timeout>', 'Task timeout in milliseconds', settings.timeout)
  .option('-v, --verbose', 'Verbose output', settings.verbose)
  .option('--no-cache', 'Disable caching')
  .option('--no-retry', 'Disable retry mechanism')
  .option('--monitor', 'Enable real-time monitoring')
  .option('--save <file>', 'Save results to file')
  .action(async (file, options) => {
    try {
      // Load task configuration
      const config = await loadTaskConfig(file);
      
      // Apply CLI options to config
      const runOptions = {
        ...options,
        disableCache: options.noCache,
        disableRetries: options.noRetry
      };
      
      if (options.dryRun) {
        await dryRun(config);
        return;
      }
      
      // Run task with enhanced monitoring
      const spinner = ora('Initializing enhanced task...').start();
      
      const task = await orchestrator.run(config, runOptions);
      
      // Setup monitoring if enabled
      if (options.monitor) {
        await monitorTask(task);
      }
      
      spinner.text = 'Executing task...';
      const result = await task.executionPromise;
      
      spinner.succeed('Task completed successfully!');
      
      // Display results
      displayResults(result, options.format);
      
      // Save results if requested
      if (options.save) {
        await saveResults(result, options.save);
      }
      
      // Add to history
      taskHistory.push({
        id: task.id,
        name: config.name,
        status: task.status,
        duration: result.executionTime,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error(chalk.red(`✗ Task failed: ${error.message}`));
      process.exit(1);
    }
  });

// Monitor command for real-time task monitoring
program
  .command('monitor <taskId>')
  .description('Monitor a task in real-time')
  .option('-i, --interval <interval>', 'Update interval in milliseconds', 1000)
  .option('-v, --verbose', 'Verbose output')
  .action(async (taskId, options) => {
    try {
      const task = await getTask(taskId);
      if (!task) {
        console.error(chalk.red(`✗ Task ${taskId} not found`));
        process.exit(1);
      }
      
      await monitorTask(task, options);
    } catch (error) {
      console.error(chalk.red(`✗ Monitoring failed: ${error.message}`));
      process.exit(1);
    }
  });

// Enhanced list command with more information
program
  .command('list')
  .description('List all tasks with enhanced information')
  .option('-a, --all', 'Show all tasks including completed')
  .option('-s, --status <status>', 'Filter by status (running|completed|failed|cancelled)')
  .option('-f, --format <format>', 'Output format (table|json)', settings.format)
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    try {
      const tasks = await getTaskList(options);
      displayTaskList(tasks, options.format, options.verbose);
    } catch (error) {
      console.error(chalk.red(`✗ Failed to list tasks: ${error.message}`));
      process.exit(1);
    }
  });

// Enhanced status command with performance metrics
program
  .command('status')
  .description('Show system status and performance metrics')
  .option('-f, --format <format>', 'Output format (table|json)', settings.format)
  .action(async (options) => {
    try {
      const health = orchestrator.getHealthStatus();
      const metrics = orchestrator.performance.getMetrics();
      
      if (options.format === 'json') {
        console.log(JSON.stringify({ health, metrics }, null, 2));
      } else {
        displaySystemStatus(health, metrics);
      }
    } catch (error) {
      console.error(chalk.red(`✗ Status check failed: ${error.message}`));
      process.exit(1);
    }
  });

// Cancel command with enhanced features
program
  .command('cancel <taskId>')
  .description('Cancel a running task')
  .option('-f, --force', 'Force cancellation even if task is not running')
  .action(async (taskId, options) => {
    try {
      const task = await getTask(taskId);
      if (!task) {
        console.error(chalk.red(`✗ Task ${taskId} not found`));
        process.exit(1);
      }
      
      if (task.status !== 'running' && !options.force) {
        console.error(chalk.red(`✗ Task ${taskId} is not running (status: ${task.status})`));
        process.exit(1);
      }
      
      const spinner = ora('Cancelling task...').start();
      const success = await orchestrator.cancel(taskId);
      
      if (success) {
        spinner.succeed(`Task ${taskId} cancelled successfully`);
      } else {
        spinner.fail(`Failed to cancel task ${taskId}`);
      }
    } catch (error) {
      console.error(chalk.red(`✗ Cancellation failed: ${error.message}`));
      process.exit(1);
    }
  });

// Export command with multiple format support
program
  .command('export <taskId>')
  .description('Export task results')
  .option('-f, --format <format>', 'Output format (json|yaml|markdown)', 'json')
  .option('-o, --output <file>', 'Output file (default: stdout)')
  .option('-i, --include-metadata', 'Include metadata and performance metrics')
  .action(async (taskId, options) => {
    try {
      const task = await getTask(taskId);
      if (!task) {
        console.error(chalk.red(`✗ Task ${taskId} not found`));
        process.exit(1);
      }
      
      const exportData = options.includeMetadata 
        ? task.toJSON()
        : task.results;
      
      await exportResults(exportData, options.format, options.output);
    } catch (error) {
      console.error(chalk.red(`✗ Export failed: ${error.message}`));
      process.exit(1);
    }
  });

// Performance analysis command
program
  .command('analyze')
  .description('Analyze performance and generate insights')
  .option('-f, --format <format>', 'Output format (table|json)', settings.format)
  .option('-s, --since <date>', 'Analyze since date (YYYY-MM-DD)')
  .action(async (options) => {
    try {
      const analysis = await analyzePerformance(options);
      displayPerformanceAnalysis(analysis, options.format);
    } catch (error) {
      console.error(chalk.red(`✗ Analysis failed: ${error.message}`));
      process.exit(1);
    }
  });

// Interactive mode
program
  .command('interactive')
  .description('Start interactive mode')
  .action(async () => {
    console.log(chalk.blue('🚀 Enhanced Agent Task CLI - Interactive Mode'));
    console.log(chalk.gray('Type "help" for available commands or "exit" to quit'));
    
    // Simple interactive loop
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.setPrompt('agent-task> ');
    rl.prompt();
    
    rl.on('line', async (input) => {
      const command = input.trim();
      
      if (command === 'exit' || command === 'quit') {
        rl.close();
        return;
      }
      
      if (command === 'help') {
        console.log('Available commands:');
        console.log('  status - Show system status');
        console.log('  list - List recent tasks');
        console.log('  patterns - Show available patterns');
        console.log('  help - Show this help');
        console.log('  exit - Exit interactive mode');
      } else if (command === 'status') {
        const health = orchestrator.getHealthStatus();
        displaySystemStatus(health, orchestrator.performance.getMetrics());
      } else if (command === 'list') {
        const tasks = await getTaskList({ limit: 10 });
        displayTaskList(tasks, 'table', false);
      } else if (command === 'patterns') {
        displayPatterns();
      } else if (command) {
        console.log(chalk.red(`✗ Unknown command: ${command}`));
      }
      
      rl.prompt();
    });
    
    rl.on('close', () => {
      console.log(chalk.blue('Goodbye!'));
      process.exit(0);
    });
  });

// Pattern information command
program
  .command('patterns')
  .description('Show available orchestration patterns')
  .option('-v, --verbose', 'Show detailed pattern information')
  .action(async (options) => {
    displayPatterns(options.verbose);
  });

// Helper functions
async function loadTaskConfig(file) {
  try {
    const content = await fs.readFile(file, 'utf8');
    const ext = path.extname(file).toLowerCase();
    
    if (ext === '.json') {
      return JSON.parse(content);
    } else if (ext === '.yaml' || ext === '.yml') {
      const yaml = require('js-yaml');
      return yaml.load(content);
    } else {
      throw new Error('Unsupported file format. Use .json, .yaml, or .yml');
    }
  } catch (error) {
    throw new Error(`Failed to load task config: ${error.message}`);
  }
}

async function dryRun(config) {
  console.log(chalk.blue('🔍 Dry Run - Task Preview'));
  console.log(chalk.gray('This task would be executed with the following configuration:'));
  console.log('');
  
  const preview = {
    name: config.name,
    pattern: config.pattern,
    agents: config.agents.map(agent => ({
      name: agent.name,
      role: agent.role,
      skills: agent.skills
    })),
    task: config.task,
    convergence: config.convergence
  };
  
  console.log(JSON.stringify(preview, null, 2));
  console.log('');
  console.log(chalk.green('✓ Task configuration is valid'));
  console.log(chalk.gray('Use --dry-run flag to preview without execution'));
}

async function monitorTask(task, options = {}) {
  const interval = options.interval || 1000;
  let lastUpdate = 0;
  
  const monitorInterval = setInterval(() => {
    const now = Date.now();
    
    // Get latest progress
    const latestProgress = task.progressHistory[task.progressHistory.length - 1];
    
    if (latestProgress && now - lastUpdate > interval) {
      console.log(`[${new Date().toLocaleTimeString()}] ${latestProgress.message}`);
      lastUpdate = now;
    }
    
    if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
      clearInterval(monitorInterval);
      
      if (task.status === 'completed') {
        console.log(chalk.green(`✓ Task completed in ${task.results.executionTime}ms`));
      } else if (task.status === 'failed') {
        console.log(chalk.red(`✗ Task failed: ${task.error}`));
      } else if (task.status === 'cancelled') {
        console.log(chalk.yellow('• Task cancelled'));
      }
    }
  }, interval);
  
  return new Promise((resolve) => {
    task.executionPromise.finally(() => {
      clearInterval(monitorInterval);
      resolve();
    });
  });
}

function displayResults(result, format) {
  if (format === 'json') {
    console.log(JSON.stringify(result, null, 2));
  } else if (format === 'yaml') {
    const yaml = require('js-yaml');
    console.log(yaml.dump(result));
  } else {
    displayResultsAsTable(result);
  }
}

function displayResultsAsTable(result) {
  const table = new Table({
    head: ['Metric', 'Value'],
    colWidths: [30, 50]
  });
  
  table.push(
    ['Pattern', result.pattern],
    ['Task', result.task],
    ['Execution Time', `${result.executionTime}ms`],
    ['Strategy', result.strategy || 'N/A'],
    ['Status', result.analysis?.convergenceQuality || 'N/A']
  );
  
  if (result.agentResults) {
    table.push(
      ['Total Agents', result.agentResults.length],
      ['Successful Agents', result.analysis?.successfulAgents || 0],
      ['Failed Agents', result.analysis?.failedAgents || 0]
    );
  }
  
  console.log(table.toString());
  
  if (result.analysis?.recommendations?.length > 0) {
    console.log(chalk.yellow('\n📋 Recommendations:'));
    result.analysis.recommendations.forEach(rec => {
      console.log(`  • ${rec}`);
    });
  }
}

async function saveResults(result, file) {
  try {
    const content = JSON.stringify(result, null, 2);
    await fs.writeFile(file, content);
    console.log(chalk.green(`✓ Results saved to ${file}`));
  } catch (error) {
    console.error(chalk.red(`✗ Failed to save results: ${error.message}`));
  }
}

async function getTask(taskId) {
  try {
    const task = orchestrator.activeTasks.get(taskId);
    if (task) {
      return task;
    }
    
    // Load from storage
    const storage = require('./utils/storage');
    const taskData = await storage.getTask(taskId);
    if (taskData) {
      return Object.assign(new (require('./orchestrator-enhanced').EnhancedTask)(), taskData);
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

async function getTaskList(options) {
  // Get active tasks
  let tasks = Array.from(orchestrator.activeTasks.values());
  
  // Filter by status
  if (options.status) {
    tasks = tasks.filter(task => task.status === options.status);
  }
  
  // Load from storage if needed
  if (options.all) {
    try {
      const storage = require('./utils/storage');
      const storedTasks = await storage.getAllTasks();
      tasks.push(...storedTasks);
    } catch (error) {
      // Ignore storage errors
    }
  }
  
  // Sort by creation time
  tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  // Limit results
  if (options.limit) {
    tasks = tasks.slice(0, options.limit);
  }
  
  return tasks;
}

function displayTaskList(tasks, format, verbose) {
  if (format === 'json') {
    console.log(JSON.stringify(tasks, null, 2));
    return;
  }
  
  const table = new Table({
    head: ['ID', 'Name', 'Status', 'Duration', 'Created'],
    colWidths: [12, 30, 15, 10, 20]
  });
  
  tasks.forEach(task => {
    table.push([
      task.id.slice(0, 8),
      task.config.name,
      task.status,
      task.results?.executionTime ? `${task.results.executionTime}ms` : '-',
      new Date(task.createdAt).toLocaleTimeString()
    ]);
  });
  
  console.log(table.toString());
}

function displaySystemStatus(health, metrics) {
  const table = new Table({
    head: ['Metric', 'Value'],
    colWidths: [30, 30]
  });
  
  table.push(
    ['Active Tasks', health.activeTasks],
    ['Registered Agents', health.registeredAgents],
    ['Total Requests', metrics.totalRequests],
    ['Cache Hits', metrics.cacheHits],
    ['Cache Misses', metrics.cacheMisses],
    ['Cache Hit Rate', `${metrics.cacheHitRate}%`],
    ['Retry Count', metrics.retryCount],
    ['Avg Execution Time', `${metrics.avgExecutionTime}ms`],
    ['Cache Size', metrics.cacheSize],
    ['Uptime', `${Math.round((Date.now() - health.uptime) / 1000)}s`]
  );
  
  console.log(chalk.blue('🚀 System Status'));
  console.log(table.toString());
}

function displayPatterns(verbose) {
  const patterns = [
    { name: 'work-crew', description: 'Multiple agents work in parallel on same task' },
    { name: 'supervisor', description: 'Supervisor agent decomposes and coordinates tasks' },
    { name: 'pipeline', description: 'Sequential stages with validation gates' },
    { name: 'council', description: 'Multi-expert decision making with discussion rounds' },
    { name: 'auto-routing', description: 'Automatic routing to specialized agents' }
  ];
  
  if (verbose) {
    patterns.forEach(pattern => {
      console.log(chalk.blue(`\n📋 ${pattern.name}`));
      console.log(chalk.gray(`   ${pattern.description}`));
    });
  } else {
    const table = new Table({
      head: ['Pattern', 'Description'],
      colWidths: [20, 50]
    });
    
    patterns.forEach(pattern => {
      table.push([pattern.name, pattern.description]);
    });
    
    console.log(table.toString());
  }
}

async function analyzePerformance(options) {
  const metrics = orchestrator.performance.getMetrics();
  const health = orchestrator.getHealthStatus();
  
  return {
    metrics,
    health,
    efficiency: {
      cacheEfficiency: metrics.cacheHitRate,
      agentEfficiency: health.registeredAgents > 0 
        ? (metrics.totalRequests / health.registeredAgents) 
        : 0,
      systemEfficiency: metrics.avgExecutionTime > 0 
        ? (1000 / metrics.avgExecutionTime) 
        : 0
    },
    recommendations: generatePerformanceRecommendations(metrics, health)
  };
}

function generatePerformanceRecommendations(metrics, health) {
  const recommendations = [];
  
  if (metrics.cacheHitRate < 50) {
    recommendations.push('Consider increasing cache TTL or optimizing cache keys');
  }
  
  if (metrics.retryCount > metrics.totalRequests * 0.1) {
    recommendations.push('High retry rate - consider reducing timeout or improving agent reliability');
  }
  
  if (health.activeTasks > 10) {
    recommendations.push('High number of active tasks - consider implementing task prioritization');
  }
  
  if (metrics.avgExecutionTime > 10000) {
    recommendations.push('High average execution time - consider optimizing agent timeouts');
  }
  
  return recommendations;
}

function displayPerformanceAnalysis(analysis, format) {
  if (format === 'json') {
    console.log(JSON.stringify(analysis, null, 2));
    return;
  }
  
  const table = new Table({
    head: ['Metric', 'Value'],
    colWidths: [30, 30]
  });
  
  table.push(
    ['Cache Efficiency', `${analysis.efficiency.cacheEfficiency}%`],
    ['Agent Efficiency', analysis.efficiency.agentEfficiency.toFixed(2)],
    ['System Efficiency', analysis.efficiency.systemEfficiency.toFixed(2)]
  );
  
  console.log(chalk.blue('📊 Performance Analysis'));
  console.log(table.toString());
  
  if (analysis.recommendations.length > 0) {
    console.log(chalk.yellow('\n💡 Recommendations:'));
    analysis.recommendations.forEach(rec => {
      console.log(`  • ${rec}`);
    });
  }
}

async function exportResults(data, format, outputFile) {
  let content;
  
  if (format === 'json') {
    content = JSON.stringify(data, null, 2);
  } else if (format === 'yaml') {
    const yaml = require('js-yaml');
    content = yaml.dump(data);
  } else if (format === 'markdown') {
    content = generateMarkdownReport(data);
  } else {
    throw new Error(`Unsupported format: ${format}`);
  }
  
  if (outputFile) {
    await fs.writeFile(outputFile, content);
    console.log(chalk.green(`✓ Results exported to ${outputFile}`));
  } else {
    console.log(content);
  }
}

function generateMarkdownReport(data) {
  const date = new Date().toISOString();
  let report = `# Agent Task Report\n\n`;
  report += `Generated: ${date}\n\n`;
  
  if (data.results) {
    report += `## Task Results\n\n`;
    report += `**Pattern:** ${data.results.pattern}\n`;
    report += `**Execution Time:** ${data.results.executionTime}ms\n`;
    report += `**Status:** ${data.status}\n\n`;
    
    if (data.results.analysis) {
      report += `## Analysis\n\n`;
      report += `**Convergence Quality:** ${data.results.analysis.convergenceQuality}\n`;
      report += `**Successful Agents:** ${data.results.analysis.successfulAgents}\n`;
      report += `**Failed Agents:** ${data.results.analysis.failedAgents}\n\n`;
      
      if (data.results.analysis.recommendations) {
        report += `### Recommendations\n\n`;
        data.results.analysis.recommendations.forEach(rec => {
          report += `- ${rec}\n`;
        });
        report += '\n';
      }
    }
  }
  
  return report;
}

// Handle program errors
process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('Unhandled Rejection at:'), promise, 'reason:', reason);
  process.exit(1);
});

// Parse command line arguments
program.parse();