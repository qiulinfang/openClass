# aiGeneralChatStore.ts PRD 文档（React Native）

## 📋 概述

**文件路径**：`src/stores/aiGeneralChatStore.ts`  
**文件类型**：`TypeScript Store (Zustand)`  
**主要职责**：管理 AI 通用场景下的聊天消息和会话（React Native 版本）

## 🎯 功能需求

### 1. 核心功能

#### 1.1 会话管理
- **多会话管理**：
  - 支持创建、删除、切换会话
  - 每个会话有独立的会话ID和标题
  - 会话列表持久化存储
- **当前会话管理**：
  - 跟踪当前活动的会话
  - 切换会话时自动加载历史消息
- **会话标题生成**：
  - 在第3轮对话后自动生成会话标题
  - 异步生成，不阻塞主流程

#### 1.2 消息管理
- **消息列表管理**：
  - 维护当前会话的消息列表
  - 支持添加、更新、删除消息
  - 消息按时间顺序排列
- **消息类型支持**：
  - 文本消息
  - 图片消息（支持 base64）
  - 语音消息
  - 流式消息（实时更新）

#### 1.3 发送消息
- **发送流程**：
  1. 如果没有当前会话，创建新会话
  2. 创建用户消息（可选）
  3. 创建临时 AI 回复消息
  4. 构建 AI 请求
  5. 发送请求
  6. 更新消息（支持流式更新）
  7. 保存聊天历史
- **流式响应支持**：
  - 实时接收 AI 回复片段
  - 更新临时消息内容
  - 完成后标记为完成状态

#### 1.4 消息重试
- **重试机制**：
  - 支持重试失败的消息（最多3次）
  - 保留原始消息内容用于重试
  - 重试时更新消息状态
- **重试条件**：
  - `canRetry` 为 true
  - 存在 `originalMessage`
  - 重试次数未超过最大限制

#### 1.5 聊天历史持久化
- **存储位置**：使用 `AsyncStorage` 持久化存储
- **存储内容**：
  - 会话列表
  - 消息列表（按会话分组）
  - 会话元数据（标题、创建时间等）
- **加载机制**：
  - 启动时自动加载会话列表
  - 切换会话时加载对应消息历史

### 2. 功能边界

#### 2.1 负责的功能
- ✅ AI 通用聊天场景的状态管理
- ✅ 消息发送和接收
- ✅ 会话管理（创建、删除、切换）
- ✅ 聊天历史持久化
- ✅ 消息重试逻辑
- ✅ 流式响应处理

#### 2.2 不负责的功能
- ❌ API 请求封装（由 `apiService` 负责）
- ❌ UI 渲染（由 `ChatScreen` 组件负责）
- ❌ 消息内容渲染（由 `ChatMessage` 组件负责）
- ❌ 图片选择（由原生模块负责）
- ❌ 语音录制（由原生模块负责）

### 3. 输入输出

#### 3.1 输入参数
- `sendMessage(content, userInfo, subject, selectedModel, skipUserMessage?)`
- `retryMessage(messageId, userInfo, subject, selectedModel)`
- `createSession(initialMessage)`
- `switchSession(sessionId)`
- `deleteSession(sessionId)`

#### 3.2 输出/状态
- `messages`: `ChatBubble[]` - 当前会话消息列表
- `sessions`: `AiGeneralSession[]` - 会话列表
- `currentSession`: `AiGeneralSession | null` - 当前会话
- `isChatLoading`: `boolean` - 聊天加载状态
- `enableWebSearch`: `boolean` - Web搜索开关

## 🔧 技术实现

### 1. 依赖关系

#### 1.1 导入依赖
```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { apiService } from '../services/apiService'
import { StorageService } from '../services/storageService'
import type { ChatBubble, UserInfo, AiGeneralSession } from '../types'
import { buildAiGeneralMessage } from './utils/aiMessageBuilder'
```

#### 1.2 被依赖
- `ChatScreen.tsx`：使用 Store 进行状态管理和消息发送
- `ChatMessage.tsx`：读取消息列表进行渲染

### 2. 关键代码逻辑

#### 2.1 Store 结构

```typescript
interface AiGeneralChatState {
  // 状态定义
  messages: ChatBubble[]
  sessions: AiGeneralSession[]
  currentSession: AiGeneralSession | null
  isChatLoading: boolean
  enableWebSearch: boolean
  isCreatingSession: boolean
  pendingImage: ChatImageData | null
  
  // 方法定义
  sendMessage: (
    content: string,
    userInfo: UserInfo | null,
    subject: 'MATH' | 'BIOLOGY',
    selectedModel?: string,
    skipUserMessage?: boolean
  ) => Promise<void>
  
  retryMessage: (
    messageId: string,
    userInfo: UserInfo | null,
    subject: 'MATH' | 'BIOLOGY',
    selectedModel?: string
  ) => Promise<void>
  
  createSession: (initialMessage?: string) => Promise<void>
  switchSession: (sessionId: string) => Promise<void>
  deleteSession: (sessionId: string) => Promise<void>
  loadSessions: () => Promise<void>
  saveChatHistory: () => Promise<void>
  loadChatHistory: (sessionId: string) => Promise<void>
  
  // 计算属性（通过 getter 实现）
  getCurrentMessageCount: () => number
  hasSessions: () => boolean
}
```

#### 2.2 发送消息逻辑

```typescript
sendMessage: async (content, userInfo, subject, selectedModel, skipUserMessage) => {
  // 第1步：如果没有当前会话，创建新会话
  if (!get().currentSession) {
    await get().createSession(content)
  }
  
  // 第2步：创建用户消息（可选）
  if (!skipUserMessage) {
    const userMessage = createUserMessage(content)
    set({ messages: [...get().messages, userMessage] })
  }
  
  // 第3步：创建临时AI回复
  const tempReplyId = (Date.now() + 1).toString()
  const tempReply: ChatBubble = {
    id: tempReplyId,
    content: '',
    type: 'ai',
    timestamp: new Date().toISOString(),
    sender: 'ai',
    isStreaming: true
  }
  set({ messages: [...get().messages, tempReply] })
  
  // 第4步：构建AI请求
  const aiRequest = buildAiGeneralMessage(
    content,
    userInfo,
    get().enableWebSearch,
    selectedModel || 'mate'
  )
  
  try {
    // 第5步：发送请求（支持流式响应）
    await apiService.sendChatMessage(
      aiRequest,
      (chunk: string, isComplete: boolean) => {
        // 流式更新消息
        const messages = get().messages
        const index = messages.findIndex(m => m.id === tempReplyId)
        if (index >= 0) {
          const updatedMessages = [...messages]
          updatedMessages[index] = {
            ...updatedMessages[index],
            content: updatedMessages[index].content + chunk,
            isStreaming: !isComplete
          }
          set({ messages: updatedMessages })
        }
      },
      (response: any) => {
        // 完成回调
        const messages = get().messages
        const index = messages.findIndex(m => m.id === tempReplyId)
        if (index >= 0) {
          const updatedMessages = [...messages]
          updatedMessages[index] = {
            ...updatedMessages[index],
            content: response.reply || '回复失败',
            isStreaming: false,
            messageId: response.messageId
          }
          set({ messages: updatedMessages })
        }
        
        // 保存聊天历史
        get().saveChatHistory()
        
        // 检查是否需要自动生成标题
        if (get().currentSession && get().messages.length === 7) {
          generateSessionTitle(
            get().currentSession.sessionId,
            userInfo,
            subject
          ).catch(error => {
            console.warn('[AI_GENERAL] ⚠️ 自动生成标题失败:', error)
          })
        }
      }
    )
  } catch (error) {
    // 错误处理
    const messages = get().messages
    const index = messages.findIndex(m => m.id === tempReplyId)
    if (index >= 0) {
      const updatedMessages = [...messages]
      updatedMessages[index] = {
        ...messages[index],
        content: '发送失败，请重试',
        isStreaming: false,
        isError: true,
        canRetry: true,
        originalMessage: content
      }
      set({ messages: updatedMessages })
    }
    throw error
  }
}
```

#### 2.3 会话管理逻辑

```typescript
createSession: async (initialMessage?: string) => {
  const sessionId = `ai_general_${Date.now()}`
  const newSession: AiGeneralSession = {
    sessionId,
    sessionName: initialMessage?.substring(0, 20) || '新会话',
    createTime: Date.now(),
    updateTime: Date.now()
  }
  
  set({
    currentSession: newSession,
    sessions: [...get().sessions, newSession],
    messages: []
  })
  
  // 保存会话列表
  await StorageService.saveSessions('ai_general', get().sessions)
}

switchSession: async (sessionId: string) => {
  const session = get().sessions.find(s => s.sessionId === sessionId)
  if (!session) {
    throw new Error('会话不存在')
  }
  
  set({ currentSession: session })
  await get().loadChatHistory(sessionId)
}
```

### 3. 数据流

- **发送消息流程**：`ChatScreen` → `Store.sendMessage` → `apiService` → 流式回调 → `Store.updateMessage` → `ChatScreen` 重新渲染
- **加载历史流程**：`ChatScreen` 挂载 → `Store.loadSessions` → `StorageService` → `Store` 更新状态 → `ChatScreen` 渲染

## 🔄 迁移到 React Native

### 1. 等价实现

#### 1.1 状态管理
- **当前实现**：Pinia (Vue) + `ref` / `computed`
- **React Native 实现**：Zustand + `create` / `useStore`

#### 1.2 核心差异
- Vue 的响应式系统 → Zustand 的订阅机制
- `ref()` / `computed()` → `useStore()` Hook
- Pinia Store → Zustand Store

### 2. 需要的第三方库

```json
{
  "zustand": "^4.4.0",
  "@react-native-async-storage/async-storage": "^1.19.0"
}
```

### 3. 迁移步骤

1. **创建 Zustand Store 结构**
   - 定义 State 接口
   - 使用 `create` 创建 Store
   - 使用 `persist` 中间件实现持久化

2. **迁移状态定义**
   - 将 Vue `ref` 转换为 Zustand State
   - 将 Vue `computed` 转换为 Zustand getter 方法

3. **迁移方法实现**
   - 将 Vue 方法转换为 Zustand actions
   - 使用 `set` / `get` 更新状态

4. **迁移持久化逻辑**
   - 将 `localforage` 替换为 `@react-native-async-storage/async-storage`
   - 使用 Zustand `persist` 中间件

5. **迁移流式响应处理**
   - 将 Vue 的响应式更新转换为 Zustand `set` 调用
   - 在回调中更新消息状态

### 4. 注意事项

#### 4.1 状态更新
- React Native 中使用 `set()` 批量更新状态，避免频繁更新
- 使用不可变更新模式：`set({ messages: [...messages, newMessage] })`

#### 4.2 持久化
- 使用 `persist` 中间件自动处理持久化
- 注意序列化/反序列化的性能

#### 4.3 流式响应
- 在流式回调中使用 `get()` 获取最新状态
- 避免在回调中直接修改状态，使用 `set()` 更新

#### 4.4 异步处理
- 所有异步操作使用 `async/await`
- 错误处理使用 `try/catch`

## 📝 迁移代码示例

### Vue (Pinia) 实现

```typescript
export const useAiGeneralChatStore = defineStore('aiGeneralChat', () => {
  const messages = ref<ChatBubble[]>([])
  const currentSession = ref<AiGeneralSession | null>(null)
  
  const sendMessage = async (content: string) => {
    const userMessage = createUserMessage(content)
    messages.value.push(userMessage)
    // ...
  }
  
  return { messages, currentSession, sendMessage }
})
```

### React Native (Zustand) 实现

```typescript
interface AiGeneralChatState {
  messages: ChatBubble[]
  currentSession: AiGeneralSession | null
  sendMessage: (content: string) => Promise<void>
}

export const useAiGeneralChatStore = create<AiGeneralChatState>()(
  persist(
    (set, get) => ({
      messages: [],
      currentSession: null,
      
      sendMessage: async (content: string) => {
        const userMessage = createUserMessage(content)
        set({ messages: [...get().messages, userMessage] })
        // ...
      }
    }),
    {
      name: 'ai-general-chat-storage',
      storage: createAsyncStorage(),
    }
  )
)
```

## ⚠️ 迁移风险

### 高风险项

1. **流式响应处理**：
   - **风险**：React Native 的流式响应可能与 Web 端行为不同
   - **解决方案**：使用 `apiService` 的统一接口，在回调中更新状态
   - **影响**：可能需要调整流式更新的频率和方式

2. **持久化存储**：
   - **风险**：`AsyncStorage` 的存储限制和性能可能不如 `localforage`
   - **解决方案**：使用 Zustand `persist` 中间件，配置合理的序列化策略
   - **影响**：大容量数据可能需要分批存储

### 中风险项

1. **状态更新性能**：
   - **风险**：频繁的状态更新可能影响性能
   - **解决方案**：使用批量更新，避免在流式回调中频繁 `set`
   - **影响**：可能需要优化更新策略

2. **会话列表管理**：
   - **风险**：大量会话可能影响加载性能
   - **解决方案**：实现分页加载，限制会话数量
   - **影响**：可能需要添加会话数量限制

## 🧪 测试要点

### 功能测试

1. **消息发送测试**：
   - ✅ 发送文本消息
   - ✅ 发送带图片的消息
   - ✅ 流式响应正确更新
   - ✅ 消息发送失败时显示错误状态

2. **会话管理测试**：
   - ✅ 创建新会话
   - ✅ 切换会话
   - ✅ 删除会话
   - ✅ 会话列表持久化

3. **消息重试测试**：
   - ✅ 重试失败的消息
   - ✅ 重试次数限制
   - ✅ 重试后消息正确更新

4. **持久化测试**：
   - ✅ 消息历史正确保存
   - ✅ 重启应用后消息历史正确加载
   - ✅ 会话列表正确保存和加载

### 边界测试

1. **空数据测试**：
   - 无会话时的处理
   - 无消息时的处理
   - 空消息内容的处理

2. **异常情况测试**：
   - 网络错误时的处理
   - 存储失败时的处理
   - 会话不存在时的处理

3. **性能测试**：
   - 大量消息时的性能
   - 流式响应时的性能
   - 会话切换时的性能

## 📚 参考资源

### 相关文档
- [Zustand 官方文档](https://zustand-demo.pmnd.rs/)
- [React Native AsyncStorage 文档](https://react-native-async-storage.github.io/async-storage/)
- [React Native 状态管理最佳实践](https://reactnative.dev/docs/state)

### 相关文件
- `src/stores/questionStore.ts` - 参考 Zustand Store 实现
- `src/services/apiService.ts` - API 服务
- `src/services/storageService.ts` - 存储服务
- `src/types/chat.ts` - 聊天类型定义

### 相关组件
- `src/screens/ChatScreen.tsx` - 使用 Store 的组件
- `src/components/chat/ChatMessage.tsx` - 消息渲染组件

---

**文档版本**：v1.0  
**创建日期**：2025-01-03  
**维护者**：开发团队

## 📋 概述

**文件路径**：`src/stores/aiGeneralChatStore.ts`  
**文件类型**：`TypeScript Store (Zustand)`  
**主要职责**：管理 AI 通用场景下的聊天消息和会话（React Native 版本）

## 🎯 功能需求

### 1. 核心功能

#### 1.1 会话管理
- **多会话管理**：
  - 支持创建、删除、切换会话
  - 每个会话有独立的会话ID和标题
  - 会话列表持久化存储
- **当前会话管理**：
  - 跟踪当前活动的会话
  - 切换会话时自动加载历史消息
- **会话标题生成**：
  - 在第3轮对话后自动生成会话标题
  - 异步生成，不阻塞主流程

#### 1.2 消息管理
- **消息列表管理**：
  - 维护当前会话的消息列表
  - 支持添加、更新、删除消息
  - 消息按时间顺序排列
- **消息类型支持**：
  - 文本消息
  - 图片消息（支持 base64）
  - 语音消息
  - 流式消息（实时更新）

#### 1.3 发送消息
- **发送流程**：
  1. 如果没有当前会话，创建新会话
  2. 创建用户消息（可选）
  3. 创建临时 AI 回复消息
  4. 构建 AI 请求
  5. 发送请求
  6. 更新消息（支持流式更新）
  7. 保存聊天历史
- **流式响应支持**：
  - 实时接收 AI 回复片段
  - 更新临时消息内容
  - 完成后标记为完成状态

#### 1.4 消息重试
- **重试机制**：
  - 支持重试失败的消息（最多3次）
  - 保留原始消息内容用于重试
  - 重试时更新消息状态
- **重试条件**：
  - `canRetry` 为 true
  - 存在 `originalMessage`
  - 重试次数未超过最大限制

#### 1.5 聊天历史持久化
- **存储位置**：使用 `AsyncStorage` 持久化存储
- **存储内容**：
  - 会话列表
  - 消息列表（按会话分组）
  - 会话元数据（标题、创建时间等）
- **加载机制**：
  - 启动时自动加载会话列表
  - 切换会话时加载对应消息历史

### 2. 功能边界

#### 2.1 负责的功能
- ✅ AI 通用聊天场景的状态管理
- ✅ 消息发送和接收
- ✅ 会话管理（创建、删除、切换）
- ✅ 聊天历史持久化
- ✅ 消息重试逻辑
- ✅ 流式响应处理

#### 2.2 不负责的功能
- ❌ API 请求封装（由 `apiService` 负责）
- ❌ UI 渲染（由 `ChatScreen` 组件负责）
- ❌ 消息内容渲染（由 `ChatMessage` 组件负责）
- ❌ 图片选择（由原生模块负责）
- ❌ 语音录制（由原生模块负责）

### 3. 输入输出

#### 3.1 输入参数
- `sendMessage(content, userInfo, subject, selectedModel, skipUserMessage?)`
- `retryMessage(messageId, userInfo, subject, selectedModel)`
- `createSession(initialMessage)`
- `switchSession(sessionId)`
- `deleteSession(sessionId)`

#### 3.2 输出/状态
- `messages`: `ChatBubble[]` - 当前会话消息列表
- `sessions`: `AiGeneralSession[]` - 会话列表
- `currentSession`: `AiGeneralSession | null` - 当前会话
- `isChatLoading`: `boolean` - 聊天加载状态
- `enableWebSearch`: `boolean` - Web搜索开关

## 🔧 技术实现

### 1. 依赖关系

#### 1.1 导入依赖
```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { apiService } from '../services/apiService'
import { StorageService } from '../services/storageService'
import type { ChatBubble, UserInfo, AiGeneralSession } from '../types'
import { buildAiGeneralMessage } from './utils/aiMessageBuilder'
```

#### 1.2 被依赖
- `ChatScreen.tsx`：使用 Store 进行状态管理和消息发送
- `ChatMessage.tsx`：读取消息列表进行渲染

### 2. 关键代码逻辑

#### 2.1 Store 结构

```typescript
interface AiGeneralChatState {
  // 状态定义
  messages: ChatBubble[]
  sessions: AiGeneralSession[]
  currentSession: AiGeneralSession | null
  isChatLoading: boolean
  enableWebSearch: boolean
  isCreatingSession: boolean
  pendingImage: ChatImageData | null
  
  // 方法定义
  sendMessage: (
    content: string,
    userInfo: UserInfo | null,
    subject: 'MATH' | 'BIOLOGY',
    selectedModel?: string,
    skipUserMessage?: boolean
  ) => Promise<void>
  
  retryMessage: (
    messageId: string,
    userInfo: UserInfo | null,
    subject: 'MATH' | 'BIOLOGY',
    selectedModel?: string
  ) => Promise<void>
  
  createSession: (initialMessage?: string) => Promise<void>
  switchSession: (sessionId: string) => Promise<void>
  deleteSession: (sessionId: string) => Promise<void>
  loadSessions: () => Promise<void>
  saveChatHistory: () => Promise<void>
  loadChatHistory: (sessionId: string) => Promise<void>
  
  // 计算属性（通过 getter 实现）
  getCurrentMessageCount: () => number
  hasSessions: () => boolean
}
```

#### 2.2 发送消息逻辑

```typescript
sendMessage: async (content, userInfo, subject, selectedModel, skipUserMessage) => {
  // 第1步：如果没有当前会话，创建新会话
  if (!get().currentSession) {
    await get().createSession(content)
  }
  
  // 第2步：创建用户消息（可选）
  if (!skipUserMessage) {
    const userMessage = createUserMessage(content)
    set({ messages: [...get().messages, userMessage] })
  }
  
  // 第3步：创建临时AI回复
  const tempReplyId = (Date.now() + 1).toString()
  const tempReply: ChatBubble = {
    id: tempReplyId,
    content: '',
    type: 'ai',
    timestamp: new Date().toISOString(),
    sender: 'ai',
    isStreaming: true
  }
  set({ messages: [...get().messages, tempReply] })
  
  // 第4步：构建AI请求
  const aiRequest = buildAiGeneralMessage(
    content,
    userInfo,
    get().enableWebSearch,
    selectedModel || 'mate'
  )
  
  try {
    // 第5步：发送请求（支持流式响应）
    await apiService.sendChatMessage(
      aiRequest,
      (chunk: string, isComplete: boolean) => {
        // 流式更新消息
        const messages = get().messages
        const index = messages.findIndex(m => m.id === tempReplyId)
        if (index >= 0) {
          const updatedMessages = [...messages]
          updatedMessages[index] = {
            ...updatedMessages[index],
            content: updatedMessages[index].content + chunk,
            isStreaming: !isComplete
          }
          set({ messages: updatedMessages })
        }
      },
      (response: any) => {
        // 完成回调
        const messages = get().messages
        const index = messages.findIndex(m => m.id === tempReplyId)
        if (index >= 0) {
          const updatedMessages = [...messages]
          updatedMessages[index] = {
            ...updatedMessages[index],
            content: response.reply || '回复失败',
            isStreaming: false,
            messageId: response.messageId
          }
          set({ messages: updatedMessages })
        }
        
        // 保存聊天历史
        get().saveChatHistory()
        
        // 检查是否需要自动生成标题
        if (get().currentSession && get().messages.length === 7) {
          generateSessionTitle(
            get().currentSession.sessionId,
            userInfo,
            subject
          ).catch(error => {
            console.warn('[AI_GENERAL] ⚠️ 自动生成标题失败:', error)
          })
        }
      }
    )
  } catch (error) {
    // 错误处理
    const messages = get().messages
    const index = messages.findIndex(m => m.id === tempReplyId)
    if (index >= 0) {
      const updatedMessages = [...messages]
      updatedMessages[index] = {
        ...messages[index],
        content: '发送失败，请重试',
        isStreaming: false,
        isError: true,
        canRetry: true,
        originalMessage: content
      }
      set({ messages: updatedMessages })
    }
    throw error
  }
}
```

#### 2.3 会话管理逻辑

```typescript
createSession: async (initialMessage?: string) => {
  const sessionId = `ai_general_${Date.now()}`
  const newSession: AiGeneralSession = {
    sessionId,
    sessionName: initialMessage?.substring(0, 20) || '新会话',
    createTime: Date.now(),
    updateTime: Date.now()
  }
  
  set({
    currentSession: newSession,
    sessions: [...get().sessions, newSession],
    messages: []
  })
  
  // 保存会话列表
  await StorageService.saveSessions('ai_general', get().sessions)
}

switchSession: async (sessionId: string) => {
  const session = get().sessions.find(s => s.sessionId === sessionId)
  if (!session) {
    throw new Error('会话不存在')
  }
  
  set({ currentSession: session })
  await get().loadChatHistory(sessionId)
}
```

### 3. 数据流

- **发送消息流程**：`ChatScreen` → `Store.sendMessage` → `apiService` → 流式回调 → `Store.updateMessage` → `ChatScreen` 重新渲染
- **加载历史流程**：`ChatScreen` 挂载 → `Store.loadSessions` → `StorageService` → `Store` 更新状态 → `ChatScreen` 渲染

## 🔄 迁移到 React Native

### 1. 等价实现

#### 1.1 状态管理
- **当前实现**：Pinia (Vue) + `ref` / `computed`
- **React Native 实现**：Zustand + `create` / `useStore`

#### 1.2 核心差异
- Vue 的响应式系统 → Zustand 的订阅机制
- `ref()` / `computed()` → `useStore()` Hook
- Pinia Store → Zustand Store

### 2. 需要的第三方库

```json
{
  "zustand": "^4.4.0",
  "@react-native-async-storage/async-storage": "^1.19.0"
}
```

### 3. 迁移步骤

1. **创建 Zustand Store 结构**
   - 定义 State 接口
   - 使用 `create` 创建 Store
   - 使用 `persist` 中间件实现持久化

2. **迁移状态定义**
   - 将 Vue `ref` 转换为 Zustand State
   - 将 Vue `computed` 转换为 Zustand getter 方法

3. **迁移方法实现**
   - 将 Vue 方法转换为 Zustand actions
   - 使用 `set` / `get` 更新状态

4. **迁移持久化逻辑**
   - 将 `localforage` 替换为 `@react-native-async-storage/async-storage`
   - 使用 Zustand `persist` 中间件

5. **迁移流式响应处理**
   - 将 Vue 的响应式更新转换为 Zustand `set` 调用
   - 在回调中更新消息状态

### 4. 注意事项

#### 4.1 状态更新
- React Native 中使用 `set()` 批量更新状态，避免频繁更新
- 使用不可变更新模式：`set({ messages: [...messages, newMessage] })`

#### 4.2 持久化
- 使用 `persist` 中间件自动处理持久化
- 注意序列化/反序列化的性能

#### 4.3 流式响应
- 在流式回调中使用 `get()` 获取最新状态
- 避免在回调中直接修改状态，使用 `set()` 更新

#### 4.4 异步处理
- 所有异步操作使用 `async/await`
- 错误处理使用 `try/catch`

## 📝 迁移代码示例

### Vue (Pinia) 实现

```typescript
export const useAiGeneralChatStore = defineStore('aiGeneralChat', () => {
  const messages = ref<ChatBubble[]>([])
  const currentSession = ref<AiGeneralSession | null>(null)
  
  const sendMessage = async (content: string) => {
    const userMessage = createUserMessage(content)
    messages.value.push(userMessage)
    // ...
  }
  
  return { messages, currentSession, sendMessage }
})
```

### React Native (Zustand) 实现

```typescript
interface AiGeneralChatState {
  messages: ChatBubble[]
  currentSession: AiGeneralSession | null
  sendMessage: (content: string) => Promise<void>
}

export const useAiGeneralChatStore = create<AiGeneralChatState>()(
  persist(
    (set, get) => ({
      messages: [],
      currentSession: null,
      
      sendMessage: async (content: string) => {
        const userMessage = createUserMessage(content)
        set({ messages: [...get().messages, userMessage] })
        // ...
      }
    }),
    {
      name: 'ai-general-chat-storage',
      storage: createAsyncStorage(),
    }
  )
)
```

## ⚠️ 迁移风险

### 高风险项

1. **流式响应处理**：
   - **风险**：React Native 的流式响应可能与 Web 端行为不同
   - **解决方案**：使用 `apiService` 的统一接口，在回调中更新状态
   - **影响**：可能需要调整流式更新的频率和方式

2. **持久化存储**：
   - **风险**：`AsyncStorage` 的存储限制和性能可能不如 `localforage`
   - **解决方案**：使用 Zustand `persist` 中间件，配置合理的序列化策略
   - **影响**：大容量数据可能需要分批存储

### 中风险项

1. **状态更新性能**：
   - **风险**：频繁的状态更新可能影响性能
   - **解决方案**：使用批量更新，避免在流式回调中频繁 `set`
   - **影响**：可能需要优化更新策略

2. **会话列表管理**：
   - **风险**：大量会话可能影响加载性能
   - **解决方案**：实现分页加载，限制会话数量
   - **影响**：可能需要添加会话数量限制

## 🧪 测试要点

### 功能测试

1. **消息发送测试**：
   - ✅ 发送文本消息
   - ✅ 发送带图片的消息
   - ✅ 流式响应正确更新
   - ✅ 消息发送失败时显示错误状态

2. **会话管理测试**：
   - ✅ 创建新会话
   - ✅ 切换会话
   - ✅ 删除会话
   - ✅ 会话列表持久化

3. **消息重试测试**：
   - ✅ 重试失败的消息
   - ✅ 重试次数限制
   - ✅ 重试后消息正确更新

4. **持久化测试**：
   - ✅ 消息历史正确保存
   - ✅ 重启应用后消息历史正确加载
   - ✅ 会话列表正确保存和加载

### 边界测试

1. **空数据测试**：
   - 无会话时的处理
   - 无消息时的处理
   - 空消息内容的处理

2. **异常情况测试**：
   - 网络错误时的处理
   - 存储失败时的处理
   - 会话不存在时的处理

3. **性能测试**：
   - 大量消息时的性能
   - 流式响应时的性能
   - 会话切换时的性能

## 📚 参考资源

### 相关文档
- [Zustand 官方文档](https://zustand-demo.pmnd.rs/)
- [React Native AsyncStorage 文档](https://react-native-async-storage.github.io/async-storage/)
- [React Native 状态管理最佳实践](https://reactnative.dev/docs/state)

### 相关文件
- `src/stores/questionStore.ts` - 参考 Zustand Store 实现
- `src/services/apiService.ts` - API 服务
- `src/services/storageService.ts` - 存储服务
- `src/types/chat.ts` - 聊天类型定义

### 相关组件
- `src/screens/ChatScreen.tsx` - 使用 Store 的组件
- `src/components/chat/ChatMessage.tsx` - 消息渲染组件

---

**文档版本**：v1.0  
**创建日期**：2025-01-03  
**维护者**：开发团队
