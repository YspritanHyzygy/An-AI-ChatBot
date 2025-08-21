/**
 * AI服务管理器 - 统一管理所有AI服务适配器
 */
import { OpenAIAdapter } from './openai-adapter.js';
import { OpenAIResponsesAdapter } from './openai-responses-adapter.js';
import { ClaudeAdapter } from './claude-adapter.js';
import { GeminiAdapter } from './gemini-adapter.js';
import { XAIAdapter } from './xai-adapter.js';
import { OllamaAdapter } from './ollama-adapter.js';
import { QwenAdapter } from './qwen-adapter.js';
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
    this.adapters.set('qwen', new QwenAdapter());
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
   * 获取提供商的默认配置（2025年1月最新真实模型）
   */
  getDefaultConfig(provider: AIProvider): Partial<AIServiceConfig> {
    const defaults: Record<AIProvider, Partial<AIServiceConfig>> = {
      openai: {
        model: 'gpt-4o',
        baseUrl: 'https://api.openai.com/v1',
        temperature: 0.7,
        maxTokens: 4000
      },
      'openai-responses': {
        model: 'gpt-4o',
        baseUrl: 'https://api.openai.com/v1',
        temperature: 0.7,
        maxTokens: 4000
      },
      claude: {
        model: 'claude-3-5-sonnet-20241022',
        baseUrl: 'https://api.anthropic.com',
        temperature: 0.7,
        maxTokens: 4000
      },
      gemini: {
        model: 'gemini-2.5-pro',
        baseUrl: 'https://generativelanguage.googleapis.com',
        temperature: 0.7,
        maxTokens: 4000
      },
      xai: {
        model: 'grok-2-1212',
        baseUrl: 'https://api.x.ai/v1',
        temperature: 0.7,
        maxTokens: 4000
      },
      ollama: {
        model: 'llama3.3',
        baseUrl: 'http://localhost:11434/v1',
        temperature: 0.7,
        maxTokens: 4000
      },
      qwen: {
        model: 'qwen-max',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        temperature: 0.7,
        maxTokens: 4000
      }
    };

    return defaults[provider] || {};
  }

  /**
   * 验证配置是否完整
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
      case 'claude':
      case 'gemini':
      case 'xai':
      case 'qwen':
        if (!config.apiKey) {
          errors.push('API Key不能为空');
        }
        break;
      case 'ollama':
        // Ollama通常不需要API Key，但需要确保服务运行
        if (!config.baseUrl) {
          errors.push('Base URL不能为空');
        }
        break;
    }

    // 验证数值范围
    if (config.temperature !== undefined && (config.temperature < 0 || config.temperature > 2)) {
      errors.push('温度值必须在0-2之间');
    }

    if (config.maxTokens !== undefined && config.maxTokens <= 0) {
      errors.push('最大令牌数必须大于0');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// 导出单例实例
export const aiServiceManager = new AIServiceManager();