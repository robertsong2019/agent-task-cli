const { MockAgent } = require('../src/agents/mock-agent');
const { LLMAgent } = require('../src/agents/llm-agent');
const { AgentFactory } = require('../src/agents/agent-factory');

describe('Agents', () => {
  describe('MockAgent', () => {
    test('should create mock agent with config', () => {
      const agent = new MockAgent({
        name: 'test-agent',
        role: 'tester',
        delay: 100
      });
      
      expect(agent.name).toBe('test-agent');
      expect(agent.role).toBe('tester');
      expect(agent.status).toBe('idle');
    });

    test('should execute task and return output', async () => {
      const agent = new MockAgent({
        name: 'test-agent',
        role: 'tester',
        delay: 100
      });
      
      const output = await agent.execute('Test task');
      
      expect(output).toBeDefined();
      expect(output).toContain('tester');
      expect(agent.status).toBe('completed');
    });

    test('should emit progress events', async () => {
      const agent = new MockAgent({
        name: 'test-agent',
        role: 'tester',
        delay: 100
      });
      
      const progressEvents = [];
      agent.on('progress', (event) => progressEvents.push(event));
      
      await agent.execute('Test task');
      
      expect(progressEvents.length).toBeGreaterThan(0);
    });

    test('should convert to JSON', () => {
      const agent = new MockAgent({
        name: 'test-agent',
        role: 'tester',
        focus: 'testing'
      });
      
      const json = agent.toJSON();
      
      expect(json.id).toBeDefined();
      expect(json.name).toBe('test-agent');
      expect(json.role).toBe('tester');
      expect(json.focus).toBe('testing');
      expect(json.status).toBe('idle');
    });
  });

  describe('LLMAgent', () => {
    const originalEnv = process.env;
    
    beforeEach(() => {
      process.env = { ...originalEnv };
    });
    
    afterEach(() => {
      process.env = originalEnv;
    });

    test('should create LLM agent with config', () => {
      const agent = new LLMAgent({
        name: 'llm-agent',
        role: 'analyzer',
        apiKey: 'test-key',
        model: 'gpt-4',
        provider: 'openai'
      });
      
      expect(agent.name).toBe('llm-agent');
      expect(agent.role).toBe('analyzer');
      expect(agent.model).toBe('gpt-4');
      expect(agent.provider).toBe('openai');
    });

    test('should use environment variables for config', () => {
      process.env.LLM_API_KEY = 'env-test-key';
      process.env.LLM_MODEL = 'gpt-3.5-turbo';
      process.env.LLM_PROVIDER = 'openai';
      
      const agent = new LLMAgent({
        name: 'llm-agent',
        role: 'analyzer'
      });
      
      expect(agent.apiKey).toBe('env-test-key');
      expect(agent.model).toBe('gpt-3.5-turbo');
      expect(agent.provider).toBe('openai');
    });

    test('should throw error without API key', () => {
      delete process.env.LLM_API_KEY;
      delete process.env.OPENAI_API_KEY;
      
      expect(() => {
        new LLMAgent({
          name: 'llm-agent',
          role: 'analyzer'
        });
      }).toThrow('API key required');
    });

    test('should use correct base URL for different providers', () => {
      const providers = [
        { provider: 'openai', expectedUrl: 'https://api.openai.com/v1' },
        { provider: 'glm', expectedUrl: 'https://open.bigmodel.cn/api/paas/v4' },
        { provider: 'deepseek', expectedUrl: 'https://api.deepseek.com/v1' },
        { provider: 'moonshot', expectedUrl: 'https://api.moonshot.cn/v1' }
      ];
      
      providers.forEach(({ provider, expectedUrl }) => {
        const agent = new LLMAgent({
          name: 'test',
          role: 'test',
          apiKey: 'test-key',
          provider
        });
        
        expect(agent.baseUrl).toBe(expectedUrl);
      });
    });

    test('should build default system prompt', () => {
      const agent = new LLMAgent({
        name: 'Analyst',
        role: 'Data Analyst',
        focus: 'data analysis and visualization',
        skills: ['Python', 'SQL', 'Statistics'],
        apiKey: 'test-key'
      });
      
      const prompt = agent.systemPrompt;
      
      expect(prompt).toContain('Analyst');
      expect(prompt).toContain('Data Analyst');
      expect(prompt).toContain('data analysis and visualization');
      expect(prompt).toContain('Python');
      expect(prompt).toContain('SQL');
      expect(prompt).toContain('Statistics');
    });

    test('should build messages with context', () => {
      const agent = new LLMAgent({
        name: 'test',
        role: 'test',
        apiKey: 'test-key'
      });
      
      const messages = agent.buildMessages('Test task', {
        previousOutputs: ['Stage 1 output', 'Stage 2 output'],
        additionalContext: 'Extra context'
      });
      
      expect(messages.length).toBe(4);
      expect(messages[0].role).toBe('system');
      expect(messages[1].content).toContain('Stage 1 output');
      expect(messages[3].content).toContain('Extra context');
    });

    test('should execute task and return output', async () => {
      // Mock fetch
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            choices: [
              { message: { content: 'Test response' } }
            ],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 5,
              total_tokens: 15
            }
          })
        })
      );

      const agent = new LLMAgent({
        name: 'test',
        role: 'test',
        apiKey: 'test-key',
        model: 'gpt-4'
      });

      const output = await agent.execute('Test task');

      expect(output).toBe('Test response');
      expect(agent.status).toBe('completed');
      expect(agent.metadata.tokenUsage.totalTokens).toBe(15);
      expect(fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-key'
          })
        })
      );

      global.fetch.mockRestore();
    });

    test('should handle API errors', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 401,
          text: () => Promise.resolve('Unauthorized')
        })
      );

      const agent = new LLMAgent({
        name: 'test',
        role: 'test',
        apiKey: 'test-key'
      });

      await expect(agent.execute('Test task')).rejects.toThrow('LLM API error (401)');
      expect(agent.status).toBe('failed');

      global.fetch.mockRestore();
    });

    test('should handle timeout', async () => {
      global.fetch = jest.fn(() =>
        new Promise((resolve, reject) => {
          const error = new Error('The operation was aborted');
          error.name = 'AbortError';
          setTimeout(() => reject(error), 100);
        })
      );

      const agent = new LLMAgent({
        name: 'test',
        role: 'test',
        apiKey: 'test-key',
        timeout: 50 // Very short timeout
      });

      await expect(agent.execute('Test task')).rejects.toThrow('timed out');
      expect(agent.status).toBe('failed');

      global.fetch.mockRestore();
    });

    test('should include metadata in toJSON', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            choices: [{ message: { content: 'Test' } }],
            usage: { total_tokens: 10 }
          })
        })
      );

      const agent = new LLMAgent({
        name: 'test',
        role: 'test',
        apiKey: 'test-key',
        model: 'gpt-4',
        provider: 'openai'
      });

      await agent.execute('Test task');
      const json = agent.toJSON();

      expect(json.provider).toBe('openai');
      expect(json.model).toBe('gpt-4');
      expect(json.metadata.model).toBe('gpt-4');
      expect(json.metadata.tokenUsage.totalTokens).toBe(10);

      global.fetch.mockRestore();
    });

    test('should stream response from LLM', async () => {
      // Mock streaming response
      const mockReader = {
        read: jest.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n')
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":" World"}}]}\n\n')
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: [DONE]\n\n')
          })
          .mockResolvedValue({ done: true, value: undefined })
      };

      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          body: {
            getReader: () => mockReader
          }
        })
      );

      const agent = new LLMAgent({
        name: 'test',
        role: 'test',
        apiKey: 'test-key'
      });

      const chunks = [];
      for await (const chunk of agent.executeStream('Test task')) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['Hello', ' World']);
      expect(agent.output).toBe('Hello World');
      expect(agent.status).toBe('completed');

      global.fetch.mockRestore();
    });

    test('should handle stream API errors', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Server error')
        })
      );

      const agent = new LLMAgent({
        name: 'test',
        role: 'test',
        apiKey: 'test-key'
      });

      await expect(async () => {
        for await (const chunk of agent.executeStream('Test task')) {
          // Should throw before yielding
        }
      }).rejects.toThrow('LLM API error (500)');

      global.fetch.mockRestore();
    });
  });

  describe('AgentFactory', () => {
    test('should create mock agent by default', () => {
      const agent = AgentFactory.createAgent({
        name: 'test',
        role: 'test'
      });
      
      expect(agent).toBeInstanceOf(MockAgent);
    });

    test('should create LLM agent when type is llm', () => {
      const agent = AgentFactory.createAgent({
        name: 'test',
        role: 'test',
        type: 'llm',
        apiKey: 'test-key'
      });
      
      expect(agent).toBeInstanceOf(LLMAgent);
    });

    test('should create multiple agents', () => {
      const agents = AgentFactory.createAgents([
        { name: 'agent-1', role: 'role-1' },
        { name: 'agent-2', role: 'role-2' }
      ]);
      
      expect(agents.length).toBe(2);
      expect(agents[0].name).toBe('agent-1');
      expect(agents[1].name).toBe('agent-2');
    });

    test('should detect agent type from config', () => {
      const mockType = AgentFactory.detectAgentType({
        name: 'test',
        role: 'test'
      });
      
      expect(mockType).toBe('mock');
      
      const llmType = AgentFactory.detectAgentType({
        name: 'test',
        role: 'test',
        apiKey: 'test-key'
      });
      
      expect(llmType).toBe('llm');
    });
  });
});
