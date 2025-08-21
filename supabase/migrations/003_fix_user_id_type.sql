-- 修复custom_models表中user_id字段类型
-- 将UUID类型改为VARCHAR类型以匹配前端用户ID格式

-- 删除外键约束
ALTER TABLE custom_models DROP CONSTRAINT IF EXISTS custom_models_user_id_fkey;

-- 修改user_id字段类型
ALTER TABLE custom_models ALTER COLUMN user_id TYPE VARCHAR(255);

-- 重新创建索引
CREATE INDEX IF NOT EXISTS idx_custom_models_user_id ON custom_models(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_models_user_active ON custom_models(user_id, is_active);

-- 授权
GRANT SELECT, INSERT, UPDATE, DELETE ON custom_models TO authenticated;
GRANT SELECT ON custom_models TO anon;