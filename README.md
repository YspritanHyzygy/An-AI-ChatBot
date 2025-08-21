# 🤖 AI Chat Application

A modern multi-AI provider chat application built with React, TypeScript, and Node.js. Support conversations with multiple AI models including OpenAI GPT, Google Gemini, Anthropic Claude, and more.

English | [简体中文](README.zh-CN.md)

## ✨ Key Features

- 🔄 **Multiple AI Provider Support**: OpenAI, Google Gemini, Anthropic Claude, xAI Grok, Ollama, and Qwen
- 🔐 **User-Configurable API Keys**: Securely configure personal API keys through web interface
- 💬 **Conversation Management**: Create, save, and manage multiple chat conversations
- ⚡ **Real-time Chat Interface**: Modern responsive chat UI with message history
- 📝 **Markdown Rendering**: Full Markdown format support for AI responses
- 💾 **Persistent Storage**: All conversations and messages stored in Supabase database
- 🛠️ **Flexible Configuration**: Support both user configuration and environment variables
- 🔒 **TypeScript**: Complete type safety for both frontend and backend

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **React Router** for navigation
- **Zustand** for state management

### Backend
- **Node.js** with Express.js and TypeScript
- **Supabase** for database and authentication
- **AI Service Adapters** for multiple AI providers

## 📋 Prerequisites

- **Node.js 18+** and npm
- **Supabase account and project** ([Sign up for free](https://supabase.com))
- **AI Provider API Keys** (can be configured through web interface, no need to prepare in advance)

## 🚀 Quick Start

### Step 1: Clone and Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd gemini-video-webui

# Install dependencies
npm install
```

### Step 2: Configure Supabase Database

#### 2.1 Create Supabase Project
1. Visit [Supabase](https://supabase.com) and sign up for an account
2. Create a new project and note down the project URL and API key
3. Wait for project initialization to complete (about 2-3 minutes)

#### 2.2 Set Up Database
1. In the Supabase console, go to **SQL Editor**
2. Execute the SQL files in the `supabase/migrations/` directory in order:
   - `001_initial_schema.sql`
   - `002_custom_models.sql` 
   - `003_fix_user_id_type.sql`
   - `004_fix_all_user_id_types.sql`
   - `005_fix_conversations_and_messages.sql`

#### 2.3 Configure Environment Variables
```bash
# Copy environment template
cp .env.example .env
```

Edit the `.env` file with your Supabase configuration:
```env
# Supabase Configuration (Required)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# AI Provider API Keys (Optional - Recommended to configure via web interface)
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
CLAUDE_API_KEY=...
XAI_API_KEY=...
QWEN_API_KEY=...
OLLAMA_BASE_URL=http://localhost:11434/v1
```

> 💡 **Tip**: AI provider API keys can be configured later through the web interface, no need to fill them in this step.

### Step 3: Start the Application

#### Option 1: Start Both Frontend and Backend (Recommended)
```bash
npm run dev
```

#### Option 2: Start Separately
```bash
# Terminal 1: Start backend service (port 3001)
npm run server:dev

# Terminal 2: Start frontend service (port 5173)
npm run client:dev
```

### Step 4: Configure AI Providers

1. 🌐 Visit `http://localhost:5173`
2. ⚙️ Click the settings button in the top right corner
3. 🔑 Configure your AI provider API keys
4. ✅ Click "Test Connection" to verify configuration
5. 🎯 Select your default model
6. 💬 Return to chat page and start chatting!

### Step 5: Production Deployment

```bash
# Build frontend
npm run build

# Start production server
npm start
```

## 🔧 Configuration Verification

### Check Supabase Connection
After starting the application, check if the terminal output includes:
```
SUPABASE_URL: Set
SUPABASE_ANON_KEY: Set
Server ready on port 3001
```

### Check Frontend Service
Successful frontend startup will display:
```
➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

## ❓ Troubleshooting

### Q: Supabase connection failed
**A**: Check if the URL and key in the `.env` file are correct, ensure there are no extra spaces or quotes.

### Q: AI provider test connection failed
**A**: 
- Confirm API key format is correct
- Check network connection
- Verify API key is valid and has sufficient balance

### Q: Port already in use
**A**: 
```bash
# Check port usage
netstat -ano | findstr :3001
netstat -ano | findstr :5173

# Or modify port configuration
# Frontend: modify server.port in vite.config.ts
# Backend: modify PORT in api/server.ts
```

### Q: Database migration failed
**A**: Ensure all SQL files are executed in order. If errors occur, you can delete tables and re-execute.

## Project Structure

```
├── api/                    # Backend Express.js API
│   ├── routes/            # API route handlers
│   ├── services/          # AI service adapters and managers
│   └── app.ts            # Express app configuration
├── src/                   # Frontend React application
│   ├── components/       # Reusable React components
│   ├── pages/           # Page components
│   ├── hooks/           # Custom React hooks
│   └── lib/            # Utility functions
├── supabase/             # Database migrations and schema
└── public/              # Static assets
```

## API Endpoints

### Chat Endpoints
- `GET /api/chat/conversations` - Fetch user conversations
- `POST /api/chat` - Send message and get AI response
- `GET /api/chat/:conversationId/messages` - Get conversation messages

### Provider Endpoints
- `GET /api/providers` - Get available AI providers and their configurations
- `GET /api/providers/supported` - Get list of supported AI providers

## 🤖 Supported AI Providers

| Provider | Latest Models | Configuration | How to Get |
|----------|---------------|---------------|------------|
| **OpenAI** | GPT-4o, GPT-4o-mini, GPT-4-turbo, GPT-3.5-turbo | API Key | [Get API Key](https://platform.openai.com/api-keys) |
| **Google Gemini** | Gemini-2.5-Pro, Gemini-2.5-Flash, Gemini-2.0-Flash | API Key | [Get API Key](https://aistudio.google.com/app/apikey) |
| **Anthropic Claude** | Claude-3.5-Sonnet, Claude-3-Opus, Claude-3.5-Haiku | API Key | [Get API Key](https://console.anthropic.com/) |
| **xAI Grok** | Grok-4, Grok-3, Grok-2-1212, Grok-2-Vision | API Key | [Get API Key](https://console.x.ai/) |
| **Alibaba Qwen** | Qwen-Max, Qwen-Plus, Qwen-Turbo, Qwen2.5-Coder | API Key | [Get API Key](https://dashscope.console.aliyun.com/) |
| **Ollama** | Llama3.3, Llama3.2, Qwen2.5, Mistral-Nemo, Phi4 | Local Installation | [Download Ollama](https://ollama.ai/) |

### 💰 Pricing Information
- **OpenAI**: Pay-per-use, GPT-4o ~$0.005/1K tokens
- **Google Gemini**: Free tier available, pay-per-use after limit
- **Anthropic Claude**: Pay-per-use, Claude-3.5-Sonnet ~$0.003/1K tokens
- **xAI Grok**: Pay-per-use
- **Alibaba Qwen**: Free tier available, pay-per-use after limit
- **Ollama**: Completely free, runs locally

### 🚀 Recommended Configuration
- **New Users**: Start with Google Gemini (has free tier)
- **Advanced Users**: OpenAI GPT-4o or Claude-3.5-Sonnet (best performance)
- **Local Deployment**: Ollama + Llama3.3 (completely offline, privacy protection)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.
