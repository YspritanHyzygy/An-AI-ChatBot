/**
 * AI服务相关的类型定义
 */

// AI服务提供商类型
export type AIProvider = 'openai' | 'openai-responses' | 'claude' | 'gemini' | 'xai' | 'ollama' | 'qwen';

// 消息角色
export type MessageRole = 'user' | 'assistant' | 'system';

// 聊天消息接口
export interface ChatMessage {
  role: MessageRole;
  content: string;
}

// AI服务配置接口
export interface AIServiceConfig {
  provider: AIProvider;
  apiKey: string;
  baseUrl?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number; // 核采样参数，控制生成文本的多样性
  frequencyPenalty?: number; // 频率惩罚，减少重复内容
  presencePenalty?: number; // 存在惩罚，鼓励谈论新话题
  stop?: string[]; // 停止序列
  // OpenAI Responses API 相关配置
  useResponsesAPI?: boolean; // 是否使用 Responses API
  previousResponseId?: string; // 上一个响应的ID，用于链式对话
  store?: boolean; // 是否存储响应数据（默认30天）
}

// AI响应接口
export interface AIResponse {
  content: string;
  model: string;
  provider: AIProvider;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  // Responses API 特有字段
  responseId?: string; // 响应ID，用于后续链式对话
  conversationId?: string; // 对话ID
  createdAt?: number; // 创建时间戳
}

// 流式响应接口
export interface StreamResponse {
  content: string;
  done: boolean;
  model: string;
  provider: AIProvider;
}

// AI服务适配器基础接口
export interface AIServiceAdapter {
  provider: AIProvider;
  
  // 发送聊天消息
  chat(messages: ChatMessage[], config: AIServiceConfig): Promise<AIResponse>;
  
  // 流式聊天（可选）
  streamChat?(messages: ChatMessage[], config: AIServiceConfig): AsyncGenerator<StreamResponse>;
  
  // 测试连接
  testConnection(config: AIServiceConfig): Promise<boolean>;
  
  // 获取可用模型列表
  getAvailableModels(config: AIServiceConfig): Promise<{ id: string; name: string }[]>;
  
  // Responses API 特有方法（可选）
  retrieveResponse?(responseId: string, config: AIServiceConfig): Promise<AIResponse>;
  deleteResponse?(responseId: string, config: AIServiceConfig): Promise<boolean>;
}

// 错误类型
export class AIServiceError extends Error {
  constructor(
    message: string,
    public provider: AIProvider,
    public statusCode?: number,
    public originalError?: any
  ) {
    super(message);
    this.name = 'AIServiceError';
  }
}