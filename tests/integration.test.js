const { Orchestrator } = require('../src/orchestrator');
const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');

describe('Integration Tests', () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = new Orchestrator();
  });

  afterEach(async () => {
    // Clean up
    if (orchestrator && orchestrator.activeTasks) {
      for (const [taskId, task] of orchestrator.activeTasks) {
        task.removeAllListeners();
        task.cancel();
      }
      orchestrator.activeTasks.clear();
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('Work Crew Pattern Integration', () => {
    test('should execute work crew with multiple agents', async () => {
      const config = {
        name: 'Multi-Agent Analysis',
        pattern: 'work-crew',
        agents: [
          { name: 'analyst-1', role: 'Technical Analysis', focus: 'Architecture' },
          { name: 'analyst-2', role: 'Business Analysis', focus: 'ROI' },
          { name: 'analyst-3', role: 'Risk Analysis', focus: 'Security' }
        ],
        task: 'Analyze the feasibility of implementing AI agents',
        convergence: {
          strategy: 'merge'
        }
      };

      const task = await orchestrator.run(config);
      
      // Wait for completion
      await new Promise((resolve, reject) => {
        task.on('complete', resolve);
        task.on('error', reject);
        setTimeout(() => reject(new Error('Timeout')), 10000);
      });

      expect(task.status).toBe('completed');
      expect(task.results).toBeDefined();
      expect(task.results.pattern).toBe('work-crew');
      expect(task.agents.length).toBe(3);
      
      task.removeAllListeners();
    }, 15000);

    test('should achieve consensus with work crew', async () => {
      const config = {
        name: 'Consensus Test',
        pattern: 'work-crew',
        agents: [
          { name: 'expert-1', role: 'Expert 1' },
          { name: 'expert-2', role: 'Expert 2' }
        ],
        task: 'Should we adopt this technology?',
        convergence: {
          strategy: 'consensus',
          threshold: 0.6
        }
      };

      const task = await orchestrator.run(config);
      
      await new Promise((resolve, reject) => {
        task.on('complete', resolve);
        task.on('error', reject);
        setTimeout(() => reject(new Error('Timeout')), 10000);
      });

      expect(task.results.converged).toBeDefined();
      expect(task.results.converged.agreementRate).toBeDefined();
      
      task.removeAllListeners();
    }, 15000);
  });

  describe('Pipeline Pattern Integration', () => {
    test('should execute pipeline stages sequentially', async () => {
      const config = {
        name: 'Content Pipeline',
        pattern: 'pipeline',
        stages: [
          { name: 'research', agent: 'researcher' },
          { name: 'draft', agent: 'writer' },
          { name: 'review', agent: 'editor' }
        ],
        task: 'Create a blog post about AI agents'
      };

      const task = await orchestrator.run(config);
      
      await new Promise((resolve, reject) => {
        task.on('complete', resolve);
        task.on('error', reject);
        setTimeout(() => reject(new Error('Timeout')), 15000);
      });

      expect(task.status).toBe('completed');
      expect(task.results).toBeDefined();
      
      task.removeAllListeners();
    }, 20000);
  });

  describe('Supervisor Pattern Integration', () => {
    test('should execute supervisor pattern', async () => {
      const config = {
        name: 'Project Planning',
        pattern: 'supervisor',
        supervisor: {
          name: 'project-manager',
          strategy: 'adaptive'
        },
        workers: [
          { name: 'developer', skills: ['coding', 'testing'] },
          { name: 'designer', skills: ['UI/UX', 'graphics'] }
        ],
        task: 'Plan a new feature implementation'
      };

      const task = await orchestrator.run(config);
      
      await new Promise((resolve, reject) => {
        task.on('complete', resolve);
        task.on('error', reject);
        setTimeout(() => reject(new Error('Timeout')), 15000);
      });

      expect(task.status).toBe('completed');
      
      task.removeAllListeners();
    }, 20000);
  });

  describe('Council Pattern Integration', () => {
    test('should execute council discussion rounds', async () => {
      const config = {
        name: 'Strategic Decision',
        pattern: 'council',
        experts: [
          { name: 'skeptic', role: 'Challenge assumptions' },
          { name: 'optimist', role: 'Identify opportunities' },
          { name: 'realist', role: 'Practical assessment' }
        ],
        task: 'Should we invest in this new technology?',
        rounds: 2,
        convergence: {
          strategy: 'vote'
        }
      };

      const task = await orchestrator.run(config);
      
      await new Promise((resolve, reject) => {
        task.on('complete', resolve);
        task.on('error', reject);
        setTimeout(() => reject(new Error('Timeout')), 20000);
      });

      expect(task.status).toBe('completed');
      expect(task.results.rounds).toBeDefined();
      
      task.removeAllListeners();
    }, 25000);
  });

  describe('Auto-Routing Pattern Integration', () => {
    test('should route tasks to specialized agents', async () => {
      const config = {
        name: 'Multi-Task Processing',
        pattern: 'auto-routing',
        router: {
          confidence_threshold: 0.7
        },
        agents: [
          { 
            name: 'coder', 
            specialties: ['programming', 'debugging', 'refactoring'] 
          },
          { 
            name: 'researcher', 
            specialties: ['research', 'analysis', 'summarization'] 
          }
        ],
        task: 'Debug this code and research best practices'
      };

      const task = await orchestrator.run(config);
      
      await new Promise((resolve, reject) => {
        task.on('complete', resolve);
        task.on('error', reject);
        setTimeout(() => reject(new Error('Timeout')), 15000);
      });

      expect(task.status).toBe('completed');
      expect(task.results.routing).toBeDefined();
      
      task.removeAllListeners();
    }, 20000);
  });

  describe('Error Handling', () => {
    test('should handle invalid pattern', async () => {
      const config = {
        name: 'Invalid Test',
        pattern: 'invalid-pattern',
        agents: [{ name: 'agent-1', role: 'test' }],
        task: 'Test task'
      };

      const task = await orchestrator.run(config);
      
      await new Promise((resolve, reject) => {
        task.on('error', (error) => {
          expect(error.message).toContain('Unknown pattern');
          resolve();
        });
        task.on('complete', () => reject(new Error('Should have failed')));
        setTimeout(() => reject(new Error('Timeout')), 5000);
      });
      
      task.removeAllListeners();
    });

    test('should handle task cancellation', async () => {
      const config = {
        name: 'Long Running Task',
        pattern: 'work-crew',
        agents: [{ name: 'agent-1', role: 'test' }],
        task: 'Test task'
      };

      const task = await orchestrator.run(config);
      
      // Cancel immediately
      await orchestrator.cancel(task.id);
      
      expect(task.cancelled).toBe(true);
      
      task.removeAllListeners();
    });

    test('should emit progress events', async () => {
      const config = {
        name: 'Progress Test',
        pattern: 'work-crew',
        agents: [{ name: 'agent-1', role: 'test' }],
        task: 'Test task'
      };

      const task = await orchestrator.run(config);
      
      const progressEvents = [];
      task.on('progress', (event) => progressEvents.push(event));
      
      await new Promise((resolve, reject) => {
        task.on('complete', resolve);
        task.on('error', reject);
        setTimeout(() => reject(new Error('Timeout')), 10000);
      });

      expect(progressEvents.length).toBeGreaterThan(0);
      
      task.removeAllListeners();
    }, 15000);
  });

  describe('Performance Tests', () => {
    test('should handle concurrent tasks', async () => {
      const tasks = [];
      
      for (let i = 0; i < 5; i++) {
        const config = {
          name: `Concurrent Task ${i}`,
          pattern: 'work-crew',
          agents: [{ name: 'agent-1', role: 'test' }],
          task: 'Test task'
        };
        
        tasks.push(orchestrator.run(config));
      }
      
      const runningTasks = await Promise.all(tasks);
      
      expect(runningTasks.length).toBe(5);
      expect(orchestrator.activeTasks.size).toBe(5);
      
      // Clean up
      runningTasks.forEach(task => task.removeAllListeners());
    });

    test('should complete task within timeout', async () => {
      const config = {
        name: 'Timeout Test',
        pattern: 'work-crew',
        agents: [{ name: 'agent-1', role: 'test' }],
        task: 'Test task'
      };

      const startTime = Date.now();
      const task = await orchestrator.run(config);
      
      await new Promise((resolve, reject) => {
        task.on('complete', resolve);
        task.on('error', reject);
        setTimeout(() => reject(new Error('Timeout')), 5000);
      });
      
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(5000);
      
      task.removeAllListeners();
    }, 10000);
  });
});
