/**
 * 聊天相关的API路由
 * 处理对话创建、消息发送、历史记录等功能
 */
import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { aiServiceManager } from '../services/ai-service-manager.js';
import { AIProvider, ChatMessage } from '../services/types.js';

const router = Router();

// Supabase客户端配置 - 延迟初始化
let supabase: any = null;

function getSupabaseClient() {
  if (!supabase) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase configuration:');
      console.error('SUPABASE_URL:', supabaseUrl ? 'Set' : 'Not set');
      console.error('SUPABASE_ANON_KEY:', supabaseKey ? 'Set' : 'Not set');
      console.error('Please check your .env file in the project root directory.');
      throw new Error('Missing Supabase configuration. Please check your environment variables.');
    }

    supabase = createClient(supabaseUrl, supabaseKey);
  }
  return supabase;
}

// 获取默认AI服务配置的辅助函数
function getDefaultProviderConfig(provider: string) {
  const envConfigs: Record<string, any> = {
    'openai': {
      api_key: process.env.OPENAI_API_KEY,
      base_url: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      default_model: process.env.OPENAI_DEFAULT_MODEL || 'gpt-4o'
    },
    'gemini': {
      api_key: process.env.GEMINI_API_KEY,
      base_url: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com',
      default_model: process.env.GEMINI_DEFAULT_MODEL || 'gemini-2.5-pro'
    },
    'claude': {
      api_key: process.env.CLAUDE_API_KEY,
      base_url: process.env.CLAUDE_BASE_URL || 'https://api.anthropic.com',
      default_model: process.env.CLAUDE_DEFAULT_MODEL || 'claude-3-5-sonnet-20241022'
    }
  };

  const config = envConfigs[provider];
  if (config && config.api_key) {
    return config;
  }
  return null;
}

/**
 * 获取用户的对话列表
 * GET /api/chat/conversations
 */
router.get('/conversations', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.query['userId'] as string | undefined;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        error: '缺少用户ID'
      });
      return;
    }

    const { data, error } = await getSupabaseClient()
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Supabase conversations query error:', error);
      // 如果数据库查询失败，返回空数组而不是错误
      res.json({
        success: true,
        data: []
      });
      return;
    }

    res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    console.error('Chat conversations route error:', error);
    // 如果发生任何错误，返回空对话列表以避免前端白屏
    res.json({
      success: true,
      data: []
    });
  }
});

/**
 * 创建新对话
 * POST /api/chat/conversations
 */
router.post('/conversations', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, title = '新对话' } = req.body as { userId?: string; title?: string };
    
    if (!userId) {
      res.status(400).json({
        success: false,
        error: '缺少用户ID'
      });
      return;
    }

    const { data, error } = await getSupabaseClient()
      .from('conversations')
      .insert({
        user_id: userId,
        title
      })
      .select()
      .single();

    if (error) {
      res.status(500).json({
        success: false,
        error: '创建对话失败'
      });
      return;
    }

    res.json({
      success: true,
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * 获取对话的消息列表
 * GET /api/chat/conversations/:conversationId/messages
 */
router.get('/conversations/:conversationId/messages', async (req: Request, res: Response): Promise<void> => {
  try {
    const { conversationId } = req.params;
    
    const { data, error } = await getSupabaseClient()
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      res.status(500).json({
        success: false,
        error: '获取消息列表失败'
      });
      return;
    }

    res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * 发送消息并获取AI回复
 * POST /api/chat/conversations/:conversationId/messages
 */
router.post('/conversations/:conversationId/messages', async (req: Request, res: Response): Promise<void> => {
  try {
    const { conversationId } = req.params;
    const { content, provider = 'openai', model = 'gpt-3.5-turbo', stream = false, userId } = req.body as {
      content?: string;
      provider?: string;
      model?: string;
      stream?: boolean;
      userId?: string;
    };
    
    if (!content) {
      res.status(400).json({
        success: false,
        error: '消息内容不能为空'
      });
      return;
    }

    if (!userId) {
      res.status(400).json({
        success: false,
        error: '缺少用户ID'
      });
      return;
    }

    // 获取用户的AI服务配置
    const { data: providerConfig, error: configError } = await getSupabaseClient()
      .from('ai_providers')
      .select('*')
      .eq('user_id', userId)
      .eq('provider_name', provider)
      .eq('is_active', true)
      .single();

    if (configError || !providerConfig) {
      res.status(400).json({
        success: false,
        error: `请先配置${provider}服务`
      });
      return;
    }

    // 首先检查对话是否存在
    const { data: conversation, error: conversationError } = await getSupabaseClient()
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .single();

    if (conversationError || !conversation) {
      console.error('对话不存在:', conversationId, conversationError);
      res.status(404).json({
        success: false,
        error: '对话不存在'
      });
      return;
    }

    // 保存用户消息
    const { data: userMessage, error: userMessageError } = await getSupabaseClient()
      .from('messages')
      .insert({
        conversation_id: conversationId,
        content,
        role: 'user'
      })
      .select()
      .single();

    if (userMessageError) {
      console.error('保存用户消息失败:', userMessageError);
      res.status(500).json({
        success: false,
        error: `保存用户消息失败: ${userMessageError.message}`
      });
      return;
    }

    // 获取对话历史消息
    const { data: historyMessages, error: historyError } = await getSupabaseClient()
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(20);

    if (historyError) {
      res.status(500).json({
        success: false,
        error: '获取历史消息失败'
      });
      return;
    }

    const messages: ChatMessage[] = historyMessages.map((msg: any) => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content
    }));

    try {
      if (stream) {
        // 流式响应
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*'
        });

        let aiResponseContent = '';
        
        for await (const chunk of aiServiceManager.streamChat(
          provider as AIProvider,
          messages,
          {
            provider: provider as AIProvider,
            apiKey: providerConfig.api_key,
            baseUrl: providerConfig.base_url,
            model: providerConfig.default_model || model,
            temperature: providerConfig.temperature || 0.7,
            maxTokens: providerConfig.max_tokens || 2000,
            topP: providerConfig.top_p,
            frequencyPenalty: providerConfig.frequency_penalty,
            presencePenalty: providerConfig.presence_penalty,
            stop: providerConfig.stop
          }
        )) {
          aiResponseContent += chunk.content;
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          
          if (chunk.done) {
            break;
          }
        }

        // 保存完整的AI回复
        await getSupabaseClient()
          .from('messages')
          .insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: aiResponseContent,
            provider,
            model
          });

        res.write(`data: [DONE]\n\n`);
        res.end();
      } else {
        // 普通响应
        const aiResponse = await aiServiceManager.chat(
          provider as AIProvider,
          messages,
          {
            provider: provider as AIProvider,
            apiKey: providerConfig.api_key,
            baseUrl: providerConfig.base_url,
            model: providerConfig.default_model || model,
            temperature: providerConfig.temperature || 0.7,
            maxTokens: providerConfig.max_tokens || 2000,
            topP: providerConfig.top_p,
            frequencyPenalty: providerConfig.frequency_penalty,
            presencePenalty: providerConfig.presence_penalty,
            stop: providerConfig.stop
          }
        );

        // 保存AI回复
        const { data: aiMessage, error: aiMessageError } = await getSupabaseClient()
          .from('messages')
          .insert({
            conversation_id: conversationId,
            content: aiResponse.content,
            role: 'assistant',
            provider,
            model
          })
          .select()
          .single();

        if (aiMessageError) {
          res.status(500).json({
            success: false,
            error: '保存AI回复失败'
          });
          return;
        }

        // 更新对话的最后更新时间
        await getSupabaseClient()
          .from('conversations')
          .update({ 
            updated_at: new Date().toISOString(),
            provider_used: provider,
            model_used: model
          })
          .eq('id', conversationId);

        res.json({
          success: true,
          data: {
            userMessage,
            aiMessage
          }
        });
      }
    } catch (aiError: any) {
      console.error('AI服务调用错误:', aiError);
      
      // 保存错误消息
      await getSupabaseClient()
        .from('messages')
        .insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: `抱歉，AI服务暂时不可用：${aiError.message}`,
          provider,
          model
        });

      if (stream) {
        res.write(`data: ${JSON.stringify({ error: aiError.message, done: true })}\n\n`);
        res.end();
      } else {
        res.status(500).json({
          success: false,
          error: `AI服务调用失败：${aiError.message}`
        });
      }
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * 删除对话
 * DELETE /api/chat/conversations/:conversationId
 */
router.delete('/conversations/:conversationId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { conversationId } = req.params;
    
    // 删除对话（消息会因为外键约束自动删除）
    const { error } = await getSupabaseClient()
      .from('conversations')
      .delete()
      .eq('id', conversationId);

    if (error) {
      res.status(500).json({
        success: false,
        error: '删除对话失败'
      });
      return;
    }

    res.json({
      success: true,
      message: '对话删除成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * 简化的聊天接口 - 兼容前端调用
 * POST /api/chat
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { message, provider = 'openai', model = 'gpt-3.5-turbo', conversationId, userId = '00000000-0000-0000-0000-000000000001', parameters } = req.body as {
      message?: string;
      provider?: string;
      model?: string;
      conversationId?: string;
      userId?: string;
      parameters?: {
        temperature?: number;
        maxTokens?: number;
        topP?: number;
      };
    };
    
    if (!message) {
      res.status(400).json({
        success: false,
        error: '消息内容不能为空'
      });
      return;
    }

    let targetConversationId = conversationId;
    
    // 如果没有提供conversationId，创建新对话
    if (!targetConversationId) {
      // 使用演示用户ID，避免UUID类型问题
      const demoUserId = '00000000-0000-0000-0000-000000000001';
      
      console.log(`[DEBUG] 使用演示用户ID: ${demoUserId} 代替前端用户ID: ${userId}`);

      const { data: newConversation, error: createError } = await getSupabaseClient()
        .from('conversations')
        .insert({
          user_id: demoUserId,
          title: message.slice(0, 30) + (message.length > 30 ? '...' : '')
        })
        .select()
        .single();

      if (createError) {
        console.error('创建对话失败:', createError);
        console.error('创建对话时使用的用户ID:', demoUserId);
        console.error('消息内容:', message);
        res.status(500).json({
          success: false,
          error: `创建对话失败: ${createError.message}`
        });
        return;
      }
      
      targetConversationId = newConversation.id;
    }

    // 获取用户的AI服务配置，如果没有配置则使用默认配置
    let providerConfig;
    const actualUserId = targetConversationId ? userId : '00000000-0000-0000-0000-000000000001';
    const { data: userConfigs, error: configError } = await getSupabaseClient()
      .from('ai_providers')
      .select('*')
      .eq('user_id', actualUserId)
      .eq('is_active', true);

    console.log(`[DEBUG] Provider from frontend: "${provider}"`);
    console.log('[DEBUG] All active configs found in DB for user:', JSON.stringify(userConfigs, null, 2));

    // 在代码中进行过滤，而不是在数据库查询中
    const userConfig = userConfigs ? userConfigs.find((config: { provider_name: string }) => config.provider_name === provider) : null;

    if (configError || !userConfig) {
      // 如果用户没有配置，尝试使用环境变量中的默认配置
      const defaultConfig = getDefaultProviderConfig(provider);
      if (!defaultConfig) {
        res.status(400).json({
          success: false,
          error: `请先配置${provider}服务或设置相应的环境变量。请在.env文件中添加对应的API密钥：${provider.toUpperCase()}_API_KEY`
        });
        return;
      }
      providerConfig = {
        api_key: defaultConfig.api_key,
        base_url: defaultConfig.base_url,
        default_model: defaultConfig.default_model
      };
    } else {
      providerConfig = userConfig;
    }

    // 保存用户消息
    const { data: userMessage, error: userMessageError } = await getSupabaseClient()
      .from('messages')
      .insert({
        conversation_id: targetConversationId,
        content: message,
        role: 'user',
        provider: provider,
        model: model
      })
      .select()
      .single();

    if (userMessageError) {
      console.error('保存用户消息失败:', userMessageError);
      console.error('保存消息时使用的数据:', {
        conversation_id: targetConversationId,
        content: message,
        role: 'user',
        provider: provider,
        model: model
      });
      res.status(500).json({
        success: false,
        error: `保存用户消息失败: ${userMessageError.message}`
      });
      return;
    }

    // 获取对话历史消息
    const { data: historyMessages, error: historyError } = await getSupabaseClient()
      .from('messages')
      .select('role, content')
      .eq('conversation_id', targetConversationId)
      .order('created_at', { ascending: true })
      .limit(20);

    if (historyError) {
      res.status(500).json({
        success: false,
        error: '获取历史消息失败'
      });
      return;
    }

    const messages: ChatMessage[] = historyMessages.map((msg: any) => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content
    }));

    try {
      // 调用AI服务
      const aiResponse = await aiServiceManager.chat(
        provider as AIProvider,
        messages,
        {
          provider: provider as AIProvider,
          apiKey: providerConfig.api_key,
          baseUrl: providerConfig.base_url,
          model: providerConfig.default_model || model,
          temperature: parameters?.temperature ?? 0.7,
          maxTokens: parameters?.maxTokens ?? 2000,
          topP: parameters?.topP ?? 1.0
        }
      );

      // 保存AI回复
      const { data: aiMessage, error: aiMessageError } = await getSupabaseClient()
        .from('messages')
        .insert({
          conversation_id: targetConversationId,
          content: aiResponse.content,
          role: 'assistant',
          provider,
          model
        })
        .select()
        .single();

      if (aiMessageError) {
        res.status(500).json({
          success: false,
          error: '保存AI回复失败'
        });
        return;
      }

      // 更新对话的最后更新时间
      await getSupabaseClient()
        .from('conversations')
        .update({ 
          updated_at: new Date().toISOString(),
          provider_used: provider,
          model_used: model
        })
        .eq('id', targetConversationId);

      res.json({
        success: true,
        response: aiResponse.content,
        conversationId: targetConversationId,
        data: {
          userMessage,
          aiMessage
        }
      });
    } catch (aiError: any) {
      console.error('AI服务调用错误:', aiError);
      
      // 保存错误消息
      await getSupabaseClient()
        .from('messages')
        .insert({
          conversation_id: targetConversationId,
          role: 'assistant',
          content: `抱歉，AI服务暂时不可用：${aiError.message}`,
          provider,
          model
        });

      res.status(500).json({
        success: false,
        error: `AI服务调用失败：${aiError.message}`
      });
    }
  } catch (error) {
    console.error('聊天接口错误:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

export default router;