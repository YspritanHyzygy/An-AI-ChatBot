/**
 * AI服务提供商配置相关的API路由
 * 处理用户的AI服务配置、测试连接等功能
 */
import { Router, type Request, type Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { aiServiceManager } from '../services/ai-service-manager.js';
import { AIProvider } from '../services/types.js';

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

// 支持的AI服务提供商列表（2025年1月最新真实模型）
const SUPPORTED_PROVIDERS = [
  {
    name: 'openai',
    displayName: 'OpenAI',
    defaultModels: ['gpt-5', 'o3', 'o3-mini', 'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    defaultBaseUrl: 'https://api.openai.com/v1'
  },
  {
    name: 'claude',
    displayName: 'Anthropic Claude',
    defaultModels: ['claude-opus-4-1-20250805', 'claude-opus-4-20250514', 'claude-sonnet-4-20250514', 'claude-3-7-sonnet-20250219', 'claude-3-5-haiku-20241022'],
    defaultBaseUrl: 'https://api.anthropic.com'
  },
  {
    name: 'gemini',
    displayName: 'Google Gemini',
    defaultModels: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'],
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1'
  },
  {
    name: 'xai',
    displayName: 'xAI Grok',
    defaultModels: ['grok-4', 'grok-3', 'grok-2-1212', 'grok-2-vision-1212'],
    defaultBaseUrl: 'https://api.x.ai/v1'
  },
  {
    name: 'ollama',
    displayName: 'Ollama',
    defaultModels: ['llama3.3', 'llama3.2', 'qwen2.5', 'mistral-nemo', 'phi4'],
    defaultBaseUrl: 'http://localhost:11434/v1'
  },
  {
    name: 'qwen',
    displayName: '阿里云通义千问',
    defaultModels: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen2.5-coder'],
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  }
];

/**
 * 获取用户配置的AI服务提供商及其模型列表
 * GET /api/providers
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.query.userId as string;
    
    if (!userId) {
      // 如果没有用户ID，返回默认提供商列表
      res.json({
        success: true,
        data: SUPPORTED_PROVIDERS.map(provider => ({
          id: provider.name,
          name: provider.displayName,
          models: provider.defaultModels,
          config: {
            model: provider.defaultModels && provider.defaultModels[0] || ''
          }
        }))
      });
      return;
    }

    // 获取用户配置的提供商
    const { data: userConfigs, error } = await getSupabaseClient()
      .from('ai_providers')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      console.error('获取用户配置失败:', error);
      // 如果获取失败，返回默认提供商列表
      res.json({
        success: true,
        data: SUPPORTED_PROVIDERS.map(provider => ({
          id: provider.name,
          name: provider.displayName,
          models: provider.defaultModels,
          config: {
            model: provider.defaultModels && provider.defaultModels[0] || ''
          }
        }))
      });
      return;
    }

    // 如果用户没有配置任何提供商，返回默认列表
    if (!userConfigs || userConfigs.length === 0) {
      res.json({
        success: true,
        data: SUPPORTED_PROVIDERS.map(provider => ({
          id: provider.name,
          name: provider.displayName,
          models: provider.defaultModels,
          config: {
            model: provider.defaultModels && provider.defaultModels[0] || ''
          }
        }))
      });
      return;
    }

    // 返回用户配置的提供商和模型
    const configuredProviders = userConfigs.map((config: any) => {
      const defaultProvider = SUPPORTED_PROVIDERS.find(p => p.name === config.provider_name);
      return {
        provider_name: config.provider_name,
        id: config.provider_name,
        name: defaultProvider?.displayName || config.provider_name,
        models: config.available_models && config.available_models.length > 0 
          ? config.available_models 
          : defaultProvider?.defaultModels || [],
        config: {
          model: config.default_model || (defaultProvider?.defaultModels && defaultProvider.defaultModels[0]) || ''
        }
      };
    });

    res.json({
      success: true,
      data: configuredProviders
    });
  } catch (error) {
    console.error('获取提供商列表错误:', error);
    // 发生错误时返回默认提供商列表
    res.json({
      success: true,
      data: SUPPORTED_PROVIDERS.map(provider => ({
        id: provider.name,
        name: provider.displayName,
        models: provider.defaultModels,
        config: {
          model: provider.defaultModels && provider.defaultModels[0] || ''
        }
      }))
    });
  }
});

/**
 * 获取支持的AI服务提供商列表
 * GET /api/providers/supported
 */
router.get('/supported', async (_req: Request, res: Response): Promise<void> => {
  try {
    const supportedProviders = aiServiceManager.getSupportedProviders();
    const providers = supportedProviders.map(provider => {
      const defaultConfig = aiServiceManager.getDefaultConfig(provider);
      
      const providerInfo = {
        openai: {
          name: 'OpenAI',
          description: 'GPT系列模型',
          requiresApiKey: true
        },
        'openai-responses': {
          name: 'OpenAI Responses',
          description: 'OpenAI Responses API（有状态对话）',
          requiresApiKey: true
        },
        claude: {
          name: 'Anthropic Claude',
          description: 'Claude系列模型',
          requiresApiKey: true
        },
        gemini: {
          name: 'Google Gemini',
          description: 'Gemini系列模型',
          requiresApiKey: true
        },
        xai: {
          name: 'xAI Grok',
          description: 'Grok系列模型',
          requiresApiKey: true
        },
        ollama: {
          name: 'Ollama',
          description: '本地运行的开源模型',
          requiresApiKey: false
        },
        qwen: {
          name: '阿里云通义千问',
          description: '通义千问系列模型',
          requiresApiKey: true
        }
      }[provider];

      return {
        id: provider,
        ...providerInfo,
        defaultConfig
      };
    });

    res.json({
      success: true,
      data: providers
    });
  } catch (error) {
    console.error('获取支持的提供商列表错误:', error);
    res.status(500).json({ 
      success: false,
      error: '获取支持的提供商列表失败' 
    });
  }
});

/**
 * 获取用户的AI服务配置
 * GET /api/providers/config
 */
router.get('/config', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.query.userId as string;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        error: '缺少用户ID'
      });
      return;
    }

    const { data, error } = await getSupabaseClient()
      .from('ai_providers')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      res.status(500).json({
        success: false,
        error: '获取配置失败'
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
 * 保存或更新AI服务配置
 * POST /api/providers/config
 */
router.post('/config', async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      userId, 
      providerName, 
      apiKey, 
      baseUrl, 
      availableModels = [], 
      defaultModel 
    } = req.body;
    
    if (!userId || !providerName) {
      res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
      return;
    }

    // 检查是否是支持的提供商
    const supportedProvider = SUPPORTED_PROVIDERS.find(p => p.name === providerName);
    if (!supportedProvider) {
      res.status(400).json({
        success: false,
        error: '不支持的AI服务提供商'
      });
      return;
    }

    // 使用upsert操作（如果存在则更新，不存在则插入）
    const { data, error } = await getSupabaseClient()
      .from('ai_providers')
      .upsert({
        user_id: userId,
        provider_name: providerName,
        api_key: apiKey,
        base_url: baseUrl || supportedProvider.defaultBaseUrl,
        available_models: availableModels.length > 0 ? availableModels : supportedProvider.defaultModels,
        default_model: defaultModel || supportedProvider.defaultModels[0],
        is_active: true,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,provider_name'
      })
      .select()
      .single();

    if (error) {
      res.status(500).json({
        success: false,
        error: '保存配置失败'
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
 * 测试AI服务连接
 * POST /api/providers/test
 */
router.post('/test', async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerName, apiKey, baseUrl, model } = req.body;
    
    if (!providerName || !apiKey) {
      res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
      return;
    }

    // 验证提供商是否支持
    const supportedProviders = aiServiceManager.getSupportedProviders();
    if (!supportedProviders.includes(providerName as AIProvider)) {
      res.status(400).json({ 
        success: false, 
        error: `不支持的AI服务提供商: ${providerName}` 
      });
      return;
    }

    // 验证配置（连接测试时不需要验证model）
    const errors: string[] = [];
    
    // 特定提供商验证
    switch (providerName) {
      case 'openai':
      case 'claude':
      case 'gemini':
      case 'xai':
      case 'qwen':
        if (!apiKey) {
          errors.push('API Key不能为空');
        }
        break;
      case 'ollama':
        // Ollama通常不需要API Key，但需要确保服务运行
        if (!baseUrl) {
          errors.push('Base URL不能为空');
        }
        break;
    }

    if (errors.length > 0) {
      res.status(400).json({ 
        success: false, 
        error: errors.join(', ') 
      });
      return;
    }

    // 测试连接
    console.log(`[DEBUG] Testing connection for ${providerName} with config:`, {
      provider: providerName,
      apiKey: apiKey ? `${apiKey.substring(0, 10)}...` : 'undefined',
      baseUrl: baseUrl || 'default'
    });
    
    const isConnected = await aiServiceManager.testConnection(providerName as AIProvider, {
      provider: providerName as AIProvider,
      model: model || 'default', // 提供默认值，虽然testConnection不会使用它
      apiKey,
      baseUrl
    });
    
    console.log(`[DEBUG] Connection test result for ${providerName}:`, isConnected);

    if (isConnected) {
      // 获取可用模型列表
      try {
        const models = await aiServiceManager.getAvailableModels(providerName as AIProvider, {
          provider: providerName as AIProvider,
          model: model || 'default', // 提供默认值
          apiKey,
          baseUrl
        });
        
        res.json({
          success: true,
          data: {
            provider: providerName,
            model: model || 'default',
            message: '连接测试成功',
            models
          }
        });
      } catch (modelError) {
        // 连接成功但获取模型列表失败
        res.json({
          success: true,
          data: {
            provider: providerName,
            model: model || 'default',
            message: '连接测试成功（无法获取模型列表）',
            models: []
          }
        });
      }
    } else {
      res.status(400).json({ 
        success: false, 
        error: `${providerName}连接测试失败，请检查配置` 
      });
    }
  } catch (error: any) {
    console.error('测试连接错误:', error);
    res.status(500).json({
      success: false,
      error: `连接测试失败: ${error.message}`
    });
  }
});

/**
 * 获取指定提供商的模型列表
 * POST /api/providers/models
 */
router.post('/models', async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerName, apiKey, baseUrl } = req.body;
    
    if (!providerName) {
      res.status(400).json({
        success: false,
        error: '缺少提供商名称'
      });
      return;
    }

    // 验证API Key（除了Ollama外都需要）
    if (providerName !== 'ollama' && !apiKey) {
      res.status(400).json({
        success: false,
        error: 'API Key是必填项'
      });
      return;
    }

    // 验证提供商是否支持
    const supportedProviders = aiServiceManager.getSupportedProviders();
    if (!supportedProviders.includes(providerName as AIProvider)) {
      res.status(400).json({ 
        success: false, 
        error: `不支持的AI服务提供商: ${providerName}` 
      });
      return;
    }

    // 获取默认配置
    const defaultConfig = aiServiceManager.getDefaultConfig(providerName as AIProvider);
    
    // 构建配置对象
    const config = {
      provider: providerName as AIProvider,
      model: defaultConfig.model || 'default',
      apiKey: apiKey || '',
      baseUrl: baseUrl || defaultConfig.baseUrl
    };

    try {
      // 获取可用模型列表
      const models = await aiServiceManager.getAvailableModels(providerName as AIProvider, config);
      
      res.json({
        success: true,
        data: {
          provider: providerName,
          models
        }
      });
    } catch (error: any) {
      console.error(`获取${providerName}模型列表错误:`, error);
      res.status(500).json({
        success: false,
        error: `获取模型列表失败: ${error.message}`
      });
    }
  } catch (error: any) {
    console.error('获取模型列表错误:', error);
    res.status(500).json({
      success: false,
      error: `服务器内部错误: ${error.message}`
    });
  }
});

/**
 * 删除AI服务配置
 * DELETE /api/providers/config/:providerId
 */
router.delete('/config/:providerId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerId } = req.params;
    
    const { error } = await getSupabaseClient()
      .from('ai_providers')
      .delete()
      .eq('id', providerId);

    if (error) {
      res.status(500).json({
        success: false,
        error: '删除配置失败'
      });
      return;
    }

    res.json({
      success: true,
      message: '配置删除成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * 设置默认AI服务提供商
 * PUT /api/providers/default
 */
router.put('/default', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, providerName } = req.body;
    
    if (!userId || !providerName) {
      res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
      return;
    }

    // 更新用户的默认提供商
    const { error } = await getSupabaseClient()
      .from('users')
      .update({ default_provider: providerName })
      .eq('id', userId);

    if (error) {
      res.status(500).json({
        success: false,
        error: '设置默认提供商失败'
      });
      return;
    }

    res.json({
      success: true,
      message: '默认提供商设置成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * 获取用户的自定义模型列表
 * GET /api/providers/custom-models
 */
router.get('/custom-models', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        error: '缺少用户ID'
      });
      return;
    }

    const { data, error } = await getSupabaseClient()
      .from('custom_models')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('获取自定义模型错误:', error);
      res.status(500).json({
        success: false,
        error: '获取自定义模型失败'
      });
      return;
    }

    res.json({
      success: true,
      data: data || []
    });
  } catch (error: any) {
    console.error('获取自定义模型错误:', error);
    res.status(500).json({
      success: false,
      error: `服务器内部错误: ${error.message}`
    });
  }
});

/**
 * 创建自定义模型
 * POST /api/providers/custom-models
 */
router.post('/custom-models', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, name, displayName, provider, apiEndpoint, modelId, description } = req.body;
    
    if (!userId || !name || !displayName || !provider || !modelId) {
      res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
      return;
    }

    // 检查模型名称是否已存在
    const { data: existing } = await getSupabaseClient()
      .from('custom_models')
      .select('id')
      .eq('user_id', userId)
      .eq('name', name)
      .single();

    if (existing) {
      res.status(400).json({
        success: false,
        error: '模型名称已存在'
      });
      return;
    }

    const { data, error } = await getSupabaseClient()
      .from('custom_models')
      .insert({
        user_id: userId,
        name,
        display_name: displayName,
        provider,
        api_endpoint: apiEndpoint,
        model_id: modelId,
        description
      })
      .select()
      .single();

    if (error) {
      console.error('创建自定义模型错误:', error);
      res.status(500).json({
        success: false,
        error: '创建自定义模型失败'
      });
      return;
    }

    res.json({
      success: true,
      data,
      message: '自定义模型创建成功'
    });
  } catch (error: any) {
    console.error('创建自定义模型错误:', error);
    res.status(500).json({
      success: false,
      error: `服务器内部错误: ${error.message}`
    });
  }
});

/**
 * 更新自定义模型
 * PUT /api/providers/custom-models/:id
 */
router.put('/custom-models/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, displayName, provider, apiEndpoint, modelId, description, isActive } = req.body;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: '缺少模型ID'
      });
      return;
    }

    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (name !== undefined) updateData.name = name;
    if (displayName !== undefined) updateData.display_name = displayName;
    if (provider !== undefined) updateData.provider = provider;
    if (apiEndpoint !== undefined) updateData.api_endpoint = apiEndpoint;
    if (modelId !== undefined) updateData.model_id = modelId;
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.is_active = isActive;

    const { data, error } = await getSupabaseClient()
      .from('custom_models')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('更新自定义模型错误:', error);
      res.status(500).json({
        success: false,
        error: '更新自定义模型失败'
      });
      return;
    }

    res.json({
      success: true,
      data,
      message: '自定义模型更新成功'
    });
  } catch (error: any) {
    console.error('更新自定义模型错误:', error);
    res.status(500).json({
      success: false,
      error: `服务器内部错误: ${error.message}`
    });
  }
});

/**
 * 删除自定义模型
 * DELETE /api/providers/custom-models/:id
 */
router.delete('/custom-models/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: '缺少模型ID'
      });
      return;
    }

    const { error } = await getSupabaseClient()
      .from('custom_models')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('删除自定义模型错误:', error);
      res.status(500).json({
        success: false,
        error: '删除自定义模型失败'
      });
      return;
    }

    res.json({
      success: true,
      message: '自定义模型删除成功'
    });
  } catch (error: any) {
    console.error('删除自定义模型错误:', error);
    res.status(500).json({
      success: false,
      error: `服务器内部错误: ${error.message}`
    });
  }
});

export default router;