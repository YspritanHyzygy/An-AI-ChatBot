import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { getUserId } from '../lib/user';

interface ModelOption {
  provider: string;
  providerName: string;
  model: string;
  displayName: string;
}

interface ModelSelectorProps {
  selectedModel: ModelOption | null;
  onModelChange: (model: ModelOption) => void;
  className?: string;
}

interface GroupedModels {
  [providerName: string]: ModelOption[];
}

// 获取厂商显示名称
const getProviderDisplayName = (providerId: string): string => {
  const providerNames: { [key: string]: string } = {
    'openai': 'OpenAI',
    'openai-responses': 'OpenAI Responses',
    'claude': 'Anthropic Claude',
    'gemini': 'Google Gemini',
    'xai': 'xAI Grok',
    'ollama': 'Ollama'
  };
  return providerNames[providerId] || providerId.charAt(0).toUpperCase() + providerId.slice(1);
};

export default function ModelSelector({ selectedModel, onModelChange, className = '' }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([]);
  const [groupedModels, setGroupedModels] = useState<GroupedModels>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const selectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchModels = async () => {
      setLoading(true);
      setError(null);
      try {
        const userId = getUserId();
        const response = await fetch(`/api/providers?userId=${encodeURIComponent(userId)}`);
        if (!response.ok) {
          throw new Error('无法获取模型列表，请检查后端服务是否正常运行。');
        }
        const result = await response.json();

        if (result.success && Array.isArray(result.data)) {
          const models: ModelOption[] = [];
          const grouped: GroupedModels = {};
          let defaultModelFromSettings: ModelOption | null = null;
          
          // 使用Set来跟踪已添加的模型，避免重复
          const addedModels = new Set<string>();

          result.data.forEach((provider: any) => {
            if (provider && Array.isArray(provider.models)) {
              const providerName = provider.name || provider.provider_name || provider.id;
              const providerDisplayName = getProviderDisplayName(providerName);
              
              // 获取该提供商的配置，包括默认模型
              const providerConfig = provider.config || {};
              const defaultModel = providerConfig.model;
              
              provider.models.forEach((model: string | { id?: string; name?: string; [key: string]: unknown }) => {
                // 统一处理模型数据，支持字符串和对象两种格式
                let modelId: string;
                let modelDisplayName: string;
                
                if (typeof model === 'string') {
                  modelId = model;
                  modelDisplayName = model;
                } else if (model && typeof model === 'object') {
                  modelId = model.id || model.name || String(model);
                  modelDisplayName = model.name || model.id || String(model);
                } else {
                  console.warn('无效的模型数据格式:', model);
                  return;
                }
                
                // 生成唯一标识符来避免重复
                const uniqueKey = `${provider.id}-${modelId}`;
                
                // 如果已经添加过这个模型，跳过
                if (addedModels.has(uniqueKey)) {
                  return;
                }
                
                const modelOption: ModelOption = {
                  provider: provider.id,
                  providerName: providerDisplayName,
                  model: modelId,
                  displayName: modelDisplayName,
                };
                
                models.push(modelOption);
                addedModels.add(uniqueKey);
                
                // 按厂商分组
                if (!grouped[providerDisplayName]) {
                  grouped[providerDisplayName] = [];
                }
                grouped[providerDisplayName].push(modelOption);
                
                // 如果这是设置页面配置的默认模型，记录下来
                if (modelId === defaultModel && !defaultModelFromSettings) {
                  defaultModelFromSettings = modelOption;
                }
              });
            }
          });
          
          setAvailableModels(models);
          setGroupedModels(grouped);

          // 优先使用localStorage中保存的模型，其次是设置页面的默认模型，最后是第一个可用模型
          let modelToSelect: ModelOption | null = null;
          
          // 1. 首先尝试从localStorage读取
          try {
            const savedModel = localStorage.getItem('selectedModel');
            if (savedModel) {
              const parsedModel = JSON.parse(savedModel);
              const matchedModel = models.find(m => 
                m.model === parsedModel.model && m.provider === parsedModel.provider
              );
              if (matchedModel) {
                modelToSelect = matchedModel;
              }
            }
          } catch (e) {
            console.warn('Failed to parse saved model from localStorage:', e);
          }
          
          // 2. 如果localStorage中没有有效模型，使用设置页面的默认模型
          if (!modelToSelect && defaultModelFromSettings) {
            modelToSelect = defaultModelFromSettings;
          }
          
          // 3. 如果都没有，使用第一个可用模型
          if (!modelToSelect && models.length > 0) {
            modelToSelect = models[0];
          }
          
          // 4. 设置选中的模型（只在初始化时）
          if (modelToSelect && availableModels.length === 0) {
            // 只在第一次加载时设置默认模型
            if (!selectedModel || 
                selectedModel.model !== modelToSelect.model || 
                selectedModel.provider !== modelToSelect.provider) {
              // 使用setTimeout防止在渲染过程中触发状态更新
              setTimeout(() => onModelChange(modelToSelect), 0);
            }
          }
        } else {
          throw new Error('获取到的模型列表格式不正确。');
        }
      } catch (e: any) {
        setError(e.message || '加载模型失败。');
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchModels();
    
    // 监听模型列表更新事件
    const handleModelsUpdated = () => {
      console.log('Models updated, refetching...');
      fetchModels();
    };
    
    window.addEventListener('modelsUpdated', handleModelsUpdated);
    
    return () => {
      window.removeEventListener('modelsUpdated', handleModelsUpdated);
    };
  }, []);  // 移除不必要的依赖项

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 监听localStorage变化，当设置页面保存配置时同步更新
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const savedModel = localStorage.getItem('selectedModel');
        if (savedModel && availableModels.length > 0) {
          const parsedModel = JSON.parse(savedModel);
          const matchedModel = availableModels.find(m => 
            m.model === parsedModel.model && m.provider === parsedModel.provider
          );
          if (matchedModel && (!selectedModel || 
              selectedModel.model !== matchedModel.model || 
              selectedModel.provider !== matchedModel.provider)) {
            // 使用setTimeout防止在渲染过程中触发状态更新
            setTimeout(() => onModelChange(matchedModel), 0);
          }
        }
      } catch (e) {
        console.warn('Failed to parse saved model from localStorage:', e);
      }
    };

    // 只在有可用模型时才监听变化
    if (availableModels.length > 0) {
      // 监听storage事件（跨标签页）
      window.addEventListener('storage', handleStorageChange);
      
      // 监听自定义事件（同一页面内）
      window.addEventListener('localStorageChanged', handleStorageChange);
      
      return () => {
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener('localStorageChanged', handleStorageChange);
      };
    }
  }, [availableModels, selectedModel]);  // 移除onModelChange依赖项，避免无限循环

  const handleModelSelect = (model: ModelOption) => {
    try {
      onModelChange(model);
      localStorage.setItem('selectedModel', JSON.stringify(model));
      setIsOpen(false);
    } catch (error) {
      console.error('选择模型失败:', error);
      setError('选择模型失败，请重试');
    }
  };

  if (loading) {
    return <div className={`text-sm text-gray-500 ${className}`}>加载模型中...</div>;
  }

  if (error) {
    return <div className={`text-sm text-red-500 ${className}`}>{error}</div>;
  }

  return (
    <div className={`relative ${className}`} ref={selectorRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
      >
        <div className="flex-1 text-left">
          <div className="text-sm font-medium text-gray-900">
            {selectedModel ? (
              <div className="flex flex-col">
                <span className="text-xs text-gray-500">{selectedModel.providerName}</span>
                <span>{selectedModel.displayName}</span>
              </div>
            ) : (
              '请选择模型'
            )}
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-80 overflow-y-auto custom-scrollbar min-w-full w-max">
          {Object.keys(groupedModels).length > 0 ? (
            Object.entries(groupedModels).map(([providerName, models]) => (
              <div key={providerName} className="border-b border-gray-100 last:border-b-0">
                <div className="px-3 py-2 bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  {providerName}
                </div>
                <div className="py-1">
                  {models.map((model, index) => (
                    <button
                      key={`${model.provider}-${model.model}-${index}`}
                      onClick={() => handleModelSelect(model)}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center justify-between transition-colors"
                    >
                      <span className="flex-1">{model.displayName}</span>
                      {selectedModel?.model === model.model && selectedModel?.provider === model.provider && (
                        <Check className="w-4 h-4 text-blue-600 flex-shrink-0 ml-2" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="p-4 text-center text-sm text-gray-500">无可用模型。</div>
          )}
        </div>
      )}
    </div>
  );
}
