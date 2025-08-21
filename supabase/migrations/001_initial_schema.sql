-- 创建用户表
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    default_provider VARCHAR(50) DEFAULT 'openai',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_users_email ON users(email);

-- 创建AI服务提供商配置表
CREATE TABLE ai_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    provider_name VARCHAR(50) NOT NULL CHECK (provider_name IN ('openai', 'claude', 'gemini', 'xai', 'ollama', 'qwen')),
    api_key VARCHAR(500),
    base_url VARCHAR(500),
    available_models JSONB DEFAULT '[]',
    default_model VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, provider_name)
);

-- 创建索引
CREATE INDEX idx_ai_providers_user_id ON ai_providers(user_id);
CREATE INDEX idx_ai_providers_provider_name ON ai_providers(provider_name);

-- 创建对话表
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL DEFAULT '新对话',
    provider_used VARCHAR(50),
    model_used VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_created_at ON conversations(created_at DESC);

-- 创建消息表
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL,
    content TEXT NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
    provider VARCHAR(50),
    model VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- 设置权限
GRANT SELECT ON users TO anon;
GRANT ALL PRIVILEGES ON users TO authenticated;

GRANT SELECT ON ai_providers TO anon;
GRANT ALL PRIVILEGES ON ai_providers TO authenticated;

GRANT SELECT ON conversations TO anon;
GRANT ALL PRIVILEGES ON conversations TO authenticated;

GRANT SELECT ON messages TO anon;
GRANT ALL PRIVILEGES ON messages TO authenticated;

-- 初始化示例数据
INSERT INTO users (id, email, name) VALUES 
('00000000-0000-0000-0000-000000000001', 'demo@example.com', '演示用户');

INSERT INTO conversations (user_id, title) VALUES 
('00000000-0000-0000-0000-000000000001', '欢迎对话');

INSERT INTO messages (conversation_id, content, role) VALUES 
((SELECT id FROM conversations WHERE title = '欢迎对话'), '你好！我是AI助手，有什么可以帮助你的吗？', 'assistant');