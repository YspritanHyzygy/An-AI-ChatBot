/**
 * AI服务提供商配置相关的API路由
 * 处理用户的AI服务配置、测试连接等功能
 */
import { Router, type Request, type Response } from 'express';
import { jsonDatabase } from '../services/json-database.js';
import { aiServiceManager } from '../services/ai-service-manager.js';
import { AIProvider } from '../services/types.js';

const router = Router();

// 初始化JSON数据库
let dbInitialized = false;

async function ensureDatabaseInitialized() {
  if (!dbInitialized) {
    await jsonDatabase.init();
    dbInitialized = true;
    console.log('JSON Database initialized successfully');
  }
  return jsonDatabase;
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
    const db = await ensureDatabaseInitialized();
    const { data: userConfigs, error } = await db.getAIProvidersByUserId(userId);

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
      
      // 优先使用用户保存的模型列表，其次使用默认列表
      let modelsList = [];
      if (config.available_models && Array.isArray(config.available_models) && config.available_models.length > 0) {
        modelsList = config.available_models;
      } else if (defaultProvider?.defaultModels) {
        modelsList = defaultProvider.defaultModels;
      }
      
      return {
        provider_name: config.provider_name,
        id: config.provider_name,
        name: defaultProvider?.displayName || config.provider_name,
        models: modelsList,
        config: {
          model: config.default_model || (modelsList.length > 0 ? modelsList[0] : '')
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

    const db = await ensureDatabaseInitialized();
    const { data, error } = await db.getAIProvidersByUserId(userId);

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
      defaultModel,
      extraConfig = {}
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

    // 使用JSON数据库保存配置
    const db = await ensureDatabaseInitialized();
    
    const configData = {
      user_id: userId,
      provider_name: providerName,
      api_key: apiKey,
      base_url: baseUrl || supportedProvider.defaultBaseUrl,
      available_models: availableModels.length > 0 ? availableModels : supportedProvider.defaultModels,
      default_model: defaultModel || supportedProvider.defaultModels[0],
      is_active: true,
      // 合并额外的配置字段（如use_responses_api等）
      ...extraConfig
    };
    
    // 使用新的更新方法
    const result = await db.updateAIProviderConfig(userId, providerName, configData);
    
    const { data, error } = result;

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
 * 重置所有AI服务提供商的模型配置到默认状态
 * POST /api/providers/reset
 */
router.post('/reset', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        error: '缺少用户ID'
      });
      return;
    }

    const db = await ensureDatabaseInitialized();
    
    // 获取用户的所有AI服务提供商配置
    const { data: userConfigs, error: getError } = await db.getAIProvidersByUserId(userId);
    
    if (getError) {
      console.error('获取用户配置失败:', getError);
      res.status(500).json({
        success: false,
        error: '获取用户配置失败'
      });
      return;
    }

    let resetCount = 0;
    
    // 如果用户有配置，则清空所有提供商的available_models字段
    if (userConfigs && userConfigs.length > 0) {
      for (const config of userConfigs) {
        // 获取默认模型列表
        const defaultProvider = SUPPORTED_PROVIDERS.find(p => p.name === config.provider_name);
        const defaultModel = defaultProvider?.defaultModels?.[0] || config.default_model;
        
        const { error: updateError } = await db.updateAIProviderConfig(userId, config.provider_name, {
          user_id: userId,
          provider_name: config.provider_name,
          api_key: config.api_key,
          base_url: config.base_url,
          available_models: [], // 清空获取的模型列表
          default_model: defaultModel,
          is_active: config.is_active
        });
        
        if (updateError) {
          console.error(`重置${config.provider_name}配置失败:`, updateError);
        } else {
          resetCount++;
        }
      }
    }
    
    res.json({
      success: true,
      message: '所有模型配置已重置到默认状态',
      data: {
        resetCount
      }
    });
    
  } catch (error) {
    console.error('重置模型配置错误:', error);
    res.status(500).json({
      success: false,
      error: '重置模型配置失败'
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
    
    if (!providerName) {
      res.status(400).json({
        success: false,
        error: '缺少提供商名称参数'
      });
      return;
    }
    
    // 验证API Key（Ollama除外）
    if (providerName !== 'ollama' && !apiKey) {
      res.status(400).json({
        success: false,
        error: 'API Key不能为空'
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
      
      // 根据错误类型返回不同的错误信息
      let errorMessage = '获取模型列表失败';
      
      if (error.message) {
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          errorMessage = 'API Key无效，请检查密钥是否正确';
        } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
          errorMessage = 'API Key权限不足或已过期';
        } else if (error.message.includes('429') || error.message.includes('rate limit')) {
          errorMessage = 'API调用频率超限，请稍后重试';
        } else if (error.message.includes('timeout') || error.message.includes('ECONNREFUSED')) {
          errorMessage = '连接超时，请检查网络或服务地址';
        } else {
          errorMessage = `获取模型列表失败: ${error.message}`;
        }
      }
      
      // 返回错误响应而不是抛出异常
      res.json({
        success: false,
        error: errorMessage,
        data: {
          provider: providerName,
          models: []
        }
      });
    }
  } catch (error: any) {
    console.error('获取模型列表外层错误:', error);
    
    // 检查是否是AIServiceError
    if (error.name === 'AIServiceError') {
      // 直接使用AIServiceError的错误信息
      res.json({
        success: false,
        error: error.message || '获取模型列表失败',
        data: {
          provider: req.body?.providerName || 'unknown',
          models: []
        }
      });
    } else {
      // 其他类型的错误
      res.status(500).json({
        success: false,
        error: `服务器内部错误: ${error.message}`,
        data: {
          provider: req.body?.providerName || 'unknown',
          models: []
        }
      });
    }
  }
});

/**
 * 删除AI服务配置
 * DELETE /api/providers/config/:providerId
 */
router.delete('/config/:providerId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerId } = req.params;
    
    const db = await ensureDatabaseInitialized();
    const { error } = await db.from('ai_providers').delete().eq('id', providerId);

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
    const db = await ensureDatabaseInitialized();
    const { error } = await db.from('users').update({ default_provider: providerName }).eq('id', userId);

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

    const db = await ensureDatabaseInitialized();
    // 简化查询，直接获取所有custom_models数据
    const allCustomModels = db.from('custom_models').select().data;
    const userCustomModels = allCustomModels.filter((model: any) => 
      model.user_id === userId && model.is_active === true
    ).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    const data = userCustomModels;
    const error = null;

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
    const db = await ensureDatabaseInitialized();
    const allCustomModels = db.from('custom_models').select().data;
    const existing = allCustomModels.find((model: any) => 
      model.user_id === userId && model.name === name
    );

    if (existing) {
      res.status(400).json({
        success: false,
        error: '模型名称已存在'
      });
      return;
    }

    const { data, error } = await db.from('custom_models').insert({
      user_id: userId,
      name,
      display_name: displayName,
      provider,
      api_endpoint: apiEndpoint,
      model_id: modelId,
      description
    });

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

    const db = await ensureDatabaseInitialized();
    const { data, error } = await db.from('custom_models').update(updateData).eq('id', id);

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

    const db = await ensureDatabaseInitialized();
    const { error } = await db.from('custom_models').delete().eq('id', id);

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

/**
 * 重置所有动态获取的模型到默认状态
 * POST /api/providers/reset-models
 */
router.post('/reset-models', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        error: '缺少用户ID'
      });
      return;
    }

    const db = await ensureDatabaseInitialized();
    
    // 获取该用户所有的AI提供商配置
    const { data: userConfigs, error: fetchError } = await db.getAIProvidersByUserId(userId);
    
    if (fetchError) {
      console.error('获取用户配置失败:', fetchError);
      res.status(500).json({
        success: false,
        error: '获取用户配置失败'
      });
      return;
    }
    
    if (!userConfigs || userConfigs.length === 0) {
      res.json({
        success: true,
        message: '没有找到需要重置的配置'
      });
      return;
    }
    
    // 清除每个提供商的available_models字段
    const resetPromises = userConfigs.map((config: any) => {
      return db.from('ai_providers')
        .update({ 
          available_models: [],
          updated_at: new Date().toISOString()
        })
        .eq('id', config.id);
    });
    
    // 等待所有重置操作完成
    const results = await Promise.allSettled(resetPromises);
    
    // 检查是否有失败的操作
    const failures = results.filter(result => result.status === 'rejected');
    if (failures.length > 0) {
      console.error('部分重置操作失败:', failures);
      res.status(500).json({
        success: false,
        error: `重置失败，${failures.length}个操作出错`
      });
      return;
    }
    
    console.log(`成功重置用户${userId}的所有模型配置`);
    res.json({
      success: true,
      message: `成功重置${userConfigs.length}个提供商的模型列表`
    });
    
  } catch (error: any) {
    console.error('重置模型错误:', error);
    res.status(500).json({
      success: false,
      error: `服务器内部错误: ${error.message}`
    });
  }
});

export default router;