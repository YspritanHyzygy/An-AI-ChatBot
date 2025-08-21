import { useState, useEffect } from 'react';
import { Sliders, RotateCcw } from 'lucide-react';

interface AIParameters {
  temperature: number;
  maxTokens: number;
  topP: number;
}

interface AIParametersPanelProps {
  onParametersChange: (params: AIParameters) => void;
  className?: string;
}

const DEFAULT_PARAMS: AIParameters = {
  temperature: 0.7,
  maxTokens: 4000,
  topP: 1.0
};

export default function AIParametersPanel({ onParametersChange, className = '' }: AIParametersPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [parameters, setParameters] = useState<AIParameters>(DEFAULT_PARAMS);

  useEffect(() => {
    // 从本地存储加载参数
    const savedParams = localStorage.getItem('ai-parameters');
    if (savedParams) {
      try {
        const parsed = JSON.parse(savedParams);
        setParameters(parsed);
        onParametersChange(parsed);
      } catch (error) {
        console.error('Failed to parse saved AI parameters:', error);
      }
    } else {
      onParametersChange(DEFAULT_PARAMS);
    }
  }, [onParametersChange]);

  const updateParameter = (key: keyof AIParameters, value: number) => {
    const newParams = { ...parameters, [key]: value };
    setParameters(newParams);
    onParametersChange(newParams);
    localStorage.setItem('ai-parameters', JSON.stringify(newParams));
  };

  const resetToDefaults = () => {
    setParameters(DEFAULT_PARAMS);
    onParametersChange(DEFAULT_PARAMS);
    localStorage.setItem('ai-parameters', JSON.stringify(DEFAULT_PARAMS));
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
              {/* Temperature 滑块 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">创造性 (Temperature)</label>
                  <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    {parameters.temperature.toFixed(1)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={parameters.temperature}
                  onChange={(e) => updateParameter('temperature', parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>保守 (0.0)</span>
                  <span>创新 (2.0)</span>
                </div>
              </div>

              {/* Max Tokens 滑块 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">最大长度 (Max Tokens)</label>
                  <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    {parameters.maxTokens.toLocaleString()}
                  </span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="8000"
                  step="100"
                  value={parameters.maxTokens}
                  onChange={(e) => updateParameter('maxTokens', parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>简短 (100)</span>
                  <span>详细 (8000)</span>
                </div>
              </div>

              {/* Top P 滑块 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">多样性 (Top P)</label>
                  <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    {parameters.topP.toFixed(1)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.1"
                  value={parameters.topP}
                  onChange={(e) => updateParameter('topP', parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>聚焦 (0.1)</span>
                  <span>多样 (1.0)</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-500 leading-relaxed">
                💡 <strong>创造性</strong>：控制回答的随机性和创新程度<br/>
                📏 <strong>最大长度</strong>：限制AI回答的最大字符数<br/>
                🎯 <strong>多样性</strong>：控制词汇选择的多样性
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