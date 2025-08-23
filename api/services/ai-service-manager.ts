/**
 * AI服务管理器 - 统一管理所有AI服务适配器
 */
import { OpenAIAdapter } from './openai-adapter.js';
import { OpenAIResponsesAdapter } from './openai-responses-adapter.js';
import { ClaudeAdapter } from './claude-adapter.js';
import { GeminiAdapter } from './gemini-adapter.js';
import { XAIAdapter } from './xai-adapter.js';
import { OllamaAdapter } from './ollama-adapter.js';
import { 
  AIProvider, 
  AIServiceAdapter, 
  AIServiceConfig, 
  ChatMessage, 
  AIResponse, 
  StreamResponse, 
  AIServiceError 
} from './types.js';

export class AIServiceManager {
  private adapters: Map<AIProvider, AIServiceAdapter> = new Map();

  constructor() {
    // 注册所有AI服务适配器
    this.adapters.set('openai', new OpenAIAdapter());
    this.adapters.set('openai-responses', new OpenAIResponsesAdapter());
    this.adapters.set('claude', new ClaudeAdapter());
    this.adapters.set('gemini', new GeminiAdapter());
    this.adapters.set('xai', new XAIAdapter());
    this.adapters.set('ollama', new OllamaAdapter());
  }

  /**
   * 获取指定提供商的适配器
   */
  getAdapter(provider: AIProvider): AIServiceAdapter {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new AIServiceError(`不支持的AI服务提供商: ${provider}`, provider);
    }
    return adapter;
  }

  /**
   * 获取所有支持的提供商列表
   */
  getSupportedProviders(): AIProvider[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * 发送聊天消息
   */
  async chat(
    provider: AIProvider, 
    messages: ChatMessage[], 
    config: AIServiceConfig
  ): Promise<AIResponse> {
    const adapter = this.getAdapter(provider);
    return adapter.chat(messages, config);
  }

  /**
   * 发送流式聊天消息
   */
  async *streamChat(
    provider: AIProvider, 
    messages: ChatMessage[], 
    config: AIServiceConfig
  ): AsyncGenerator<StreamResponse> {
    const adapter = this.getAdapter(provider);
    if (adapter.streamChat) {
      yield* adapter.streamChat(messages, config);
    } else {
      throw new AIServiceError(`${provider} does not support streaming`, provider);
    }
  }

  /**
   * 测试连接
   */
  async testConnection(provider: AIProvider, config: AIServiceConfig): Promise<boolean> {
    try {
      const adapter = this.getAdapter(provider);
      return await adapter.testConnection(config);
    } catch (_error) {
      return false;
    }
  }

  /**
   * 获取可用模型列表
   */
  async getAvailableModels(provider: AIProvider, config: AIServiceConfig): Promise<{ id: string; name: string }[]> {
    const adapter = this.getAdapter(provider);
    return adapter.getAvailableModels(config);
  }

  /**
   * 获取提供商的默认配置（根据2025年1月官方API文档适配）
   */
  getDefaultConfig(provider: AIProvider): Partial<AIServiceConfig> {
    const defaults: Record<AIProvider, Partial<AIServiceConfig>> = {
      // OpenAI GPT-4o 参数范围: temperature 0.0-2.0, max_tokens 1-4096, top_p 0.0-1.0
      openai: {
        model: 'gpt-4o',
        baseUrl: 'https://api.openai.com/v1',
        temperature: 0.7,     // 范围: 0.0-2.0，推荐创意任务用0.7-1.0
        maxTokens: 4000,      // 范围: 1-4096，根据需要调整
        topP: 1.0             // 范围: 0.0-1.0，与temperature二选一使用
      },
      // OpenAI Responses API 同样参数规范
      'openai-responses': {
        model: 'gpt-4o',
        baseUrl: 'https://api.openai.com/v1',
        temperature: 0.7,     // 范围: 0.0-2.0
        maxTokens: 4000,      // 范围: 1-4096
        topP: 1.0             // 范围: 0.0-1.0
      },
      // Claude 参数范围: temperature 0.0-1.0, max_tokens 1-8192(标准4096,beta时8192), top_p 0.0-1.0
      // 注意：Claude文档明确不建议同时设置temperature和top_p
      claude: {
        model: 'claude-3-5-sonnet-20241022',
        baseUrl: 'https://api.anthropic.com',
        temperature: 0.7,     // 范围: 0.0-1.0，比OpenAI范围小
        maxTokens: 4000,      // 范围: 1-8192(标准4096,beta时8192)
        topP: undefined       // 与temperature二选一，默认不设置
      },
      // Gemini 参数范围: temperature 0.0-2.0, maxOutputTokens 1-65536, topP 0.0-1.0
      gemini: {
        model: 'gemini-2.5-pro',
        baseUrl: 'https://generativelanguage.googleapis.com',
        temperature: 0.7,     // 范围: 0.0-2.0
        topP: 0.95            // 范围: 0.0-1.0，Gemini推荐0.95
        // 不设置maxTokens，让Gemini使用模型最大限制(65536)
      },
      // XAI Grok 使用OpenAI兼容API，参数范围: temperature 0.0-1.0, max_tokens 1-4096, top_p 0.0-1.0
      xai: {
        model: 'grok-2-1212',
        baseUrl: 'https://api.x.ai/v1',
        temperature: 0.7,     // 范围: 0.0-1.0，与OpenAI不同
        maxTokens: 4000,      // 范围: 1-4096，比OpenAI稍小
        topP: 1.0             // 范围: 0.0-1.0
      },
      // Ollama 本地模型，参数范围: temperature 0.0-2.0, max_tokens 无严格限制, top_p 0.0-1.0
      ollama: {
        model: 'llama3.3',
        baseUrl: 'http://localhost:11434/v1',
        temperature: 0.7,     // 范围: 0.0-2.0，本地模型更灵活
        maxTokens: 4000,      // 本地模型可根据硬件调整
        topP: 1.0             // 范围: 0.0-1.0
      }
    };

    return defaults[provider] || {};
  }

  /**
   * 验证配置是否完整（根据各厂商API文档验证参数范围）
   */
  validateConfig(provider: AIProvider, config: AIServiceConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 通用验证
    if (!config.model) {
      errors.push('模型名称不能为空');
    }

    // 特定提供商验证
    switch (provider) {
      case 'openai':
      case 'openai-responses':
        if (!config.apiKey) {
          errors.push('API Key不能为空');
        }
        // OpenAI 参数范围验证
        if (config.temperature !== undefined && (config.temperature < 0 || config.temperature > 2)) {
          errors.push('OpenAI temperature值必须在0.0-2.0之间');
        }
        if (config.maxTokens !== undefined && (config.maxTokens <= 0 || config.maxTokens > 4096)) {
          errors.push('OpenAI maxTokens必须在1-4096之间');
        }
        if (config.topP !== undefined && (config.topP < 0 || config.topP > 1)) {
          errors.push('OpenAI topP值必须在0.0-1.0之间');
        }
        break;
        
      case 'claude':
        if (!config.apiKey) {
          errors.push('API Key不能为空');
        }
        // Claude 参数范围验证 (更严格的temperature范围)
        if (config.temperature !== undefined && (config.temperature < 0 || config.temperature > 1)) {
          errors.push('Claude temperature值必须在0.0-1.0之间');
        }
        if (config.maxTokens !== undefined && (config.maxTokens <= 0 || config.maxTokens > 8192)) {
          errors.push('Claude maxTokens必须在1-8192之间(标准4096,beta时8192)');
        }
        if (config.topP !== undefined && (config.topP < 0 || config.topP > 1)) {
          errors.push('Claude topP值必须在0.0-1.0之间');
        }
        // Claude不建议同时设置temperature和topP
        if (config.temperature !== undefined && config.topP !== undefined) {
          errors.push('Claude不建议同时设置temperature和topP参数，请选择一个使用');
        }
        break;
        
      case 'gemini':
        if (!config.apiKey) {
          errors.push('API Key不能为空');
        }
        // Gemini 参数范围验证
        if (config.temperature !== undefined && (config.temperature < 0 || config.temperature > 2)) {
          errors.push('Gemini temperature值必须在0.0-2.0之间');
        }
        if (config.maxTokens !== undefined && (config.maxTokens <= 0 || config.maxTokens > 65536)) {
          errors.push('Gemini maxOutputTokens必须在1-65536之间');
        }
        if (config.topP !== undefined && (config.topP < 0 || config.topP > 1)) {
          errors.push('Gemini topP值必须在0.0-1.0之间');
        }
        break;
        
      case 'xai':
        if (!config.apiKey) {
          errors.push('API Key不能为空');
        }
        // XAI Grok 参数范围验证 (更严格的temperature范围)
        if (config.temperature !== undefined && (config.temperature < 0 || config.temperature > 1)) {
          errors.push('XAI temperature值必须在0.0-1.0之间');
        }
        if (config.maxTokens !== undefined && (config.maxTokens <= 0 || config.maxTokens > 4096)) {
          errors.push('XAI maxTokens必须在1-4096之间');
        }
        if (config.topP !== undefined && (config.topP < 0 || config.topP > 1)) {
          errors.push('XAI topP值必须在0.0-1.0之间');
        }
        break;
        
      case 'ollama':
        // Ollama通常不需要API Key，但需要确保服务运行
        if (!config.baseUrl) {
          errors.push('Base URL不能为空');
        }
        // Ollama 参数范围验证 (本地模型相对灵活)
        if (config.temperature !== undefined && (config.temperature < 0 || config.temperature > 2)) {
          errors.push('Ollama temperature值必须在0.0-2.0之间');
        }
        if (config.maxTokens !== undefined && config.maxTokens <= 0) {
          errors.push('Ollama maxTokens必须大于0');
        }
        if (config.topP !== undefined && (config.topP < 0 || config.topP > 1)) {
          errors.push('Ollama topP值必须在0.0-1.0之间');
        }
        break;
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// 导出单例实例
export const aiServiceManager = new AIServiceManager();