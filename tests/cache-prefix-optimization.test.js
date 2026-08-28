const PerformanceManager = require('../src/utils/performance');

describe('PerformanceManager Cache Prefix Optimization', () => {
  let perfManager;

  beforeEach(() => {
    perfManager = new PerformanceManager({
      maxCacheSize: 1000,
      cacheTTL: 10000 // 10 seconds for testing
    });
  });

  test('should cache multiple keys with same prefix efficiently', async () => {
    // Add multiple cache entries with same prefix
    await perfManager.cachedExecute('test:user:1', () => Promise.resolve('user1_data'));
    await perfManager.cachedExecute('test:user:2', () => Promise.resolve('user2_data'));
    await perfManager.cachedExecute('test:user:3', () => Promise.resolve('user3_data'));
    await perfManager.cachedExecute('test:session:1', () => Promise.resolve('session1_data'));
    await perfManager.cachedExecute('test:session:2', () => Promise.resolve('session2_data'));
    
    // Verify all entries are cached
    expect(perfManager.cache.size).toBe(5);
    
    // Test prefix matching - should return only user entries
    const userKeys = perfManager._getKeysByPrefix('test:user');
    expect(userKeys).toHaveLength(3);
    expect(userKeys).toEqual(expect.arrayContaining([
      expect.stringContaining('test:user:1'),
      expect.stringContaining('test:user:2'),
      expect.stringContaining('test:user:3')
    ]));
    
    // Test prefix matching for session
    const sessionKeys = perfManager._getKeysByPrefix('test:session');
    expect(sessionKeys).toHaveLength(2);
    expect(sessionKeys).toEqual(expect.arrayContaining([
      expect.stringContaining('test:session:1'),
      expect.stringContaining('test:session:2')
    ]));
  });

  test('should invalidate cache by prefix efficiently', () => {
    // Add cache entries
    perfManager.cache.set('test:user:1', { data: 'user1', timestamp: Date.now() });
    perfManager.cache.set('test:user:2', { data: 'user2', timestamp: Date.now() });
    perfManager.cache.set('test:session:1', { data: 'session1', timestamp: Date.now() });
    perfManager.cache.set('other:data', { data: 'other', timestamp: Date.now() });
    
    // Update prefix index
    perfManager._addToPrefixIndex('test:user:1');
    perfManager._addToPrefixIndex('test:user:2');
    perfManager._addToPrefixIndex('test:session:1');
    perfManager._addToPrefixIndex('other:data');
    
    expect(perfManager.cache.size).toBe(4);
    
    // Invalidate by prefix
    perfManager.invalidateCacheByPrefix('test:user');
    
    // Should only remove user entries
    expect(perfManager.cache.size).toBe(2);
    expect(perfManager.cache.has('test:user:1')).toBe(false);
    expect(perfManager.cache.has('test:user:2')).toBe(false);
    expect(perfManager.cache.has('test:session:1')).toBe(true);
    expect(perfManager.cache.has('other:data')).toBe(true);
    
    // Prefix index should be updated
    expect(perfManager._getKeysByPrefix('test:user')).toHaveLength(0);
  });

  test('should provide prefix index size in metrics', () => {
    // Add cache entries with nested prefixes
    perfManager.cache.set('api:v1:user:1', { data: 'user1', timestamp: Date.now() });
    perfManager.cache.set('api:v1:user:2', { data: 'user2', timestamp: Date.now() });
    perfManager.cache.set('api:v2:session:1', { data: 'session1', timestamp: Date.now() });
    
    // Update prefix index
    perfManager._addToPrefixIndex('api:v1:user:1');
    perfManager._addToPrefixIndex('api:v1:user:2');
    perfManager._addToPrefixIndex('api:v2:session:1');
    
    const metrics = perfManager.getMetrics();
    
    // Should include prefix index size
    expect(metrics).toHaveProperty('prefixIndexSize');
    expect(typeof metrics.prefixIndexSize).toBe('number');
    expect(metrics.prefixIndexSize).toBeGreaterThan(0);
    
    // Should still have all original metrics
    expect(metrics).toHaveProperty('cacheSize', 3);
    expect(metrics).toHaveProperty('cacheHitRate', 0);
    expect(metrics).toHaveProperty('avgExecutionTime', 0);
  });

  test('should handle complex nested prefixes correctly', () => {
    // Test complex nested prefixes
    const keys = [
      'app:frontend:components:header',
      'app:frontend:components:sidebar',
      'app:frontend:pages:home',
      'app:backend:api:v1:users',
      'app:backend:api:v2:users',
      'app:shared:utils:helpers'
    ];
    
    keys.forEach(key => {
      perfManager.cache.set(key, { data: `data_${key}`, timestamp: Date.now() });
      perfManager._addToPrefixIndex(key);
    });
    
    // Test different prefix levels
    expect(perfManager._getKeysByPrefix('app')).toHaveLength(keys.length);
    expect(perfManager._getKeysByPrefix('app:frontend')).toHaveLength(3);
    expect(perfManager._getKeysByPrefix('app:frontend:components')).toHaveLength(2);
    expect(perfManager._getKeysByPrefix('app:backend:api:v1')).toHaveLength(1);
    expect(perfManager._getKeysByPrefix('nonexistent')).toHaveLength(0);
    
    // Test invalidation at different levels
    perfManager.invalidateCacheByPrefix('app:frontend');
    expect(perfManager.cache.size).toBe(3); // Should only remove frontend entries
    expect(perfManager._getKeysByPrefix('app:frontend')).toHaveLength(0);
    
    // Should still have backend and shared entries
    expect(perfManager._getKeysByPrefix('app:backend')).toHaveLength(2);
    expect(perfManager._getKeysByPrefix('app:shared')).toHaveLength(1);
  });

  test('should reset prefix index when reset() is called', () => {
    // Add some data
    perfManager.cache.set('test:key1', { data: 'data1', timestamp: Date.now() });
    perfManager._addToPrefixIndex('test:key1');
    
    expect(perfManager.cache.size).toBe(1);
    expect(perfManager.prefixIndex.size).toBeGreaterThan(0);
    
    // Reset should clear everything
    perfManager.reset();
    
    expect(perfManager.cache.size).toBe(0);
    expect(perfManager.prefixIndex.size).toBe(0);
    expect(perfManager.metrics.totalRequests).toBe(0);
    expect(perfManager.metrics.cacheHits).toBe(0);
    expect(perfManager.metrics.cacheMisses).toBe(0);
  });
});