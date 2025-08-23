/**
 * Ollama服务适配器
 */
import OpenAI from 'openai';
import { 
  AIServiceAdapter, 
  AIServiceConfig, 
  ChatMessage, 
  AIResponse, 
  StreamResponse, 
  AIServiceError 
} from './types.js';

export class OllamaAdapter implements AIServiceAdapter {
  provider = 'ollama' as const;

  private createClient(config: AIServiceConfig): OpenAI {
    // Ollama提供OpenAI兼容的API
    return new OpenAI({
      apiKey: config.apiKey || 'ollama', // Ollama通常不需要API key
      baseURL: config.baseUrl || 'http://localhost:11434/v1'
    });
  }

  async chat(messages: ChatMessage[], config: AIServiceConfig): Promise<AIResponse> {
    try {
      const client = this.createClient(config);
      
      const requestParams: any = {
        model: config.model,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        temperature: config.temperature || 0.7,
        max_tokens: config.maxTokens || 2000
      };

      // 添加其他支持的参数
      if (config.topP !== undefined) {
        requestParams.top_p = config.topP;
      }
      if (config.frequencyPenalty !== undefined) {
        requestParams.frequency_penalty = config.frequencyPenalty;
      }
      if (config.presencePenalty !== undefined) {
        requestParams.presence_penalty = config.presencePenalty;
      }
      if (config.stop) {
        requestParams.stop = config.stop;
      }

      const response = await client.chat.completions.create(requestParams);

      const choice = response.choices[0];
      if (!choice?.message?.content) {
        throw new AIServiceError('No response content', 'ollama');
      }

      return {
        content: choice.message.content,
        model: response.model,
        provider: 'ollama',
        usage: response.usage ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens
        } : undefined
      };
    } catch (error: any) {
      throw new AIServiceError(
        error.message || 'Ollama API调用失败',
        'ollama',
        error.status,
        error
      );
    }
  }

  async *streamChat(messages: ChatMessage[], config: AIServiceConfig): AsyncGenerator<StreamResponse> {
    try {
      const client = this.createClient(config);
      
      const streamParams: any = {
        model: config.model,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        temperature: config.temperature || 0.7,
        max_tokens: config.maxTokens || 2000,
        stream: true
      };

      // 添加其他支持的参数
      if (config.topP !== undefined) {
        streamParams.top_p = config.topP;
      }
      if (config.frequencyPenalty !== undefined) {
        streamParams.frequency_penalty = config.frequencyPenalty;
      }
      if (config.presencePenalty !== undefined) {
        streamParams.presence_penalty = config.presencePenalty;
      }
      if (config.stop) {
        streamParams.stop = config.stop;
      }

      const stream = await client.chat.completions.create(streamParams);

      for await (const chunk of stream as any) {
        const choice = chunk.choices[0];
        if (choice?.delta?.content) {
          yield {
            content: choice.delta.content,
            done: false,
            model: chunk.model,
            provider: 'ollama'
          };
        }
        
        if (choice?.finish_reason) {
          yield {
            content: '',
            done: true,
            model: chunk.model,
            provider: 'ollama'
          };
          break;
        }
      }
    } catch (error: any) {
      throw new AIServiceError(
        error.message || 'Ollama流式API调用失败',
        'ollama',
        error.status,
        error
      );
    }
  }

  async testConnection(config: AIServiceConfig): Promise<boolean> {
    try {
      // 通过检查Ollama服务状态来测试连接，而不是发送聊天消息
      // 这样可以避免依赖具体的模型配置
      const baseUrl = config.baseUrl || 'http://localhost:11434';
      const response = await fetch(`${baseUrl}/api/tags`);
      
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async getAvailableModels(config: AIServiceConfig): Promise<{ id: string; name: string }[]> {
    try {
      const baseUrl = config.baseUrl || 'http://localhost:11434';
      const response = await fetch(`${baseUrl}/api/tags`);
      
      if (!response.ok) {
        throw new AIServiceError(
          `Failed to fetch Ollama models: HTTP ${response.status}`,
          'ollama',
          response.status
        );
      }
      
      const data = await response.json();
      const models = data.models?.map((model: any) => ({
        id: model.name,
        name: model.name
      })) || [];
      
      // If no models are installed, use default models as fallback
      if (models.length === 0) {
        return [
          { id: 'llama3.2', name: 'Llama 3.2' },
        { id: 'qwen2.5', name: 'Qwen 2.5' },
        { id: 'mistral-nemo', name: 'Mistral Nemo' },
          { id: 'codellama', name: 'Code Llama' },
          { id: 'codellama:13b', name: 'Code Llama 13B' },
          { id: 'mistral', name: 'Mistral' },
          { id: 'mixtral', name: 'Mixtral' },
          { id: 'phi', name: 'Phi' },
          { id: 'neural-chat', name: 'Neural Chat' },
          { id: 'starling-lm', name: 'Starling LM' }
        ];
      }
      
      return models;
    } catch (error: any) {
      // If it's already an AIServiceError, re-throw it
      if (error instanceof AIServiceError) {
        throw error;
      }
      
      // For other errors (like network errors), wrap them in AIServiceError
      throw new AIServiceError(
        `Failed to connect to Ollama: ${error.message || 'Service unavailable'}`,
        'ollama',
        error.status,
        error
      );
    }
  }

  // Ollama特有的方法：拉取模型
  async pullModel(modelName: string, config: AIServiceConfig): Promise<boolean> {
    try {
      const baseUrl = config.baseUrl || 'http://localhost:11434';
      const response = await fetch(`${baseUrl}/api/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: modelName })
      });
      
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}