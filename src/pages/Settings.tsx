import { useState, useEffect } from 'react';
import { Save, TestTube, Eye, EyeOff, AlertCircle, Settings as SettingsIcon, ArrowLeft, RefreshCw, Check, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getUserId } from '../lib/user';

interface AIProvider {
  id: string;
  name: string;
  description: string;
  fields: {
    name: string;
    label: string;
    type: 'text' | 'password' | 'url' | 'boolean' | 'number';
    required: boolean;
    placeholder?: string;
    description?: string;
    min?: number;
    max?: number;
    step?: number;
  }[];
  models: (string | { id?: string; name?: string; [key: string]: unknown })[];
}

interface ProviderConfig {
  provider: string;
  config: Record<string, string>;
  model: string;
  is_default: boolean;
  models?: (string | { id?: string; name?: string; [key: string]: unknown })[];
}

export default function Settings() {
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [configs, setConfigs] = useState<ProviderConfig[]>([]);
  const [activeTab, setActiveTab] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [fetchingModels, setFetchingModels] = useState<string | null>(null);
  const [modelFetchResults, setModelFetchResults] = useState<Record<string, { success: boolean; models: (string | { id?: string; name?: string; [key: string]: unknown })[]; message: string }>>({});
  const [saveStatus, setSaveStatus] = useState<Record<string, { status: 'idle' | 'success' | 'error'; timestamp: number }>>({});
  const [customModelSaveStatus, setCustomModelSaveStatus] = useState<{ status: 'idle' | 'success' | 'error'; timestamp: number }>({ status: 'idle', timestamp: 0 });
  
  // 自定义模型管理状态
  const [customModels, setCustomModels] = useState<Array<{
    id: string;
    name: string;
    displayName?: string;
    providerId: string;
    apiEndpoint?: string;
    description?: string;
    visible: boolean;
  }>>([]);
  const [newModelName, setNewModelName] = useState('');
  const [newModelDisplayName, setNewModelDisplayName] = useState('');
  const [newModelApiEndpoint, setNewModelApiEndpoint] = useState('');
  const [newModelDescription, setNewModelDescription] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');
  const [loadingCustomModels, setLoadingCustomModels] = useState(false);
  const [savingCustomModels, setSavingCustomModels] = useState(false);

  useEffect(() => {
    loadProviders();
    loadConfigs();
    loadCustomModels();
  }, []);

  // 加载自定义模型
  const loadCustomModels = async () => {
    const userId = getUserId();
    if (!userId) return;
    
    setLoadingCustomModels(true);
    try {
      const response = await fetch(`/api/providers/custom-models?userId=${userId}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const models = result.data.map((model: { id: string; name: string; display_name?: string; provider: string; api_endpoint?: string; description?: string; is_active?: boolean }) => ({
            id: model.id,
            name: model.name,
            displayName: model.display_name || model.name,
            providerId: model.provider,
            apiEndpoint: model.api_endpoint || '',
            description: model.description || '',
            visible: model.is_active !== false
          }));
          setCustomModels(models);
        }
      } else {
        console.error('Failed to load custom models:', response.statusText);
      }
    } catch (error) {
      console.error('Error loading custom models:', error);
    } finally {
      setLoadingCustomModels(false);
    }
  };

  // 保存自定义模型
  const saveCustomModels = async () => {
    const userId = getUserId();
    if (!userId) {
      alert('请先登录');
      return;
    }

    setSavingCustomModels(true);
    try {
      // 保存所有自定义模型
      for (const model of customModels) {
        if (model.id.startsWith('custom-')) {
          // 新模型，需要创建
          const modelData = {
            userId,
            name: model.name,
            displayName: model.displayName || model.name,
            provider: model.providerId,
            apiEndpoint: model.apiEndpoint || '',
            modelId: model.name,
            description: model.description || ''
          };

          const response = await fetch('/api/providers/custom-models', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(modelData)
          });

          if (!response.ok) {
            throw new Error(`Failed to save model ${model.name}`);
          }
        } else {
          // 现有模型，需要更新
          const modelData = {
            displayName: model.displayName || model.name,
            apiEndpoint: model.apiEndpoint || '',
            description: model.description || '',
            isActive: model.visible
          };

          const response = await fetch(`/api/providers/custom-models/${model.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(modelData)
          });

          if (!response.ok) {
            throw new Error(`Failed to update model ${model.name}`);
          }
        }
      }

      // 设置保存成功状态
      setCustomModelSaveStatus({ status: 'success', timestamp: Date.now() });
      
      // 3秒后重置状态
      setTimeout(() => {
        setCustomModelSaveStatus({ status: 'idle', timestamp: Date.now() });
      }, 3000);
      
      // 重新加载自定义模型
      await loadCustomModels();
    } catch (error) {
      console.error('Error saving custom models:', error);
      
      // 设置保存失败状态
      setCustomModelSaveStatus({ status: 'error', timestamp: Date.now() });
      
      // 3秒后重置状态
      setTimeout(() => {
        setCustomModelSaveStatus({ status: 'idle', timestamp: Date.now() });
      }, 3000);
    } finally {
      setSavingCustomModels(false);
    }
  };

  const loadProviders = async () => {
    try {
      type KnownProviderId = 'openai' | 'claude' | 'gemini' | 'xai' | 'ollama' | 'qwen';
      interface ApiProviderData { id: KnownProviderId; name: string; description?: string; }
      // 从API获取支持的提供商信息
      const response = await fetch('/api/providers/supported');
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          // 将API返回的数据转换为前端需要的格式
          const apiProviders: AIProvider[] = result.data.map((provider: ApiProviderData) => {
            const fieldConfig: Record<KnownProviderId, AIProvider['fields']> = {
              openai: [
                {
                  name: 'api_key',
                  label: 'API Key',
                  type: 'password' as const,
                  required: true,
                  placeholder: 'sk-...',
                  description: '从OpenAI控制台获取您的API密钥'
                },
                {
                  name: 'base_url',
                  label: 'Base URL',
                  type: 'url' as const,
                  required: false,
                  placeholder: 'https://api.openai.com/v1',
                  description: '可选：自定义API端点'
                },
                {
                  name: 'use_responses_api',
                  label: '使用 Responses API',
                  type: 'boolean' as const,
                  required: false,
                  description: '启用OpenAI新的Responses API，支持有状态对话和链式响应'
                },

              ],
              claude: [
                {
                  name: 'api_key',
                  label: 'API Key',
                  type: 'password' as const,
                  required: true,
                  placeholder: 'sk-ant-...',
                  description: '从Anthropic控制台获取您的API密钥'
                },
                {
                  name: 'base_url',
                  label: 'Base URL',
                  type: 'url' as const,
                  required: false,
                  placeholder: 'https://api.anthropic.com',
                  description: '可选：自定义API端点'
                },

              ],
              gemini: [
                {
                  name: 'api_key',
                  label: 'API Key',
                  type: 'password' as const,
                  required: true,
                  placeholder: 'AIza...',
                  description: '从Google AI Studio获取您的API密钥'
                },
                {
                  name: 'base_url',
                  label: 'Base URL',
                  type: 'url' as const,
                  required: false,
                  placeholder: 'https://generativelanguage.googleapis.com',
                  description: '可选：自定义API端点'
                },

              ],
              xai: [
                {
                  name: 'api_key',
                  label: 'API Key',
                  type: 'password' as const,
                  required: true,
                  placeholder: 'xai-...',
                  description: '从xAI控制台获取您的API密钥'
                },
                {
                  name: 'base_url',
                  label: 'Base URL',
                  type: 'url' as const,
                  required: false,
                  placeholder: 'https://api.x.ai/v1',
                  description: '可选：自定义API端点'
                },

              ],
              ollama: [
                {
                  name: 'base_url',
                  label: 'Base URL',
                  type: 'url' as const,
                  required: true,
                  placeholder: 'http://localhost:11434/v1',
                  description: 'Ollama服务器地址'
                },

              ],
              qwen: [
                {
                  name: 'api_key',
                  label: 'API Key',
                  type: 'password' as const,
                  required: true,
                  placeholder: 'sk-...',
                  description: '从阿里云控制台获取您的API密钥'
                },
                {
                  name: 'base_url',
                  label: 'Base URL',
                  type: 'url' as const,
                  required: false,
                  placeholder: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
                  description: '可选：自定义API端点'
                }
              ]
            };
            
            const modelLists: Record<KnownProviderId, (string | { id?: string; name?: string; [key: string]: unknown; })[]> = {
                openai: ['gpt-5', 'o3', 'o3-mini', 'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
                claude: ['claude-opus-4-1-20250805', 'claude-opus-4-20250514', 'claude-sonnet-4-20250514', 'claude-3-7-sonnet-20250219', 'claude-3-5-haiku-20241022'],
                gemini: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'],
                xai: ['grok-4', 'grok-3', 'grok-2-1212', 'grok-2-vision-1212'],
                ollama: ['llama3.3', 'llama3.2', 'qwen2.5', 'mistral-nemo', 'phi4'],
                qwen: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen2.5-coder']
            };

            return {
              id: provider.id,
              name: provider.name,
              description: provider.description || `${provider.name}系列模型`,
              fields: fieldConfig[provider.id] || [],
              models: modelLists[provider.id] || []
            };
          });
          
          setProviders(apiProviders);
          if (apiProviders.length > 0) {
            setActiveTab(apiProviders[0].id);
          }
        }
      } else {
        // API调用失败时使用后备数据（2025年最新模型）
        console.warn('API调用失败，使用后备数据');
        const fallbackProviders: AIProvider[] = [
          {
            id: 'openai',
            name: 'OpenAI',
            description: '最新o系列推理模型和GPT-4系列',
            fields: [
              {
                name: 'api_key',
                label: 'API Key',
                type: 'password',
                required: true,
                placeholder: 'sk-...',
                description: '从OpenAI控制台获取您的API密钥'
              },
              {
                name: 'base_url',
                label: 'Base URL',
                type: 'url',
                required: false,
                placeholder: 'https://api.openai.com/v1',
                description: '可选：自定义API端点'
              },
              {
                name: 'use_responses_api',
                label: '使用 Responses API',
                type: 'boolean',
                required: false,
                description: '启用OpenAI新的Responses API，支持有状态对话和链式响应'
              }
            ],
            models: ['gpt-5', 'o3', 'o3-mini', 'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo']
          },
          {
            id: 'claude',
            name: 'Anthropic Claude',
            description: 'Claude 4系列和3.5系列高性能模型',
            fields: [
              {
                name: 'api_key',
                label: 'API Key',
                type: 'password',
                required: true,
                placeholder: 'sk-ant-...',
                description: '从Anthropic控制台获取您的API密钥'
              },
              {
                name: 'base_url',
                label: 'Base URL',
                type: 'url',
                required: false,
                placeholder: 'https://api.anthropic.com',
                description: '可选：自定义API端点'
              }
            ],
            models: ['claude-opus-4-1-20250805', 'claude-opus-4-20250514', 'claude-sonnet-4-20250514', 'claude-3-7-sonnet-20250219', 'claude-3-5-haiku-20241022']
          },
          {
            id: 'gemini',
            name: 'Google Gemini',
            description: 'Gemini 2.5系列多模态模型',
            fields: [
              {
                name: 'api_key',
                label: 'API Key',
                type: 'password',
                required: true,
                placeholder: 'AIza...',
                description: '从Google AI Studio获取您的API密钥'
              },
              {
                name: 'base_url',
                label: 'Base URL',
                type: 'url',
                required: false,
                placeholder: 'https://generativelanguage.googleapis.com',
                description: '可选：自定义API端点'
              }
            ],
            models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-2.0-flash-lite']
          },
          {
            id: 'xai',
            name: 'xAI Grok',
            description: 'Grok系列模型',
            fields: [
              {
                name: 'api_key',
                label: 'API Key',
                type: 'password',
                required: true,
                placeholder: 'xai-...',
                description: '从xAI控制台获取您的API密钥'
              },
              {
                name: 'base_url',
                label: 'Base URL',
                type: 'url',
                required: false,
                placeholder: 'https://api.x.ai/v1',
                description: '可选：自定义API端点'
              }
            ],
            models: ['grok-4', 'grok-3', 'grok-2-1212', 'grok-2-vision-1212']
          },
          {
            id: 'ollama',
            name: 'Ollama',
            description: '本地运行的开源模型',
            fields: [
              {
                name: 'base_url',
                label: 'Base URL',
                type: 'url',
                required: true,
                placeholder: 'http://localhost:11434/v1',
                description: 'Ollama服务器地址'
              }
            ],
            models: ['llama3.3', 'llama3.2', 'qwen2.5', 'mistral-nemo', 'phi4']
          },
          {
            id: 'qwen',
            name: '阿里云通义千问',
            description: '通义千问系列模型',
            fields: [
              {
                name: 'api_key',
                label: 'API Key',
                type: 'password',
                required: true,
                placeholder: 'sk-...',
                description: '从阿里云控制台获取您的API密钥'
              },
              {
                name: 'base_url',
                label: 'Base URL',
                type: 'url',
                required: false,
                placeholder: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
                description: '可选：自定义API端点'
              }
            ],
            models: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen2.5-coder']
          }
        ];
        setProviders(fallbackProviders);
        if (fallbackProviders.length > 0) {
          setActiveTab(fallbackProviders[0].id);
        }
      }
    } catch (error) {
      console.error('加载AI服务提供商失败:', error);
      // 错误时也使用后备数据
      const fallbackProviders: AIProvider[] = [
        {
          id: 'openai',
          name: 'OpenAI',
          description: '最新o系列推理模型和GPT-4系列',
          fields: [
            {
              name: 'api_key',
              label: 'API Key',
              type: 'password',
              required: true,
              placeholder: 'sk-...',
              description: '从OpenAI控制台获取您的API密钥'
            },
            {
              name: 'base_url',
              label: 'Base URL',
              type: 'url',
              required: false,
              placeholder: 'https://api.openai.com/v1',
              description: '可选：自定义API端点'
            },
            {
              name: 'use_responses_api',
              label: '使用 Responses API',
              type: 'boolean',
              required: false,
              description: '启用OpenAI新的Responses API，支持有状态对话和链式响应'
            }
          ],
          models: ['gpt-5', 'o3', 'o3-mini', 'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo']
        }
      ];
      setProviders(fallbackProviders);
      if (fallbackProviders.length > 0) {
        setActiveTab(fallbackProviders[0].id);
      }
    }
  };

  const loadConfigs = async () => {
    try {
      setIsLoading(true);
      const userId = getUserId();
      
      // 获取用户配置的AI服务提供商
      const response = await fetch(`/api/providers/config?userId=${encodeURIComponent(userId)}`);
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const configs: ProviderConfig[] = result.data.map((config: { provider_name: string; api_key?: string; base_url?: string; default_model?: string; available_models?: (string | { id?: string; name?: string; [key: string]: unknown })[] }) => ({
            provider: config.provider_name,
            config: {
              api_key: config.api_key || '',
              base_url: config.base_url || ''
            },
            model: config.default_model || '',
            is_default: false,
            models: config.available_models || []
          }));
          setConfigs(configs);
        } else {
          // 如果没有配置，使用空数组
          setConfigs([]);
        }
      } else {
        console.warn('加载配置失败，使用空配置');
        setConfigs([]);
      }
    } catch (error) {
      console.error('加载配置失败:', error);
      setConfigs([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getProviderConfig = (providerId: string): ProviderConfig | undefined => {
    return configs.find(config => config.provider === providerId);
  };

  const updateConfig = (providerId: string, field: string, value: string | (string | { id?: string; name?: string; [key: string]: unknown })[]) => {
    setConfigs(prev => {
      const existingIndex = prev.findIndex(config => config.provider === providerId);
      if (existingIndex >= 0) {
        const updated = [...prev];
        const newConfig = { ...updated[existingIndex] };

        if (field === 'models') {
          newConfig.models = value as (string | { id?: string; name?: string; [key: string]: unknown })[];
        } else {
          newConfig.config = {
            ...newConfig.config,
            [field]: value as string
          };
        }
        updated[existingIndex] = newConfig;
        return updated;
      } else {
        // Create new config
        const provider = providers.find(p => p.id === providerId);
        const firstModel = provider?.models[0];
        const defaultModel = typeof firstModel === 'string' ? firstModel : firstModel?.id || firstModel?.name || '';
        
        const newProviderConfig: ProviderConfig = {
          provider: providerId,
          config: {},
          model: defaultModel,
          is_default: false,
        };

        if (field === 'models') {
          newProviderConfig.models = value as (string | { id?: string; name?: string; [key: string]: unknown })[];
        } else {
          newProviderConfig.config[field] = value as string;
        }

        return [...prev, newProviderConfig];
      }
    });
  };

  const updateModel = (providerId: string, model: string) => {
    setConfigs(prev => {
      const existingIndex = prev.findIndex(config => config.provider === providerId);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          model
        };
        
        // 同步到localStorage，让主页的ModelSelector能读取到
        const selectedModelData = {
          provider: providerId,
          providerName: getProviderDisplayName(providerId),
          model: model,
          displayName: model
        };
        localStorage.setItem('selectedModel', JSON.stringify(selectedModelData));
        
        // 触发自定义事件，通知其他组件localStorage已更新
        window.dispatchEvent(new Event('localStorageChanged'));
        
        return updated;
      }
      return prev;
    });
  };
  
  // 获取厂商显示名称
  const getProviderDisplayName = (providerId: string): string => {
    const providerNames: { [key: string]: string } = {
      'openai': 'OpenAI',
      'openai-responses': 'OpenAI Responses', 
      'claude': 'Anthropic Claude',
      'gemini': 'Google Gemini',
      'xai': 'xAI Grok',
      'ollama': 'Ollama',
      'qwen': 'Qwen'
    };
    return providerNames[providerId] || providerId.charAt(0).toUpperCase() + providerId.slice(1);
  };

  const setAsDefault = (providerId: string) => {
    setConfigs(prev => prev.map(config => ({
      ...config,
      is_default: config.provider === providerId
    })));
  };

  const saveConfig = async (providerId: string) => {
    try {
      setIsSaving(true);
      const config = getProviderConfig(providerId);
      if (!config) {
        throw new Error('配置不存在');
      }

      // 验证必填字段
      if (!config.config.api_key) {
        throw new Error('API Key 是必填项');
      }

      const userId = getUserId();
      const response = await fetch('/api/providers/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          providerName: providerId,
          apiKey: config.config.api_key,
          baseUrl: config.config.base_url,
          availableModels: config.models || modelFetchResults[providerId]?.models || [],
          defaultModel: config.model
        })
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || '保存配置失败');
      }
      
      // 保存成功后，同步到localStorage，让主页的ModelSelector能读取到
      const selectedModelData = {
        provider: providerId,
        providerName: getProviderDisplayName(providerId),
        model: config.model,
        displayName: config.model
      };
      localStorage.setItem('selectedModel', JSON.stringify(selectedModelData));
      
      // 触发自定义事件，通知其他组件localStorage已更新
      window.dispatchEvent(new Event('localStorageChanged'));
      
      // 设置保存成功状态
      setSaveStatus(prev => ({
        ...prev,
        [providerId]: { status: 'success', timestamp: Date.now() }
      }));
      
      // 3秒后重置状态
      setTimeout(() => {
        setSaveStatus(prev => ({
          ...prev,
          [providerId]: { status: 'idle', timestamp: Date.now() }
        }));
      }, 3000);
      
      console.log('配置保存成功:', result.data);
    } catch (error) {
      console.error('保存自定义模型失败:', error as Error);
      
      // 设置保存失败状态
      setSaveStatus(prev => ({
        ...prev,
        [providerId]: { status: 'error', timestamp: Date.now() }
      }));
      
      // 3秒后重置状态
      setTimeout(() => {
        setSaveStatus(prev => ({
          ...prev,
          [providerId]: { status: 'idle', timestamp: Date.now() }
        }));
      }, 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const testConnection = async (providerId: string) => {
    try {
      setTestingProvider(providerId);
      const config = getProviderConfig(providerId);
      if (!config) {
        setTestResults(prev => ({
          ...prev,
          [providerId]: {
            success: false,
            message: '配置不存在'
          }
        }));
        return;
      }

      // 验证必填字段
      if (!config.config.api_key) {
        setTestResults(prev => ({
          ...prev,
          [providerId]: {
            success: false,
            message: 'API Key 是必填项'
          }
        }));
        return;
      }
      
      const response = await fetch('/api/providers/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          providerName: providerId,
          apiKey: config.config.api_key,
          baseUrl: config.config.base_url,
          model: config.model || 'default'
        })
      });

      const result = await response.json();
      
      setTestResults(prev => ({
        ...prev,
        [providerId]: {
          success: result.success,
          message: result.success ? '连接测试成功！' : (result.error || '连接测试失败，请检查配置。')
        }
      }));
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [providerId]: {
          success: false,
          message: error instanceof Error ? error.message : '测试过程中发生错误'
        }
      }));
    } finally {
      setTestingProvider(null);
    }
  };

  const togglePasswordVisibility = (providerId: string, fieldName: string) => {
    const key = `${providerId}-${fieldName}`;
    setShowPasswords(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const fetchModels = async (providerId: string) => {
    try {
      setFetchingModels(providerId);
      const config = getProviderConfig(providerId);
      if (!config || !config.config.api_key) {
        setModelFetchResults(prev => ({
          ...prev,
          [providerId]: {
            success: false,
            models: [],
            message: '请先配置API密钥'
          }
        }));
        return;
      }

      const response = await fetch('/api/providers/models', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          providerName: providerId,
          apiKey: config.config.api_key,
          baseUrl: config.config.base_url
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setModelFetchResults(prev => ({
          ...prev,
          [providerId]: {
            success: true,
            models: result.data.models,
            message: `成功获取 ${result.data.models.length} 个模型`
          }
        }));
        
        // 更新provider的models配置
        const provider = providers.find(p => p.id === providerId);
        if (provider) {
          provider.models = result.data.models;
        }
        
        // 更新配置中的可用模型列表
        updateConfig(providerId, 'available_models', result.data.models);
        
        // 自动保存配置到数据库
        if (config) {
          await saveConfig(providerId);
          // 重新加载配置以确保同步
          await loadConfigs();
        }
      } else {
        setModelFetchResults(prev => ({
          ...prev,
          [providerId]: {
            success: false,
            models: [],
            message: result.error || '获取模型列表失败'
          }
        }));
      }
    } catch (_error) {
      setModelFetchResults(prev => ({
        ...prev,
        [providerId]: {
          success: false,
          models: [],
          message: '网络错误，请检查连接'
        }
      }));
    } finally {
      setFetchingModels(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-gray-500">加载中...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 头部 */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center">
              <Link
                to="/"
                className="inline-flex items-center text-gray-500 hover:text-gray-700 transition-colors mr-4"
              >
                <ArrowLeft className="w-5 h-5 mr-1" />
                返回聊天
              </Link>
              <SettingsIcon className="w-8 h-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">AI服务配置</h1>
                <p className="mt-1 text-sm text-gray-500">
                  配置和管理您的AI服务提供商
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* 侧边栏 */}
          <div className="lg:w-64">
            <nav className="space-y-1">
              {providers.map((provider) => {
                const config = getProviderConfig(provider.id);
                const isConfigured = config && Object.keys(config.config).length > 0;
                
                return (
                  <button
                    key={provider.id}
                    onClick={() => setActiveTab(provider.id)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                      activeTab === provider.id
                        ? 'bg-blue-100 text-blue-700 border-r-2 border-blue-500'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{provider.name}</span>
                      <div className="flex items-center space-x-1">
                        {config?.is_default && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            默认
                          </span>
                        )}
                        {isConfigured && (
                          <Check className="w-4 h-4 text-green-500" />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
              
              {/* 自定义模型管理标签 */}
              <div className="pt-4 border-t border-gray-200">
                <button
                  onClick={() => setActiveTab('custom-models')}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                    activeTab === 'custom-models'
                      ? 'bg-purple-100 text-purple-700 border-r-2 border-purple-500'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center">
                    <span>自定义模型</span>
                  </div>
                </button>
              </div>
            </nav>
          </div>

          {/* 主内容区 */}
          <div className="flex-1">
            {providers.map((provider) => {
              if (activeTab !== provider.id) return null;
              
              const config = getProviderConfig(provider.id);
              const testResult = testResults[provider.id];
              
              return (
                <div key={provider.id} className="bg-white rounded-lg border border-gray-200">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-medium text-gray-900">{provider.name}</h2>
                        <p className="mt-1 text-sm text-gray-500">{provider.description}</p>
                      </div>
                      {config && (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setAsDefault(provider.id)}
                            disabled={config.is_default}
                            className={`px-3 py-1 text-xs font-medium rounded-md ${
                              config.is_default
                                ? 'bg-green-100 text-green-800 cursor-not-allowed'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {config.is_default ? '默认服务' : '设为默认'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="px-6 py-6">
                    <div className="space-y-6">
                      {/* 配置字段 */}
                      {provider.fields.map((field) => {
                        const fieldValue = config?.config[field.name] || '';
                        const showPasswordKey = `${provider.id}-${field.name}`;
                        const showPassword = showPasswords[showPasswordKey];
                        
                        return (
                          <div key={field.name}>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              {field.label}
                              {field.required && <span className="text-red-500 ml-1">*</span>}
                            </label>
                            {field.type === 'boolean' ? (
                              <div className="flex items-center">
                                <button
                                  type="button"
                                  onClick={() => updateConfig(provider.id, field.name, fieldValue === 'true' ? 'false' : 'true')}
                                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                                    fieldValue === 'true' ? 'bg-blue-600' : 'bg-gray-200'
                                  }`}
                                >
                                  <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                      fieldValue === 'true' ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                                  />
                                </button>
                                <span className="ml-3 text-sm text-gray-600">
                                  {fieldValue === 'true' ? '已启用' : '已禁用'}
                                </span>
                              </div>
                            ) : field.type === 'number' ? (
                              <div className="relative">
                                <input
                                  type="number"
                                  value={fieldValue}
                                  onChange={(e) => updateConfig(provider.id, field.name, e.target.value)}
                                  placeholder={field.placeholder}
                                  min={field.min}
                                  max={field.max}
                                  step={field.step}
                                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                />
                              </div>
                            ) : (
                              <div className="relative">
                                <input
                                  type={field.type === 'password' && !showPassword ? 'password' : 'text'}
                                  value={fieldValue}
                                  onChange={(e) => updateConfig(provider.id, field.name, e.target.value)}
                                  placeholder={field.placeholder}
                                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                />
                                {field.type === 'password' && (
                                  <button
                                    type="button"
                                    onClick={() => togglePasswordVisibility(provider.id, field.name)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                  >
                                    {showPassword ? (
                                      <EyeOff className="h-4 w-4 text-gray-400" />
                                    ) : (
                                      <Eye className="h-4 w-4 text-gray-400" />
                                    )}
                                  </button>
                                )}
                              </div>
                            )}
                            {field.description && (
                              <p className="mt-1 text-xs text-gray-500">{field.description}</p>
                            )}
                          </div>
                        );
                      })}

                      {/* 模型选择 */}
                      {provider.models.length > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            默认模型
                          </label>
                          <select
                            value={config?.model || (typeof provider.models[0] === 'string' ? provider.models[0] : provider.models[0]?.id || provider.models[0]?.name || '')}
                            onChange={(e) => updateModel(provider.id, e.target.value)}
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          >
                            {provider.models.map((model, index) => {
                              const modelId = typeof model === 'string' ? model : model?.id || model?.name || `model-${index}`;
                              const modelName = typeof model === 'string' ? model : model?.name || model?.id || `Model ${index + 1}`;
                              return (
                                <option key={`${provider.id}-${modelId}-${index}`} value={modelId}>
                                  {modelName}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      )}

                      {/* 可用模型列表管理 */}
                      {provider.models.length > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            选择要在聊天界面显示的模型
                          </label>
                          <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-md p-3">
                            {provider.models.map((model, index) => {
                              const modelId = typeof model === 'string' ? model : model?.id || model?.name || `model-${index}`;
                              const modelName = typeof model === 'string' ? model : model?.name || model?.id || `Model ${index + 1}`;
                              const isSelected = config?.models?.includes(modelId) ?? true; // 默认选中所有模型
                              
                              return (
                                <label key={`${provider.id}-${modelId}-${index}`} className="flex items-center space-x-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      const currentModels = config?.models || provider.models.map(m => typeof m === 'string' ? m : m?.id || m?.name || '');
                                      const newModels = e.target.checked 
                                        ? [...currentModels.filter(m => m !== modelId), modelId]
                                        : currentModels.filter(m => m !== modelId);
                                      updateConfig(provider.id, 'models', newModels);
                                    }}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                  />
                                  <span className="text-sm text-gray-700">{modelName}</span>
                                </label>
                              );
                            })}
                          </div>
                          <p className="mt-1 text-xs text-gray-500">
                            选中的模型将显示在聊天界面的模型选择器中
                          </p>
                        </div>
                      )}

                      {/* 测试结果 */}
                      {testResult && (
                        <div className={`p-3 rounded-md ${
                          testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                        }`}>
                          <div className="flex items-center">
                            {testResult.success ? (
                              <Check className="w-4 h-4 text-green-500 mr-2" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-red-500 mr-2" />
                            )}
                            <span className={`text-sm ${
                              testResult.success ? 'text-green-700' : 'text-red-700'
                            }`}>
                              {testResult.message}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* 模型获取结果 */}
                      {modelFetchResults[provider.id] && (
                        <div className={`p-3 rounded-md ${
                          modelFetchResults[provider.id].success ? 'bg-blue-50 border border-blue-200' : 'bg-red-50 border border-red-200'
                        }`}>
                          <div className="flex items-center mb-2">
                            {modelFetchResults[provider.id].success ? (
                              <Check className="w-4 h-4 text-blue-500 mr-2" />
                            ) : (
                              <X className="w-4 h-4 text-red-500 mr-2" />
                            )}
                            <span className={`text-sm ${
                              modelFetchResults[provider.id].success ? 'text-blue-700' : 'text-red-700'
                            }`}>
                              {modelFetchResults[provider.id].message}
                            </span>
                          </div>
                          {modelFetchResults[provider.id].success && modelFetchResults[provider.id].models.length > 0 && (
                            <div className="mt-2">
                              <div className="text-sm text-blue-700 mb-1">可用模型：</div>
                              <div className="flex flex-wrap gap-1">
                                {modelFetchResults[provider.id].models.slice(0, 10).map((model, index) => {
                                  const modelName = typeof model === 'string' ? model : model?.name || model?.id || `Model ${index + 1}`;
                                  return (
                                    <span key={`${provider.id}-result-${index}`} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                                      {modelName}
                                    </span>
                                  );
                                })}
                                {modelFetchResults[provider.id].models.length > 10 && (
                                  <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                                    +{modelFetchResults[provider.id].models.length - 10} 更多
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 操作按钮 */}
                      <div className="flex items-center space-x-3 pt-4 border-t border-gray-200">
                        <button
                          onClick={() => saveConfig(provider.id)}
                          disabled={isSaving}
                          className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-300 ${
                            saveStatus[provider.id]?.status === 'success'
                              ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                              : saveStatus[provider.id]?.status === 'error'
                              ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                              : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                          }`}
                        >
                          {saveStatus[provider.id]?.status === 'success' ? (
                            <Check className="w-4 h-4 mr-2" />
                          ) : saveStatus[provider.id]?.status === 'error' ? (
                            <X className="w-4 h-4 mr-2" />
                          ) : (
                            <Save className="w-4 h-4 mr-2" />
                          )}
                          {isSaving
                            ? '保存中...'
                            : saveStatus[provider.id]?.status === 'success'
                            ? '保存成功'
                            : saveStatus[provider.id]?.status === 'error'
                            ? '保存失败'
                            : '保存配置'
                          }
                        </button>
                        <div className="flex gap-2">
                          <button
                            onClick={() => testConnection(provider.id)}
                            disabled={testingProvider === provider.id || !config}
                            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <TestTube className="w-4 h-4 mr-2" />
                            {testingProvider === provider.id ? '测试中...' : '测试连接'}
                          </button>
                          <button
                            onClick={() => fetchModels(provider.id)}
                            disabled={fetchingModels === provider.id || !config}
                            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            {fetchingModels === provider.id ? '获取中...' : '获取模型列表'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {/* 自定义模型管理界面 */}
            {activeTab === 'custom-models' && (
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-medium text-gray-900">自定义模型管理</h2>
                      <p className="mt-1 text-sm text-gray-500">添加、删除和管理您的自定义模型</p>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-6">
                  <div className="space-y-6">
                    {/* 添加新模型 */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="text-sm font-medium text-gray-900 mb-4">添加新模型</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            选择提供商 *
                          </label>
                          <select
                            value={selectedProvider}
                            onChange={(e) => setSelectedProvider(e.target.value)}
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="">选择提供商</option>
                            {providers.map((provider) => (
                              <option key={provider.id} value={provider.id}>
                                {provider.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            模型名称 *
                          </label>
                          <input
                            type="text"
                            value={newModelName}
                            onChange={(e) => setNewModelName(e.target.value)}
                            placeholder="输入模型名称，如 gpt-4-turbo"
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            显示名称
                          </label>
                          <input
                            type="text"
                            value={newModelDisplayName}
                            onChange={(e) => setNewModelDisplayName(e.target.value)}
                            placeholder="用户友好的显示名称"
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            API 端点
                          </label>
                          <input
                            type="text"
                            value={newModelApiEndpoint}
                            onChange={(e) => setNewModelApiEndpoint(e.target.value)}
                            placeholder="自定义 API 端点（可选）"
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            描述
                          </label>
                          <textarea
                            value={newModelDescription}
                            onChange={(e) => setNewModelDescription(e.target.value)}
                            placeholder="模型描述（可选）"
                            rows={2}
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div className="md:col-span-2 flex justify-end">
                          <button
                            onClick={() => {
                              if (newModelName.trim() && selectedProvider) {
                                const newModel = {
                                  id: `custom-${crypto.randomUUID()}`,
                                  name: newModelName.trim(),
                                  displayName: newModelDisplayName.trim() || newModelName.trim(),
                                  providerId: selectedProvider,
                                  apiEndpoint: newModelApiEndpoint.trim(),
                                  description: newModelDescription.trim(),
                                  visible: true
                                };
                                setCustomModels(prev => [...prev, newModel]);
                                setNewModelName('');
                                setNewModelDisplayName('');
                                setNewModelApiEndpoint('');
                                setNewModelDescription('');
                                setSelectedProvider('');
                              }
                            }}
                            disabled={!newModelName.trim() || !selectedProvider}
                            className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            添加模型
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 自定义模型列表 */}
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 mb-4">已添加的自定义模型</h3>
                      {loadingCustomModels ? (
                        <div className="text-center py-8 text-gray-500">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                          <p>加载自定义模型中...</p>
                        </div>
                      ) : customModels.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <p>暂无自定义模型</p>
                          <p className="text-sm mt-1">使用上方表单添加您的第一个自定义模型</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {customModels.map((model) => {
                            const provider = providers.find(p => p.id === model.providerId);
                            return (
                              <div key={model.id} className="p-4 bg-white border border-gray-200 rounded-lg">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-2 mb-2">
                                      <div className="font-medium text-gray-900">{model.displayName || model.name}</div>
                                      {model.displayName && model.displayName !== model.name && (
                                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">{model.name}</span>
                                      )}
                                    </div>
                                    <div className="text-sm text-gray-600 mb-1">
                                      提供商: {provider?.name || '未知提供商'}
                                    </div>
                                    {model.apiEndpoint && (
                                      <div className="text-sm text-gray-600 mb-1">
                                        API 端点: {model.apiEndpoint}
                                      </div>
                                    )}
                                    {model.description && (
                                      <div className="text-sm text-gray-600">
                                        描述: {model.description}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center space-x-2 ml-4">
                                    <label className="flex items-center">
                                      <input
                                        type="checkbox"
                                        checked={model.visible}
                                        onChange={(e) => {
                                          setCustomModels(prev => prev.map(m => 
                                            m.id === model.id ? { ...m, visible: e.target.checked } : m
                                          ));
                                        }}
                                        className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                                      />
                                      <span className="ml-2 text-sm text-gray-600">在主页显示</span>
                                    </label>
                                    <button
                                      onClick={async () => {
                                        if (confirm('确定要删除这个自定义模型吗？')) {
                                          // 如果是已保存的模型，需要从数据库删除
                                          if (!model.id.startsWith('custom-')) {
                                            try {
                                              const response = await fetch(`/api/providers/custom-models/${model.id}`, {
                                                method: 'DELETE'
                                              });
                                              if (!response.ok) {
                                                throw new Error('Failed to delete model from database');
                                              }
                                            } catch (error) {
                                              console.error('Error deleting model:', error);
                                              alert('删除模型失败：' + (error instanceof Error ? error.message : '未知错误'));
                                              return;
                                            }
                                          }
                                          setCustomModels(prev => prev.filter(m => m.id !== model.id));
                                        }
                                      }}
                                      className="text-red-600 hover:text-red-800 p-1"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* 保存按钮 */}
                    <div className="flex justify-end pt-4 border-t border-gray-200">
                      <button
                        onClick={saveCustomModels}
                        disabled={savingCustomModels || customModels.length === 0}
                        className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-300 ${
                          customModelSaveStatus.status === 'success'
                            ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                            : customModelSaveStatus.status === 'error'
                            ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                            : 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500'
                        }`}
                      >
                        {customModelSaveStatus.status === 'success' ? (
                          <Check className="w-4 h-4 mr-2" />
                        ) : customModelSaveStatus.status === 'error' ? (
                          <X className="w-4 h-4 mr-2" />
                        ) : (
                          <Save className="w-4 h-4 mr-2" />
                        )}
                        {savingCustomModels
                          ? '保存中...'
                          : customModelSaveStatus.status === 'success'
                          ? '保存成功'
                          : customModelSaveStatus.status === 'error'
                          ? '保存失败'
                          : '保存自定义模型'
                        }
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}