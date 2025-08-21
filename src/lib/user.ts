/**
 * 用户管理工具函数
 * 处理临时用户ID的生成和存储
 */

/**
 * 生成唯一的用户ID
 */
function generateUserId(): string {
  // 使用标准UUID格式，兼容数据库的uuid类型
  return crypto.randomUUID();
}

/**
 * 检查用户ID是否为有效的UUID格式
 */
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * 获取或创建用户ID
 * 如果localStorage中没有用户ID或格式不正确，则创建一个新的UUID格式用户ID
 */
export function getUserId(): string {
  const STORAGE_KEY = 'gemini_video_webui_user_id';
  
  let userId = localStorage.getItem(STORAGE_KEY);
  
  // 如果没有用户ID或者不是有效的UUID格式，则生成新的
  if (!userId || !isValidUUID(userId)) {
    userId = generateUserId();
    localStorage.setItem(STORAGE_KEY, userId);
  }
  
  return userId;
}

/**
 * 清除用户ID（用于重置用户数据）
 */
export function clearUserId(): void {
  const STORAGE_KEY = 'gemini_video_webui_user_id';
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * 检查是否有有效的用户ID
 */
export function hasUserId(): boolean {
  const STORAGE_KEY = 'gemini_video_webui_user_id';
  return !!localStorage.getItem(STORAGE_KEY);
}