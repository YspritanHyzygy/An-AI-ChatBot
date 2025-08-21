-- 创建自定义模型表
CREATE TABLE custom_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    api_endpoint VARCHAR(500),
    model_id VARCHAR(200) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- 创建索引
CREATE INDEX idx_custom_models_user_id ON custom_models(user_id);
CREATE INDEX idx_custom_models_provider ON custom_models(provider);
CREATE INDEX idx_custom_models_is_active ON custom_models(is_active);

-- 设置权限
GRANT SELECT ON custom_models TO anon;
GRANT ALL PRIVILEGES ON custom_models TO authenticated;