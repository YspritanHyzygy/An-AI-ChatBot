/**
 * JSON文件数据库适配器 - 完全替代Supabase的轻量级本地存储方案
 * 数据存储在本地JSON文件中，支持基本的CRUD操作
 */
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';

interface User {
  id: string;
  username: string;
  passwordHash: string;
  displayName?: string;
  email?: string;
  avatar?: string;
  created_at: string;
  updated_at: string;
  last_login?: string;
}

interface AIProvider {
  id: string;
  user_id: string;
  provider_name: string;
  api_key?: string;
  base_url?: string;
  available_models: string[];
  default_model?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Conversation {
  id: string;
  user_id: string;
  title: string;
  provider_used?: string;
  model_used?: string;
  created_at: string;
  updated_at: string;
}

interface Message {
  id: string;
  conversation_id: string;
  content: string;
  role: 'user' | 'assistant';
  provider?: string;
  model?: string;
  created_at: string;
}

interface DatabaseSchema {
  users: User[];
  ai_providers: AIProvider[];
  conversations: Conversation[];
  messages: Message[];
  custom_models: any[];
}

class JSONDatabase {
  private dbPath: string;
  private data: DatabaseSchema;

  constructor() {
    // 数据文件存储在项目根目录的data文件夹中
    this.dbPath = path.join(process.cwd(), 'data', 'database.json');
    this.data = {
      users: [],
      ai_providers: [],
      conversations: [],
      messages: [],
      custom_models: []
    };
  }

  /**
   * 初始化数据库 - 创建文件夹和初始数据
   */
  async init(): Promise<void> {
    try {
      const dataDir = path.dirname(this.dbPath);
      
      // 创建data目录
      try {
        await fs.access(dataDir);
      } catch {
        await fs.mkdir(dataDir, { recursive: true });
      }

      // 检查数据库文件是否存在
      try {
        await fs.access(this.dbPath);
        await this.loadData();
      } catch {
        // 文件不存在，创建初始数据
        await this.createInitialData();
        await this.saveData();
      }
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  }

  /**
   * 创建初始演示数据
   */
  private async createInitialData(): Promise<void> {
    const now = new Date().toISOString();
    const demoUserId = 'demo-user-001';
    const demoPasswordHash = await bcrypt.hash('demo123', 10);

    // 创建演示用户
    this.data.users.push({
      id: demoUserId,
      username: 'demo_user',
      passwordHash: demoPasswordHash,
      displayName: '演示用户',
      email: 'demo@example.com',
      created_at: now,
      updated_at: now,
      last_login: now
    });

    // 创建欢迎对话
    const welcomeConversationId = uuidv4();
    this.data.conversations.push({
      id: welcomeConversationId,
      user_id: demoUserId,
      title: '欢迎对话',
      created_at: now,
      updated_at: now
    });

    // 创建欢迎消息
    this.data.messages.push({
      id: uuidv4(),
      conversation_id: welcomeConversationId,
      content: '你好！我是AI助手，有什么可以帮助你的吗？',
      role: 'assistant',
      created_at: now
    });
  }

  /**
   * 从文件加载数据
   */
  private async loadData(): Promise<void> {
    try {
      const fileContent = await fs.readFile(this.dbPath, 'utf-8');
      this.data = JSON.parse(fileContent);
    } catch (error) {
      console.error('Failed to load database:', error);
      throw error;
    }
  }

  /**
   * 保存数据到文件
   */
  private async saveData(): Promise<void> {
    try {
      await fs.writeFile(this.dbPath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save database:', error);
      throw error;
    }
  }

  /**
   * 公开的保存数据方法 - 用于手动触发数据保存
   */
  async save(): Promise<void> {
    await this.saveData();
  }

  // ============= 通用查询方法 =============

  /**
   * 模拟Supabase的from().select()查询
   */
  from(table: keyof DatabaseSchema) {
    return {
      select: (_fields: string = '*') => {
        return {
          data: this.data[table],
          error: null
        };
      },
      insert: async (record: any) => {
        const now = new Date().toISOString();
        const newRecord = {
          id: uuidv4(),
          ...record,
          created_at: now,
          updated_at: now
        };
        
        (this.data[table] as any[]).push(newRecord);
        await this.saveData();
        
        return {
          data: newRecord,
          error: null
        };
      },
      update: (updates: any) => {
        return {
          eq: async (field: string, value: any) => {
            const items = this.data[table] as any[];
            const index = items.findIndex(item => item[field] === value);
            
            if (index !== -1) {
              items[index] = {
                ...items[index],
                ...updates,
                updated_at: new Date().toISOString()
              };
              await this.saveData();
              return { data: items[index], error: null };
            }
            
            return { data: null, error: { message: 'Record not found' } };
          }
        };
      },
      delete: () => {
        return {
          eq: async (field: string, value: any) => {
            const items = this.data[table] as any[];
            const index = items.findIndex(item => item[field] === value);
            
            if (index !== -1) {
              const deleted = items.splice(index, 1)[0];
              await this.saveData();
              return { data: deleted, error: null };
            }
            
            return { data: null, error: { message: 'Record not found' } };
          }
        };
      }
    };
  }

  // ============= 特定查询方法 =============

  /**
   * 根据用户ID获取对话列表
   */
  async getConversationsByUserId(userId: string) {
    const conversations = this.data.conversations
      .filter(conv => conv.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    return { data: conversations, error: null };
  }

  /**
   * 根据对话ID获取消息列表
   */
  async getMessagesByConversationId(conversationId: string) {
    const messages = this.data.messages
      .filter(msg => msg.conversation_id === conversationId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    
    return { data: messages, error: null };
  }

  /**
   * 根据用户ID和提供商名称获取AI配置
   */
  async getAIProviderConfig(userId: string, providerName: string) {
    const provider = this.data.ai_providers.find(
      p => p.user_id === userId && p.provider_name === providerName
    );
    
    return { data: provider || null, error: null };
  }

  /**
   * 获取用户的所有AI提供商配置
   */
  async getAIProvidersByUserId(userId: string) {
    const providers = this.data.ai_providers.filter(p => p.user_id === userId);
    return { data: providers, error: null };
  }

  /**
   * 更新或创建 AI 提供商配置
   */
  async updateAIProviderConfig(userId: string, providerName: string, configData: any) {
    try {
      const existingIndex = this.data.ai_providers.findIndex(
        p => p.user_id === userId && p.provider_name === providerName
      );
      
      const now = new Date().toISOString();
      
      if (existingIndex !== -1) {
        // 更新现有配置
        this.data.ai_providers[existingIndex] = {
          ...this.data.ai_providers[existingIndex],
          ...configData,
          updated_at: now
        };
        await this.saveData();
        return { data: this.data.ai_providers[existingIndex], error: null };
      } else {
        // 创建新配置
        const newConfig = {
          id: uuidv4(),
          ...configData,
          created_at: now,
          updated_at: now
        };
        this.data.ai_providers.push(newConfig);
        await this.saveData();
        return { data: newConfig, error: null };
      }
    } catch (error) {
      console.error('Failed to update AI provider config:', error);
      return { data: null, error: { message: 'Failed to update config' } };
    }
  }

  // ============= 用户认证方法 =============

  /**
   * 通过用户名查找用户
   */
  async findUserByUsername(username: string) {
    const user = this.data.users.find(u => u.username === username);
    if (user) {
      // 返回时移除密码哈希
      const { passwordHash: _, ...userWithoutPassword } = user;
      return { data: userWithoutPassword, error: null };
    }
    return { data: null, error: null };
  }

  /**
   * 通过用户ID查找用户
   */
  async findUserById(userId: string) {
    const user = this.data.users.find(u => u.id === userId);
    if (user) {
      // 返回时移除密码哈希
      const { passwordHash: _, ...userWithoutPassword } = user;
      return { data: userWithoutPassword, error: null };
    }
    return { data: null, error: null };
  }

  /**
   * 验证用户密码
   */
  async validatePassword(username: string, password: string) {
    const user = this.data.users.find(u => u.username === username);
    if (!user) {
      return { data: false, error: { message: '用户不存在' } };
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    return { data: isValid, error: null };
  }

  /**
   * 更改用户密码
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const userIndex = this.data.users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      return { data: null, error: { message: '用户不存在' } };
    }

    const user = this.data.users[userIndex];
    
    // 验证当前密码
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      return { data: null, error: { message: '当前密码不正确' } };
    }

    // 加密新密码
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    
    // 更新用户数据
    this.data.users[userIndex] = {
      ...user,
      passwordHash: newPasswordHash,
      updated_at: new Date().toISOString()
    };
    
    await this.saveData();
    
    // 返回时移除密码哈希
    const { passwordHash: _, ...userWithoutPassword } = this.data.users[userIndex];
    return { data: userWithoutPassword, error: null };
  }

  /**
   * 创建新用户
   */
  async createUser(userData: { username: string; password: string; displayName?: string; email?: string }) {
    // 检查用户名是否已存在
    const existingUser = this.data.users.find(u => u.username === userData.username);
    if (existingUser) {
      return { data: null, error: { message: '用户名已存在' } };
    }

    // 加密密码
    const passwordHash = await bcrypt.hash(userData.password, 10);

    const now = new Date().toISOString();
    const newUser = {
      id: uuidv4(),
      username: userData.username,
      passwordHash,
      displayName: userData.displayName || userData.username,
      email: userData.email,
      created_at: now,
      updated_at: now,
      last_login: now
    };

    this.data.users.push(newUser);
    await this.saveData();
    
    // 返回时移除密码哈希
    const { passwordHash: _, ...userWithoutPassword } = newUser;
    return { data: userWithoutPassword, error: null };
  }

  /**
   * 更新用户最后登录时间
   */
  async updateLastLogin(userId: string) {
    const userIndex = this.data.users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
      this.data.users[userIndex].last_login = new Date().toISOString();
      this.data.users[userIndex].updated_at = new Date().toISOString();
      await this.saveData();
      return { data: this.data.users[userIndex], error: null };
    }
    return { data: null, error: { message: '用户不存在' } };
  }
}

// 导出单例实例
export const jsonDatabase = new JSONDatabase();

// 导出创建客户端的函数，保持与Supabase相同的接口
export function createClient(_url?: string, _key?: string) {
  return jsonDatabase;
}