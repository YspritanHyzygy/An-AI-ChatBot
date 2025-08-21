-- 修复conversations和messages表的外键约束和字段类型
-- 将UUID类型改为VARCHAR类型以匹配前端用户ID格式

-- 修复conversations表
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_user_id_fkey;
ALTER TABLE conversations ALTER COLUMN user_id TYPE VARCHAR(255);

-- 重新创建conversations表的索引
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_created ON conversations(user_id, created_at DESC);

-- 修复messages表，添加外键约束
ALTER TABLE messages ADD CONSTRAINT messages_conversation_id_fkey 
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;

-- 重新创建messages表的索引
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at);

-- 授权
GRANT SELECT, INSERT, UPDATE, DELETE ON conversations TO authenticated;
GRANT SELECT ON conversations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON messages TO authenticated;
GRANT SELECT ON messages TO anon;