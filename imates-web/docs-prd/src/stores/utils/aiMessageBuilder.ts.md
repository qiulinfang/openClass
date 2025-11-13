# aiMessageBuilder.ts PRD 文档

## 📋 概述

**文件路径**：`src/stores/utils/aiMessageBuilder.ts`（已废弃）  
**文件类型**：`TypeScript 服务/工具`（已整合到各 Store）  
**主要职责**：`AI消息构建工具 - 所有方法已整合到对应的 Store 中`

## ⚠️ 重要说明

**此文件已不存在，所有方法已整合到对应的 Store 中：**

- ✅ `buildAiGeneralMessage` → 已整合到 `aiGeneralChatStore.ts` 和 `teacherGeneralChatStore.ts`
- ✅ `buildAiExerciseMessage` → 已整合到 `aiExerciseChatStore.ts`
- ✅ `buildAiTextbookMessage` → 已整合到 `aiTextbookChatStore.ts`

## 🎯 功能需求

### 1. 核心功能
- **buildAiGeneralMessage**：构建AI通用聊天消息请求
  - 位置：`src/stores/aiGeneralChatStore.ts`（第21-43行）
  - 位置：`src/stores/teacherGeneralChatStore.ts`（第36-58行）
- **buildAiExerciseMessage**：构建AI题目聊天消息请求
  - 位置：`src/stores/aiExerciseChatStore.ts`（第24-80行）
- **buildAiTextbookMessage**：构建AI教材聊天消息请求
  - 位置：`src/stores/aiTextbookChatStore.ts`（第47-97行）

### 2. 功能边界
- **负责的功能**：将聊天参数转换为API接口需要的格式
- **不负责的功能**：消息发送、状态管理、历史记录等（由各 Store 负责）

## 🔧 技术实现

### 1. 依赖关系
- **导入依赖**：无（各方法已作为内部函数整合到对应的 Store 中）
- **被依赖**：无（不再作为独立工具文件存在）

### 2. 关键代码逻辑

#### buildAiGeneralMessage（通用场景）
```typescript
// 位置：src/stores/aiGeneralChatStore.ts (第21-43行)
const buildAiGeneralMessage = (
  content: string,
  userInfo: UserInfo | null,
  enableWebSearch: boolean,
  chatRole: string = 'mate',
): AiChatMessageRequest => {
  const sessionId = `general-session-${Date.now()}`
  return {
    sessionId,
    newValue: '1',
    coversation: content,
    question: '',
    answer: '',
    name: userInfo?.userName || 'User',
    reason: 'start',
    bmNo: sessionId,
    isWebSearch: enableWebSearch ? '1' : '0',
    chatRole,
    subject: '',
    dstUrl: '/permission/chats',
  }
}
```

#### buildAiExerciseMessage（题目场景）
```typescript
// 位置：src/stores/aiExerciseChatStore.ts (第24-80行)
const buildAiExerciseMessage = (
  content: string,
  currentQuestion: ExerciseItem,
  userInfo: UserInfo | null,
  subject: 'MATH' | 'BIOLOGY',
  enableWebSearch: boolean,
  selectedModel: string = 'mate',
  imageData?: ChatImageData
): AiChatMessageRequest => {
  // 获取用户ID，优先级：userInfo.userId > userInfo.id > getCurrentUserId() > 'User'
  const userId = userInfo?.userId || userInfo?.id || getCurrentUserIdOrDefault() || 'User'
  const questionId = currentQuestion.id || currentQuestion.bmNo || ''
  const sessionId = `exercise-${questionId}-${Date.now()}`
  
  // 如果有图片数据，使用图片接口
  if (imageData?.base64DataUrl) {
    // ... 图片消息处理
  }
  
  // 普通文本消息
  return {
    sessionId,
    newValue: '1',
    coversation: content,
    question: currentQuestion.question || '',
    answer: currentQuestion.answer || '',
    name: userId,
    reason: 'start',
    bmNo: questionId,
    isWebSearch: enableWebSearch ? '1' : '0',
    chatRole: selectedModel,
    subject: subject,
    dstUrl: '/permission/chatMath',
  }
}
```

#### buildAiTextbookMessage（教材场景）
```typescript
// 位置：src/stores/aiTextbookChatStore.ts (第47-97行)
const buildAiTextbookMessage = ({
  sessionId,
  content,
  userInfo,
  enableWebSearch,
  chatRole = 'mate',
  imageData,
  useScreenshotApi = false,
  isNewSession = true,
}: BuildTextbookMessageParams): AiChatMessageRequest => {
  const userName = userInfo?.userName || 'User'
  
  if (imageData?.base64DataUrl) {
    // ... 图片消息处理
  }
  
  const dstUrl = useScreenshotApi ? '/permission/previewPictureQA' : '/permission/chats'
  return {
    sessionId,
    newValue: isNewSession ? '1' : '0',
    coversation: content,
    question: '',
    answer: '',
    name: userName,
    reason: 'start',
    bmNo: sessionId,
    isWebSearch: enableWebSearch ? '1' : '0',
    chatRole,
    subject: '',
    dstUrl,
  }
}
```

## 🔄 整合历史

### 整合时间线
1. **初始状态**：所有方法位于独立的 `aiMessageBuilder.ts` 工具文件中
2. **整合阶段**：将各方法整合到对应的 Store 中，作为内部函数
3. **当前状态**：所有方法已整合完成，`aiMessageBuilder.ts` 文件已删除

### 整合原因
- **代码内聚性**：每个 Store 负责自己的消息构建逻辑，提高代码内聚性
- **减少依赖**：避免跨文件依赖，简化代码结构
- **易于维护**：相关逻辑集中管理，便于维护和修改

## 📝 使用示例

### 通用场景（aiGeneralChatStore）
```typescript
import { useAiGeneralChatStore } from '@/stores/aiGeneralChatStore'

const store = useAiGeneralChatStore()
// buildAiGeneralMessage 作为内部函数，通过 sendMessage 方法间接调用
await store.sendMessage('你好', 'mate')
```

### 题目场景（aiExerciseChatStore）
```typescript
import { useAiExerciseChatStore } from '@/stores/aiExerciseChatStore'

const store = useAiExerciseChatStore()
// buildAiExerciseMessage 作为内部函数，通过 sendMessage 方法间接调用
await store.sendMessage('这道题怎么做？', currentQuestion, userInfo, 'MATH', 'mate')
```

### 教材场景（aiTextbookChatStore）
```typescript
import { useAiTextbookChatStore } from '@/stores/aiTextbookChatStore'

const store = useAiTextbookChatStore()
// buildAiTextbookMessage 作为内部函数，通过 sendMessage 方法间接调用
await store.sendMessage('请解释这个概念', 'mate', imageData)
```

## ⚠️ 注意事项

### 重要提醒
- ❌ **不要**尝试从 `aiMessageBuilder.ts` 导入这些函数（文件已不存在）
- ✅ **应该**直接使用各 Store 的 `sendMessage` 方法
- ✅ 如果需要自定义消息构建逻辑，可以在对应的 Store 中修改内部函数

### 代码位置
- `buildAiGeneralMessage`: `src/stores/aiGeneralChatStore.ts` (第21-43行)
- `buildAiGeneralMessage`: `src/stores/teacherGeneralChatStore.ts` (第36-58行)
- `buildAiExerciseMessage`: `src/stores/aiExerciseChatStore.ts` (第24-80行)
- `buildAiTextbookMessage`: `src/stores/aiTextbookChatStore.ts` (第47-97行)

## 🧪 测试要点

### 功能测试
- ✅ 验证各 Store 的 `sendMessage` 方法能正确构建消息
- ✅ 验证不同场景下的消息格式正确性
- ✅ 验证图片消息的处理逻辑

## 📚 相关文档

- `src/stores/aiGeneralChatStore.ts` - 通用聊天 Store
- `src/stores/aiExerciseChatStore.ts` - 题目聊天 Store
- `src/stores/aiTextbookChatStore.ts` - 教材聊天 Store
- `src/stores/teacherGeneralChatStore.ts` - 教师通用聊天 Store

---

**文档版本**：v2.0  
**创建日期**：2025-11-03  
**最后更新**：2025-01-XX  
**更新说明**：所有方法已整合到对应的 Store 中，此文件已废弃  
**维护者**：开发团队
