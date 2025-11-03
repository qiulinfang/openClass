# aiExerciseChatStore.ts PRD 文档（React Native）

## 📋 概述

**文件路径**：`src/stores/aiExerciseChatStore.ts`  
**文件类型**：`TypeScript Store (Zustand)`  
**主要职责**：管理 AI 题目场景下的聊天消息和业务逻辑（React Native 版本）

**场景特点**：
- 需要选中题目才能对话
- 发送题目信息给 AI
- 支持消息重试（最多 3 次）
- 保存到题目维度（按题目 ID 存储）

## 🎯 功能需求

### 1. 核心功能

#### 1.1 消息管理
- **消息列表管理**：
  - 维护当前题目的消息列表
  - 支持添加、更新消息
  - 消息按时间顺序排列
- **消息类型支持**：
  - 文本消息
  - 图片消息（支持 base64）
  - 流式消息（实时更新）

#### 1.2 发送消息
- **发送流程**：
  1. 验证题目是否选中
  2. 创建用户消息（可选）
  3. 创建临时 AI 回复消息
  4. 构建 AI 请求（包含题目信息）
  5. 发送请求
  6. 更新消息（支持流式更新）
  7. 更新回复次数
  8. 保存聊天历史（按题目 ID）
- **题目信息集成**：
  - 发送消息时包含题目信息（题目内容、答案等）
  - 题目信息通过 `buildAiExerciseMessage` 构建

#### 1.3 消息重试
- **重试机制**：
  - 支持重试失败的消息（最多 3 次）
  - 保留原始消息内容和题目信息用于重试
  - 重试时更新消息状态
- **重试条件**：
  - `canRetry` 为 true
  - 存在 `originalMessage`
  - 重试次数未超过最大限制（3 次）

#### 1.4 聊天历史持久化
- **存储位置**：使用 `AsyncStorage` 持久化存储
- **存储键**：`chat_history_{questionId}`
- **存储内容**：
  - 消息列表
  - 回复次数（`chatResponseTimes`）
  - 最后更新时间
- **加载机制**：
  - 切换题目时自动加载对应题目的聊天历史
  - 无历史记录时清空状态

#### 1.5 查看答案控制
- **响应次数统计**：
  - 跟踪 AI 回复次数
  - 达到 3 次后允许查看答案
- **权限控制**：
  - `canViewAnswer`: 是否允许查看答案
  - `VIEW_ANSWER_CHAT_TIMES = 3`: 查看答案所需最小交互次数

#### 1.6 Web 搜索支持
- **Web 搜索开关**：
  - `enableWebSearch`: 是否启用 Web 搜索
  - `toggleWebSearch()`: 切换 Web 搜索状态

### 2. 功能边界

#### 2.1 负责的功能
- ✅ AI 题目聊天场景的状态管理
- ✅ 消息发送和接收
- ✅ 聊天历史持久化（按题目维度）
- ✅ 消息重试逻辑
- ✅ 回复次数统计
- ✅ 查看答案权限控制

#### 2.2 不负责的功能
- ❌ API 请求封装（由 `apiService` 负责）
- ❌ UI 渲染（由 `ChatScreen` 组件负责）
- ❌ 消息内容渲染（由 `ChatMessage` 组件负责）
- ❌ 题目选择（由 `QuestionStore` 负责）
- ❌ 图片选择（由原生模块负责）

## 🔧 技术实现

### 1. 依赖关系

#### 1.1 导入依赖

```typescript
import { create } from 'zustand'
import { apiService } from '../services/api-service'
import { asyncStorage } from '../services/chat-storage'
import type { ChatBubble, ExerciseItem, UserInfo } from '../types'
import { buildAiExerciseMessage } from './utils/aiMessageBuilder'
import { createUserMessage } from './utils/chatStoreUtils'
```

#### 1.2 被依赖
- `ChatScreen.tsx`：使用 `aiExerciseChatStore` 发送和接收消息
- `QuestionStore`：提供当前选中的题目信息

### 2. 关键代码逻辑

#### 2.1 Store 状态定义

```typescript
interface AiExerciseChatState {
  // 状态
  messages: ChatBubble[]
  chatResponseTimes: number
  isChatLoading: boolean
  enableWebSearch: boolean
  canViewAnswer: boolean
  
  // 方法
  sendMessage: (
    content: string,
    currentQuestion: ExerciseItem | null,
    userInfo: UserInfo | null,
    subject: 'MATH' | 'BIOLOGY',
    selectedModel?: string,
    imageData?: { filePath: string; base64DataUrl?: string },
    hidePrefix?: boolean,
    skipUserMessage?: boolean
  ) => Promise<void>
  
  retryMessage: (
    messageId: string,
    currentQuestion: ExerciseItem | null,
    userInfo: UserInfo | null,
    subject: 'MATH' | 'BIOLOGY',
    selectedModel?: string,
    imageData?: { filePath: string; base64DataUrl?: string }
  ) => Promise<void>
  
  saveChatHistory: (questionId: string) => Promise<void>
  loadChatHistory: (questionId: string) => Promise<void>
  clearChatHistory: (questionId: string) => Promise<void>
  resetState: () => void
  toggleWebSearch: () => void
}
```

#### 2.2 发送消息逻辑

```typescript
const sendMessage = async (
  content: string,
  currentQuestion: ExerciseItem | null,
  userInfo: UserInfo | null,
  subject: 'MATH' | 'BIOLOGY',
  selectedModel: string = 'mate',
  imageData?: { filePath: string; base64DataUrl?: string },
  hidePrefix: boolean = false,
  skipUserMessage?: boolean
): Promise<void> => {
  // 第1步：验证题目
  if (!currentQuestion) {
    throw new Error('请先选择一道题目')
  }
  
  // 第2步：创建用户消息（可选）
  if (!skipUserMessage) {
    const userMessage = createUserMessage(content, imageData, hidePrefix)
    set((state) => ({ messages: [...state.messages, userMessage] }))
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
  set((state) => ({ messages: [...state.messages, tempReply] }))
  
  // 第4步：构建AI请求
  const aiRequest = buildAiExerciseMessage(
    content,
    currentQuestion,
    userInfo,
    subject,
    get().enableWebSearch,
    selectedModel,
    imageData
  )
  
  try {
    // 第5步：发送请求
    const response = await apiService.sendChatMessage(aiRequest)
    
    // 第6步：更新消息
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === tempReplyId
          ? {
              ...tempReply,
              content: response.reply || '回复失败',
              isStreaming: false,
              messageId: response.messageId
            }
          : msg
      )
    }))
    
    // 第7步：更新回复次数
    set((state) => {
      const newResponseTimes = state.chatResponseTimes + 1
      return {
        chatResponseTimes: newResponseTimes,
        canViewAnswer: newResponseTimes >= 3
      }
    })
    
    // 第8步：保存聊天历史
    await saveChatHistory(currentQuestion.id)
  } catch (error) {
    // 错误处理
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === tempReplyId
          ? {
              ...tempReply,
              content: '发送失败，请重试',
              isStreaming: false,
              isError: true,
              canRetry: true,
              originalMessage: content,
              imageData: imageData && imageData.base64DataUrl ? {
                filePath: imageData.filePath || '',
                width: imageData.width || 0,
                height: imageData.height || 0,
                fileSize: imageData.fileSize || 0,
                base64DataUrl: imageData.base64DataUrl
              } : undefined
            }
          : msg
      )
    }))
    throw error
  }
}
```

#### 2.3 重试消息逻辑

```typescript
const retryMessage = async (
  messageId: string,
  currentQuestion: ExerciseItem | null,
  userInfo: UserInfo | null,
  subject: 'MATH' | 'BIOLOGY',
  selectedModel: string = 'mate',
  imageData?: { filePath: string; base64DataUrl?: string }
): Promise<void> => {
  // 验证题目
  if (!currentQuestion) {
    throw new Error('请先选择一道题目')
  }
  
  // 查找消息
  const state = get()
  const index = state.messages.findIndex((m) => m.id === messageId)
  if (index < 0) {
    throw new Error('消息不存在')
  }
  
  const message = state.messages[index]
  if (!message.canRetry || !message.originalMessage) {
    throw new Error('该消息不支持重发')
  }
  
  // 检查重试次数
  const maxRetries = 3
  const retryCount = message.retryCount || 0
  if (retryCount >= maxRetries) {
    throw new Error('已达到最大重试次数')
  }
  
  // 更新为重试中状态
  set((state) => ({
    messages: state.messages.map((msg) =>
      msg.id === messageId
        ? {
            ...message,
            content: '',
            isStreaming: true,
            isError: false,
            canRetry: false,
            retryCount: retryCount + 1
          }
        : msg
    )
  }))
  
  // 构建AI请求
  const aiRequest = buildAiExerciseMessage(
    message.originalMessage,
    currentQuestion,
    userInfo,
    subject,
    get().enableWebSearch,
    selectedModel,
    imageData
  )
  
  try {
    // 重新发送请求
    const response = await apiService.sendChatMessage(aiRequest)
    
    // 判断是否成功
    const isActuallySuccess =
      response.success &&
      response.reply &&
      response.reply !== '请求失败，请重试。'
    
    // 更新消息
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === messageId
          ? {
              ...message,
              content: response.reply || '请求失败，请重试。',
              timestamp: new Date().toISOString(),
              messageId: response.messageId,
              isStreaming: false,
              isError: !isActuallySuccess,
              canRetry: !isActuallySuccess && retryCount + 1 < maxRetries,
              retryCount: !isActuallySuccess ? retryCount + 1 : undefined,
              originalMessage: !isActuallySuccess ? message.originalMessage : undefined
            }
          : msg
      )
    }))
    
    // 保存聊天历史
    await saveChatHistory(currentQuestion.id)
  } catch (error) {
    // 更新为重试失败状态
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === messageId
          ? {
              ...message,
              content: `重试失败 (${retryCount + 1}/${maxRetries})，请稍后重试。`,
              isError: true,
              isStreaming: false,
              canRetry: retryCount + 1 < maxRetries,
              retryCount: retryCount + 1
            }
          : msg
      )
    }))
    
    await saveChatHistory(currentQuestion.id)
    throw error
  }
}
```

#### 2.4 聊天历史管理

```typescript
const saveChatHistory = async (questionId: string): Promise<void> => {
  const state = get()
  if (state.messages.length === 0) return
  
  const historyData = {
    questionId,
    messages: state.messages,
    chatResponseTimes: state.chatResponseTimes,
    lastUpdated: Date.now()
  }
  
  try {
    await asyncStorage.saveChatHistory(questionId, historyData)
    console.log(`[AI_EXERCISE] ✅ 保存聊天历史成功: ${questionId}`)
  } catch (error) {
    console.error('[AI_EXERCISE] ❌ 保存聊天历史失败:', error)
  }
}

const loadChatHistory = async (questionId: string): Promise<void> => {
  set({ isChatLoading: true })
  
  try {
    const historyData = await asyncStorage.loadChatHistory(questionId)
    
    if (historyData) {
      set({
        messages: historyData.messages || [],
        chatResponseTimes: historyData.chatResponseTimes || 0,
        canViewAnswer: (historyData.chatResponseTimes || 0) >= 3
      })
      
      console.log(`[AI_EXERCISE] ✅ 加载聊天历史成功: ${questionId}, ${historyData.messages?.length || 0}条消息`)
    } else {
      // 无历史记录，清空状态
      set({
        messages: [],
        chatResponseTimes: 0,
        canViewAnswer: false
      })
    }
  } catch (error) {
    console.error('[AI_EXERCISE] ❌ 加载聊天历史失败:', error)
    set({
      messages: [],
      chatResponseTimes: 0,
      canViewAnswer: false
    })
  } finally {
    set({ isChatLoading: false })
  }
}
```

## 🔄 迁移到 React Native

### 1. 等价实现

#### 1.1 状态管理
- **当前实现**：Vue 3 Composition API + Pinia
- **React Native 实现**：React + Zustand

#### 1.2 核心差异

| Vue 功能 | React Native 实现 |
|---------|------------------|
| `ref()` | `useState()` 或 Zustand store |
| `computed()` | `useMemo()` 或 Zustand computed |
| `defineStore()` | `create()` (Zustand) |
| `localforage` | `@react-native-async-storage/async-storage` |

### 2. 需要的第三方库

```json
{
  "zustand": "^4.4.0",
  "@react-native-async-storage/async-storage": "^1.19.0"
}
```

### 3. 迁移步骤

1. **创建 Zustand Store**
   - 定义状态接口
   - 实现状态管理逻辑
   - 实现方法（发送、重试、保存历史等）

2. **替换存储库**
   - `localforage` → `AsyncStorage`
   - 存储键格式保持不变：`chat_history_{questionId}`

3. **调整异步处理**
   - React Native 使用 Promise/async-await
   - 错误处理保持一致

### 4. 注意事项

#### 4.1 状态管理
- Zustand 使用不可变更新模式
- 状态更新使用函数式更新：`set((state) => ({ ...state, newValue }))`

#### 4.2 存储迁移
- `AsyncStorage` 只支持字符串，需要 JSON 序列化/反序列化
- 存储格式保持一致

#### 4.3 题目依赖
- 需要从 `QuestionStore` 获取当前题目
- 切换题目时需要加载对应历史

## ⚠️ 迁移风险

### 高风险项

1. **题目信息依赖**：
   - **风险**：题目信息需要从外部 Store 传入
   - **解决方案**：通过 Props 或 Store 依赖传入题目信息
   - **影响**：需要确保题目信息在发送时可用

2. **存储格式兼容**：
   - **风险**：`AsyncStorage` 和 `localforage` 存储格式可能不同
   - **解决方案**：保持相同的 JSON 序列化格式
   - **影响**：需要确保历史数据格式兼容

### 中风险项

1. **流式响应处理**：
   - 需要实现流式响应接收逻辑（如果支持）

2. **图片数据处理**：
   - `base64DataUrl` 和 `filePath` 的处理逻辑保持一致

## 🧪 测试要点

### 功能测试

1. **发送消息测试**：
   - ✅ 未选中题目时发送失败
   - ✅ 成功发送文本消息
   - ✅ 成功发送图片消息
   - ✅ 消息正确添加到列表
   - ✅ 回复次数正确更新

2. **重试消息测试**：
   - ✅ 重试失败消息成功
   - ✅ 重试次数限制生效（最多3次）
   - ✅ 重试后消息状态正确更新

3. **历史记录测试**：
   - ✅ 保存聊天历史成功
   - ✅ 加载聊天历史成功
   - ✅ 切换题目时加载对应历史
   - ✅ 清空历史记录成功

4. **查看答案权限测试**：
   - ✅ 回复3次后允许查看答案
   - ✅ 回复次数未达到时不允许查看答案

## 📚 参考资源

### 相关文档
- [Zustand 文档](https://github.com/pmndrs/zustand)
- [AsyncStorage 文档](https://react-native-async-storage.github.io/async-storage/)

### 相关文件
- `src/stores/aiGeneralChatStore.ts` - AI 通用聊天 Store（参考）
- `src/stores/utils/aiMessageBuilder.ts` - AI 消息构建工具
- `src/stores/utils/chatStoreUtils.ts` - 聊天工具函数
- `src/types/chat.ts` - 聊天相关类型定义

---

**文档版本**：v1.0  
**创建日期**：2025-01-03  
**维护者**：开发团队
