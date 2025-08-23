/**
 * OpenAI服务适配器
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

export class OpenAIAdapter implements AIServiceAdapter {
  provider = 'openai' as const;

  private createClient(config: AIServiceConfig): OpenAI {
    return new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || 'https://api.openai.com/v1'
    });
  }

  async chat(messages: ChatMessage[], config: AIServiceConfig): Promise<AIResponse> {
    try {
      const client = this.createClient(config);
      
      console.log('[OpenAI] 使用传统 Chat Completions API 进行对话');
      // 使用传统的 Chat Completions API
      const requestParams: any = {
        model: config.model,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        max_completion_tokens: config.maxTokens || 2000
      };

      // 默认添加 temperature 参数
      requestParams.temperature = config.temperature || 0.7;

      let response;
      try {
        response = await client.chat.completions.create(requestParams);
      } catch (error: any) {
        // 如果是 temperature 不支持的错误，重试不带 temperature 参数
        if (error.code === 'unsupported_value' && error.param === 'temperature') {
          console.log(`[OpenAI] 模型 ${config.model} 不支持自定义 temperature，使用默认值重试`);
          delete requestParams.temperature;
          response = await client.chat.completions.create(requestParams);
        } else {
          throw error;
        }
      }

      const choice = response.choices[0];
      if (!choice?.message?.content) {
        throw new AIServiceError('No response content', 'openai');
      }

      return {
        content: choice.message.content,
        model: response.model,
        provider: 'openai',
        usage: response.usage ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens
        } : undefined
      };
    } catch (error: any) {
      throw new AIServiceError(
        error.message || 'OpenAI API调用失败',
        'openai',
        error.status,
        error
      );
    }
  }

  async *streamChat(messages: ChatMessage[], config: AIServiceConfig): AsyncGenerator<StreamResponse> {
    try {
      const client = this.createClient(config);
      
      // Responses API 暂不支持流式响应，使用传统 API
      const streamParams: any = {
        model: config.model,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        max_completion_tokens: config.maxTokens || 2000,
        stream: true
      };

      // 默认添加 temperature 参数
      streamParams.temperature = config.temperature || 0.7;

      let stream;
      try {
        stream = await client.chat.completions.create(streamParams);
      } catch (error: any) {
        // 如果是 temperature 不支持的错误，重试不带 temperature 参数
        if (error.code === 'unsupported_value' && error.param === 'temperature') {
          console.log(`[OpenAI] 模型 ${config.model} 不支持自定义 temperature，使用默认值重试`);
          delete streamParams.temperature;
          stream = await client.chat.completions.create(streamParams);
        } else {
          throw error;
        }
      }

      for await (const chunk of stream as any) {
        const choice = chunk.choices[0];
        if (choice?.delta?.content) {
          yield {
            content: choice.delta.content,
            done: false,
            model: chunk.model,
            provider: 'openai'
          };
        }
        
        if (choice?.finish_reason) {
          yield {
            content: '',
            done: true,
            model: chunk.model,
            provider: 'openai'
          };
          break;
        }
      }
    } catch (error: any) {
      throw new AIServiceError(
        error.message || 'OpenAI流式API调用失败',
        'openai',
        error.status,
        error
      );
    }
  }

  async testConnection(config: AIServiceConfig): Promise<boolean> {
    try {
      console.log(`[DEBUG] OpenAI testConnection - Creating client with baseURL: ${config.baseUrl || 'https://api.openai.com/v1'}`);
      const client = this.createClient(config);
      
      // 通过获取模型列表来测试连接，而不是发送聊天消息
      // 这样可以避免依赖具体的模型配置
      console.log('[DEBUG] OpenAI testConnection - Calling models.list()');
      const response = await client.models.list();
      console.log(`[DEBUG] OpenAI testConnection - Success, found ${response.data.length} models`);
      
      return true;
    } catch (error: any) {
      console.error('[DEBUG] OpenAI testConnection - Error:', {
        message: error.message,
        status: error.status,
        code: error.code,
        type: error.type
      });
      return false;
    }
  }

  async getAvailableModels(config: AIServiceConfig): Promise<{ id: string; name: string }[]> {
    try {
      const client = this.createClient(config);
      const response = await client.models.list();
      
      const models = response.data
        .filter(model => model.id.includes('gpt'))
        .map(model => ({
          id: model.id,
          name: model.id
        }))
        .sort((a, b) => a.id.localeCompare(b.id));
      
      // 只有在API调用成功但返回空列表时才使用默认模型作为fallback
      if (models.length === 0) {
        return [
          { id: 'gpt-4o', name: 'GPT-4o' },
          { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
          { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
          { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
        ];
      }
      
      return models;
    } catch (error: any) {
      console.error('OpenAI获取模型列表失败:', error);
      
      // API调用失败时抛出错误，不返回默认模型
      throw new AIServiceError(
        error.message || 'OpenAI API调用失败，无法获取模型列表',
        'openai',
        error.status,
        error
      );
    }
  }



  /**
   * 检索之前的响应
   */
  async retrieveResponse(responseId: string, config: AIServiceConfig): Promise<AIResponse> {
    try {
      const client = this.createClient(config);
      const response = await (client as any).responses.retrieve(responseId);
      
      // 解析响应内容
      if (!response.output || response.output.length === 0) {
        throw new AIServiceError('No response output', 'openai');
      }

      const firstOutput = response.output[0];
      let content = '';
      
      if (firstOutput.content && firstOutput.content.length > 0) {
        const textContent = firstOutput.content.find((c: any) => c.type === 'text');
        if (textContent) {
          content = textContent.text;
        }
      }

      return {
        content,
        model: response.model,
        provider: 'openai',
        responseId: response.id,
        createdAt: response.created_at
      };
    } catch (error: any) {
      throw new AIServiceError(
        error.message || 'OpenAI响应检索失败',
        'openai',
        error.status,
        error
      );
    }
  }

  /**
   * 删除响应
   */
  async deleteResponse(responseId: string, config: AIServiceConfig): Promise<boolean> {
    try {
      const client = this.createClient(config);
      await (client as any).responses.delete(responseId);
      return true;
    } catch (error: any) {
      console.error('OpenAI删除响应失败:', error);
      return false;
    }
  }
}