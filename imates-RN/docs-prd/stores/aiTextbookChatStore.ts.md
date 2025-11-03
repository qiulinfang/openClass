# aiTextbookChatStore.ts PRD 文档（React Native）

## 📋 概述

**文件路径**：`src/stores/aiTextbookChatStore.ts`  
**文件类型**：`TypeScript Store (Zustand)`  
**主要职责**：管理 AI 教材场景下的聊天消息和业务逻辑（React Native 版本）

**场景特点**：
- 教材场景下的 AI 对话
- 支持截图问答
- 支持科目信息（MATH/BIOLOGY）
- 聊天历史按教材场景存储（单一历史）

## 🎯 功能需求

### 1. 核心功能

#### 1.1 消息管理
- **消息列表管理**：
  - 维护教材场景的消息列表
  - 支持添加、更新、删除消息
  - 消息按时间顺序排列
- **消息类型支持**：
  - 文本消息
  - 图片消息（支持 base64，用于截图问答）
  - 流式消息（实时更新）

#### 1.2 发送消息
- **发送流程**：
  1. 创建用户消息（可选）
  2. 创建临时 AI 回复消息
  3. 构建 AI 请求（包含科目信息）
  4. 发送请求
  5. 更新消息（支持流式更新）
  6. 更新回复次数
  7. 保存聊天历史（防抖保存）
- **科目信息集成**：
  - 发送消息时包含科目信息（MATH/BIOLOGY）
  - 科目信息用于确定 API 的 `dstUrl`
  - 科目信息从 `UserStore` 获取

#### 1.3 消息重试
- **重试机制**：
  - 支持重试失败的消息（最多 3 次）
  - 保留原始消息内容用于重试
  - 重试时更新消息状态
- **重试条件**：
  - `canRetry` 为 true
  - 存在 `originalMessage`
  - 重试次数未超过最大限制

#### 1.4 聊天历史持久化
- **存储位置**：使用 `AsyncStorage` 持久化存储
- **存储键**：`chat_history_ai_textbook_chat_history`
- **存储内容**：
  - 消息列表
  - 回复次数（`chatResponseTimes`）
  - 最后更新时间
- **防抖保存**：
  - 默认防抖 1 秒保存
  - 支持立即保存（`immediate: true`）

#### 1.5 查看答案控制
- **响应次数统计**：
  - 跟踪 AI 回复次数
  - 达到 3 次后允许查看答案
- **权限控制**：
  - `canViewAnswer`: 是否允许查看答案（computed）
  - `VIEW_ANSWER_CHAT_TIMES = 3`: 查看答案所需最小交互次数

#### 1.6 Web 搜索支持
- **Web 搜索开关**：
  - `enableWebSearch`: 是否启用 Web 搜索
  - `toggleWebSearch()`: 切换 Web 搜索状态

## 🔧 技术实现

### 1. 依赖关系

#### 1.1 导入依赖

```typescript
import { create } from 'zustand'
import { apiService } from '../services/api-service'
import { asyncStorage } from '../services/chat-storage'
import { useUserStore } from './userStore'
import {
  createUserMessage,
  createTempAiReplyMessage,
  updateMessageSuccess,
  updateMessageError,
  updateMessageRetrying,
  checkRetryCondition,
  isResponseSuccess,
  buildRetryFailureMessage,
  findMessageIndex,
  validateMessageExists,
  type ChatImageData
} from './utils/chatStoreUtils'
import { buildAiTextbookMessage } from './utils/aiMessageBuilder'
import type { ChatBubble } from '../types'
```

#### 1.2 被依赖
- `ChatScreen.tsx`：使用 `aiTextbookChatStore` 发送和接收消息
- `UserStore`：提供用户信息和科目信息

### 2. 关键代码逻辑

#### 2.1 Store 状态定义

```typescript
interface AiTextbookChatState {
  // 状态
  messages: ChatBubble[]
  isChatLoading: boolean
  isChatRendering: boolean
  chatResponseTimes: number
  enableWebSearch: boolean
  canViewAnswer: boolean
  
  // 方法
  addMessage: (message: ChatBubble) => void
  updateMessage: (messageId: string, updates: Partial<ChatBubble>) => void
  clearMessages: () => void
  
  sendMessage: (
    content: string,
    selectedModel?: string,
    imageData?: ChatImageData,
    hidePrefix?: boolean,
    skipUserMessage?: boolean
  ) => Promise<void>
  
  retryAiMessage: (
    messageId: string,
    chatRole?: string,
    imageData?: ChatImageData
  ) => Promise<void>
  
  saveChatHistory: (immediate?: boolean) => Promise<void>
  loadChatHistory: () => Promise<void>
  clearChatHistory: () => Promise<void>
  toggleWebSearch: () => void
}
```

#### 2.2 发送消息逻辑

```typescript
const sendMessage = async (
  content: string,
  selectedModel?: string,
  imageData?: ChatImageData,
  hidePrefix: boolean = false,
  skipUserMessage?: boolean
): Promise<void> => {
  // 第1步：创建用户消息（可选）
  if (!skipUserMessage) {
    const userMessage = createUserMessage(content, imageData, hidePrefix)
    set((state) => ({ messages: [...state.messages, userMessage] }))
  }
  
  // 第2步：创建临时AI回复消息
  const { message: tempReply, id: tempReplyId } = createTempAiReplyMessage()
  set((state) => ({ messages: [...state.messages, tempReply] }))
  
  // 第3步：设置加载状态
  set({ isChatLoading: true, isChatRendering: true })
  
  try {
    // 第4步：获取用户信息和科目
    const userStore = useUserStore.getState()
    
    // 第5步：构建AI消息请求（传入科目以确定dstUrl）
    const builderImageData = imageData && imageData.base64DataUrl 
      ? { base64DataUrl: imageData.base64DataUrl } 
      : undefined
    const aiMessage = buildAiTextbookMessage(
      content,
      userStore.userInfo,
      get().enableWebSearch,
      selectedModel || 'mate',
      builderImageData,
      userStore.subject  // ⭐ 传入科目参数
    )
    
    // 第6步：调用API发送消息
    const response = await apiService.sendChatMessage(aiMessage)
    
    // 第7步：处理响应
    if (isResponseSuccess(response)) {
      // 成功：更新消息内容
      const updatedMessage = updateMessageSuccess(
        tempReply,
        response.reply || '',
        response.messageId
      )
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg.id === tempReplyId ? updatedMessage : msg
        )
      }))
      
      // 增加响应次数
      set((state) => {
        const newResponseTimes = state.chatResponseTimes + 1
        return {
          chatResponseTimes: newResponseTimes,
          canViewAnswer: newResponseTimes >= 3
        }
      })
      
      // 保存聊天历史
      await saveChatHistory()
    } else {
      // 失败：标记为错误
      const errorMessage = updateMessageError(
        tempReply,
        '抱歉，我暂时无法回答这个问题。请稍后重试。',
        content,
        imageData
      )
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg.id === tempReplyId ? errorMessage : msg
        )
      }))
    }
  } catch (error) {
    console.error('发送消息失败:', error)
    
    // 错误处理
    const errorMessage = updateMessageError(
      tempReply,
      '发送失败，请检查网络连接后重试。',
      content,
      imageData
    )
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === tempReplyId ? errorMessage : msg
      )
    }))
  } finally {
    // 重置加载状态
    set({ isChatLoading: false, isChatRendering: false })
  }
}
```

#### 2.3 重试消息逻辑

```typescript
const retryAiMessage = async (
  messageId: string,
  chatRole: string = 'mate',
  imageData?: ChatImageData
): Promise<void> => {
  // 第1步：查找消息
  const state = get()
  const index = findMessageIndex(state.messages, messageId)
  try {
    validateMessageExists(index)
  } catch {
    // 显示错误消息
    return
  }
  
  const message = state.messages[index]
  
  // 第2步：检查重试条件
  const { canRetry, error } = checkRetryCondition(message)
  if (!canRetry) {
    // 显示错误消息
    return
  }
  
  // 第3步：更新为重试中状态
  const retryCount = (message.retryCount || 0) + 1
  const retryingMessage = updateMessageRetrying(message, retryCount)
  set((state) => ({
    messages: state.messages.map((msg) =>
      msg.id === messageId ? retryingMessage : msg
    )
  }))
  
  // 第4步：重新发送
  try {
    const userStore = useUserStore.getState()
    const builderImageData = imageData && imageData.base64DataUrl 
      ? { base64DataUrl: imageData.base64DataUrl } 
      : undefined
    const aiMessage = buildAiTextbookMessage(
      message.originalMessage!,
      userStore.userInfo,
      get().enableWebSearch,
      chatRole,
      builderImageData,
      userStore.subject  // ⭐ 传入科目参数
    )
    
    const response = await apiService.sendChatMessage(aiMessage)
    
    if (isResponseSuccess(response)) {
      // 重试成功
      const successMessage = updateMessageSuccess(
        message,
        response.reply || '',
        response.messageId
      )
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg.id === messageId ? successMessage : msg
        )
      }))
      
      set((state) => {
        const newResponseTimes = state.chatResponseTimes + 1
        return {
          chatResponseTimes: newResponseTimes,
          canViewAnswer: newResponseTimes >= 3
        }
      })
      
      await saveChatHistory()
    } else {
      // 重试失败
      const errorContent = buildRetryFailureMessage(retryCount, 3)
      const errorMessage = updateMessageError(
        message,
        errorContent,
        message.originalMessage,
        imageData
      )
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg.id === messageId ? errorMessage : msg
        )
      }))
    }
  } catch (error) {
    console.error('重试失败:', error)
    const errorContent = buildRetryFailureMessage(retryCount, 3)
    const errorMessage = updateMessageError(
      message,
      errorContent,
      message.originalMessage,
      imageData
    )
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === messageId ? errorMessage : msg
      )
    }))
  }
}
```

#### 2.4 聊天历史管理（防抖保存）

```typescript
let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null

const saveChatHistory = async (immediate: boolean = false): Promise<void> => {
  // 第1步：清除旧定时器
  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer)
    saveDebounceTimer = null
  }
  
  const saveAction = async () => {
    try {
      // 第2步：构建存储键
      const storageKey = 'ai_textbook_chat_history'
      
      // 第3步：保存到AsyncStorage
      const state = get()
      await asyncStorage.saveChatHistory(storageKey, {
        questionId: storageKey,
        messages: state.messages,
        lastUpdated: Date.now(),
        chatResponseTimes: state.chatResponseTimes
      })
    } catch (error) {
      console.error('保存聊天历史失败:', error)
    }
  }
  
  // 第4步：立即保存或防抖保存
  if (immediate) {
    await saveAction()
  } else {
    saveDebounceTimer = setTimeout(saveAction, 1000)
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
| 防抖定时器 | `setTimeout` / `clearTimeout`（相同） |

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
   - 存储键格式：`chat_history_ai_textbook_chat_history`

3. **实现防抖保存**
   - 使用模块级变量保存定时器引用
   - 防抖逻辑保持一致（1秒）

4. **科目信息集成**
   - 从 `UserStore` 获取科目信息
   - 在构建消息时传入科目参数

### 4. 注意事项

#### 4.1 防抖定时器
- 定时器需要在 Store 外部定义（模块级）
- 确保定时器清理逻辑正确

#### 4.2 科目信息依赖
- 需要从 `UserStore` 获取科目信息
- 确保科目信息在发送时可用

#### 4.3 存储格式兼容
- `AsyncStorage` 只支持字符串，需要 JSON 序列化/反序列化
- 存储格式保持一致

## ⚠️ 迁移风险

### 高风险项

1. **科目信息依赖**：
   - **风险**：科目信息需要从 `UserStore` 获取
   - **解决方案**：通过 Store 依赖获取科目信息
   - **影响**：需要确保科目信息在发送时可用

2. **防抖定时器管理**：
   - **风险**：定时器在 Store 外部，需要正确管理
   - **解决方案**：使用模块级变量保存定时器引用
   - **影响**：需要注意内存泄漏

### 中风险项

1. **存储格式兼容**：
   - `AsyncStorage` 和 `localforage` 存储格式可能不同
   - 需要保持相同的 JSON 序列化格式

## 🧪 测试要点

### 功能测试

1. **发送消息测试**：
   - ✅ 成功发送文本消息
   - ✅ 成功发送图片消息（截图问答）
   - ✅ 消息正确添加到列表
   - ✅ 回复次数正确更新

2. **重试消息测试**：
   - ✅ 重试失败消息成功
   - ✅ 重试次数限制生效
   - ✅ 重试后消息状态正确更新

3. **历史记录测试**：
   - ✅ 防抖保存正常工作（1秒延迟）
   - ✅ 立即保存正常工作
   - ✅ 加载聊天历史成功
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
- `src/stores/aiExerciseChatStore.ts` - AI 题目聊天 Store（参考）
- `src/stores/utils/aiMessageBuilder.ts` - AI 消息构建工具
- `src/stores/utils/chatStoreUtils.ts` - 聊天工具函数
- `src/types/chat.ts` - 聊天相关类型定义

---

**文档版本**：v1.0  
**创建日期**：2025-01-03  
**维护者**：开发团队
