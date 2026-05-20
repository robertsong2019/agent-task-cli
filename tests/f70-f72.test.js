const { Cache } = require('../src/utils/cache');
const { EventBus } = require('../src/utils/event-bus');
const { Storage } = require('../src/utils/storage');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// F70: Cache.setNX
async function testCacheSetNX() {
  const cache = new Cache({ maxSize: 10, defaultTTL: 60000 });

  // Set new key — should succeed
  const r1 = cache.setNX('key1', 'val1');
  console.assert(r1 === true, 'setNX new key should return true');
  console.assert(cache.get('key1') === 'val1', 'value should be set');

  // Set existing key — should fail
  const r2 = cache.setNX('key1', 'val2');
  console.assert(r2 === false, 'setNX existing key should return false');
  console.assert(cache.get('key1') === 'val1', 'value should not change');

  // SetNX on expired key — should succeed
  cache.set('key2', 'old', 1); // 1ms TTL
  await new Promise(r => setTimeout(r, 10));
  const r3 = cache.setNX('key2', 'new');
  console.assert(r3 === true, 'setNX on expired key should return true');
  console.assert(cache.get('key2') === 'new', 'value should be updated');

  cache.destroy();
  console.log('✅ F70: Cache.setNX — all assertions passed');
}

// F71: EventBus.throttle
async function testEventBusThrottle() {
  const bus = new EventBus();
  const received = [];

  bus.on('tick', (e) => received.push(e.data));

  const throttledEmit = bus.throttle('tick', 100);

  // Rapid fires — only first should go through
  throttledEmit('a');
  throttledEmit('b');
  throttledEmit('c');

  console.assert(received.length === 1, `expected 1, got ${received.length}`);
  console.assert(received[0] === 'a', 'first emit should go through');

  // Wait for interval to pass
  await new Promise(r => setTimeout(r, 120));
  const r4 = throttledEmit('d');
  console.assert(r4 === true, 'emit after interval should succeed');
  console.assert(received.length === 2, `expected 2, got ${received.length}`);
  console.assert(received[1] === 'd', 'second emit should be d');

  bus.reset();
  console.log('✅ F71: EventBus.throttle — all assertions passed');
}

// F72: Storage.batchUpdate
async function testStorageBatchUpdate() {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-batch-'));
  const storage = new Storage(tmpDir);

  // Create some tasks
  await storage.saveTask('t1', { title: 'Task 1', status: 'pending', createdAt: new Date().toISOString() });
  await storage.saveTask('t2', { title: 'Task 2', status: 'pending', createdAt: new Date().toISOString() });
  await storage.saveTask('t3', { title: 'Task 3', status: 'pending', createdAt: new Date().toISOString() });

  // Batch update t1 and t2
  const results = await storage.batchUpdate([
    { id: 't1', updates: { status: 'done' } },
    { id: 't2', updates: { status: 'running', progress: 50 } },
    { id: 't_nonexistent', updates: { status: 'x' } },  // should be skipped
  ]);

  console.assert(results.length === 2, `expected 2 results, got ${results.length}`);
  console.assert(results[0].status === 'done', 't1 should be done');
  console.assert(results[1].status === 'running', 't2 should be running');
  console.assert(results[1].progress === 50, 't2 should have progress=50');

  // Verify t3 unchanged
  const t3 = await storage.getTask('t3');
  console.assert(t3.status === 'pending', 't3 should be unchanged');

  // Cleanup
  await fs.rm(tmpDir, { recursive: true });
  console.log('✅ F72: Storage.batchUpdate — all assertions passed');
}

(async () => {
  await testCacheSetNX();
  await testEventBusThrottle();
  await testStorageBatchUpdate();
  console.log('\n🎉 All F70-F72 tests passed!');
})().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
