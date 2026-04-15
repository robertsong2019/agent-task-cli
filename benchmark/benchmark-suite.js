/**
 * Performance Benchmark Suite for Agent Task CLI
 * Tests throughput, latency, memory usage, and scalability
 */

const { Orchestrator } = require('../src/orchestrator-v2');
const { performance } = require('perf_hooks');
const v8 = require('v8');
const fs = require('fs').promises;
const path = require('path');

class BenchmarkSuite {
  constructor(options = {}) {
    this.results = [];
    this.options = {
      warmupRuns: options.warmupRuns || 3,
      testRuns: options.testRuns || 10,
      outputDir: options.outputDir || './benchmark-results',
      verbose: options.verbose || false
    };
    this.orchestrator = null;
  }

  /**
   * Run all benchmarks
   */
  async runAll() {
    console.log('🚀 Starting Performance Benchmark Suite\n');
    
    const startTime = Date.now();
    
    // Warmup
    console.log('🔥 Warming up...');
    await this.warmup();
    console.log('');
    
    // Run benchmarks
    await this.benchmark('Single Task Execution', () => this.benchSingleTask());
    await this.benchmark('Concurrent Tasks (10)', () => this.benchConcurrentTasks(10));
    await this.benchmark('Concurrent Tasks (50)', () => this.benchConcurrentTasks(50));
    await this.benchmark('Large Agent Team (20 agents)', () => this.benchLargeAgentTeam(20));
    await this.benchmark('Pipeline Pattern (5 stages)', () => this.benchPipelinePattern(5));
    await this.benchmark('Council Pattern (5 rounds)', () => this.benchCouncilPattern(5));
    await this.benchmark('Cache Performance', () => this.benchCachePerformance());
    await this.benchmark('Memory Usage', () => this.benchMemoryUsage());
    
    const totalTime = Date.now() - startTime;
    
    // Generate report
    await this.generateReport(totalTime);
    
    return this.results;
  }

  /**
   * Warmup runs to stabilize JIT
   */
  async warmup() {
    for (let i = 0; i < this.options.warmupRuns; i++) {
      const orchestrator = new Orchestrator();
      const task = {
        name: `Warmup ${i + 1}`,
        pattern: 'work-crew',
        agents: [
          { name: 'agent-1', role: 'Test', type: 'mock' }
        ],
        task: 'Test task'
      };
      
      const result = orchestrator.run(task, { dryRun: true });
      await this.waitForCompletion(result);
      await orchestrator.shutdown();
    }
  }

  /**
   * Run a single benchmark
   */
  async benchmark(name, fn) {
    console.log(`📊 Running: ${name}`);
    
    const measurements = [];
    let memoryBefore, memoryAfter;
    
    for (let i = 0; i < this.options.testRuns; i++) {
      // Force GC if available
      if (global.gc) global.gc();
      
      memoryBefore = process.memoryUsage();
      const start = performance.now();
      
      await fn();
      
      const duration = performance.now() - start;
      memoryAfter = process.memoryUsage();
      
      measurements.push({
        duration,
        memoryDelta: {
          heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
          external: memoryAfter.external - memoryBefore.external
        }
      });
      
      if (this.options.verbose) {
        process.stdout.write('.');
      }
    }
    
    if (this.options.verbose) {
      console.log('');
    }
    
    const stats = this.calculateStats(measurements);
    const result = { name, ...stats };
    this.results.push(result);
    
    console.log(`   ✓ Avg: ${stats.avgDuration.toFixed(2)}ms, P95: ${stats.p95Duration.toFixed(2)}ms\n`);
    
    return result;
  }

  /**
   * Calculate statistics from measurements
   */
  calculateStats(measurements) {
    const durations = measurements.map(m => m.duration);
    const memoryDeltas = measurements.map(m => m.memoryDelta.heapUsed);
    
    durations.sort((a, b) => a - b);
    
    return {
      avgDuration: this.average(durations),
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      p50Duration: this.percentile(durations, 50),
      p95Duration: this.percentile(durations, 95),
      p99Duration: this.percentile(durations, 99),
      stdDev: this.standardDeviation(durations),
      avgMemoryDelta: this.average(memoryDeltas),
      measurements: durations.length
    };
  }

  /**
   * Benchmark: Single task execution
   */
  async benchSingleTask() {
    const orchestrator = new Orchestrator();
    
    const task = {
      name: 'Single Task Benchmark',
      pattern: 'work-crew',
      agents: [
        { name: 'agent-1', role: 'Researcher', type: 'mock' }
      ],
      task: 'Analyze AI trends'
    };
    
    const result = orchestrator.run(task);
    await this.waitForCompletion(result);
    await orchestrator.shutdown();
  }

  /**
   * Benchmark: Concurrent tasks
   */
  async benchConcurrentTasks(count) {
    const orchestrator = new Orchestrator({ maxConcurrent: count });
    
    const tasks = Array(count).fill(null).map((_, i) => ({
      name: `Concurrent Task ${i + 1}`,
      pattern: 'work-crew',
      agents: [
        { name: 'agent-1', role: 'Worker', type: 'mock' }
      ],
      task: `Process task ${i + 1}`
    }));
    
    const results = tasks.map(task => orchestrator.run(task));
    await Promise.all(results.map(r => this.waitForCompletion(r)));
    await orchestrator.shutdown();
  }

  /**
   * Benchmark: Large agent team
   */
  async benchLargeAgentTeam(agentCount) {
    const orchestrator = new Orchestrator();
    
    const task = {
      name: 'Large Team Benchmark',
      pattern: 'work-crew',
      agents: Array(agentCount).fill(null).map((_, i) => ({
        name: `agent-${i + 1}`,
        role: `Role ${i + 1}`,
        type: 'mock'
      })),
      task: 'Collaborative analysis'
    };
    
    const result = orchestrator.run(task);
    await this.waitForCompletion(result);
    await orchestrator.shutdown();
  }

  /**
   * Benchmark: Pipeline pattern
   */
  async benchPipelinePattern(stages) {
    const orchestrator = new Orchestrator();
    
    const task = {
      name: 'Pipeline Benchmark',
      pattern: 'pipeline',
      stages: Array(stages).fill(null).map((_, i) => ({
        name: `stage-${i + 1}`,
        agent: { name: `agent-${i + 1}`, role: `Stage ${i + 1}`, type: 'mock' }
      })),
      task: 'Process through pipeline'
    };
    
    const result = orchestrator.run(task);
    await this.waitForCompletion(result);
    await orchestrator.shutdown();
  }

  /**
   * Benchmark: Council pattern
   */
  async benchCouncilPattern(rounds) {
    const orchestrator = new Orchestrator();
    
    const task = {
      name: 'Council Benchmark',
      pattern: 'council',
      experts: [
        { name: 'expert-1', role: 'Analyst', type: 'mock' },
        { name: 'expert-2', role: 'Critic', type: 'mock' },
        { name: 'expert-3', role: 'Strategist', type: 'mock' }
      ],
      rounds: rounds,
      task: 'Make a decision'
    };
    
    const result = orchestrator.run(task);
    await this.waitForCompletion(result);
    await orchestrator.shutdown();
  }

  /**
   * Benchmark: Cache performance
   */
  async benchCachePerformance() {
    const orchestrator = new Orchestrator();
    
    const task = {
      name: 'Cache Benchmark',
      pattern: 'work-crew',
      agents: [
        { name: 'agent-1', role: 'Worker', type: 'mock' }
      ],
      task: 'Cache test task'
    };
    
    // First run (cache miss)
    const result1 = orchestrator.run(task);
    await this.waitForCompletion(result1);
    
    // Second run (cache hit)
    const result2 = orchestrator.run(task);
    await this.waitForCompletion(result2);
    
    const stats = orchestrator.getStats();
    await orchestrator.shutdown();
    
    return stats.cache;
  }

  /**
   * Benchmark: Memory usage
   */
  async benchMemoryUsage() {
    const orchestrator = new Orchestrator();
    
    const initialMemory = process.memoryUsage();
    
    // Run 100 tasks
    for (let i = 0; i < 100; i++) {
      const task = {
        name: `Memory Test ${i}`,
        pattern: 'work-crew',
        agents: [
          { name: 'agent-1', role: 'Worker', type: 'mock' }
        ],
        task: `Task ${i}`
      };
      
      const result = orchestrator.run(task);
      await this.waitForCompletion(result);
    }
    
    const finalMemory = process.memoryUsage();
    await orchestrator.shutdown();
    
    return {
      heapGrowth: finalMemory.heapUsed - initialMemory.heapUsed,
      externalGrowth: finalMemory.external - initialMemory.external,
      heapStats: v8.getHeapStatistics()
    };
  }

  /**
   * Wait for task completion
   */
  async waitForCompletion(task) {
    return new Promise((resolve, reject) => {
      task.on('complete', resolve);
      task.on('error', reject);
    });
  }

  /**
   * Generate benchmark report
   */
  async generateReport(totalTime) {
    const report = {
      timestamp: new Date().toISOString(),
      totalRunTime: totalTime,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        cpus: require('os').cpus().length,
        totalMemory: require('os').totalmem()
      },
      results: this.results
    };
    
    // Ensure output directory exists
    await fs.mkdir(this.options.outputDir, { recursive: true });
    
    // Save JSON report
    const jsonPath = path.join(this.options.outputDir, `benchmark-${Date.now()}.json`);
    await fs.writeFile(jsonPath, JSON.stringify(report, null, 2));
    
    // Generate markdown report
    const mdPath = path.join(this.options.outputDir, `benchmark-${Date.now()}.md`);
    const mdContent = this.generateMarkdownReport(report);
    await fs.writeFile(mdPath, mdContent);
    
    console.log('📄 Reports generated:');
    console.log(`   - JSON: ${jsonPath}`);
    console.log(`   - Markdown: ${mdPath}\n`);
    
    // Print summary
    this.printSummary(report);
  }

  /**
   * Generate markdown report
   */
  generateMarkdownReport(report) {
    let md = `# Performance Benchmark Report\n\n`;
    md += `**Generated:** ${report.timestamp}\n`;
    md += `**Total Runtime:** ${(report.totalRunTime / 1000).toFixed(2)}s\n\n`;
    
    md += `## Environment\n\n`;
    md += `- **Node Version:** ${report.environment.nodeVersion}\n`;
    md += `- **Platform:** ${report.environment.platform} (${report.environment.arch})\n`;
    md += `- **CPUs:** ${report.environment.cpus}\n`;
    md += `- **Total Memory:** ${(report.environment.totalMemory / 1024 / 1024 / 1024).toFixed(2)} GB\n\n`;
    
    md += `## Results\n\n`;
    md += `| Benchmark | Avg (ms) | P95 (ms) | P99 (ms) | Std Dev | Memory Delta (MB) |\n`;
    md += `|-----------|----------|----------|----------|---------|-------------------|\n`;
    
    for (const result of report.results) {
      md += `| ${result.name} | `;
      md += `${result.avgDuration.toFixed(2)} | `;
      md += `${result.p95Duration.toFixed(2)} | `;
      md += `${result.p99Duration.toFixed(2)} | `;
      md += `${result.stdDev.toFixed(2)} | `;
      md += `${(result.avgMemoryDelta / 1024 / 1024).toFixed(2)} |\n`;
    }
    
    md += `\n## Performance Insights\n\n`;
    md += this.generateInsights(report.results);
    
    return md;
  }

  /**
   * Generate performance insights
   */
  generateInsights(results) {
    let insights = '';
    
    // Find slowest benchmark
    const slowest = results.reduce((a, b) => 
      a.avgDuration > b.avgDuration ? a : b
    );
    insights += `- **Slowest Operation:** ${slowest.name} (${slowest.avgDuration.toFixed(2)}ms)\n`;
    
    // Find highest memory usage
    const highestMemory = results.reduce((a, b) => 
      a.avgMemoryDelta > b.avgMemoryDelta ? a : b
    );
    insights += `- **Highest Memory Usage:** ${highestMemory.name} (${(highestMemory.avgMemoryDelta / 1024 / 1024).toFixed(2)}MB)\n`;
    
    // Find most consistent
    const mostConsistent = results.reduce((a, b) => 
      a.stdDev < b.stdDev ? a : b
    );
    insights += `- **Most Consistent:** ${mostConsistent.name} (σ = ${mostConsistent.stdDev.toFixed(2)}ms)\n`;
    
    return insights;
  }

  /**
   * Print summary to console
   */
  printSummary(report) {
    console.log('📊 Benchmark Summary\n');
    console.log('┌─────────────────────────────────┬──────────┬──────────┬──────────┐');
    console.log('│ Benchmark                       │ Avg (ms) │ P95 (ms) │ P99 (ms) │');
    console.log('├─────────────────────────────────┼──────────┼──────────┼──────────┤');
    
    for (const result of report.results) {
      const name = result.name.padEnd(31).substring(0, 31);
      const avg = result.avgDuration.toFixed(2).padStart(8);
      const p95 = result.p95Duration.toFixed(2).padStart(8);
      const p99 = result.p99Duration.toFixed(2).padStart(8);
      console.log(`│ ${name} │ ${avg} │ ${p95} │ ${p99} │`);
    }
    
    console.log('└─────────────────────────────────┴──────────┴──────────┴──────────┘\n');
  }

  // Utility functions
  average(arr) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  percentile(sortedArr, p) {
    const idx = Math.ceil((p / 100) * sortedArr.length) - 1;
    return sortedArr[Math.max(0, idx)];
  }

  standardDeviation(arr) {
    const avg = this.average(arr);
    const squareDiffs = arr.map(value => Math.pow(value - avg, 2));
    const avgSquareDiff = this.average(squareDiffs);
    return Math.sqrt(avgSquareDiff);
  }
}

// Run benchmarks if called directly
if (require.main === module) {
  const suite = new BenchmarkSuite({
    warmupRuns: 3,
    testRuns: 10,
    verbose: true
  });
  
  suite.runAll().catch(console.error);
}

module.exports = { BenchmarkSuite };
