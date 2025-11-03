# teacherChatStore.ts PRD 文档（React Native）

## 📋 概述

**文件路径**：`src/stores/teacherChatStore.ts`  
**文件类型**：`TypeScript Store (Zustand)`  
**主要职责**：管理教师答疑场景下的聊天消息和业务逻辑（React Native 版本）

**场景特点**：
- 通过 Android Bridge 直接发送到 RabbitMQ（不使用 HTTP 接口）
- 支持会话管理（创建、切换、删除会话）
- 支持消息转发（从 AI 对话转发到教师对话）
- 支持自动生成会话标题
- 通过 RabbitMQ 接收教师回复

## 🎯 功能需求

### 1. 核心功能

#### 1.1 会话管理
- **会话创建**：
  - 基于 AI 会话创建教师会话
  - 从 AI 会话 ID 提取题目 ID（可选）
  - 支持复用已有会话（基于 sessionName 和 subject 匹配）
  - 会话 ID 生成（使用哈希算法）
- **会话切换**：
  - 切换会话时自动加载历史消息
  - 更新当前会话状态
- **会话删除**：
  - 删除会话及其历史消息
  - 清理本地存储

#### 1.2 消息管理
- **消息列表管理**：
  - 维护当前会话的消息列表
  - 支持添加、更新、删除消息
  - 消息按时间顺序排列
- **消息类型支持**：
  - 文本消息
  - 图片消息（支持 base64 和 filePath）
  - 语音消息（通过 Android Bridge）
  - 聊天记录转发

#### 1.3 发送消息
- **发送流程**：
  1. 验证会话是否存在
  2. 验证 Android Bridge 是否可用
  3. 根据消息类型调用不同的 Android Bridge 方法
  4. 发送到 RabbitMQ（不通过 HTTP）
  5. 更新回复次数
  6. 保存聊天历史（防抖保存）
  7. 自动生成标题（第3轮对话后，6条消息）
- **Android Bridge 方法**：
  - `sendTextMessageToTeacher(content, sessionId, subject)`：发送文本消息
  - `sendPictureToTeacher(filePath, sessionId, subject)`：发送图片消息
  - `sendVoiceMessageToTeacher(filePath, duration, sessionId, subject)`：发送语音消息

#### 1.4 消息接收
- **RabbitMQ 监听**：
  - 通过 Android Bridge 初始化 RabbitMQ 监听
  - 全局回调函数 `onTeacherMessageReceived`
  - 接收教师回复消息
  - 自动添加到消息列表
- **消息接收器初始化**：
  - `initTeacherMessageListener()`：初始化监听器
  - `cleanupTeacherMessageListener()`：清理监听器

#### 1.5 消息转发
- **转发功能**：
  - 支持将 AI 对话的消息转发到教师对话
  - 批量转发多条消息
  - 统计转发成功/失败数量
  - 根据消息类型调用不同的 Android Bridge 方法

#### 1.6 消息重试
- **重试机制**：
  - 支持重试失败的消息（最多 3 次）
  - 保留原始消息内容用于重试
  - 重试时更新消息状态
- **重试条件**：
  - `canRetry` 为 true
  - 存在 `originalMessage`
  - 重试次数未超过最大限制

#### 1.7 聊天历史持久化
- **存储位置**：
  - 使用 `AsyncStorage` 持久化存储消息
  - 使用 `AsyncStorage` 持久化存储会话信息
- **存储键**：
  - 消息历史：`chat_history_teacher_chat_{sessionId}`
  - 会话信息：`teacher_chat_{sessionId}_session`
- **存储内容**：
  - 消息列表
  - 回复次数（`chatResponseTimes`）
  - 会话元数据（sessionId, sessionName, subject, createTime）
- **防抖保存**：
  - 默认防抖 1 秒保存
  - 支持立即保存（`immediate: true`）

#### 1.8 自动生成标题
- **标题生成时机**：
  - 在第 3 轮对话后自动生成（6 条消息）
  - 异步生成，不阻塞主流程
- **生成流程**：
  1. 获取前 6 条消息（3 轮对话）
  2. 构建对话摘要
  3. 调用 AI 接口生成标题
  4. 清理生成的标题（去除引号、换行等）
  5. 更新 localStorage 中的会话标题
  6. 同步更新当前会话

#### 1.9 查看答案控制
- **响应次数统计**：
  - 跟踪教师回复次数
  - 达到 3 次后允许查看答案
- **权限控制**：
  - `canViewAnswer`: 是否允许查看答案（computed）
  - `VIEW_ANSWER_CHAT_TIMES = 3`: 查看答案所需最小交互次数

#### 1.10 待发送图片管理
- **拍作业场景**：
  - `pendingImage`: 保存待发送的图片信息
  - `setPendingImage()`: 设置待发送图片
  - `clearPendingImage()`: 清除待发送图片

## 🔧 技术实现

### 1. 依赖关系

#### 1.1 导入依赖

```typescript
import { create } from 'zustand'
import { apiService } from '../services/api-service'
import { asyncStorage } from '../services/chat-storage'
import { useUserStore } from './userStore'
import { useQuestionStore } from './questionStore'
import {
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
import { buildAiGeneralMessage } from './utils/aiMessageBuilder'
import type { ChatBubble } from '../types'
```

#### 1.2 被依赖
- `ChatScreen.tsx`：使用 `teacherChatStore` 发送和接收消息
- `UserStore`：提供用户信息
- `QuestionStore`：提供当前选中的题目信息（重试时使用）

#### 1.3 原生依赖
- **Android Bridge**：需要原生模块提供以下方法
  - `sendTextMessageToTeacher(content, sessionId, subject)`
  - `sendPictureToTeacher(filePath, sessionId, subject)`
  - `sendVoiceMessageToTeacher(filePath, duration, sessionId, subject)`
  - `initTeacherMessageListener()`
  - `cleanupTeacherMessageListener()`

### 2. 关键代码逻辑

#### 2.1 Store 状态定义

```typescript
interface TeacherSession {
  sessionId: string
  sessionName: string
  subject: string
  createTime: number
}

interface TeacherChatState {
  // 状态
  messages: ChatBubble[]
  currentSession: TeacherSession | null
  isChatLoading: boolean
  isChatRendering: boolean
  chatResponseTimes: number
  enableWebSearch: boolean
  canViewAnswer: boolean
  pendingImage: {
    filePath: string
    width: number
    height: number
    fileSize: number
    base64DataUrl?: string
  } | null
  
  // 会话管理
  setSession: (session: TeacherSession) => void
  clearSession: () => void
  createTeacherSession: (
    aiSessionId: string,
    aiSessionName: string,
    subject: 'biology' | 'math'
  ) => TeacherSession
  checkSessionExists: (sessionId: string) => boolean
  getSessionMessageCount: (sessionId: string) => Promise<number>
  generateSessionTitle: (
    sessionId: string,
    userInfo: UserInfo | null,
    subject: 'MATH' | 'BIOLOGY'
  ) => Promise<void>
  
  // 消息管理
  addMessage: (message: ChatBubble) => void
  updateMessage: (messageId: string, updates: Partial<ChatBubble>) => void
  clearMessages: () => void
  
  // 发送和接收
  sendMessage: (
    content: string,
    imageData?: ChatImageData
  ) => Promise<void>
  retryTeacherMessage: (
    messageId: string,
    imageData?: ChatImageData
  ) => Promise<void>
  forwardMessagesToTeacher: (
    messagesToForward: ChatBubble[]
  ) => Promise<{ success: number; failed: number }>
  
  // 消息接收
  initMessageReceiver: () => Promise<void>
  cleanupMessageReceiver: () => Promise<void>
  
  // 历史记录
  saveChatHistory: (immediate?: boolean) => Promise<void>
  loadChatHistory: (sessionId: string) => Promise<void>
  clearChatHistory: (sessionId: string) => Promise<void>
  
  // 其他
  toggleWebSearch: () => void
  setPendingImage: (imageData: {...}) => void
  clearPendingImage: () => void
}
```

#### 2.2 发送消息逻辑（通过 Android Bridge）

```typescript
const sendMessage = async (
  content: string,
  imageData?: ChatImageData
): Promise<void> => {
  // 第1步：验证会话
  const state = get()
  if (!state.currentSession) {
    throw new Error('请先选择教师会话')
  }
  
  // 检查Android Bridge
  if (!NativeModules.AndroidBridge) {
    throw new Error('AndroidBridge未初始化')
  }
  
  // 第2步：设置加载状态
  set({ isChatLoading: true, isChatRendering: true })
  
  try {
    const sessionId = state.currentSession.sessionId
    const subject = state.currentSession.subject || 'math'
    
    let result: string
    
    // 第3步：根据消息类型调用不同的Android Bridge方法
    if (imageData?.base64DataUrl) {
      // 图片消息：优先使用filePath（更高效）
      if (imageData.filePath) {
        result = await NativeModules.AndroidBridge.sendPictureToTeacher(
          imageData.filePath,
          sessionId,
          subject
        )
      } else {
        // 如果没有filePath，回退使用base64DataUrl（兼容旧代码）
        result = await NativeModules.AndroidBridge.sendPictureToTeacher(
          imageData.base64DataUrl,
          sessionId,
          subject
        )
      }
    } else {
      // 文本消息
      result = await NativeModules.AndroidBridge.sendTextMessageToTeacher(
        content,
        sessionId,
        subject
      )
    }
    
    const data = JSON.parse(result)
    if (data.success) {
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
      
      // 检查是否需要自动生成标题（第3轮对话后，6条消息）
      const currentState = get()
      if (currentState.currentSession && currentState.messages.length === 6) {
        // 异步生成标题，不阻塞主流程
        const userStore = useUserStore.getState()
        generateSessionTitle(
          currentState.currentSession!.sessionId,
          userStore.userInfo,
          currentState.currentSession!.subject as 'MATH' | 'BIOLOGY'
        ).catch((error: Error) => {
          console.warn('[TeacherStore] ⚠️ 自动生成标题失败:', error)
        })
      }
    } else {
      throw new Error(data.message || '发送失败')
    }
  } catch (error) {
    console.error('[TeacherStore] ❌ 发送教师消息异常:', error)
    throw error
  } finally {
    // 重置加载状态
    set({ isChatLoading: false, isChatRendering: false })
  }
}
```

#### 2.3 消息接收器初始化

```typescript
const initMessageReceiver = async (): Promise<void> => {
  // 第1步：设置全局回调函数
  global.onTeacherMessageReceived = (messageData: unknown) => {
    const data = messageData as {
      messageId: string
      sessionId: string
      content: string
      messageType: string
      isSelf: boolean
      timestamp: number
      chatRole: string
    }
    
    const teacherMessage: ChatBubble = {
      id: data.messageId,
      content: data.content,
      type: 'ai',
      timestamp: new Date(data.timestamp).toISOString(),
      sender: 'teacher'
    }
    
    // 只添加属于当前会话的消息
    const state = get()
    if (state.currentSession?.sessionId === data.sessionId) {
      set((state) => ({ messages: [...state.messages, teacherMessage] }))
      saveChatHistory(true) // 立即保存
    }
  }
  
  // 第2步：初始化原生监听器
  if (!NativeModules.AndroidBridge) {
    throw new Error('AndroidBridge未初始化，无法连接教师消息系统')
  }
  
  try {
    const result = await NativeModules.AndroidBridge.initTeacherMessageListener()
    const data = JSON.parse(result)
    if (!data.success) {
      throw new Error(`初始化教师消息监听失败: ${data.message}`)
    }
    console.log('✅ 教师消息监听器初始化成功')
  } catch (error) {
    console.error('初始化教师消息监听失败:', error)
    throw error
  }
}
```

#### 2.4 会话创建逻辑

```typescript
const createTeacherSession = (
  aiSessionId: string,
  aiSessionName: string,
  subject: 'biology' | 'math'
): TeacherSession => {
  // 第1步：尝试从aiSessionId提取题目ID
  let questionId: string | null = null
  const match = aiSessionId.match(/^ai_session_([^_]+)_/)
  if (match && match[1]) {
    questionId = match[1]
  }
  
  // 第2步：检查是否已存在相同的会话
  let existingSession: TeacherSession | null = null
  
  // 从AsyncStorage读取所有会话
  // 注意：这里需要遍历所有存储的会话键
  // 实际实现需要使用 AsyncStorage.getAllKeys() 和匹配逻辑
  
  // 第3步：如果已存在，复用已有会话；否则创建新会话
  let session: TeacherSession
  if (existingSession) {
    session = existingSession
  } else {
    const sessionId = generateSessionId(aiSessionId)
    session = {
      sessionId,
      sessionName: aiSessionName,
      subject,
      createTime: Date.now()
    }
  }
  
  // 第4步：保存到AsyncStorage
  const storageKey = `teacher_chat_${session.sessionId}_session`
  AsyncStorage.setItem(storageKey, JSON.stringify(session))
  
  // 第5步：设置为当前会话
  set({ currentSession: session })
  
  return session
}

const generateSessionId = (aiSessionId: string): string => {
  // 使用哈希算法生成会话ID（与Android的UUID.nameUUIDFromBytes逻辑保持一致）
  let hash = 0
  for (let i = 0; i < aiSessionId.length; i++) {
    const char = aiSessionId.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // 转为32位整数
  }
  
  const hex = Math.abs(hash).toString(16).padStart(8, '0')
  return `teacher-${hex}-${Date.now()}`
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
| `localStorage` | `@react-native-async-storage/async-storage` |
| `window.AndroidBridge` | `NativeModules.AndroidBridge` |
| 全局回调函数 | `global.onTeacherMessageReceived` |

### 2. 需要的第三方库

```json
{
  "zustand": "^4.4.0",
  "@react-native-async-storage/async-storage": "^1.19.0",
  "react-native": "^0.72.0"
}
```

### 3. 原生模块依赖

需要原生模块（Android/iOS）提供以下接口：

#### Android Bridge 接口

```typescript
interface AndroidBridge {
  sendTextMessageToTeacher: (
    content: string,
    sessionId: string,
    subject: string
  ) => Promise<string>
  
  sendPictureToTeacher: (
    filePath: string,
    sessionId: string,
    subject: string
  ) => Promise<string>
  
  sendVoiceMessageToTeacher: (
    filePath: string,
    duration: string,
    sessionId: string,
    subject: string
  ) => Promise<string>
  
  initTeacherMessageListener: () => Promise<string>
  
  cleanupTeacherMessageListener: () => Promise<string>
}
```

### 4. 迁移步骤

1. **创建 Zustand Store**
   - 定义状态接口
   - 实现状态管理逻辑
   - 实现方法（发送、重试、保存历史等）

2. **替换存储库**
   - `localforage` → `AsyncStorage`
   - `localStorage` → `AsyncStorage`
   - 存储键格式保持一致

3. **替换 Android Bridge**
   - `window.AndroidBridge` → `NativeModules.AndroidBridge`
   - 全局回调函数使用 `global` 对象

4. **实现消息接收**
   - 设置全局回调函数
   - 初始化原生监听器
   - 处理接收到的消息

### 5. 注意事项

#### 5.1 Android Bridge 集成
- 需要确保原生模块已正确实现所有接口
- 错误处理需要正确处理原生模块返回的 JSON 字符串

#### 5.2 全局回调函数
- 使用 `global` 对象存储回调函数
- 清理时需要移除回调函数

#### 5.3 会话匹配逻辑
- 需要实现 `AsyncStorage.getAllKeys()` 遍历所有会话
- 会话匹配逻辑需要与 Web 版本保持一致

#### 5.4 存储格式兼容
- `AsyncStorage` 只支持字符串，需要 JSON 序列化/反序列化
- 存储格式保持一致

## ⚠️ 迁移风险

### 高风险项

1. **Android Bridge 依赖**：
   - **风险**：需要原生模块正确实现所有接口
   - **解决方案**：与原生开发团队确认接口实现
   - **影响**：如果接口未实现或实现不正确，功能无法使用

2. **消息接收机制**：
   - **风险**：全局回调函数和原生监听器的集成可能存在问题
   - **解决方案**：仔细实现消息接收逻辑，确保回调正确触发
   - **影响**：如果接收机制有问题，无法收到教师回复

3. **会话存储查询**：
   - **风险**：`AsyncStorage` 没有 `getAllKeys()` 的直接支持，需要遍历所有键
   - **解决方案**：使用 `AsyncStorage.getAllKeys()` 方法（如果可用），或维护会话列表
   - **影响**：会话匹配逻辑可能性能较差

### 中风险项

1. **存储格式兼容**：
   - `AsyncStorage` 和 `localStorage`/`localforage` 存储格式可能不同
   - 需要保持相同的 JSON 序列化格式

2. **防抖定时器管理**：
   - 定时器在 Store 外部，需要正确管理
   - 需要注意内存泄漏

## 🧪 测试要点

### 功能测试

1. **发送消息测试**：
   - ✅ 未选择会话时发送失败
   - ✅ 成功发送文本消息
   - ✅ 成功发送图片消息（filePath）
   - ✅ 成功发送图片消息（base64DataUrl 降级）
   - ✅ 成功发送语音消息
   - ✅ 消息正确添加到列表
   - ✅ 回复次数正确更新

2. **消息接收测试**：
   - ✅ 初始化消息接收器成功
   - ✅ 接收到教师回复消息
   - ✅ 消息自动添加到列表
   - ✅ 只有当前会话的消息被添加
   - ✅ 清理消息接收器成功

3. **会话管理测试**：
   - ✅ 创建新会话成功
   - ✅ 复用已有会话成功
   - ✅ 切换会话时加载历史消息
   - ✅ 删除会话成功
   - ✅ 自动生成标题成功（6条消息后）

4. **消息转发测试**：
   - ✅ 批量转发多条消息成功
   - ✅ 统计转发成功/失败数量
   - ✅ 根据消息类型调用正确的 Android Bridge 方法

5. **重试消息测试**：
   - ✅ 重试失败消息成功
   - ✅ 重试次数限制生效
   - ✅ 重试后消息状态正确更新

6. **历史记录测试**：
   - ✅ 防抖保存正常工作（1秒延迟）
   - ✅ 立即保存正常工作
   - ✅ 加载聊天历史成功
   - ✅ 清空历史记录成功

## 📚 参考资源

### 相关文档
- [Zustand 文档](https://github.com/pmndrs/zustand)
- [AsyncStorage 文档](https://react-native-async-storage.github.io/async-storage/)
- [React Native Native Modules 文档](https://reactnative.dev/docs/native-modules-intro)

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
