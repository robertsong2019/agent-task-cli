#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const Table = require('cli-table3');
const { Orchestrator } = require('../src/orchestrator');
const { Logger } = require('../src/utils/logger');
const { Storage } = require('../src/utils/storage');

const logger = new Logger();
const storage = new Storage();
const orchestrator = new Orchestrator();

program
  .name('agent-task')
  .description('CLI tool for orchestrating multi-agent tasks')
  .version('1.0.0');

// Run command
program
  .command('run <file>')
  .description('Execute a task from YAML/JSON file')
  .option('--dry-run', 'Preview without execution')
  .option('--timeout <seconds>', 'Task timeout in seconds', parseInt)
  .option('--verbose', 'Enable verbose logging')
  .action(async (file, options) => {
    try {
      const filePath = path.resolve(file);
      const content = await fs.readFile(filePath, 'utf8');
      
      let taskConfig;
      if (file.endsWith('.yaml') || file.endsWith('.yml')) {
        taskConfig = yaml.load(content);
      } else {
        taskConfig = JSON.parse(content);
      }

      if (options.dryRun) {
        console.log(chalk.blue('📋 Task Configuration:'));
        console.log(JSON.stringify(taskConfig, null, 2));
        return;
      }

      const spinner = ora('Starting task execution...').start();
      
      const task = await orchestrator.run(taskConfig, {
        timeout: options.timeout,
        verbose: options.verbose
      });

      task.on('progress', (update) => {
        if (options.verbose) {
          spinner.text = update.message;
        }
      });

      task.on('complete', (results) => {
        spinner.succeed(chalk.green('✓ Task completed successfully!'));
        console.log('\n' + chalk.bold('Results:'));
        console.log(JSON.stringify(results, null, 2));
      });

      task.on('error', (error) => {
        spinner.fail(chalk.red('✗ Task failed'));
        console.error(chalk.red(error.message));
        process.exit(1);
      });

    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// List command
program
  .command('list')
  .description('List all tasks')
  .option('--status <status>', 'Filter by status (running, completed, failed)')
  .action(async (options) => {
    try {
      const tasks = await storage.listTasks(options.status);
      
      if (tasks.length === 0) {
        console.log(chalk.yellow('No tasks found.'));
        return;
      }

      const table = new Table({
        head: [chalk.cyan('ID'), chalk.cyan('Name'), chalk.cyan('Pattern'), chalk.cyan('Status'), chalk.cyan('Created')],
        colWidths: [15, 30, 15, 12, 20]
      });

      tasks.forEach(task => {
        table.push([
          task.id.substring(0, 8),
          task.name,
          task.pattern,
          task.status === 'completed' ? chalk.green(task.status) : 
            task.status === 'failed' ? chalk.red(task.status) : 
            chalk.yellow(task.status),
          new Date(task.createdAt).toLocaleString()
        ]);
      });

      console.log(table.toString());
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Monitor command
program
  .command('monitor <task-id>')
  .description('Monitor task execution in real-time')
  .option('--verbose', 'Enable verbose logging')
  .action(async (taskId, options) => {
    try {
      const task = await storage.getTask(taskId);
      
      if (!task) {
        console.log(chalk.red('Task not found:', taskId));
        process.exit(1);
      }

      console.log(chalk.blue.bold('📋 Task Monitor'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(`${chalk.bold('Task:')} ${task.name}`);
      console.log(`${chalk.bold('Pattern:')} ${task.pattern}`);
      console.log(`${chalk.bold('Status:')} ${task.status}`);
      console.log(chalk.gray('─'.repeat(50)));
      console.log(chalk.bold('\nAgents:'));

      task.agents.forEach((agent, index) => {
        const status = agent.status === 'completed' ? chalk.green('✓') :
          agent.status === 'running' ? chalk.yellow('●') :
          agent.status === 'failed' ? chalk.red('✗') : chalk.gray('○');
        console.log(`  ${status} ${agent.name} - ${agent.role}`);
        if (options.verbose && agent.output) {
          console.log(chalk.gray(`    Output: ${agent.output.substring(0, 100)}...`));
        }
      });

      if (task.status === 'completed') {
        console.log(chalk.green('\n✓ Task completed successfully!'));
        if (task.results) {
          console.log(chalk.bold('\nResults:'));
          console.log(JSON.stringify(task.results, null, 2));
        }
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Export command
program
  .command('export <task-id>')
  .description('Export task results')
  .option('--format <format>', 'Output format (json, markdown)', 'json')
  .option('--output <file>', 'Output file path')
  .action(async (taskId, options) => {
    try {
      const task = await storage.getTask(taskId);
      
      if (!task) {
        console.log(chalk.red('Task not found:', taskId));
        process.exit(1);
      }

      let output;
      
      if (options.format === 'markdown') {
        output = generateMarkdownReport(task);
      } else {
        output = JSON.stringify(task, null, 2);
      }

      if (options.output) {
        await fs.writeFile(options.output, output);
        console.log(chalk.green(`✓ Results exported to ${options.output}`));
      } else {
        console.log(output);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Cancel command
program
  .command('cancel <task-id>')
  .description('Cancel a running task')
  .action(async (taskId) => {
    try {
      const task = await orchestrator.cancel(taskId);
      console.log(chalk.green(`✓ Task ${taskId} cancelled`));
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Patterns command
program
  .command('patterns')
  .description('List available orchestration patterns')
  .action(() => {
    const patterns = [
      {
        name: 'work-crew',
        description: 'Multiple agents work in parallel on the same task',
        useCase: 'Multi-perspective analysis, validation, consensus building'
      },
      {
        name: 'supervisor',
        description: 'Supervisor dynamically decomposes and assigns tasks',
        useCase: 'Complex projects requiring adaptive planning'
      },
      {
        name: 'pipeline',
        description: 'Sequential stages with validation gates',
        useCase: 'Data processing, content creation workflows'
      },
      {
        name: 'council',
        description: 'Multi-expert decision making with discussion',
        useCase: 'Strategic decisions, ethical evaluations, debates'
      },
      {
        name: 'auto-routing',
        description: 'Automatically route tasks to specialized agents',
        useCase: 'Mixed-type tasks requiring different expertise'
      }
    ];

    console.log(chalk.blue.bold('\n📋 Available Orchestration Patterns\n'));
    
    patterns.forEach(pattern => {
      console.log(chalk.bold.green(pattern.name));
      console.log(chalk.gray('  Description:'), pattern.description);
      console.log(chalk.gray('  Use Case:'), pattern.useCase);
      console.log();
    });
  });

function generateMarkdownReport(task) {
  let markdown = `# Task Report: ${task.name}\n\n`;
  markdown += `**Pattern:** ${task.pattern}\n`;
  markdown += `**Status:** ${task.status}\n`;
  markdown += `**Created:** ${new Date(task.createdAt).toLocaleString()}\n\n`;
  
  markdown += `## Agents\n\n`;
  task.agents.forEach(agent => {
    markdown += `### ${agent.name}\n`;
    markdown += `- **Role:** ${agent.role}\n`;
    markdown += `- **Status:** ${agent.status}\n`;
    if (agent.output) {
      markdown += `- **Output:**\n\`\`\`\n${agent.output}\n\`\`\`\n`;
    }
    markdown += `\n`;
  });

  if (task.results) {
    markdown += `## Results\n\n`;
    markdown += '```json\n';
    markdown += JSON.stringify(task.results, null, 2);
    markdown += '\n```\n';
  }

  return markdown;
}

program.parse();
