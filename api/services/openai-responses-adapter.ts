/**
 * OpenAI Responses API 专用适配器
 * 简化版本，专注于基本功能的稳定实现
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

export class OpenAIResponsesAdapter implements AIServiceAdapter {
  provider = 'openai-responses' as const;

  private createClient(config: AIServiceConfig): OpenAI {
    return new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || 'https://api.openai.com/v1'
    });
  }

  async chat(messages: ChatMessage[], config: AIServiceConfig): Promise<AIResponse> {
    try {
      const client = this.createClient(config);
      
      console.log('[OpenAI Responses API] 开始对话，模型:', config.model);

      // 使用 Responses API
      const requestParams: any = {
        model: config.model,
        messages: messages.map(msg => ({
          role: msg.role as 'system' | 'user' | 'assistant',
          content: [{
            type: 'text',
            text: msg.content
          }]
        })),
        max_completion_tokens: config.maxTokens || 2000,
        store: config.store || true // Responses API 特有参数
      };

      // 如果有前一个响应ID，添加到请求中实现链式对话
      if (config.previousResponseId) {
        requestParams.include = [{
          type: 'response',
          id: config.previousResponseId
        }];
      }

      // 默认添加 temperature 参数
      requestParams.temperature = config.temperature || 0.7;

      let response;
      try {
        // 使用 Responses API 端点
        response = await (client as any).responses.create(requestParams);
      } catch (error: any) {
        // 如果是 temperature 不支持的错误，重试不带 temperature 参数
        if (error.code === 'unsupported_value' && error.param === 'temperature') {
          console.log(`[OpenAI Responses] 模型 ${config.model} 不支持自定义 temperature，使用默认值重试`);
          delete requestParams.temperature;
          response = await (client as any).responses.create(requestParams);
        } else {
          throw error;
        }
      }
      
      console.log('[OpenAI Responses API] 响应成功，ID:', response.id);

      // 从 Responses API 响应中提取内容
      if (!response.output || response.output.length === 0) {
        console.error('[OpenAI Responses API] 响应中没有输出内容');
        throw new AIServiceError('No response output', 'openai-responses');
      }

      const firstOutput = response.output[0];
      let content = '';
      
      if (firstOutput.content && firstOutput.content.length > 0) {
        const textContent = firstOutput.content.find((c: any) => c.type === 'text');
        if (textContent) {
          content = textContent.text;
        }
      }
      
      if (!content) {
        console.error('[OpenAI Responses API] 无法提取文本内容');
        console.error('[DEBUG] Response:', JSON.stringify(response, null, 2));
        throw new AIServiceError(
          'OpenAI Chat Completions API 返回了空的响应内容，请检查模型配置或稍后重试',
          'openai-responses'
        );
      }

      return {
        content,
        model: response.model || config.model,
        provider: 'openai-responses',
        responseId: response.id, // Responses API 特有的响应ID
        createdAt: response.created, // 响应创建时间
        usage: response.usage ? {
          promptTokens: response.usage.prompt_tokens || 0,
          completionTokens: response.usage.completion_tokens || 0,
          totalTokens: response.usage.total_tokens || 0
        } : undefined
      };
    } catch (error: any) {
      console.error('[OpenAI Responses API] 错误:', {
        message: error.message,
        status: error.status,
        code: error.code
      });
      
      // 如果已经是 AIServiceError，直接抛出
      if (error instanceof AIServiceError) {
        throw error;
      }
      
      // 包装其他错误
      throw new AIServiceError(
        error.message || 'OpenAI Responses API 调用失败',
        'openai-responses',
        error.status,
        error
      );
    }
  }

  async *streamChat(messages: ChatMessage[], config: AIServiceConfig): AsyncGenerator<StreamResponse> {
    // Responses API 目前不支持流式响应，回退到非流式调用
    console.log('[OpenAI Responses API] 注意：Responses API 不支持流式响应，使用非流式调用');
    
    try {
      const response = await this.chat(messages, config);
      
      // 模拟流式响应，一次性返回完整内容
      yield {
        content: response.content,
        done: false,
        model: response.model,
        provider: 'openai-responses'
      };
      
      yield {
        content: '',
        done: true,
        model: response.model,
        provider: 'openai-responses'
      };
    } catch (error: any) {
      throw new AIServiceError(
        error.message || 'OpenAI Responses API调用失败',
        'openai-responses',
        error.status,
        error
      );
    }
  }

  async testConnection(config: AIServiceConfig): Promise<boolean> {
    try {
      const client = this.createClient(config);
      // 简单的连接测试
      await client.models.list();
      return true;
    } catch (error: any) {
      console.error('[OpenAI Responses API] 连接测试失败:', error.message);
      return false;
    }
  }

  async getAvailableModels(config: AIServiceConfig): Promise<{ id: string; name: string }[]> {
    try {
      const client = this.createClient(config);
      const response = await client.models.list();
      
      // 过滤出支持的模型
      return response.data
        .filter(model => model.id.includes('gpt'))
        .map(model => ({
          id: model.id,
          name: model.id
        }));
    } catch (error: any) {
      console.error('[OpenAI Responses API] 获取模型列表失败:', error.message);
      throw new AIServiceError(
        '无法获取 OpenAI 模型列表',
        'openai-responses',
        error.status,
        error
      );
    }
  }
}