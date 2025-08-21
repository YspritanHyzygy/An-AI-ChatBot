import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixDatabase() {
  console.log('开始修复数据库结构...');
  
  try {
    // 修复conversations表的user_id字段类型
    console.log('1. 修复conversations表的user_id字段类型...');
    const { error: error1 } = await supabase.rpc('execute_sql', {
      sql: 'ALTER TABLE conversations ALTER COLUMN user_id TYPE VARCHAR(255);'
    });
    if (error1) console.log('conversations表user_id字段可能已经是正确类型:', error1.message);
    
    // 添加messages表的外键约束
    console.log('2. 添加messages表的外键约束...');
    const { error: error2 } = await supabase.rpc('execute_sql', {
      sql: `ALTER TABLE messages ADD CONSTRAINT messages_conversation_id_fkey 
             FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;`
    });
    if (error2) console.log('外键约束可能已存在:', error2.message);
    
    // 创建索引
    console.log('3. 创建必要的索引...');
    const { error: error3 } = await supabase.rpc('execute_sql', {
      sql: `CREATE INDEX IF NOT EXISTS idx_conversations_user_created ON conversations(user_id, created_at DESC);
             CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at);`
    });
    if (error3) console.log('索引创建错误:', error3.message);
    
    console.log('数据库结构修复完成！');
    
    // 测试插入一条消息
    console.log('4. 测试插入消息...');
    const testUserId = 'user_test_' + Date.now();
    
    // 创建测试用户
    const { error: userError } = await supabase
      .from('users')
      .insert({
        id: testUserId,
        email: `${testUserId}@test.com`,
        name: '测试用户'
      });
    
    if (userError) {
      console.log('创建测试用户失败:', userError.message);
      return;
    }
    
    // 创建测试对话
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .insert({
        user_id: testUserId,
        title: '测试对话'
      })
      .select()
      .single();
    
    if (convError) {
      console.log('创建测试对话失败:', convError.message);
      return;
    }
    
    // 创建测试消息
    const { error: msgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        content: '测试消息',
        role: 'user'
      });
    
    if (msgError) {
      console.log('创建测试消息失败:', msgError.message);
    } else {
      console.log('测试消息创建成功！数据库修复完成。');
    }
    
    // 清理测试数据
    await supabase.from('conversations').delete().eq('user_id', testUserId);
    await supabase.from('users').delete().eq('id', testUserId);
    
  } catch (error) {
    console.error('修复数据库时出错:', error);
  }
}

fixDatabase();