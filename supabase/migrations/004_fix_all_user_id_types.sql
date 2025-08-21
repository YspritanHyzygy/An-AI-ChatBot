-- 修复所有表中user_id字段类型
-- 将UUID类型改为VARCHAR类型以匹配前端用户ID格式

-- 修复ai_providers表
ALTER TABLE ai_providers DROP CONSTRAINT IF EXISTS ai_providers_user_id_fkey;
ALTER TABLE ai_providers ALTER COLUMN user_id TYPE VARCHAR(255);

-- 重新创建ai_providers表的索引
CREATE INDEX IF NOT EXISTS idx_ai_providers_user_id ON ai_providers(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_providers_user_active ON ai_providers(user_id, is_active);

-- 授权ai_providers表
GRANT SELECT, INSERT, UPDATE, DELETE ON ai_providers TO authenticated;
GRANT SELECT ON ai_providers TO anon;