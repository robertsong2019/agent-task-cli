/**
 * Plugin CLI Commands
 * 
 * Commands for managing plugins: list, create, validate, install
 * 
 * @module plugin-commands
 */

const { PluginManager } = require('./plugin-manager');
const path = require('path');
const fs = require('fs');
const Table = require('cli-table3');
const chalk = require('chalk');

/**
 * Create plugin command handlers
 * @param {Object} program - Commander program instance
 */
function createPluginCommands(program) {
  const plugins = program.command('plugins');
  
  // List plugins
  plugins
    .command('list')
    .description('List all loaded plugins')
    .option('-v, --verbose', 'Show detailed information')
    .action(async (options) => {
      const manager = new PluginManager();
      
      try {
        await manager.discover();
        const pluginList = manager.listPlugins();
        
        if (pluginList.length === 0) {
          console.log(chalk.yellow('No plugins found.'));
          console.log(chalk.gray(`Plugins directory: ${manager.pluginsDir}`));
          console.log(chalk.gray('Create a plugin with: agent-task plugins create <name>'));
          return;
        }
        
        if (options.verbose) {
          console.log(chalk.bold('\n📦 Loaded Plugins\n'));
          
          for (const plugin of pluginList) {
            console.log(chalk.cyan(`${plugin.name}@${plugin.version}`));
            console.log(chalk.gray(`  ${plugin.description || 'No description'}`));
            console.log(chalk.gray(`  Patterns: ${plugin.patterns.join(', ')}`));
            console.log(chalk.gray(`  Loaded: ${plugin.loadedAt}`));
            console.log();
          }
        } else {
          const table = new Table({
            head: [chalk.white('Plugin'), chalk.white('Version'), chalk.white('Patterns')],
            style: { head: [] }
          });
          
          for (const plugin of pluginList) {
            table.push([
              plugin.name,
              plugin.version,
              plugin.patterns.join('\n')
            ]);
          }
          
          console.log(table.toString());
        }
        
        console.log(chalk.gray(`\nTotal: ${pluginList.length} plugin(s), ${manager.patterns.size} pattern(s)`));
        
      } catch (error) {
        console.error(chalk.red('Error listing plugins:'), error.message);
        process.exit(1);
      }
    });
  
  // Create plugin
  plugins
    .command('create <name>')
    .description('Create a new plugin template')
    .option('-d, --dir <path>', 'Target directory')
    .action(async (name, options) => {
      const manager = new PluginManager();
      const targetDir = options.dir || manager.pluginsDir;
      
      try {
        const pluginPath = await manager.createPluginTemplate(name, targetDir);
        
        console.log(chalk.green('✓ Plugin template created successfully!'));
        console.log(chalk.gray(`  Location: ${pluginPath}`));
        console.log();
        console.log('Next steps:');
        console.log(chalk.cyan(`  1. Edit ${path.join(pluginPath, 'index.js')}`));
        console.log(chalk.cyan(`  2. Update ${path.join(pluginPath, 'plugin.json')}`));
        console.log(chalk.cyan('  3. Test with: agent-task run <task.yaml>'));
        
      } catch (error) {
        console.error(chalk.red('Error creating plugin:'), error.message);
        process.exit(1);
      }
    });
  
  // Validate plugin
  plugins
    .command('validate <path>')
    .description('Validate a plugin manifest and structure')
    .action(async (pluginPath) => {
      const manager = new PluginManager();
      
      // Resolve path
      const resolvedPath = path.resolve(pluginPath);
      
      console.log(chalk.bold('\n🔍 Validating plugin...\n'));
      console.log(chalk.gray(`Path: ${resolvedPath}`));
      
      // Check directory exists
      if (!fs.existsSync(resolvedPath)) {
        console.log(chalk.red('✗ Plugin directory not found'));
        process.exit(1);
      }
      console.log(chalk.green('✓ Directory exists'));
      
      // Check manifest
      const manifestPath = path.join(resolvedPath, 'plugin.json');
      if (!fs.existsSync(manifestPath)) {
        console.log(chalk.red('✗ plugin.json not found'));
        process.exit(1);
      }
      console.log(chalk.green('✓ plugin.json found'));
      
      // Validate manifest
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const validation = manager.validateManifest(manifest);
        
        if (validation.valid) {
          console.log(chalk.green('✓ Manifest is valid'));
          
          console.log();
          console.log(chalk.bold('Manifest details:'));
          console.log(`  Name: ${chalk.cyan(manifest.name)}`);
          console.log(`  Version: ${manifest.version}`);
          console.log(`  Main: ${manifest.main}`);
          console.log(`  Patterns: ${manifest.patterns?.length || 0}`);
          
          if (manifest.patterns) {
            for (const pattern of manifest.patterns) {
              console.log(chalk.gray(`    - ${pattern.name} (${pattern.export})`));
            }
          }
        } else {
          console.log(chalk.red('✗ Manifest validation failed:'));
          for (const error of validation.errors) {
            console.log(chalk.red(`  - ${error}`));
          }
          process.exit(1);
        }
      } catch (error) {
        console.log(chalk.red('✗ Invalid JSON in plugin.json:'), error.message);
        process.exit(1);
      }
      
      // Check main file
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const mainPath = path.join(resolvedPath, manifest.main);
      
      if (!fs.existsSync(mainPath)) {
        console.log(chalk.red(`✗ Main file not found: ${manifest.main}`));
        process.exit(1);
      }
      console.log(chalk.green(`✓ Main file exists: ${manifest.main}`));
      
      // Try to load and validate pattern
      try {
        delete require.cache[require.resolve(mainPath)];
        const pluginModule = require(mainPath);
        
        for (const patternDef of manifest.patterns) {
          const PatternClass = pluginModule[patternDef.export] || pluginModule.default;
          
          if (!PatternClass) {
            console.log(chalk.red(`✗ Pattern export not found: ${patternDef.export}`));
            continue;
          }
          
          try {
            manager.validatePattern(PatternClass, patternDef.name);
            console.log(chalk.green(`✓ Pattern ${patternDef.name} is valid`));
          } catch (error) {
            console.log(chalk.red(`✗ Pattern ${patternDef.name} invalid: ${error.message}`));
          }
        }
      } catch (error) {
        console.log(chalk.red('✗ Failed to load plugin module:'), error.message);
        process.exit(1);
      }
      
      console.log();
      console.log(chalk.green.bold('✓ Plugin validation passed!'));
    });
  
  // Show patterns
  plugins
    .command('patterns')
    .description('List all available patterns (built-in and plugin)')
    .action(async () => {
      const manager = new PluginManager();
      
      try {
        await manager.discover();
        const patterns = manager.getAllPatterns();
        
        // Built-in patterns
        const builtIn = ['work-crew', 'supervisor', 'pipeline', 'council', 'auto-routing'];
        
        console.log(chalk.bold('\n📋 Available Patterns\n'));
        
        console.log(chalk.cyan('Built-in:'));
        for (const name of builtIn) {
          console.log(`  • ${name}`);
        }
        
        if (patterns.length > 0) {
          console.log();
          console.log(chalk.cyan('Plugin patterns:'));
          
          const table = new Table({
            head: [chalk.white('Pattern'), chalk.white('Plugin'), chalk.white('Description')],
            style: { head: [] }
          });
          
          for (const pattern of patterns) {
            table.push([
              pattern.name,
              pattern.plugin,
              pattern.description || '-'
            ]);
          }
          
          console.log(table.toString());
        }
        
      } catch (error) {
        console.error(chalk.red('Error listing patterns:'), error.message);
        process.exit(1);
      }
    });
  
  // Reload plugins
  plugins
    .command('reload [name]')
    .description('Reload all plugins or a specific plugin')
    .action(async (name) => {
      const manager = new PluginManager();
      
      try {
        await manager.discover();
        
        if (name) {
          console.log(chalk.cyan(`Reloading plugin: ${name}`));
          await manager.reloadPlugin(name);
          console.log(chalk.green(`✓ Plugin ${name} reloaded`));
        } else {
          console.log(chalk.cyan('Reloading all plugins...'));
          
          for (const [pluginName] of manager.plugins) {
            await manager.reloadPlugin(pluginName);
            console.log(chalk.green(`  ✓ ${pluginName}`));
          }
          
          console.log(chalk.green(`\n✓ All plugins reloaded`));
        }
        
      } catch (error) {
        console.error(chalk.red('Error reloading plugins:'), error.message);
        process.exit(1);
      }
    });
  
  // Plugin stats
  plugins
    .command('stats')
    .description('Show plugin system statistics')
    .action(async () => {
      const manager = new PluginManager();
      
      try {
        await manager.discover();
        const stats = manager.getStats();
        
        console.log(chalk.bold('\n📊 Plugin System Statistics\n'));
        console.log(`  Plugins loaded: ${stats.pluginsLoaded}`);
        console.log(`  Patterns registered: ${stats.patternsRegistered}`);
        console.log(`  Hooks registered: ${stats.hooksRegistered}`);
        
        if (stats.plugins.length > 0) {
          console.log();
          console.log('  Loaded plugins:');
          for (const name of stats.plugins) {
            console.log(chalk.gray(`    • ${name}`));
          }
        }
        
      } catch (error) {
        console.error(chalk.red('Error getting stats:'), error.message);
        process.exit(1);
      }
    });
}

module.exports = {
  createPluginCommands
};
