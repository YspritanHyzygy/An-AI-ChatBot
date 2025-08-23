/**
 * 设置页面 - 包含用户信息和密码管理
 */
import { useState } from 'react';
import { User, Lock, Eye, EyeOff, Save, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import PasswordStrength from '../components/PasswordStrength';

export default function SettingsPage() {
  const { user, isLoading, changePassword } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');
  
  // 密码更改状态
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordValidation, setPasswordValidation] = useState<{
    isValid: boolean;
    errors: string[];
    strength: 'weak' | 'medium' | 'strong';
  } | null>(null);

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">请先登录</p>
          <Link to="/auth" className="mt-2 text-blue-600 hover:text-blue-500">
            前往登录
          </Link>
        </div>
      </div>
    );
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword || !newPassword) {
      setPasswordError('请填写所有密码字段');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError('两次输入的新密码不一致');
      return;
    }

    if (passwordValidation && !passwordValidation.isValid) {
      setPasswordError('新密码强度不足，请参考密码要求');
      return;
    }

    try {
      const result = await changePassword(currentPassword, newPassword, confirmNewPassword);
      if (result.success) {
        setPasswordSuccess(result.message || '密码修改成功');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        setPasswordValidation(null);
      } else {
        setPasswordError(result.error || '密码修改失败');
      }
    } catch (error) {
      setPasswordError('操作失败，请重试');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold text-gray-900">设置</h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow-sm">
          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex">
              <button
                onClick={() => setActiveTab('profile')}
                className={`px-6 py-3 border-b-2 font-medium text-sm ${
                  activeTab === 'profile'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  个人信息
                </div>
              </button>
              <button
                onClick={() => setActiveTab('security')}
                className={`px-6 py-3 border-b-2 font-medium text-sm ${
                  activeTab === 'security'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  安全设置
                </div>
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <h2 className="text-lg font-medium text-gray-900">个人信息</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      用户名
                    </label>
                    <input
                      type="text"
                      value={user.username}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 text-gray-500"
                    />
                    <p className="mt-1 text-sm text-gray-500">用户名无法修改</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      显示名称
                    </label>
                    <input
                      type="text"
                      value={user.displayName || ''}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 text-gray-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      邮箱地址
                    </label>
                    <input
                      type="email"
                      value={user.email || ''}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 text-gray-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      注册时间
                    </label>
                    <input
                      type="text"
                      value={new Date(user.created_at).toLocaleString()}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 text-gray-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-6">
                <h2 className="text-lg font-medium text-gray-900">安全设置</h2>
                
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <h3 className="text-md font-medium text-gray-900">修改密码</h3>
                  
                  {/* 成功/错误消息 */}
                  {passwordSuccess && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
                      {passwordSuccess}
                    </div>
                  )}
                  
                  {passwordError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                      {passwordError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 当前密码 */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        当前密码 *
                      </label>
                      <div className="relative">
                        <input
                          type={showPasswords ? "text" : "password"}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
                          placeholder="输入当前密码"
                          disabled={isLoading}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords(!showPasswords)}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                          disabled={isLoading}
                        >
                          {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* 新密码 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        新密码 *
                      </label>
                      <input
                        type={showPasswords ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="设置新密码"
                        disabled={isLoading}
                      />
                    </div>

                    {/* 确认新密码 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        确认新密码 *
                      </label>
                      <input
                        type={showPasswords ? "text" : "password"}
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="再次输入新密码"
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  {/* 密码强度指示器 */}
                  {newPassword && (
                    <PasswordStrength 
                      password={newPassword} 
                      onValidation={(isValid, errors, strength) => {
                        setPasswordValidation({ isValid, errors, strength });
                      }}
                    />
                  )}

                  {/* 提交按钮 */}
                  <button
                    type="submit"
                    disabled={isLoading || !currentPassword || !newPassword || !confirmNewPassword}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="w-4 h-4" />
                    {isLoading ? '修改中...' : '修改密码'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}