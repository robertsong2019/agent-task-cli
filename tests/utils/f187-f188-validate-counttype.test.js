'use strict';

const { Cache } = require('../../src/utils/cache');

describe('F187: Cache.validate', () => {
  let cache;

  beforeEach(() => {
    cache = new Cache({ defaultTTL: 60000 });
  });

  afterEach(() => {
    cache.destroy();
  });

  test('returns valid=true for matching type', () => {
    cache.set('k1', { a: 1 });
    const result = cache.validate('k1', { type: 'object' });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('returns valid=false for type mismatch', () => {
    cache.set('k1', 'hello');
    const result = cache.validate('k1', { type: 'number' });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Type mismatch');
  });

  test('validates required fields on objects', () => {
    cache.set('k1', { a: 1, b: 2 });
    const result = cache.validate('k1', { type: 'object', required: ['a', 'c'] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required field: c');
  });

  test('passes when all required fields present', () => {
    cache.set('k1', { a: 1, b: 2 });
    const result = cache.validate('k1', { type: 'object', required: ['a', 'b'] });
    expect(result.valid).toBe(true);
  });

  test('returns error for missing key', () => {
    const result = cache.validate('nonexistent', { type: 'string' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Key not found or expired');
  });

  test('returns error for expired key', () => {
    cache.set('k1', 'val', 1); // 1ms TTL
    return new Promise(resolve => {
      setTimeout(() => {
        const result = cache.validate('k1', { type: 'string' });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Key not found or expired');
        resolve();
      }, 10);
    });
  });

  test('validates array type', () => {
    cache.set('k1', [1, 2, 3]);
    const result = cache.validate('k1', { type: 'array' });
    expect(result.valid).toBe(true);
  });

  test('does not check required fields for non-objects', () => {
    cache.set('k1', 'string-val');
    const result = cache.validate('k1', { type: 'string', required: ['x'] });
    expect(result.valid).toBe(true);
  });
});

describe('F188: Cache.countType', () => {
  let cache;

  beforeEach(() => {
    cache = new Cache({ defaultTTL: 60000 });
  });

  afterEach(() => {
    cache.destroy();
  });

  test('returns all zeros for empty cache', () => {
    const result = cache.countType();
    expect(result.object).toBe(0);
    expect(result.array).toBe(0);
    expect(result.string).toBe(0);
    expect(result.number).toBe(0);
    expect(result.boolean).toBe(0);
  });

  test('counts each type correctly', () => {
    cache.set('obj', { a: 1 });
    cache.set('arr', [1, 2]);
    cache.set('str', 'hello');
    cache.set('num', 42);
    cache.set('bool', true);
    const result = cache.countType();
    expect(result.object).toBe(1);
    expect(result.array).toBe(1);
    expect(result.string).toBe(1);
    expect(result.number).toBe(1);
    expect(result.boolean).toBe(1);
  });

  test('excludes expired entries', () => {
    cache.set('live', 'yes');
    cache.set('dead', 'no', 1); // 1ms TTL
    return new Promise(resolve => {
      setTimeout(() => {
        const result = cache.countType();
        expect(result.string).toBe(1); // only 'live'
        resolve();
      }, 10);
    });
  });

  test('counts multiple of same type', () => {
    cache.set('s1', 'a');
    cache.set('s2', 'b');
    cache.set('s3', 'c');
    cache.set('n1', 1);
    const result = cache.countType();
    expect(result.string).toBe(3);
    expect(result.number).toBe(1);
  });
});
