/**
 * Plugin Manager for Agent Task CLI
 * 
 * Enables loading, validation, and management of custom pattern plugins.
 * 
 * @module plugin-manager
 */

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { Logger } = require('../utils/logger');

/**
 * Plugin manifest schema version
 */
const MANIFEST_VERSION = '1.0.0';

/**
 * Required fields in plugin manifest
 */
const REQUIRED_MANIFEST_FIELDS = [
  'name',
  'version',
  'main',
  'patterns'
];

/**
 * Plugin Manager class
 * Handles plugin discovery, loading, validation, and lifecycle
 */
class PluginManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.logger = new Logger();
    this.pluginsDir = options.pluginsDir || path.join(process.cwd(), 'plugins');
    this.plugins = new Map();
    this.patterns = new Map();
    this.hooks = new Map();
    this.loaded = false;
    this.options = options;
  }

  /**
   * Discover and load all plugins from plugins directory
   * @returns {Promise<Map>} Map of loaded plugins
   */
  async discover() {
    this.logger.info('Discovering plugins...');
    
    if (!fs.existsSync(this.pluginsDir)) {
      this.logger.info(`Plugins directory not found: ${this.pluginsDir}`);
      fs.mkdirSync(this.pluginsDir, { recursive: true });
      return this.plugins;
    }

    const entries = fs.readdirSync(this.pluginsDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const pluginPath = path.join(this.pluginsDir, entry.name);
        try {
          await this.loadPlugin(pluginPath);
        } catch (error) {
          this.logger.error(`Failed to load plugin from ${pluginPath}:`, error.message);
          this.emit('plugin:error', { path: pluginPath, error });
        }
      }
    }
    
    this.loaded = true;
    this.logger.info(`Discovered ${this.plugins.size} plugin(s)`);
    this.emit('plugins:discovered', { count: this.plugins.size });
    
    return this.plugins;
  }

  /**
   * Load a plugin from a directory
   * @param {string} pluginPath - Path to plugin directory
   * @returns {Promise<Object>} Loaded plugin
   */
  async loadPlugin(pluginPath) {
    const manifestPath = path.join(pluginPath, 'plugin.json');
    
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Plugin manifest not found: ${manifestPath}`);
    }
    
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    
    // Validate manifest
    const validation = this.validateManifest(manifest);
    if (!validation.valid) {
      throw new Error(`Invalid plugin manifest: ${validation.errors.join(', ')}`);
    }
    
    // Check for duplicate
    if (this.plugins.has(manifest.name)) {
      throw new Error(`Plugin already loaded: ${manifest.name}`);
    }
    
    // Load main module
    const mainPath = path.join(pluginPath, manifest.main);
    if (!fs.existsSync(mainPath)) {
      throw new Error(`Plugin main file not found: ${mainPath}`);
    }
    
    // Clear require cache for hot reload
    delete require.cache[require.resolve(mainPath)];
    
    const pluginModule = require(mainPath);
    
    // Build plugin object
    const plugin = {
      manifest,
      path: pluginPath,
      module: pluginModule,
      patterns: new Map(),
      hooks: new Map(),
      loadedAt: new Date().toISOString()
    };
    
    // Register patterns from plugin
    for (const patternDef of manifest.patterns) {
      const PatternClass = pluginModule[patternDef.export] || pluginModule.default;
      
      if (!PatternClass) {
        throw new Error(`Pattern export not found: ${patternDef.export}`);
      }
      
      // Validate pattern class
      this.validatePattern(PatternClass, patternDef.name);
      
      plugin.patterns.set(patternDef.name, {
        Class: PatternClass,
        definition: patternDef
      });
      
      // Register globally
      this.patterns.set(patternDef.name, {
        plugin: manifest.name,
        Class: PatternClass,
        definition: patternDef
      });
      
      this.logger.info(`Registered pattern: ${patternDef.name} (from ${manifest.name})`);
    }
    
    // Register hooks if provided
    if (manifest.hooks && pluginModule.hooks) {
      for (const hookName of manifest.hooks) {
        const hookHandler = pluginModule.hooks[hookName];
        if (typeof hookHandler === 'function') {
          plugin.hooks.set(hookName, hookHandler);
          
          if (!this.hooks.has(hookName)) {
            this.hooks.set(hookName, []);
          }
          this.hooks.get(hookName).push({
            plugin: manifest.name,
            handler: hookHandler
          });
          
          this.logger.info(`Registered hook: ${hookName} (from ${manifest.name})`);
        }
      }
    }
    
    // Call plugin init if available
    if (typeof pluginModule.init === 'function') {
      await pluginModule.init(this.options);
    }
    
    this.plugins.set(manifest.name, plugin);
    this.emit('plugin:loaded', { name: manifest.name, patterns: manifest.patterns.map(p => p.name) });
    
    this.logger.info(`Loaded plugin: ${manifest.name}@${manifest.version}`);
    
    return plugin;
  }

  /**
   * Unload a plugin by name
   * @param {string} name - Plugin name
   * @returns {boolean} Success
   */
  async unloadPlugin(name) {
    const plugin = this.plugins.get(name);
    
    if (!plugin) {
      return false;
    }
    
    // Call plugin destroy if available
    if (typeof plugin.module.destroy === 'function') {
      await plugin.module.destroy();
    }
    
    // Unregister patterns
    for (const [patternName] of plugin.patterns) {
      this.patterns.delete(patternName);
      this.logger.info(`Unregistered pattern: ${patternName}`);
    }
    
    // Unregister hooks
    for (const [hookName] of plugin.hooks) {
      const handlers = this.hooks.get(hookName);
      if (handlers) {
        const filtered = handlers.filter(h => h.plugin !== name);
        if (filtered.length > 0) {
          this.hooks.set(hookName, filtered);
        } else {
          this.hooks.delete(hookName);
        }
      }
    }
    
    this.plugins.delete(name);
    this.emit('plugin:unloaded', { name });
    
    this.logger.info(`Unloaded plugin: ${name}`);
    
    return true;
  }

  /**
   * Reload a plugin
   * @param {string} name - Plugin name
   * @returns {Promise<Object>} Reloaded plugin
   */
  async reloadPlugin(name) {
    const plugin = this.plugins.get(name);
    
    if (!plugin) {
      throw new Error(`Plugin not found: ${name}`);
    }
    
    await this.unloadPlugin(name);
    return this.loadPlugin(plugin.path);
  }

  /**
   * Validate plugin manifest
   * @param {Object} manifest - Plugin manifest
   * @returns {Object} Validation result { valid, errors }
   */
  validateManifest(manifest) {
    const errors = [];
    
    // Check required fields
    for (const field of REQUIRED_MANIFEST_FIELDS) {
      if (!manifest[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    }
    
    // Validate patterns array
    if (manifest.patterns) {
      if (!Array.isArray(manifest.patterns)) {
        errors.push('patterns must be an array');
      } else {
        for (let i = 0; i < manifest.patterns.length; i++) {
          const pattern = manifest.patterns[i];
          if (!pattern.name) {
            errors.push(`patterns[${i}].name is required`);
          }
          if (!pattern.export) {
            errors.push(`patterns[${i}].export is required`);
          }
        }
      }
    }
    
    // Validate version format
    if (manifest.version && !this.isValidVersion(manifest.version)) {
      errors.push('Invalid version format (expected semver)');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate a pattern class
   * @param {Function} PatternClass - Pattern class constructor
   * @param {string} patternName - Pattern name for error messages
   */
  validatePattern(PatternClass, patternName) {
    if (typeof PatternClass !== 'function') {
      throw new Error(`Pattern ${patternName} must be a class/constructor`);
    }
    
    // Check required methods
    const requiredMethods = ['initializeAgents', 'execute'];
    const prototype = PatternClass.prototype;
    
    for (const method of requiredMethods) {
      if (typeof prototype[method] !== 'function') {
        throw new Error(`Pattern ${patternName} must implement ${method}() method`);
      }
    }
  }

  /**
   * Check if version string is valid semver
   * @param {string} version - Version string
   * @returns {boolean}
   */
  isValidVersion(version) {
    return /^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version);
  }

  /**
   * Get a pattern class by name
   * @param {string} name - Pattern name
   * @returns {Function|null} Pattern class or null
   */
  getPattern(name) {
    const pattern = this.patterns.get(name);
    return pattern ? pattern.Class : null;
  }

  /**
   * Get all registered patterns
   * @returns {Array} Array of pattern info
   */
  getAllPatterns() {
    const patterns = [];
    
    for (const [name, info] of this.patterns) {
      patterns.push({
        name,
        plugin: info.plugin,
        description: info.definition.description || '',
        version: info.definition.version || '1.0.0'
      });
    }
    
    return patterns;
  }

  /**
   * Execute hooks for a given event
   * @param {string} hookName - Hook name
   * @param {*} data - Data to pass to hooks
   * @returns {Promise<Array>} Results from all hooks
   */
  async executeHooks(hookName, data) {
    const handlers = this.hooks.get(hookName);
    
    if (!handlers || handlers.length === 0) {
      return [];
    }
    
    const results = [];
    
    for (const { plugin, handler } of handlers) {
      try {
        const result = await handler(data);
        results.push({ plugin, result });
      } catch (error) {
        this.logger.error(`Hook ${hookName} failed in plugin ${plugin}:`, error);
        results.push({ plugin, error: error.message });
      }
    }
    
    return results;
  }

  /**
   * Get plugin statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      pluginsLoaded: this.plugins.size,
      patternsRegistered: this.patterns.size,
      hooksRegistered: this.hooks.size,
      plugins: Array.from(this.plugins.keys())
    };
  }

  /**
   * List all loaded plugins
   * @returns {Array} Plugin info array
   */
  listPlugins() {
    const plugins = [];
    
    for (const [name, plugin] of this.plugins) {
      plugins.push({
        name,
        version: plugin.manifest.version,
        description: plugin.manifest.description || '',
        patterns: Array.from(plugin.patterns.keys()),
        loadedAt: plugin.loadedAt
      });
    }
    
    return plugins;
  }

  /**
   * Create a plugin template
   * @param {string} name - Plugin name
   * @param {string} targetDir - Target directory
   * @returns {Promise<string>} Created plugin path
   */
  async createPluginTemplate(name, targetDir = this.pluginsDir) {
    const pluginPath = path.join(targetDir, name);
    
    if (fs.existsSync(pluginPath)) {
      throw new Error(`Plugin directory already exists: ${pluginPath}`);
    }
    
    fs.mkdirSync(pluginPath, { recursive: true });
    
    // Create manifest
    const manifest = {
      name,
      version: '1.0.0',
      description: `Custom pattern plugin: ${name}`,
      main: 'index.js',
      author: '',
      license: 'MIT',
      patterns: [
        {
          name: `${name}-pattern`,
          export: 'default',
          description: 'Custom pattern implementation'
        }
      ],
      hooks: []
    };
    
    fs.writeFileSync(
      path.join(pluginPath, 'plugin.json'),
      JSON.stringify(manifest, null, 2)
    );
    
    // Create main file
    const indexContent = `/**
 * ${name} Plugin
 * 
 * Custom pattern plugin for agent-task-cli
 */

const { BasePattern } = require('agent-task-cli/src/plugins/base-pattern');

/**
 * Custom Pattern Implementation
 */
class ${this.toPascalCase(name)}Pattern extends BasePattern {
  constructor(config, options = {}) {
    super(config, options);
    // Add custom initialization here
  }

  /**
   * Initialize agents for this pattern
   * @returns {Array<Agent>} Array of initialized agents
   */
  initializeAgents() {
    // TODO: Implement agent initialization
    // Example:
    // return this.config.agents.map(agentConfig => 
    //   this.createAgent(agentConfig)
    // );
    return [];
  }

  /**
   * Execute the pattern
   * @param {Function} progressCallback - Callback for progress updates
   * @returns {Promise<Object>} Execution results
   */
  async execute(progressCallback) {
    this.logger.info('Executing ${name} pattern...');
    
    // TODO: Implement pattern execution logic
    // Use progressCallback(agentId, status, output) to report progress
    
    return {
      pattern: '${name}',
      status: 'completed',
      results: []
    };
  }
}

module.exports = ${this.toPascalCase(name)}Pattern;
module.exports.default = ${this.toPascalCase(name)}Pattern;

// Optional: Plugin hooks
module.exports.hooks = {
  // 'task:before': async (task) => { ... },
  // 'task:after': async (result) => { ... }
};

// Optional: Plugin initialization
module.exports.init = async (options) => {
  console.log('${name} plugin initialized');
};

// Optional: Plugin cleanup
module.exports.destroy = async () => {
  console.log('${name} plugin destroyed');
};
`;
    
    fs.writeFileSync(path.join(pluginPath, 'index.js'), indexContent);
    
    // Create README
    const readme = `# ${name} Plugin

Custom pattern plugin for agent-task-cli.

## Installation

Place this directory in your plugins folder.

## Usage

\`\`\`yaml
name: "My Task"
pattern: "${name}-pattern"
agents:
  - name: "agent-1"
    role: "Worker"
task: "Execute task"
\`\`\`

## Patterns

- \`${name}-pattern\` - Custom pattern implementation

## Development

Edit \`index.js\` to customize the pattern behavior.

## License

MIT
`;
    
    fs.writeFileSync(path.join(pluginPath, 'README.md'), readme);
    
    this.logger.info(`Created plugin template: ${pluginPath}`);
    
    return pluginPath;
  }

  /**
   * Convert string to PascalCase
   * @param {string} str - Input string
   * @returns {string} PascalCase string
   */
  toPascalCase(str) {
    return str
      .split(/[-_\s]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }
}

module.exports = {
  PluginManager,
  MANIFEST_VERSION,
  REQUIRED_MANIFEST_FIELDS
};
