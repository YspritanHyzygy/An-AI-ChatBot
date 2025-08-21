# 🤖 AI Chat Application

一个现代化的多AI提供商聊天应用，基于React、TypeScript和Node.js构建。支持与OpenAI GPT、Google Gemini、Anthropic Claude等多种AI模型进行对话。

[English](README.md) | 简体中文

## ✨ 核心特性

- 🔄 **多AI提供商支持**: 支持OpenAI、Google Gemini、Anthropic Claude、xAI Grok、Ollama和通义千问
- 🔐 **用户自定义API密钥**: 通过Web界面安全配置个人API密钥
- 💬 **对话管理**: 创建、保存和管理多个聊天对话
- ⚡ **实时聊天界面**: 现代化响应式聊天UI，支持消息历史
- 📝 **Markdown渲染**: AI回复支持完整的Markdown格式显示
- 💾 **持久化存储**: 所有对话和消息存储在Supabase数据库中
- 🛠️ **灵活配置**: 支持用户配置和环境变量两种配置方式
- 🔒 **TypeScript**: 前后端完整的类型安全保障

## 技术栈

### 前端
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **React Router** for navigation
- **Zustand** for state management

### 后端
- **Node.js** with Express.js and TypeScript
- **Supabase** for database and authentication
- **AI Service Adapters** for multiple AI providers

## 📋 环境要求

- **Node.js 18+** 和 npm
- **Supabase账户和项目** ([免费注册](https://supabase.com))
- **AI提供商API密钥** (可通过Web界面配置，无需提前准备)

## 🚀 快速开始

### 步骤1: 克隆项目并安装依赖

```bash
# 克隆项目
git clone <repository-url>
cd gemini-video-webui

# 安装依赖
npm install
```

### 步骤2: 配置Supabase数据库

#### 2.1 创建Supabase项目
1. 访问 [Supabase官网](https://supabase.com) 并注册账户
2. 创建新项目，记录项目URL和API密钥
3. 等待项目初始化完成（约2-3分钟）

#### 2.2 设置数据库
1. 在Supabase控制台中，进入 **SQL Editor**
2. 依次执行 `supabase/migrations/` 目录下的SQL文件：
   - `001_initial_schema.sql`
   - `002_custom_models.sql` 
   - `003_fix_user_id_type.sql`
   - `004_fix_all_user_id_types.sql`
   - `005_fix_conversations_and_messages.sql`

#### 2.3 配置环境变量
```bash
# 复制环境变量模板
cp .env.example .env
```

编辑 `.env` 文件，填入Supabase配置：
```env
# Supabase配置 (必填)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# AI提供商API密钥 (可选 - 推荐通过Web界面配置)
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
CLAUDE_API_KEY=...
XAI_API_KEY=...
QWEN_API_KEY=...
OLLAMA_BASE_URL=http://localhost:11434/v1
```

> 💡 **提示**: AI提供商的API密钥可以稍后通过Web界面配置，无需在此步骤填写。

### 步骤3: 启动应用

#### 方式一: 同时启动前后端 (推荐)
```bash
npm run dev
```

#### 方式二: 分别启动
```bash
# 终端1: 启动后端服务 (端口3001)
npm run server:dev

# 终端2: 启动前端服务 (端口5173)
npm run client:dev
```

### 步骤4: 配置AI提供商

1. 🌐 访问 `http://localhost:5173`
2. ⚙️ 点击右上角设置按钮进入设置页面
3. 🔑 配置你需要的AI提供商API密钥
4. ✅ 点击"测试连接"验证配置
5. 🎯 选择默认模型
6. 💬 返回聊天页面开始对话！

### 步骤5: 生产环境部署

```bash
# 构建前端
npm run build

# 启动生产服务器
npm start
```

## 🔧 配置验证

### 检查Supabase连接
启动应用后，检查终端输出是否包含：
```
SUPABASE_URL: Set
SUPABASE_ANON_KEY: Set
Server ready on port 3001
```

### 检查前端服务
前端启动成功会显示：
```
➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

## ❓ 常见问题

### Q: Supabase连接失败
**A**: 检查 `.env` 文件中的URL和密钥是否正确，确保没有多余的空格或引号。

### Q: AI提供商测试连接失败
**A**: 
- 确认API密钥格式正确
- 检查网络连接
- 验证API密钥是否有效且有足够余额

### Q: 端口被占用
**A**: 
```bash
# 查看端口占用
netstat -ano | findstr :3001
netstat -ano | findstr :5173

# 或修改端口配置
# 前端: vite.config.ts 中修改 server.port
# 后端: api/server.ts 中修改 PORT
```

### Q: 数据库迁移失败
**A**: 确保按顺序执行所有SQL文件，如果出错可以删除表后重新执行。

## 项目结构

```
├── api/                    # 后端 Express.js API
│   ├── routes/            # API 路由处理器
│   ├── services/          # AI 服务适配器和管理器
│   └── app.ts            # Express 应用配置
├── src/                   # 前端 React 应用
│   ├── components/       # 可复用 React 组件
│   ├── pages/           # 页面组件
│   ├── hooks/           # 自定义 React hooks
│   └── lib/            # 工具函数
├── supabase/             # 数据库迁移和架构
└── public/              # 静态资源
```

## API 端点

### 聊天端点
- `GET /api/chat/conversations` - 获取用户对话
- `POST /api/chat` - 发送消息并获取AI回复
- `GET /api/chat/:conversationId/messages` - 获取对话消息

### 提供商端点
- `GET /api/providers` - 获取可用的AI提供商及其配置
- `GET /api/providers/supported` - 获取支持的AI提供商列表

## 🤖 支持的AI提供商

| 提供商 | 最新模型 | 配置要求 | 获取方式 |
|--------|----------|----------|----------|
| **OpenAI** | GPT-4o, GPT-4o-mini, GPT-4-turbo, GPT-3.5-turbo | API Key | [获取API密钥](https://platform.openai.com/api-keys) |
| **Google Gemini** | Gemini-2.5-Pro, Gemini-2.5-Flash, Gemini-2.0-Flash | API Key | [获取API密钥](https://aistudio.google.com/app/apikey) |
| **Anthropic Claude** | Claude-3.5-Sonnet, Claude-3-Opus, Claude-3.5-Haiku | API Key | [获取API密钥](https://console.anthropic.com/) |
| **xAI Grok** | Grok-4, Grok-3, Grok-2-1212, Grok-2-Vision | API Key | [获取API密钥](https://console.x.ai/) |
| **阿里云通义千问** | Qwen-Max, Qwen-Plus, Qwen-Turbo, Qwen2.5-Coder | API Key | [获取API密钥](https://dashscope.console.aliyun.com/) |
| **Ollama** | Llama3.3, Llama3.2, Qwen2.5, Mistral-Nemo, Phi4 | 本地安装 | [下载Ollama](https://ollama.ai/) |

### 💰 费用说明
- **OpenAI**: 按使用量付费，GPT-4o约$0.005/1K tokens
- **Google Gemini**: 有免费额度，超出后按使用量付费
- **Anthropic Claude**: 按使用量付费，Claude-3.5-Sonnet约$0.003/1K tokens
- **xAI Grok**: 按使用量付费
- **通义千问**: 有免费额度，超出后按使用量付费
- **Ollama**: 完全免费，本地运行

### 🚀 推荐配置
- **新手用户**: 建议从Google Gemini开始（有免费额度）
- **高级用户**: OpenAI GPT-4o或Claude-3.5-Sonnet（性能最佳）
- **本地部署**: Ollama + Llama3.3（完全离线，隐私保护）

## 贡献

1. Fork 本仓库
2. 创建功能分支
3. 提交你的更改
4. 如适用，添加测试
5. 提交 Pull Request

## 许可证

本项目采用 MIT 许可证。