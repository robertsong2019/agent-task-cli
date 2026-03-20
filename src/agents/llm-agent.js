const { BaseAgent } = require('./base-agent');

/**
 * LLM Agent - Real agent that connects to LLM providers
 * Supports OpenAI-compatible APIs (OpenAI, GLM, DeepSeek, etc.)
 */
class LLMAgent extends BaseAgent {
  constructor(config) {
    super(config);
    
    // LLM configuration
    this.provider = config.provider || process.env.LLM_PROVIDER || 'openai';
    this.model = config.model || process.env.LLM_MODEL || 'gpt-4o-mini';
    this.apiKey = config.apiKey || process.env.LLM_API_KEY;
    this.baseUrl = config.baseUrl || process.env.LLM_BASE_URL || this.getDefaultBaseUrl();
    
    // Agent behavior configuration
    this.temperature = config.temperature ?? 0.7;
    this.maxTokens = config.maxTokens || 2000;
    this.systemPrompt = config.systemPrompt || this.buildDefaultSystemPrompt();
    this.timeout = config.timeout || 60000; // 60 seconds default
    
    // Validate configuration
    if (!this.apiKey) {
      throw new Error(`API key required for agent "${this.name}". Set LLM_API_KEY env or pass apiKey in config.`);
    }
  }

  getDefaultBaseUrl() {
    switch (this.provider) {
    case 'openai':
      return 'https://api.openai.com/v1';
    case 'glm':
    case 'zhipu':
      return 'https://open.bigmodel.cn/api/paas/v4';
    case 'deepseek':
      return 'https://api.deepseek.com/v1';
    case 'moonshot':
      return 'https://api.moonshot.cn/v1';
    default:
      return 'https://api.openai.com/v1';
    }
  }

  buildDefaultSystemPrompt() {
    let prompt = `You are ${this.name}, an AI agent with the role of "${this.role}".`;
    
    if (this.focus) {
      prompt += `\n\nYour focus area is: ${this.focus}`;
    }
    
    if (this.skills && this.skills.length > 0) {
      prompt += `\n\nYour skills include: ${this.skills.join(', ')}`;
    }
    
    prompt += `\n\nInstructions:
- Provide detailed, actionable responses
- Stay focused on your role and expertise
- Be thorough but concise
- If you're uncertain, acknowledge it
- Format your response in a clear, structured manner`;
    
    return prompt;
  }

  async execute(task, context = {}) {
    this.status = 'running';
    const startTime = Date.now();
    
    try {
      // Build the messages array
      const messages = this.buildMessages(task, context);
      
      // Make the API call
      const response = await this.callLLM(messages);
      
      this.output = response;
      this.status = 'completed';
      
      // Record execution metadata
      this.metadata = {
        executionTime: Date.now() - startTime,
        model: this.model,
        provider: this.provider,
        tokenUsage: this.lastTokenUsage
      };
      
      return this.output;
      
    } catch (error) {
      this.status = 'failed';
      this.error = error.message;
      throw error;
    }
  }

  buildMessages(task, context = {}) {
    const messages = [
      { role: 'system', content: this.systemPrompt }
    ];
    
    // Add context from previous stages (for pipeline pattern)
    if (context.previousOutputs && context.previousOutputs.length > 0) {
      const contextStr = context.previousOutputs
        .map((output, i) => `[Stage ${i + 1}]: ${output}`)
        .join('\n\n');
      
      messages.push({
        role: 'user',
        content: `Previous context:\n${contextStr}\n\nBased on the above, please address: ${task}`
      });
    } else {
      messages.push({ role: 'user', content: task });
    }
    
    // Add additional context if provided
    if (context.additionalContext) {
      messages.push({
        role: 'assistant',
        content: 'I understand. Let me analyze this with the additional context in mind.'
      });
      messages.push({
        role: 'user',
        content: `Additional context: ${context.additionalContext}\n\nPlease proceed with your analysis.`
      });
    }
    
    return messages;
  }

  async callLLM(messages) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: messages,
          temperature: this.temperature,
          max_tokens: this.maxTokens
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`LLM API error (${response.status}): ${error}`);
      }
      
      const data = await response.json();
      
      // Track token usage
      this.lastTokenUsage = {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      };
      
      return data.choices[0]?.message?.content || '';
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error(`LLM request timed out after ${this.timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Stream response from LLM (for real-time output)
   */
  async *executeStream(task, context = {}) {
    this.status = 'running';
    const messages = this.buildMessages(task, context);
    
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages,
        temperature: this.temperature,
        max_tokens: this.maxTokens,
        stream: true
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LLM API error (${response.status}): ${error}`);
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.startsWith('data: '));
      
      for (const line of lines) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices[0]?.delta?.content || '';
          if (content) {
            fullContent += content;
            yield content;
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }
    
    this.output = fullContent;
    this.status = 'completed';
  }

  toJSON() {
    return {
      ...super.toJSON(),
      provider: this.provider,
      model: this.model,
      error: this.error,
      metadata: this.metadata
    };
  }
}

module.exports = { LLMAgent };
