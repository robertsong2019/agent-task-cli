/**
 * Plugin Manager Tests
 */

const { PluginManager } = require('../src/plugins/plugin-manager');
const { BasePattern } = require('../src/plugins/base-pattern');
const fs = require('fs');
const path = require('path');

// Test directory
const TEST_PLUGINS_DIR = path.join(__dirname, 'test-plugins');

// Helper to create test plugin
function createTestPlugin(name, patternCode) {
  const pluginDir = path.join(TEST_PLUGINS_DIR, name);
  fs.mkdirSync(pluginDir, { recursive: true });
  
  const manifest = {
    name,
    version: '1.0.0',
    description: `Test plugin: ${name}`,
    main: 'index.js',
    patterns: [
      {
        name: `${name}-pattern`,
        export: 'default',
        description: 'Test pattern'
      }
    ]
  };
  
  fs.writeFileSync(
    path.join(pluginDir, 'plugin.json'),
    JSON.stringify(manifest, null, 2)
  );
  
  const code = patternCode || `
const { BasePattern } = require('../../../src/plugins/base-pattern');

class TestPattern extends BasePattern {
  initializeAgents() {
    return [];
  }
  
  async execute(progressCallback) {
    return { success: true, pattern: '${name}' };
  }
}

module.exports = TestPattern;
module.exports.default = TestPattern;
`;
  
  fs.writeFileSync(path.join(pluginDir, 'index.js'), code);
  
  return pluginDir;
}

// Helper to clean up test plugins
function cleanupTestPlugins() {
  if (fs.existsSync(TEST_PLUGINS_DIR)) {
    fs.rmSync(TEST_PLUGINS_DIR, { recursive: true, force: true });
  }
}

describe('PluginManager', () => {
  let manager;
  
  beforeEach(() => {
    cleanupTestPlugins();
    manager = new PluginManager({ pluginsDir: TEST_PLUGINS_DIR });
  });
  
  afterEach(() => {
    cleanupTestPlugins();
  });
  
  describe('constructor', () => {
    test('should create manager with default options', () => {
      const m = new PluginManager();
      expect(m.plugins).toBeInstanceOf(Map);
      expect(m.patterns).toBeInstanceOf(Map);
      expect(m.loaded).toBe(false);
    });
    
    test('should use custom plugins directory', () => {
      expect(manager.pluginsDir).toBe(TEST_PLUGINS_DIR);
    });
  });
  
  describe('validateManifest', () => {
    test('should validate a correct manifest', () => {
      const manifest = {
        name: 'test-plugin',
        version: '1.0.0',
        main: 'index.js',
        patterns: [
          { name: 'test-pattern', export: 'default' }
        ]
      };
      
      const result = manager.validateManifest(manifest);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    test('should fail on missing required fields', () => {
      const manifest = {
        name: 'test-plugin'
      };
      
      const result = manager.validateManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
    
    test('should fail on invalid patterns array', () => {
      const manifest = {
        name: 'test-plugin',
        version: '1.0.0',
        main: 'index.js',
        patterns: 'not-an-array'
      };
      
      const result = manager.validateManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('patterns must be an array');
    });
    
    test('should fail on invalid version format', () => {
      const manifest = {
        name: 'test-plugin',
        version: 'invalid',
        main: 'index.js',
        patterns: []
      };
      
      const result = manager.validateManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid version format (expected semver)');
    });
  });
  
  describe('validatePattern', () => {
    test('should validate a pattern class with required methods', () => {
      class ValidPattern extends BasePattern {
        initializeAgents() { return []; }
        async execute() { return {}; }
      }
      
      expect(() => manager.validatePattern(ValidPattern, 'valid')).not.toThrow();
    });
    
    test('should fail on non-class', () => {
      expect(() => manager.validatePattern('not-a-class', 'invalid'))
        .toThrow('must be a class/constructor');
    });
    
    test('should fail on missing initializeAgents', () => {
      class InvalidPattern {}
      
      expect(() => manager.validatePattern(InvalidPattern, 'invalid'))
        .toThrow('must implement initializeAgents()');
    });
    
    test('should fail on missing execute', () => {
      class InvalidPattern {
        initializeAgents() { return []; }
      }
      
      expect(() => manager.validatePattern(InvalidPattern, 'invalid'))
        .toThrow('must implement execute()');
    });
  });
  
  describe('loadPlugin', () => {
    test('should load a valid plugin', async () => {
      createTestPlugin('test-plugin');
      
      const plugin = await manager.loadPlugin(path.join(TEST_PLUGINS_DIR, 'test-plugin'));
      
      expect(plugin).toBeDefined();
      expect(plugin.manifest.name).toBe('test-plugin');
      expect(plugin.patterns.size).toBe(1);
    });
    
    test('should register patterns from plugin', async () => {
      createTestPlugin('test-plugin');
      
      await manager.loadPlugin(path.join(TEST_PLUGINS_DIR, 'test-plugin'));
      
      expect(manager.patterns.has('test-plugin-pattern')).toBe(true);
    });
    
    test('should fail on missing manifest', async () => {
      const pluginDir = path.join(TEST_PLUGINS_DIR, 'no-manifest');
      fs.mkdirSync(pluginDir, { recursive: true });
      
      await expect(manager.loadPlugin(pluginDir))
        .rejects.toThrow('Plugin manifest not found');
    });
    
    test('should fail on duplicate plugin', async () => {
      createTestPlugin('test-plugin');
      
      await manager.loadPlugin(path.join(TEST_PLUGINS_DIR, 'test-plugin'));
      
      await expect(manager.loadPlugin(path.join(TEST_PLUGINS_DIR, 'test-plugin')))
        .rejects.toThrow('Plugin already loaded');
    });
    
    test('should fail on missing main file', async () => {
      const pluginDir = path.join(TEST_PLUGINS_DIR, 'no-main');
      fs.mkdirSync(pluginDir, { recursive: true });
      
      const manifest = {
        name: 'no-main',
        version: '1.0.0',
        main: 'missing.js',
        patterns: [{ name: 'test', export: 'default' }]
      };
      
      fs.writeFileSync(
        path.join(pluginDir, 'plugin.json'),
        JSON.stringify(manifest)
      );
      
      await expect(manager.loadPlugin(pluginDir))
        .rejects.toThrow('Plugin main file not found');
    });
  });
  
  describe('unloadPlugin', () => {
    test('should unload a plugin', async () => {
      createTestPlugin('test-plugin');
      
      await manager.loadPlugin(path.join(TEST_PLUGINS_DIR, 'test-plugin'));
      const result = await manager.unloadPlugin('test-plugin');
      
      expect(result).toBe(true);
      expect(manager.plugins.has('test-plugin')).toBe(false);
    });
    
    test('should unregister patterns on unload', async () => {
      createTestPlugin('test-plugin');
      
      await manager.loadPlugin(path.join(TEST_PLUGINS_DIR, 'test-plugin'));
      await manager.unloadPlugin('test-plugin');
      
      expect(manager.patterns.has('test-plugin-pattern')).toBe(false);
    });
    
    test('should return false for unknown plugin', async () => {
      const result = await manager.unloadPlugin('unknown');
      expect(result).toBe(false);
    });
  });
  
  describe('reloadPlugin', () => {
    test('should reload a plugin', async () => {
      createTestPlugin('test-plugin');
      
      await manager.loadPlugin(path.join(TEST_PLUGINS_DIR, 'test-plugin'));
      const plugin = await manager.reloadPlugin('test-plugin');
      
      expect(plugin).toBeDefined();
      expect(plugin.manifest.name).toBe('test-plugin');
    });
    
    test('should fail for unknown plugin', async () => {
      await expect(manager.reloadPlugin('unknown'))
        .rejects.toThrow('Plugin not found');
    });
  });
  
  describe('discover', () => {
    test('should discover plugins in directory', async () => {
      createTestPlugin('plugin-1');
      createTestPlugin('plugin-2');
      
      const plugins = await manager.discover();
      
      expect(plugins.size).toBe(2);
      expect(plugins.has('plugin-1')).toBe(true);
      expect(plugins.has('plugin-2')).toBe(true);
    });
    
    test('should create plugins directory if not exists', async () => {
      const newDir = path.join(__dirname, 'new-plugins-dir');
      const m = new PluginManager({ pluginsDir: newDir });
      
      if (fs.existsSync(newDir)) {
        fs.rmSync(newDir, { recursive: true });
      }
      
      await m.discover();
      
      expect(fs.existsSync(newDir)).toBe(true);
      
      // Cleanup
      fs.rmSync(newDir, { recursive: true });
    });
    
    test('should emit plugin:error on load failure', async () => {
      const invalidDir = path.join(TEST_PLUGINS_DIR, 'invalid-plugin');
      fs.mkdirSync(invalidDir, { recursive: true });
      // No manifest = will fail
      
      const errorHandler = jest.fn();
      manager.on('plugin:error', errorHandler);
      
      await manager.discover();
      
      expect(errorHandler).toHaveBeenCalled();
    });
  });
  
  describe('getPattern', () => {
    test('should get pattern class by name', async () => {
      createTestPlugin('test-plugin');
      await manager.loadPlugin(path.join(TEST_PLUGINS_DIR, 'test-plugin'));
      
      const PatternClass = manager.getPattern('test-plugin-pattern');
      
      expect(PatternClass).toBeDefined();
    });
    
    test('should return null for unknown pattern', () => {
      const PatternClass = manager.getPattern('unknown-pattern');
      expect(PatternClass).toBeNull();
    });
  });
  
  describe('getAllPatterns', () => {
    test('should return all registered patterns', async () => {
      createTestPlugin('plugin-a');
      createTestPlugin('plugin-b');
      
      await manager.discover();
      
      const patterns = manager.getAllPatterns();
      
      expect(patterns.length).toBe(2);
    });
  });
  
  describe('executeHooks', () => {
    test('should execute registered hooks', async () => {
      const hookHandler = jest.fn().mockResolvedValue('hook-result');
      
      manager.hooks.set('test-hook', [
        { plugin: 'test', handler: hookHandler }
      ]);
      
      const results = await manager.executeHooks('test-hook', { data: 'test' });
      
      expect(hookHandler).toHaveBeenCalledWith({ data: 'test' });
      expect(results).toHaveLength(1);
      expect(results[0].result).toBe('hook-result');
    });
    
    test('should return empty array for no hooks', async () => {
      const results = await manager.executeHooks('no-hooks', {});
      expect(results).toEqual([]);
    });
    
    test('should handle hook errors', async () => {
      const errorHandler = jest.fn().mockRejectedValue(new Error('hook error'));
      
      manager.hooks.set('error-hook', [
        { plugin: 'test', handler: errorHandler }
      ]);
      
      const results = await manager.executeHooks('error-hook', {});
      
      expect(results[0].error).toBe('hook error');
    });
  });
  
  describe('getStats', () => {
    test('should return plugin statistics', async () => {
      createTestPlugin('test-plugin');
      await manager.discover();
      
      const stats = manager.getStats();
      
      expect(stats.pluginsLoaded).toBe(1);
      expect(stats.patternsRegistered).toBe(1);
    });
  });
  
  describe('listPlugins', () => {
    test('should list loaded plugins', async () => {
      createTestPlugin('plugin-a');
      createTestPlugin('plugin-b');
      
      await manager.discover();
      
      const list = manager.listPlugins();
      
      expect(list.length).toBe(2);
      expect(list.find(p => p.name === 'plugin-a')).toBeDefined();
      expect(list.find(p => p.name === 'plugin-b')).toBeDefined();
    });
  });
  
  describe('createPluginTemplate', () => {
    test('should create plugin template', async () => {
      const pluginPath = await manager.createPluginTemplate('my-plugin', TEST_PLUGINS_DIR);
      
      expect(fs.existsSync(pluginPath)).toBe(true);
      expect(fs.existsSync(path.join(pluginPath, 'plugin.json'))).toBe(true);
      expect(fs.existsSync(path.join(pluginPath, 'index.js'))).toBe(true);
      expect(fs.existsSync(path.join(pluginPath, 'README.md'))).toBe(true);
    });
    
    test('should fail if directory exists', async () => {
      await manager.createPluginTemplate('existing', TEST_PLUGINS_DIR);
      
      await expect(manager.createPluginTemplate('existing', TEST_PLUGINS_DIR))
        .rejects.toThrow('already exists');
    });
  });
  
  describe('toPascalCase', () => {
    test('should convert kebab-case to PascalCase', () => {
      expect(manager.toPascalCase('my-plugin')).toBe('MyPlugin');
    });
    
    test('should convert snake_case to PascalCase', () => {
      expect(manager.toPascalCase('my_plugin')).toBe('MyPlugin');
    });
    
    test('should handle single word', () => {
      expect(manager.toPascalCase('plugin')).toBe('Plugin');
    });
  });
});

describe('BasePattern', () => {
  class TestPattern extends BasePattern {
    initializeAgents() {
      return this.config.agents.map(a => this.createAgent(a));
    }
    
    async execute(progressCallback) {
      return { success: true };
    }
  }
  
  test('should not be instantiable directly', () => {
    expect(() => new BasePattern({}))
      .toThrow('abstract and cannot be instantiated directly');
  });
  
  test('should create subclass instance', () => {
    const pattern = new TestPattern({ pattern: 'test' });
    expect(pattern).toBeInstanceOf(BasePattern);
  });
  
  test('should throw on missing initializeAgents', () => {
    class InvalidPattern extends BasePattern {}
    
    const pattern = new InvalidPattern({});
    expect(() => pattern.initializeAgents())
      .toThrow('initializeAgents() must be implemented by subclass');
  });
  
  test('should validate configuration', () => {
    const pattern = new TestPattern({ pattern: 'test' });
    const validation = pattern.validate();
    
    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });
  
  test('should pass validation with valid config', () => {
    const pattern = new TestPattern({
      pattern: 'test',
      task: 'test task',
      agents: [{ name: 'agent1' }]
    });
    
    const validation = pattern.validate();
    expect(validation.valid).toBe(true);
  });
  
  test('should get execution summary', async () => {
    const pattern = new TestPattern({
      pattern: 'test',
      task: 'test',
      agents: []
    });
    
    pattern.startTime = 1000;
    pattern.endTime = 2000;
    pattern.results = [{ status: 'completed' }];
    
    const summary = pattern.getSummary();
    
    expect(summary.pattern).toBe('test');
    expect(summary.duration).toBe(1000);
  });
  
  test('should emit events', () => {
    const pattern = new TestPattern({ pattern: 'test' });
    const handler = jest.fn();
    
    pattern.on('test-event', handler);
    pattern.emitEvent('test-event', { data: 'test' });
    
    expect(handler).toHaveBeenCalledWith({ data: 'test' });
  });
  
  describe('mergeResults', () => {
    test('should combine results', () => {
      const pattern = new TestPattern({ pattern: 'test' });
      pattern.agents = [{}, {}];
      pattern.startTime = 1000;
      pattern.endTime = 2000;
      
      const results = [
        { status: 'completed', output: { data: 1 } },
        { status: 'completed', output: { data: 2 } }
      ];
      
      const merged = pattern.mergeResults(results, { strategy: 'combine' });
      
      expect(merged.success).toBe(true);
      expect(merged.data.length).toBe(2);
    });
    
    test('should select best result', () => {
      const pattern = new TestPattern({ pattern: 'test' });
      pattern.agents = [{}, {}, {}];
      pattern.startTime = 1000;
      pattern.endTime = 2000;
      
      const results = [
        { status: 'completed', output: { score: 0.5 } },
        { status: 'completed', output: { score: 0.9 } },
        { status: 'completed', output: { score: 0.7 } }
      ];
      
      const merged = pattern.mergeResults(results, { strategy: 'best' });
      
      expect(merged.data.score).toBe(0.9);
    });
    
    test('should find consensus', () => {
      const pattern = new TestPattern({ pattern: 'test' });
      pattern.agents = [{}, {}, {}];
      pattern.startTime = 1000;
      pattern.endTime = 2000;
      
      const results = [
        { status: 'completed', output: { answer: 'A' } },
        { status: 'completed', output: { answer: 'A' } },
        { status: 'completed', output: { answer: 'B' } }
      ];
      
      const merged = pattern.mergeResults(results, { strategy: 'consensus' });
      
      expect(merged.data.answer).toBe('A');
      expect(merged.metadata.consensusRatio).toBeCloseTo(0.67, 1);
    });
  });
});
