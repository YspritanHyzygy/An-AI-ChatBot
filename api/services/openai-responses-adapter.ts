/**
 * OpenAI Responses API 专用适配器
 * 支持有状态对话管理和链式响应
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
      
      console.log('[OpenAI Responses API] 创建响应，配置:', {
        model: config.model,
        previousResponseId: config.previousResponseId,
        store: config.store
      });

      // 构建 Responses API 请求参数
      const requestParams: any = {
        model: config.model,
        input: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        store: config.store !== false // 默认存储30天
      };

      // 添加模型参数
      if (config.temperature !== undefined) {
        requestParams.temperature = config.temperature;
      }
      if (config.maxTokens !== undefined) {
        requestParams.max_completion_tokens = config.maxTokens;
      }
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

      // 如果有上一个响应ID，用于链式对话
      if (config.previousResponseId) {
        requestParams.previous_response_id = config.previousResponseId;
        console.log('[OpenAI Responses API] 使用链式对话，previous_response_id:', config.previousResponseId);
      }

      // 控制数据存储（默认存储30天）
      if (config.store !== undefined) {
        console.log('[OpenAI Responses API] 数据存储设置:', config.store);
      }

      console.log('[OpenAI Responses API] 请求参数:', JSON.stringify(requestParams, null, 2));

      // 调用 Responses API
      const response = await (client as any).responses.create(requestParams);
      
      console.log('[OpenAI Responses API] 响应成功，response_id:', response.id);
      
      console.log('[DEBUG] OpenAI Responses API - Response received:', {
        id: response.id,
        created_at: response.created_at,
        output_length: response.output?.length
      });

      // 解析响应内容
      if (!response.output || response.output.length === 0) {
        throw new AIServiceError('No response output from Responses API', 'openai-responses');
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
        throw new AIServiceError('No text content in Responses API output', 'openai-responses');
      }

      return {
        content,
        model: response.model || config.model,
        provider: 'openai-responses',
        responseId: response.id,
        createdAt: response.created_at,
        usage: response.usage ? {
          promptTokens: response.usage.input_tokens || 0,
          completionTokens: response.usage.output_tokens || 0,
          totalTokens: (response.usage.input_tokens || 0) + (response.usage.output_tokens || 0)
        } : undefined
      };
    } catch (error: any) {
      console.error('[DEBUG] OpenAI Responses API - Error:', {
        message: error.message,
        status: error.status,
        code: error.code,
        type: error.type
      });
      
      throw new AIServiceError(
        error.message || 'OpenAI Responses API调用失败',
        'openai-responses',
        error.status,
        error
      );
    }
  }

  // Responses API 暂不支持流式响应
  async *streamChat(_messages: ChatMessage[], _config: AIServiceConfig): AsyncGenerator<StreamResponse> {
    throw new AIServiceError('OpenAI Responses API 暂不支持流式响应', 'openai-responses');
  }

  async testConnection(config: AIServiceConfig): Promise<boolean> {
    try {
      console.log(`[DEBUG] OpenAI Responses API testConnection - Creating client with baseURL: ${config.baseUrl || 'https://api.openai.com/v1'}`);
      const client = this.createClient(config);
      
      // 通过获取模型列表来测试连接
      console.log('[DEBUG] OpenAI Responses API testConnection - Calling models.list()');
      const response = await client.models.list();
      console.log(`[DEBUG] OpenAI Responses API testConnection - Success, found ${response.data.length} models`);
      
      return true;
    } catch (error: any) {
      console.error('[DEBUG] OpenAI Responses API testConnection - Error:', {
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
      
      return response.data
        .filter(model => model.id.includes('gpt')) // 只返回GPT模型
        .map(model => ({
          id: model.id,
          name: model.id
        }));
    } catch (error: any) {
      console.error('[OpenAI Responses API] 获取模型列表失败:', error);
      return [];
    }
  }

  /**
   * 检索之前的响应
   */
  async retrieveResponse(responseId: string, config: AIServiceConfig): Promise<AIResponse> {
    try {
      const client = this.createClient(config);
      const response = await (client as any).responses.retrieve(responseId);
      
      console.log('[OpenAI Responses API] 检索响应成功:', responseId);
      
      // 解析响应内容
      if (!response.output || response.output.length === 0) {
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

      return {
        content,
        model: response.model,
        provider: 'openai-responses',
        responseId: response.id,
        createdAt: response.created_at
      };
    } catch (error: any) {
      console.error('[OpenAI Responses API] 检索响应失败:', error);
      throw new AIServiceError(
        error.message || 'OpenAI响应检索失败',
        'openai-responses',
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
      
      console.log('[OpenAI Responses API] 删除响应成功:', responseId);
      return true;
    } catch (error: any) {
      console.error('[OpenAI Responses API] 删除响应失败:', error);
      return false;
    }
  }

  /**
   * 列出所有响应
   */
  async listResponses(config: AIServiceConfig, limit: number = 20): Promise<any[]> {
    try {
      const client = this.createClient(config);
      const response = await (client as any).responses.list({ limit });
      
      console.log('[OpenAI Responses API] 列出响应成功，数量:', response.data?.length || 0);
      return response.data || [];
    } catch (error: any) {
      console.error('[OpenAI Responses API] 列出响应失败:', error);
      return [];
    }
  }

  /**
   * 创建对话链 - 基于之前的响应继续对话
   */
  async continueConversation(
    messages: ChatMessage[], 
    config: AIServiceConfig, 
    previousResponseId: string
  ): Promise<AIResponse> {
    const configWithChain = {
      ...config,
      previousResponseId
    };
    
    return this.chat(messages, configWithChain);
  }

  /**
   * 获取对话历史 - 通过响应ID链追踪完整对话
   */
  async getConversationHistory(
    responseId: string, 
    config: AIServiceConfig
  ): Promise<AIResponse[]> {
    const history: AIResponse[] = [];
    let currentResponseId = responseId;
    
    try {
      while (currentResponseId) {
        const response = await this.retrieveResponse(currentResponseId, config);
        history.unshift(response); // 添加到开头，保持时间顺序
        
        // 检查是否有前一个响应ID（需要从响应中获取）
        // 这里需要根据实际API响应结构调整
        currentResponseId = (response as any).previousResponseId;
      }
    } catch (error) {
      console.error('[OpenAI Responses API] 获取对话历史失败:', error);
    }
    
    return history;
  }
}