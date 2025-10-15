# API请求架构分析

## 整体架构概览

整个API请求架构采用分层设计，从底层到顶层分为以下几个层次：

```
┌─────────────────────────────────────────────────────────────┐
│                    Vue组件层 (Views)                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │ LoginView   │ │ Knowledge   │ │ Exercise    │   ...    │
│  │             │ │ GraphView   │ │ SolveView   │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   业务服务层 (ApiService)                   │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ • 用户认证 (login, loginStudent)                        │ │
│  │ • AI聊天 (sendAiChatMessage, streamAiChat)              │ │
│  │ • 题目管理 (addExercise, deleteExercise)               │ │
│  │ • 教材管理 (getTextbookVersions, getChapterStructure)   │ │
│  │ • 反馈系统 (createFeedbackTicket)                       │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   HTTP客户端层 (HttpClient)                 │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ • 统一请求处理 (request method)                          │ │
│  │ • 全局认证配置 (setGlobalAuthConfig)                    │ │
│  │ • 重试机制 (3次重试)                                    │ │
│  │ • 超时控制 (5秒超时)                                    │ │
│  │ • 错误处理                                             │ │
│  │ • 流式请求支持 (streamRequest)                         │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   配置管理层 (Config)                       │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ • API端点配置 (api-endpoints.ts)                       │ │
│  │ • 认证配置管理 (config-utils.ts)                       │ │
│  │ • Android Bridge集成 (android-bridge.ts)              │ │
│  │ • Vite代理配置 (vite.config.ts)                        │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   网络层 (Network)                          │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ • Vite开发代理 (开发环境)                               │ │
│  │ • 直接HTTP请求 (生产环境)                               │ │
│  │ • Android WebView (移动端)                             │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 核心组件详解

### 1. HTTP客户端层 (HttpClient)

**文件位置**: `src/services/http-client.ts`

**核心功能**:
- **统一请求处理**: 提供 `get`, `post`, `put`, `delete` 等HTTP方法
- **全局认证管理**: 支持多种认证方式（Cookie、SA-Token、Authorization、Token等）
- **重试机制**: 自动重试失败请求，最多3次
- **超时控制**: 默认5秒超时，可配置
- **流式请求**: 支持AI聊天的流式响应
- **错误处理**: 统一的错误处理和响应格式

**关键方法**:
```typescript
// 设置全局认证配置
setGlobalAuthConfig(config: AuthConfig): void

// 通用请求方法
private async request<T>(url: string, config: RequestConfig): Promise<ApiResponse<T>>

// 流式请求（AI聊天）
async streamRequest(url: string, body: any, onChunk: Function): Promise<void>
```

### 2. 业务服务层 (ApiService)

**文件位置**: `src/services/api-service.ts`

**核心功能**:
- **用户认证**: 管理员登录、学生登录
- **AI聊天**: 文本聊天、图片识别、语音处理
- **题目管理**: 添加、删除、查询题目
- **教材管理**: 教材版本、章节结构、学习包
- **反馈系统**: 工单创建和管理

**关键业务方法**:
```typescript
// 用户认证
async login(account: string, password: string): Promise<string>
async loginStudent(account: string, password: string): Promise<LoginResponse>

// AI聊天
async sendAiChatMessage(request: AiChatMessageRequest): Promise<any>
async streamAiChat(request: AiChatMessageRequest, onChunk: Function): Promise<void>

// 题目管理
async addExercise(exercise: any): Promise<boolean>
async deleteExercise(exerciseId: string, subject: string): Promise<boolean>

// 教材管理
async getTextbookVersions(): Promise<TextbookVersion[]>
async getChapterStructure(textbookId: string): Promise<ChapterNode[]>
```

### 3. 配置管理层

#### API端点配置 (`api-endpoints.ts`)
```typescript
export const API_ENDPOINTS = {
  // 用户相关
  USER: {
    LOGIN: '/admin/login',
    INFO: '/admin/info',
  },
  
  // AI聊天相关
  CHAT: {
    BIOLOGY: '/permission/chat',
    MATH: '/permission/chatMath',
  },
  
  // 学习资源管理
  LEARNING_RESOURCE: {
    LOGIN_STUDENT: '/blw-edu-yb/auth/login-student',
    TEXTBOOK: {
      VERSIONS: '/blw-edu-yb/api/app/teacher-textbook',
      STRUCTURE: '/blw-edu-yb/api/app/teacher-textbook-section-tree',
    }
  }
}
```

#### 认证配置管理 (`config-utils.ts`)
```typescript
// 初始化应用配置
export async function initializeAppConfig(initData: unknown): Promise<void>

// 更新全局认证配置
export function updateGlobalAuthConfig(authData: Partial<AuthConfig>): void

// 清除认证配置
export function clearGlobalAuthConfig(): void
```

#### Android Bridge集成 (`android-bridge.ts`)
- **原生功能**: 相机、录音、语音播放、图片处理
- **老师对话**: 通过WebView桥接调用原生RabbitMQ
- **事件监听**: 题目更新、加载状态、科目变化等

### 4. 网络代理配置 (Vite)

**文件位置**: `vite.config.ts`

**代理规则**:
```typescript
server: {
  proxy: {
    // 教材API代理
    '/blw-edu-yb/api': {
      target: 'https://43.138.16.5:50013',
      changeOrigin: true,
      secure: false
    },
    
    // 认证API代理
    '/blw-edu-yb/auth': {
      target: 'https://43.138.16.5:50013',
      changeOrigin: true,
      secure: false
    },
    
    // Zammad工单系统代理
    '/api/v1/tickets': {
      target: 'http://app.imates.com.cn:8080',
      changeOrigin: true,
      secure: false
    },
    
    // 学班服务代理
    '/permission/selectExercises/math': {
      target: 'http://www.imates.com.cn:8222/blw-edu-service-alc',
      changeOrigin: true,
      secure: false
    }
  }
}
```

## 认证机制

### 多层级认证支持
1. **Cookie认证**: 会话管理
2. **SA-Token**: 服务端认证令牌
3. **Authorization**: Bearer Token认证
4. **Token**: 通用令牌认证
5. **Admin Token**: 管理员专用令牌
6. **Student Token**: 学生专用令牌

### 认证流程
```typescript
// 1. 初始化时收集认证信息
const authConfig = {
  cookie: data.cookie,
  saToken: data.saToken,
  authorization: data.authorization,
  token: data.token,
  adminToken: data.adminToken,
  studentToken: data.studentToken
}

// 2. 设置到HTTP客户端
httpClient.setGlobalAuthConfig(authConfig)

// 3. 自动应用到所有请求头
headers: {
  'Cookie': authConfig.cookie,
  'sa-token': authConfig.saToken,
  'Authorization': authConfig.authorization,
  'token': authConfig.token,
  'Token': authConfig.adminToken || authConfig.studentToken
}
```

## 数据流向

### 1. 用户登录流程
```
LoginView → ApiService.login() → HttpClient.post() → 后端API → 返回Token → 存储到localStorage
```

### 2. AI聊天流程
```
ChatView → ApiService.sendAiChatMessage() → HttpClient.post() → 后端AI服务 → 返回响应
```

### 3. 流式聊天流程
```
ChatView → ApiService.streamAiChat() → HttpClient.streamRequest() → 后端AI服务 → 流式响应回调
```

### 4. 题目管理流程
```
ExerciseView → ApiService.addExercise() → HttpClient.post() → 后端API → 返回结果
```

## 错误处理机制

### 1. HTTP客户端层错误处理
- **网络错误**: 自动重试3次
- **超时错误**: 5秒超时控制
- **HTTP状态错误**: 统一错误格式返回

### 2. 业务服务层错误处理
- **API调用失败**: 返回null或false
- **数据解析错误**: 异常捕获和日志记录
- **业务逻辑错误**: 抛出具体错误信息

### 3. 组件层错误处理
- **用户友好提示**: 使用Quasar通知组件
- **错误状态管理**: 响应式错误状态
- **重试机制**: 用户手动重试

## 性能优化

### 1. 请求优化
- **重试机制**: 避免临时网络问题
- **超时控制**: 防止长时间等待
- **请求去重**: 避免重复请求

### 2. 认证优化
- **全局认证配置**: 避免重复设置
- **智能认证**: 只在必要时重新登录
- **会话管理**: 自动维护登录状态

### 3. 开发体验优化
- **Vite代理**: 开发环境CORS问题解决
- **TypeScript支持**: 完整的类型定义
- **统一导出**: 服务层统一入口

## 总结

整个API请求架构具有以下特点：

1. **分层清晰**: 组件层 → 业务层 → 网络层 → 配置层
2. **职责明确**: 每层都有明确的职责分工
3. **扩展性强**: 易于添加新的API接口
4. **错误处理完善**: 多层级错误处理机制
5. **认证灵活**: 支持多种认证方式
6. **开发友好**: 完整的TypeScript支持和开发代理

这种架构设计确保了代码的可维护性、可扩展性和稳定性，同时提供了良好的开发体验。
