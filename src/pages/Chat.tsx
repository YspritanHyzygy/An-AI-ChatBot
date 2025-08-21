import { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Plus, Settings, History, MessageSquare, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import ModelSelector from '../components/ModelSelector';

import MarkdownRenderer from '../components/MarkdownRenderer';
import { getUserId } from '../lib/user';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  isTyping?: boolean;
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

export default function Chat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // const [typingMessage, setTypingMessage] = useState<string>('');
  const [showSidebar, setShowSidebar] = useState(true);
  const [selectedModel, setSelectedModel] = useState<ModelOption | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // 加载对话列表
    loadConversations();
    // 从本地存储加载选中的模型
    loadSelectedModel();
  }, []);

  // 监听localStorage变化，同步模型选择
  useEffect(() => {
    const handleStorageChange = () => {
      loadSelectedModel();
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

  const loadConversations = async () => {
    try {
      const userId = getUserId();
      const response = await fetch(`/api/chat/conversations?userId=${userId}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const conversations: Conversation[] = result.data.map((conv: { id: string; title: string; created_at: string; provider_used?: string; model_used?: string }) => ({
            id: conv.id,
            title: conv.title,
            messages: [], // 消息会在选择对话时单独加载
            created_at: new Date(conv.created_at),
            provider: conv.provider_used,
            model: conv.model_used
          }));
          setConversations(conversations);
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
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
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
          parameters: {}
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: '未知错误' }));
        throw new Error(`发送消息失败: ${errorData.error || response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        const aiMessage: Message = {
          id: crypto.randomUUID(),
          content: data.response,
          role: 'assistant',
          timestamp: new Date()
        };
        
        const finalConversation = {
          ...updatedConversation,
          messages: [...updatedConversation.messages, aiMessage]
        };
        setCurrentConversation(finalConversation);
        setConversations(prev => 
          prev.map(conv => conv.id === conversation!.id ? finalConversation : conv)
        );
        
        // 如果是新对话，更新conversationId
        if (data.conversationId && !conversation.id) {
          finalConversation.id = data.conversationId;
        }
      } else {
        throw new Error(data.error || '未知错误');
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

  return (
    <div className="flex h-screen bg-gray-50">
      {/* 侧边栏 */}
      <div className={`${showSidebar ? 'w-80' : 'w-0'} transition-all duration-300 bg-white border-r border-gray-200 flex flex-col overflow-hidden`}>
        {/* Logo和网站名称 */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-center mb-4">
            <Bot className="w-6 h-6 mr-2" />
            <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              AI Chat Hub
            </h1>
          </div>
        </div>
        
        {/* 头部 */}
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={createNewConversation}
            className="w-full flex items-center justify-center px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            新建对话
          </button>
        </div>

        {/* 对话列表 */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">暂无对话记录</p>
            </div>
          ) : (
            conversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={async () => {
                  const messages = await loadConversationMessages(conversation.id);
                  const conversationWithMessages = { ...conversation, messages };
                  setCurrentConversation(conversationWithMessages);
                }}
                className={`p-4 cursor-pointer hover:bg-gray-50 border-b border-gray-100 transition-colors ${
                  currentConversation?.id === conversation.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900 truncate mb-1">
                      {conversation.title}
                    </div>
                    {conversation.messages.length > 0 && (
                      <div className="text-xs text-gray-500 truncate mb-2">
                        {conversation.messages[conversation.messages.length - 1].content}
                      </div>
                    )}
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>{conversation.messages.length} 条消息</span>
                      <span>{formatTime(conversation.created_at)}</span>
                    </div>
                  </div>
                </div>
                {conversation.provider && (
                  <div className="mt-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                      {conversation.provider === 'openai' ? 'OpenAI' : conversation.provider}
                    </span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* 底部操作 */}
        <div className="p-4 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-2">
            <Link
              to="/history"
              className="flex items-center justify-center px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <History className="w-4 h-4 mr-1" />
              <span className="text-sm">历史</span>
            </Link>
            <Link
              to="/settings"
              className="flex items-center justify-center px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Settings className="w-4 h-4 mr-1" />
              <span className="text-sm">设置</span>
            </Link>
          </div>
        </div>
      </div>

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
              <ModelSelector
                selectedModel={selectedModel}
                onModelChange={setSelectedModel}
                className="hidden sm:block"
              />
            </div>
          </div>
          
          {/* 移动端控制面板 */}
          <div className="mt-3 sm:hidden space-y-3">
            <ModelSelector
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
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
                        <MarkdownRenderer 
                          content={message.content} 
                          className="text-sm leading-relaxed"
                        />
                      ) : (
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                      )}
                      <p className={`text-xs mt-2 ${
                        message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                      }`}>
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
              
              {/* 加载动画 */}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex flex-row">
                    <div className="flex-shrink-0 mr-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center">
                        <Bot className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="px-4 py-3 bg-white border border-gray-200 rounded-2xl shadow-sm">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
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
                disabled={!inputMessage.trim() || isLoading}
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