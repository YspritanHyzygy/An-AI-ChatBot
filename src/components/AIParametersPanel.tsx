import { useState, useEffect } from 'react';
import { Sliders, RotateCcw, AlertTriangle } from 'lucide-react';

interface AIParameters {
  temperature: number;
  maxTokens?: number;  // 可选参数，不设置时让模型自动判断输出长度
  topP: number;
  useResponsesAPI?: boolean;  // 是否使用 OpenAI Responses API
}

interface AIParametersPanelProps {
  onParametersChange: (params: AIParameters) => void;
  className?: string;
  selectedModel?: { provider?: string; model?: string } | null;  // 添加选中模型信息
}

// 各厂商参数范围配置
interface ProviderLimits {
  temperature: { min: number; max: number; recommended: number };
  maxTokens: { min: number; max: number; default: number };
  topP: { min: number; max: number; default: number };
  notes?: string[];
}

const PROVIDER_LIMITS: Record<string, ProviderLimits> = {
  openai: {
    temperature: { min: 0.0, max: 2.0, recommended: 0.7 },
    maxTokens: { min: 1, max: 4096, default: 4000 },
    topP: { min: 0.0, max: 1.0, default: 1.0 },
    notes: ['可与Temperature同时使用', 'GPT-4o输出限制为4K tokens']
  },
  claude: {
    temperature: { min: 0.0, max: 1.0, recommended: 0.7 },
    maxTokens: { min: 1, max: 8192, default: 4000 },
    topP: { min: 0.0, max: 1.0, default: 1.0 },
    notes: ['建议仅使用Temperature或TopP其中一个', '标准API 4096 tokens，beta模式 8192 tokens']
  },
  gemini: {
    temperature: { min: 0.0, max: 2.0, recommended: 0.7 },
    maxTokens: { min: 1, max: 65536, default: 8192 },
    topP: { min: 0.0, max: 1.0, default: 0.95 },
    notes: ['推荐TopP值为0.95，支持最大65536 tokens输出']
  },
  xai: {
    temperature: { min: 0.0, max: 1.0, recommended: 0.7 },
    maxTokens: { min: 1, max: 4096, default: 4000 },
    topP: { min: 0.0, max: 1.0, default: 1.0 },
    notes: ['Grok模型参数范围相对保守']
  },
  ollama: {
    temperature: { min: 0.0, max: 2.0, recommended: 0.7 },
    maxTokens: { min: 1, max: 65536, default: 4000 },
    topP: { min: 0.0, max: 1.0, default: 1.0 },
    notes: ['本地模型，参数范围较灵活']
  }
};

const DEFAULT_PARAMS: AIParameters = {
  temperature: 0.7,
  maxTokens: undefined,  // 默认不限制，让模型自动判断
  topP: 1.0,
  useResponsesAPI: false  // 默认不使用 Responses API
};

export default function AIParametersPanel({ onParametersChange, className = '', selectedModel }: AIParametersPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [parameters, setParameters] = useState<AIParameters>(DEFAULT_PARAMS);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // 获取当前厂商的参数限制
  const currentLimits = selectedModel?.provider ? PROVIDER_LIMITS[selectedModel.provider] || PROVIDER_LIMITS.openai : PROVIDER_LIMITS.openai;

  useEffect(() => {
    // 从本地存储加载参数
    const savedParams = localStorage.getItem('ai-parameters');
    if (savedParams) {
      try {
        const parsed = JSON.parse(savedParams);
        setParameters(parsed);
        validateParameters(parsed);
        onParametersChange(parsed);
      } catch (error) {
        console.error('Failed to parse saved AI parameters:', error);
      }
    } else {
      onParametersChange(DEFAULT_PARAMS);
    }
  }, [onParametersChange]);

  // 当模型变化时，重新验证参数
  useEffect(() => {
    validateParameters(parameters);
  }, [selectedModel?.provider]);

  const validateParameters = (params: AIParameters) => {
    const errors: string[] = [];
    
    // 验证 temperature
    if (params.temperature < currentLimits.temperature.min || params.temperature > currentLimits.temperature.max) {
      errors.push(`${selectedModel?.provider || 'AI'} Temperature范围为 ${currentLimits.temperature.min}-${currentLimits.temperature.max}`);
    }
    
    // 验证 maxTokens
    if (params.maxTokens !== undefined && 
        (params.maxTokens < currentLimits.maxTokens.min || params.maxTokens > currentLimits.maxTokens.max)) {
      errors.push(`${selectedModel?.provider || 'AI'} 输出长度范围为 ${currentLimits.maxTokens.min}-${currentLimits.maxTokens.max.toLocaleString()}`);
    }
    
    // 验证 topP
    if (params.topP < currentLimits.topP.min || params.topP > currentLimits.topP.max) {
      errors.push(`${selectedModel?.provider || 'AI'} TopP范围为 ${currentLimits.topP.min}-${currentLimits.topP.max}`);
    }
    
    // Claude 特殊验证：不建议同时设置 temperature 和 topP
    if (selectedModel?.provider === 'claude' && 
        params.temperature !== currentLimits.temperature.recommended && 
        params.topP !== currentLimits.topP.default) {
      errors.push('Claude不建议同时调整Temperature和TopP，建议只修改其中一个');
    }
    
    setValidationErrors(errors);
  };

  const updateParameter = (key: keyof AIParameters, value: number | undefined) => {
    const newParams = { ...parameters, [key]: value };
    setParameters(newParams);
    validateParameters(newParams);
    onParametersChange(newParams);
    localStorage.setItem('ai-parameters', JSON.stringify(newParams));
  };

  const resetToDefaults = () => {
    // 根据当前厂商设置推荐默认值
    const providerDefaults: AIParameters = {
      temperature: currentLimits.temperature.recommended,
      maxTokens: undefined, // 保持不限制策略
      topP: currentLimits.topP.default
    };
    
    setParameters(providerDefaults);
    validateParameters(providerDefaults);
    onParametersChange(providerDefaults);
    localStorage.setItem('ai-parameters', JSON.stringify(providerDefaults));
  };

  return (
    <div className={`relative ${className}`}>
      {/* 触发按钮 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
          isExpanded 
            ? 'bg-blue-100 text-blue-700 border border-blue-200' 
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
        }`}
        title="AI参数调整"
      >
        <Sliders className="w-4 h-4" />
        <span className="hidden sm:inline">参数</span>
      </button>

      {/* 参数面板 */}
      {isExpanded && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-50">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">AI参数调整</h3>
              <button
                onClick={resetToDefaults}
                className="flex items-center space-x-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                title="重置为默认值"
              >
                <RotateCcw className="w-3 h-3" />
                <span>重置</span>
              </button>
            </div>

            <div className="space-y-4">
              {/* 验证错误提示 */}
              {validationErrors.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-orange-700">
                      <p className="font-medium mb-1">参数超出范围：</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        {validationErrors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* 厂商特殊提示 */}
              {currentLimits.notes && currentLimits.notes.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="text-sm text-blue-700">
                    <p className="font-medium mb-1">{selectedModel?.provider?.toUpperCase() || 'AI'} 模型提示：</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      {currentLimits.notes.map((note, index) => (
                        <li key={index}>{note}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Temperature 滑块 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">创造性 (Temperature)</label>
                  <span className={`text-sm px-2 py-1 rounded ${
                    parameters.temperature < currentLimits.temperature.min || parameters.temperature > currentLimits.temperature.max
                      ? 'text-orange-700 bg-orange-100'
                      : 'text-gray-500 bg-gray-100'
                  }`}>
                    {parameters.temperature.toFixed(1)}
                  </span>
                </div>
                <input
                  type="range"
                  min={currentLimits.temperature.min}
                  max={currentLimits.temperature.max}
                  step="0.1"
                  value={Math.max(currentLimits.temperature.min, Math.min(currentLimits.temperature.max, parameters.temperature))}
                  onChange={(e) => updateParameter('temperature', parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>保守 ({currentLimits.temperature.min})</span>
                  <span>创新 ({currentLimits.temperature.max})</span>
                </div>
              </div>

              {/* Max Tokens 控制 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">输出长度限制</label>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${
                      parameters.maxTokens !== undefined && 
                      (parameters.maxTokens < currentLimits.maxTokens.min || parameters.maxTokens > currentLimits.maxTokens.max)
                        ? 'text-orange-600'
                        : 'text-gray-500'
                    }`}>
                      {parameters.maxTokens === undefined 
                        ? '不限制长度' 
                        : `最大 ${parameters.maxTokens.toLocaleString()} tokens`
                      }
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={parameters.maxTokens === undefined}
                        onChange={(e) => {
                          if (e.target.checked) {
                            updateParameter('maxTokens', undefined);
                          } else {
                            updateParameter('maxTokens', currentLimits.maxTokens.default);
                          }
                        }}
                        className="sr-only"
                      />
                      <div className={`w-9 h-5 rounded-full transition-colors duration-200 relative ${
                        parameters.maxTokens === undefined ? 'bg-blue-600' : 'bg-gray-200'
                      }`}>
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${
                          parameters.maxTokens === undefined ? 'translate-x-4' : 'translate-x-0.5'
                        }`}></div>
                      </div>
                    </label>
                  </div>
                </div>
                {parameters.maxTokens !== undefined && (
                  <>
                    <input
                      type="range"
                      min={currentLimits.maxTokens.min}
                      max={currentLimits.maxTokens.max}
                      step={currentLimits.maxTokens.max > 10000 ? 1000 : 100}
                      value={Math.max(currentLimits.maxTokens.min, Math.min(currentLimits.maxTokens.max, parameters.maxTokens))}
                      onChange={(e) => updateParameter('maxTokens', parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>简短 ({currentLimits.maxTokens.min.toLocaleString()})</span>
                      <span>长篇 ({currentLimits.maxTokens.max.toLocaleString()})</span>
                    </div>
                  </>
                )}
                {parameters.maxTokens === undefined && (
                  <div className="text-xs text-gray-500 bg-green-50 border border-green-200 rounded p-2 mt-2">
                    🎆 AI将根据问题复杂度智能决定输出长度，无上限约束
                  </div>
                )}
              </div>

              {/* Top P 滑块 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">多样性 (Top P)</label>
                  <span className={`text-sm px-2 py-1 rounded ${
                    parameters.topP < currentLimits.topP.min || parameters.topP > currentLimits.topP.max
                      ? 'text-orange-700 bg-orange-100'
                      : 'text-gray-500 bg-gray-100'
                  }`}>
                    {parameters.topP.toFixed(1)}
                  </span>
                </div>
                <input
                  type="range"
                  min={currentLimits.topP.min}
                  max={currentLimits.topP.max}
                  step="0.1"
                  value={Math.max(currentLimits.topP.min, Math.min(currentLimits.topP.max, parameters.topP))}
                  onChange={(e) => updateParameter('topP', parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>聚焦 ({currentLimits.topP.min})</span>
                  <span>多样 ({currentLimits.topP.max})</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-200">
              <div className="mb-3">
                <p className="text-xs font-medium text-gray-600 mb-2">
                  🎯 当前适配：{selectedModel?.provider?.toUpperCase() || 'AI'} {selectedModel?.model || '模型'}
                </p>
                <div className="grid grid-cols-3 gap-2 text-xs text-gray-500">
                  <div className="bg-gray-50 rounded p-1 text-center">
                    <div className="font-medium">温度范围</div>
                    <div>{currentLimits.temperature.min}-{currentLimits.temperature.max}</div>
                  </div>
                  <div className="bg-gray-50 rounded p-1 text-center">
                    <div className="font-medium">最大Token</div>
                    <div>{(currentLimits.maxTokens.max / 1000).toFixed(0)}K</div>
                  </div>
                  <div className="bg-gray-50 rounded p-1 text-center">
                    <div className="font-medium">TopP范围</div>
                    <div>{currentLimits.topP.min}-{currentLimits.topP.max}</div>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                💡 <strong>创造性</strong>：控制回答的随机性和创新程度<br/>
                📏 <strong>输出长度限制</strong>：开启时AI可根据需要生成任意长度，关闭时设定最大token数<br/>
                🎯 <strong>多样性</strong>：控制词汇选择的多样性，{selectedModel?.provider === 'gemini' ? '推荐使用0.95' : selectedModel?.provider === 'claude' ? '与Temperature二选一' : '可与Temperature同时使用'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 点击外部关闭面板 */}
      {isExpanded && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsExpanded(false)}
        />
      )}
    </div>
  );
}

// 自定义滑块样式
const sliderStyles = `
.slider::-webkit-slider-thumb {
  appearance: none;
  height: 16px;
  width: 16px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
}

.slider::-webkit-slider-thumb:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.slider::-moz-range-thumb {
  height: 16px;
  width: 16px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
}

.slider::-moz-range-thumb:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.slider::-webkit-slider-track {
  background: linear-gradient(90deg, #e5e7eb 0%, #3b82f6 50%, #8b5cf6 100%);
  height: 8px;
  border-radius: 4px;
}

.slider::-moz-range-track {
  background: linear-gradient(90deg, #e5e7eb 0%, #3b82f6 50%, #8b5cf6 100%);
  height: 8px;
  border-radius: 4px;
  border: none;
}
`;

// 将样式注入到页面
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = sliderStyles;
  document.head.appendChild(styleElement);
}