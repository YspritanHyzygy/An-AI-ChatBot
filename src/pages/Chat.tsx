import { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, MessageSquare, Sparkles } from 'lucide-react';
import ModelSelector from '../components/ModelSelector';
import AIParametersPanel from '../components/AIParametersPanel';
import MarkdownRenderer from '../components/MarkdownRenderer';

import Sidebar from '../components/Sidebar';
import ErrorBoundary from '../components/ErrorBoundary';
import { getUserId } from '../lib/user';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  isTyping?: boolean;
  useTypewriter?: boolean; // 是否使用打字机效果
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  created_at: Date;
  provider?: string;
  model?: string;
}

interface ModelOption {
  provider: string;
  providerName: string;
  model: string;
  displayName: string;
}

interface AIParameters {
  temperature: number;
  maxTokens?: number;  // 可选参数，不设置时让模型自动判断输出长度
  topP: number;
  useResponsesAPI?: boolean;  // 是否使用 OpenAI Responses API
}

export default function Chat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // const [typingMessage, setTypingMessage] = useState<string>('');
  const [showSidebar, setShowSidebar] = useState(true);
  const [selectedModel, setSelectedModel] = useState<ModelOption | null>(null);
  const [aiParameters, setAiParameters] = useState<AIParameters>({
    temperature: 0.7,
    maxTokens: undefined,  // 默认不限制，让模型自动判断
    topP: 1.0,
    useResponsesAPI: false  // 默认不使用 Responses API
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleModelChange = (model: ModelOption) => {
    try {
      setSelectedModel(model);
      // 保存到localStorage
      localStorage.setItem('selectedModel', JSON.stringify(model));
    } catch (error) {
      console.error('模型选择失败:', error);
    }
  };

  useEffect(() => {
    // 加载对话列表
    loadConversations();
    // 从本地存储加载选中的模型
    loadSelectedModel();
    // 加载用户设置配置
    loadUserSettings();
  }, []);

  // 当conversations加载完成后，检查URL参数
  useEffect(() => {
    if (conversations.length > 0) {
      checkUrlParams();
    }
  }, [conversations]);

  // 检查URL参数并加载对应对话
  const checkUrlParams = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const conversationId = urlParams.get('conversation');
    
    if (conversationId && conversations.length > 0) {
      try {
        // 从已加载的对话列表中找到对应的对话信息
        const conversation = conversations.find((conv: Conversation) => conv.id === conversationId);
        
        if (conversation) {
          setCurrentConversation(conversation);
        }
      } catch (error) {
        console.error('加载URL指定的对话失败:', error);
      }
    }
  };

  // 监听localStorage变化，同步模型选择和设置
  useEffect(() => {
    const handleStorageChange = () => {
      loadSelectedModel();
      loadUserSettings(); // 同时重新加载用户设置
    };

    // 监听storage事件（跨标签页）
    window.addEventListener('storage', handleStorageChange);
    
    // 监听自定义事件（同一页面内）
    window.addEventListener('localStorageChanged', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('localStorageChanged', handleStorageChange);
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [currentConversation?.messages]);

  useEffect(() => {
    // 自动调整textarea高度
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputMessage]);

  const loadSelectedModel = () => {
    try {
      const savedModel = localStorage.getItem('selectedModel');
      if (savedModel) {
        setSelectedModel(JSON.parse(savedModel));
      }
    } catch (error) {
      console.error('加载选中模型失败:', error);
    }
  };

  // 加载用户设置配置
  const loadUserSettings = async () => {
    try {
      const userId = getUserId();
      const response = await fetch(`/api/providers/config?userId=${encodeURIComponent(userId)}`);
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          // 查找 OpenAI 提供商的配置
          const openaiConfig = result.data.find((config: any) => config.provider_name === 'openai');
          if (openaiConfig && openaiConfig.use_responses_api === 'true') {
            // 更新 aiParameters 以包含 useResponsesAPI
            setAiParameters(prev => ({
              ...prev,
              useResponsesAPI: true
            }));
            console.log('[DEBUG] 从用户设置中启用了 Responses API');
          } else {
            console.log('[DEBUG] 用户设置中未启用 Responses API');
          }
        }
      }
    } catch (error) {
      console.error('加载用户设置失败:', error);
    }
  };

  const loadConversations = async () => {
    try {
      const userId = getUserId();
      const response = await fetch(`/api/chat/conversations?userId=${userId}`);
      
      if (response.ok) {
        const result = await response.json();
        
        if (result.success && result.data) {
          const conversations: Conversation[] = await Promise.all(
            result.data.map(async (conv: { id: string; title: string; created_at: string; provider_used?: string; model_used?: string }) => {
              // 为每个对话加载消息
              const messages = await loadConversationMessages(conv.id);
              return {
                id: conv.id,
                title: conv.title,
                messages: messages,
                created_at: new Date(conv.created_at),
                provider: conv.provider_used,
                model: conv.model_used
              };
            })
          );
          setConversations(conversations);
          
          // 强制重新渲染
          setTimeout(() => {
            setConversations([...conversations]);
          }, 100);
        } else {
          setConversations([]);
        }
      } else {
        console.warn('加载对话列表失败，使用空列表');
        setConversations([]);
      }
    } catch (error) {
      console.error('加载对话失败:', error);
      setConversations([]);
    }
  };

  const loadConversationMessages = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/chat/conversations/${conversationId}/messages`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          return result.data.map((msg: { id: string; content: string; role: string; created_at: string }) => ({
            id: msg.id,
            content: msg.content,
            role: msg.role,
            timestamp: new Date(msg.created_at)
          }));
        }
      }
      return [];
    } catch (error) {
      console.error('加载消息失败:', error);
      return [];
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // const simulateTyping = (text: string, callback: () => void) => {
  //   let index = 0;
  //   setTypingMessage('');
  //   
  //   const typeInterval = setInterval(() => {
  //     if (index < text.length) {
  //       setTypingMessage(text.slice(0, index + 1));
  //       index++;
  //     } else {
  //       clearInterval(typeInterval);
  //       setTypingMessage('');
  //       callback();
  //     }
  //   }, 30); // 打字速度
  // };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    setIsLoading(true);
    let conversation = currentConversation;
    
    // 如果没有当前对话，创建新对话
    if (!conversation) {
      conversation = {
        id: crypto.randomUUID(),
        title: inputMessage.slice(0, 30) + (inputMessage.length > 30 ? '...' : ''),
        messages: [],
        created_at: new Date(),
        provider: selectedModel?.provider || 'openai',
        model: selectedModel?.model || 'gpt-3.5-turbo'
      };
      setConversations(prev => [conversation!, ...prev]);
      setCurrentConversation(conversation);
      
      // 更新URL参数以反映新对话
      const url = new URL(window.location.href);
      url.searchParams.set('conversation', conversation.id);
      window.history.replaceState({}, '', url.toString());
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      content: inputMessage,
      role: 'user',
      timestamp: new Date()
    };

    // 更新对话以反映最新的模型选择和新消息
    const updatedConversation = {
      ...conversation,
      provider: selectedModel?.provider || 'openai',
      model: selectedModel?.model || 'gpt-3.5-turbo',
      messages: [...conversation.messages, userMessage]
    };

    setCurrentConversation(updatedConversation);
    setConversations(prev => prev.map(conv => 
      conv.id === conversation!.id ? updatedConversation : conv
    ));
    setInputMessage('');
    // 创建一个临时的AI消息用于显示流式内容
    const aiMessageId = crypto.randomUUID();
    const aiMessage: Message = {
      id: aiMessageId,
      content: '',
      role: 'assistant',
      timestamp: new Date(),
      isTyping: true
    };
    
    // 立即添加空的AI消息到对话中
    const conversationWithAiMessage = {
      ...updatedConversation,
      messages: [...updatedConversation.messages, aiMessage]
    };
    setCurrentConversation(conversationWithAiMessage);
    setConversations(prev => 
      prev.map(conv => conv.id === conversation!.id ? conversationWithAiMessage : conv)
    );

    try {

      // 构建请求URL，使用流式响应获得真正的实时体验
      const url = new URL('/api/chat', window.location.origin);
      url.searchParams.set('stream', 'true');
      
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: inputMessage,
          provider: updatedConversation.provider,
          model: updatedConversation.model,
          conversationId: updatedConversation.id,
          userId: getUserId(),
          parameters: aiParameters
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: '未知错误' }));
        throw new Error(`发送消息失败: ${errorData.error || response.statusText}`);
      }

      // 检查是否是流式响应
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/event-stream')) {
        // 处理流式响应
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullContent = '';

        if (reader) {
          try {
            let streamTimeout: NodeJS.Timeout | null = null;
            let lastChunkTime = Date.now();
            
            // 设置流式响应超时检查
            const checkStreamTimeout = () => {
              if (Date.now() - lastChunkTime > 30000) { // 30秒超时
                console.warn('流式响应超时，强制结束');
                reader.cancel();
                return;
              }
              streamTimeout = setTimeout(checkStreamTimeout, 5000);
            };
            streamTimeout = setTimeout(checkStreamTimeout, 5000);
            
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                console.log('流式响应正常结束');
                break;
              }

              lastChunkTime = Date.now();
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const dataStr = line.slice(6).trim();
                  
                  // 检查是否是结束标记
                  if (dataStr === '[DONE]') {
                    console.log('收到[DONE]标记，流式响应结束');
                    // 确保最终状态正确设置
                    const finalUpdateMessage = (msg: any) => 
                      msg.id === aiMessageId 
                        ? { ...msg, content: fullContent, isTyping: false }
                        : msg;
                    
                    setCurrentConversation(prev => {
                      if (!prev) return prev;
                      return {
                        ...prev,
                        messages: prev.messages.map(finalUpdateMessage)
                      };
                    });
                    
                    setConversations(prev => 
                      prev.map(conv => {
                        if (conv.id === conversation!.id) {
                          return {
                            ...conv,
                            messages: conv.messages.map(finalUpdateMessage)
                          };
                        }
                        return conv;
                      })
                    );
                    
                    if (streamTimeout) {
                      clearTimeout(streamTimeout);
                    }
                    return; // 直接返回，结束整个流式处理
                  }
                  
                  try {
                    const data = JSON.parse(dataStr);
                    
                    // 处理内容更新（包括空内容的情况）
                    if (data.content !== undefined) {
                      fullContent += data.content;
                    }
                    
                    // 更新AI消息内容和状态
                    const updateMessage = (msg: any) => 
                      msg.id === aiMessageId 
                        ? { ...msg, content: fullContent, isTyping: !data.done }
                        : msg;
                    
                    setCurrentConversation(prev => {
                      if (!prev) return prev;
                      return {
                        ...prev,
                        messages: prev.messages.map(updateMessage)
                      };
                    });
                    
                    setConversations(prev => 
                      prev.map(conv => {
                        if (conv.id === conversation!.id) {
                          return {
                            ...conv,
                            messages: conv.messages.map(updateMessage)
                          };
                        }
                        return conv;
                      })
                    );
                    
                    if (data.done) {
                      console.log('收到done标记，流式响应结束');
                      if (streamTimeout) {
                        clearTimeout(streamTimeout);
                      }
                      return; // 直接返回，结束整个流式处理
                    }
                  } catch (e) {
                    console.warn('解析流式数据失败:', e, '原始数据:', dataStr);
                  }
                }
              }
            }
            
            if (streamTimeout) {
              clearTimeout(streamTimeout);
            }
          } catch (streamError) {
            console.error('流式响应处理错误:', streamError);
            // 如果流式响应出错，确保AI消息状态正确
            const errorUpdateMessage = (msg: any) => 
              msg.id === aiMessageId 
                ? { ...msg, content: fullContent || '响应被中断', isTyping: false }
                : msg;
            
            setCurrentConversation(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                messages: prev.messages.map(errorUpdateMessage)
              };
            });
            
            setConversations(prev => 
              prev.map(conv => {
                if (conv.id === conversation!.id) {
                  return {
                    ...conv,
                    messages: conv.messages.map(errorUpdateMessage)
                  };
                }
                return conv;
              })
            );
          } finally {
            try {
              reader.releaseLock();
            } catch (e) {
              console.warn('释放reader锁失败:', e);
            }
          }
        }
      } else {
        // 处理普通响应（兼容性）
        const data = await response.json();
        
        if (data.success) {
          setCurrentConversation(prev => {
            if (!prev) return prev;
            const updatedMessages = prev.messages.map(msg => 
              msg.id === aiMessageId 
                ? { ...msg, content: data.response, isTyping: false }
                : msg
            );
            return { ...prev, messages: updatedMessages };
          });
          
          setConversations(prev => 
            prev.map(conv => {
              if (conv.id === conversation!.id) {
                const updatedMessages = conv.messages.map(msg => 
                  msg.id === aiMessageId 
                    ? { ...msg, content: data.response, isTyping: false }
                    : msg
                );
                return { ...conv, messages: updatedMessages };
              }
              return conv;
            })
          );
          
          // 如果是新对话，更新conversationId
          if (data.conversationId && !conversation.id) {
            setCurrentConversation(prev => prev ? { ...prev, id: data.conversationId } : prev);
          }
        } else {
          throw new Error(data.error || '未知错误');
        }
      }
    } catch (error: unknown) {
      console.error('发送消息失败:', error);
      // 显示错误消息
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        content: `抱歉，发送消息时出现错误：${error instanceof Error ? error.message : '未知错误'}`,
        role: 'assistant',
        timestamp: new Date()
      };
      
      const finalConversation = {
        ...updatedConversation,
        messages: [...updatedConversation.messages, errorMessage]
      };
      setCurrentConversation(finalConversation);
      setConversations(prev => 
        prev.map(conv => conv.id === conversation!.id ? finalConversation : conv)
      );
    } finally {
      setIsLoading(false);
      // 确保AI消息的isTyping状态被清除
      setCurrentConversation(prev => {
        if (!prev) return prev;
        const updatedMessages = prev.messages.map(msg => 
          msg.id === aiMessageId 
            ? { ...msg, isTyping: false }
            : msg
        );
        return { ...prev, messages: updatedMessages };
      });
      
      setConversations(prev => 
        prev.map(conv => {
          if (conv.id === conversation!.id) {
            const updatedMessages = conv.messages.map(msg => 
              msg.id === aiMessageId 
                ? { ...msg, isTyping: false }
                : msg
            );
            return { ...conv, messages: updatedMessages };
          }
          return conv;
        })
      );
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const createNewConversation = () => {
    setCurrentConversation(null);
    setInputMessage('');
    
    // 清除URL参数，因为这是新对话
    const url = new URL(window.location.href);
    url.searchParams.delete('conversation');
    window.history.replaceState({}, '', url.toString());
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffMinutes = Math.ceil(diffTime / (1000 * 60));
    
    if (diffMinutes < 60) {
      return `${diffMinutes}分钟前`;
    } else if (diffMinutes < 1440) {
      return `${Math.floor(diffMinutes / 60)}小时前`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const handleConversationSelect = async (conversation: Conversation) => {
    const messages = await loadConversationMessages(conversation.id);
    const conversationWithMessages = { ...conversation, messages };
    setCurrentConversation(conversationWithMessages);
    
    // 更新URL参数，这样刷新页面时能保持当前对话
    const url = new URL(window.location.href);
    url.searchParams.set('conversation', conversation.id);
    window.history.replaceState({}, '', url.toString());
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* 新的侧边栏组件 */}
      {showSidebar && (
        <Sidebar
          showSidebar={showSidebar}
          conversations={conversations}
          currentConversation={currentConversation}
          onNewConversation={createNewConversation}
          onConversationSelect={handleConversationSelect}
          formatTime={formatTime}
        />
      )}

      {/* 主聊天区域 */}
      <div className="flex-1 flex flex-col">

        
        {/* 聊天头部 */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className="mr-4 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <MessageSquare className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {currentConversation ? currentConversation.title : '开始新对话'}
                </h2>
                {currentConversation?.provider && (
                  <p className="text-sm text-gray-500">
                    使用 {currentConversation.provider === 'openai' ? 'OpenAI' : currentConversation.provider} · {currentConversation.model}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {/* 模型选择器 */}
              <ErrorBoundary
                fallback={
                  <div className="text-sm text-red-500 px-3 py-2 border border-red-200 rounded-lg bg-red-50">
                    模型选择器加载失败
                  </div>
                }
              >
                <ModelSelector
                  selectedModel={selectedModel}
                  onModelChange={handleModelChange}
                  className="hidden sm:block"
                />
              </ErrorBoundary>
              {/* AI参数面板 */}
              <AIParametersPanel
                onParametersChange={setAiParameters}
                selectedModel={selectedModel}
                className="hidden sm:block"
              />
            </div>
          </div>
          
          {/* 移动端控制面板 */}
          <div className="mt-3 sm:hidden space-y-3">
            <ErrorBoundary
              fallback={
                <div className="text-sm text-red-500 px-3 py-2 border border-red-200 rounded-lg bg-red-50">
                  模型选择器加载失败
                </div>
              }
            >
              <ModelSelector
                selectedModel={selectedModel}
                onModelChange={handleModelChange}
              />
            </ErrorBoundary>
            <AIParametersPanel
              onParametersChange={setAiParameters}
              selectedModel={selectedModel}
            />
          </div>
        </div>

        {/* 消息区域 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {!currentConversation || currentConversation.messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">开始新对话</h3>
                <p className="text-gray-500 mb-6">发送消息开始与AI助手对话，体验智能问答的魅力</p>
                <div className="grid grid-cols-1 gap-2 text-sm">
                  <div className="p-3 bg-gray-50 rounded-lg text-left">
                    <div className="font-medium text-gray-700 mb-1">💡 提示</div>
                    <div className="text-gray-600">您可以询问任何问题，我会尽力为您提供帮助</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6 max-w-4xl mx-auto">
              {currentConversation.messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex max-w-[80%] ${
                    message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                  }`}>
                    <div className={`flex-shrink-0 ${
                      message.role === 'user' ? 'ml-3' : 'mr-3'
                    }`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        message.role === 'user' 
                          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {message.role === 'user' ? (
                          <User className="w-4 h-4" />
                        ) : (
                          <Bot className="w-4 h-4" />
                        )}
                      </div>
                    </div>
                    <div className={`px-4 py-3 rounded-2xl ${
                      message.role === 'user'
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                        : 'bg-white border border-gray-200 text-gray-900 shadow-sm'
                    }`}>
                      {message.role === 'assistant' ? (
                        <div className={message.isTyping ? 'relative' : ''}>
                          <MarkdownRenderer 
                            content={message.content} 
                            className="text-sm leading-relaxed"
                          />
                          {message.isTyping && message.content && (
                            <div className="inline-flex items-center ml-1">
                              <div className="w-1 h-4 bg-blue-500 animate-pulse rounded-full"></div>
                            </div>
                          )}
                          {message.isTyping && !message.content && (
                            <div className="flex items-center space-x-1 py-2">
                              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                      )}
                      <p className={`text-xs mt-2 ${
                        message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                      }`}>
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {message.isTyping && (
                          <span className="ml-2 text-blue-500 font-medium">AI正在思考...</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* 打字效果 */}
              {/* {typingMessage && (
                <div className="flex justify-start">
                  <div className="flex flex-row max-w-[80%]">
                    <div className="flex-shrink-0 mr-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center">
                        <Bot className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="px-4 py-3 bg-white border border-gray-200 rounded-2xl shadow-sm">
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{typingMessage}</p>
                      <div className="inline-block w-2 h-4 bg-blue-600 animate-pulse ml-1"></div>
                    </div>
                  </div>
                </div>
              )} */}
              

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* 输入区域 */}
        <div className="bg-white border-t border-gray-200 px-6 py-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-end space-x-4">
              <div className="flex-1">
                <textarea
                  ref={textareaRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="输入消息... (Enter发送，Shift+Enter换行)"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all duration-200 custom-scrollbar"
                  rows={1}
                  style={{ minHeight: '48px', maxHeight: '120px' }}
                />
              </div>
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || (currentConversation?.messages.some(msg => msg.isTyping) ?? false)}
                className="px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-2 text-xs text-gray-500 text-center">
              AI助手可能会产生不准确的信息，请谨慎使用生成的内容。
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}