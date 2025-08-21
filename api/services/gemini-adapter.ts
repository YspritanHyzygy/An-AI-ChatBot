/**
 * Google Gemini服务适配器
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { 
  AIServiceAdapter, 
  AIServiceConfig, 
  ChatMessage, 
  AIResponse, 
  StreamResponse, 
  AIServiceError 
} from './types.js';

export class GeminiAdapter implements AIServiceAdapter {
  provider = 'gemini' as const;

  private createClient(config: AIServiceConfig): GoogleGenerativeAI {
    return new GoogleGenerativeAI(config.apiKey);
  }

  private convertMessages(messages: ChatMessage[]): { history: any[], systemInstruction?: string } {
    // Gemini使用不同的消息格式
    const history = [];
    let systemInstruction = '';
    
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      
      if (message.role === 'system') {
        systemInstruction = message.content;
      } else if (message.role === 'user') {
        history.push({
          role: 'user',
          parts: [{ text: message.content }]
        });
      } else if (message.role === 'assistant') {
        history.push({
          role: 'model',
          parts: [{ text: message.content }]
        });
      }
    }
    
    return { history, systemInstruction: systemInstruction || undefined };
  }

  async chat(messages: ChatMessage[], config: AIServiceConfig): Promise<AIResponse> {
    try {
      const client = this.createClient(config);
      const { history, systemInstruction } = this.convertMessages(messages);
      
      // 获取最后一条用户消息
      const lastUserMessage = messages.filter(m => m.role === 'user').pop();
      if (!lastUserMessage) {
        throw new AIServiceError('No user message found', 'gemini');
      }

      const generationConfig: any = {
        temperature: config.temperature || 0.7,
        maxOutputTokens: config.maxTokens || 2000
      };

      // Gemini 支持 topP 参数
      if (config.topP !== undefined) {
        generationConfig.topP = config.topP;
      }

      // Gemini 支持 stop 参数
      if (config.stop) {
        generationConfig.stopSequences = Array.isArray(config.stop) ? config.stop : [config.stop];
      }

      const model = client.getGenerativeModel({ 
        model: config.model,
        systemInstruction: systemInstruction || undefined,
        generationConfig
      });

      // 如果有历史记录，使用聊天会话
      if (history.length > 1) {
        const chat = model.startChat({
          history: history.slice(0, -1) // 除了最后一条消息
        });
        
        const result = await chat.sendMessage(lastUserMessage.content);
        const response = await result.response;
        
        return {
          content: response.text(),
          model: config.model,
          provider: 'gemini',
          usage: response.usageMetadata ? {
            promptTokens: response.usageMetadata.promptTokenCount || 0,
            completionTokens: response.usageMetadata.candidatesTokenCount || 0,
            totalTokens: response.usageMetadata.totalTokenCount || 0
          } : undefined
        };
      } else {
        // 单次对话
        const result = await model.generateContent(lastUserMessage.content);
        const response = await result.response;
        
        return {
          content: response.text(),
          model: config.model,
          provider: 'gemini',
          usage: response.usageMetadata ? {
            promptTokens: response.usageMetadata.promptTokenCount || 0,
            completionTokens: response.usageMetadata.candidatesTokenCount || 0,
            totalTokens: response.usageMetadata.totalTokenCount || 0
          } : undefined
        };
      }
    } catch (error: any) {
      throw new AIServiceError(
        error.message || 'Gemini API调用失败',
        'gemini',
        error.status,
        error
      );
    }
  }

  async *streamChat(messages: ChatMessage[], config: AIServiceConfig): AsyncGenerator<StreamResponse> {
    try {
      const client = this.createClient(config);
      const { history, systemInstruction } = this.convertMessages(messages);
      
      const lastUserMessage = messages.filter(m => m.role === 'user').pop();
      if (!lastUserMessage) {
        throw new AIServiceError('No user message found', 'gemini');
      }

      const generationConfig: any = {
        temperature: config.temperature || 0.7,
        maxOutputTokens: config.maxTokens || 2000
      };

      // Gemini 支持 topP 参数
      if (config.topP !== undefined) {
        generationConfig.topP = config.topP;
      }

      // Gemini 支持 stop 参数
      if (config.stop) {
        generationConfig.stopSequences = Array.isArray(config.stop) ? config.stop : [config.stop];
      }

      const model = client.getGenerativeModel({ 
        model: config.model,
        systemInstruction: systemInstruction || undefined,
        generationConfig
      });

      let result;
      if (history.length > 1) {
        const chat = model.startChat({
          history: history.slice(0, -1)
        });
        result = await chat.sendMessageStream(lastUserMessage.content);
      } else {
        result = await model.generateContentStream(lastUserMessage.content);
      }

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        if (chunkText) {
          yield {
            content: chunkText,
            done: false,
            model: config.model,
            provider: 'gemini'
          };
        }
      }
      
      yield {
        content: '',
        done: true,
        model: config.model,
        provider: 'gemini'
      };
    } catch (error: any) {
      throw new AIServiceError(
        error.message || 'Gemini流式API调用失败',
        'gemini',
        error.status,
        error
      );
    }
  }

  async testConnection(config: AIServiceConfig): Promise<boolean> {
    try {
      // 通过获取模型列表来测试连接，而不是发送聊天消息
      // 这样可以避免依赖具体的模型配置
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${config.apiKey}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async getAvailableModels(config: AIServiceConfig): Promise<{ id: string; name: string }[]> {
    try {
      // Call Google Gemini API to get available models
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${config.apiKey}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new AIServiceError(
          `Failed to fetch Gemini models: HTTP ${response.status}`,
          'gemini',
          response.status
        );
      }

      const data = await response.json();
      
      // Transform API response to our format
      if (data.models && Array.isArray(data.models)) {
        const models = data.models
          .filter((model: any) => model.name && model.name.includes('models/gemini'))
          .map((model: any) => {
            const modelId = model.name.replace('models/', '');
            return {
              id: modelId,
              name: model.displayName || modelId
            };
          });
        
        // If API returns empty list, use default models as fallback
        if (models.length === 0) {
          return [
            { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (Experimental)' },
            { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
            { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
            { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash-8B' },
            { id: 'gemini-1.0-pro', name: 'Gemini 1.0 Pro' }
          ];
        }
        
        return models;
      }
      
      // If API response format is unexpected, use default models as fallback
      return [
        { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (Experimental)' },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
        { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash-8B' },
        { id: 'gemini-1.0-pro', name: 'Gemini 1.0 Pro' }
      ];
    } catch (error: any) {
      // If it's already an AIServiceError, re-throw it
      if (error instanceof AIServiceError) {
        throw error;
      }
      
      // For other errors, wrap them in AIServiceError
      throw new AIServiceError(
        `Failed to get Gemini models: ${error.message || 'Unknown error'}`,
        'gemini',
        error.status,
        error
      );
    }
  }
}