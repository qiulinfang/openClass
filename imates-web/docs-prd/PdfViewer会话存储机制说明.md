# PdfViewer 会话存储机制说明

## 📋 概述

本文档说明 `PdfViewerView.vue` 中 SessionList 会话信息和 ChatView 历史消息的存储位置和机制。

---

## 1. 会话信息存储（SessionList）

### 1.1 存储位置

**存储方式**：`localStorage`  
**存储键格式**：`{userId}_ai-textbook-sessions`  
**管理工具**：`imates-web/src/utils/storage/screenshotSessions.ts`

### 1.2 数据结构

每个会话记录（`QuestionRecord`）包含以下字段：

```typescript
interface QuestionRecord {
  id: string                    // 会话ID（格式：screenshot_${timestamp}）
  question: string              // 用户问题
  answer?: string               // AI回复（可选）
  timestamp: number             // 时间戳
  pinned?: boolean              // 是否置顶
  resourceId?: string           // 关联的资源ID（用于加载消息历史）
  storageKey?: string           // 存储键（格式：ai-textbook-${resourceId}）
  hasImage?: boolean            // 是否包含图片消息（用于判断接口类型）
}
```

### 1.3 存储操作

- **获取所有会话**：`getScreenshotSessions()`
- **添加新会话**：`addScreenshotSession(session)`
- **删除会话**：`deleteScreenshotSession(id)`
- **批量删除**：`batchDeleteScreenshotSessions(ids)`
- **更新会话**：`updateScreenshotSession(session)`

### 1.4 存储示例

```javascript
// localStorage 中的实际存储
{
  "12345_ai-textbook-sessions": [
    {
      "id": "screenshot_1704067200000",
      "question": "这个公式是什么意思？",
      "answer": "这是二次方程的求根公式...",
      "timestamp": 1704067200000,
      "pinned": false,
      "resourceId": "resource_001",
      "storageKey": "ai-textbook-resource_001",
      "hasImage": true
    }
  ]
}
```

---

## 2. ChatView 历史消息存储

### 2.1 存储位置

**存储方式**：`IndexedDB`（降级到 `localStorage`）  
**数据库名**：`ExerciseSolveApp_{userId}`  
**表名**：`chat_history`  
**存储键格式**：`{userId}_chat_history_ai-textbook-${resourceId}`

### 2.2 存储服务

**服务类**：`imates-web/src/services/chat-storage.ts`  
**Store**：`imates-web/src/stores/aiTextbookChatStore.ts`

### 2.3 数据结构

```typescript
interface ChatHistoryData {
  questionId: string           // 存储键（格式：ai-textbook-${resourceId}）
  messages: ChatBubble[]        // 消息列表
  chatResponseTimes: number     // 聊天响应次数
  lastUpdated: number          // 最后更新时间戳
}

interface ChatBubble {
  id: string
  content: string
  sender: 'user' | 'assistant'
  type: 'text' | 'image' | 'voice'
  timestamp: string
  messageId?: string
  messageType?: 'text' | 'image'
  imageData?: {
    filePath: string
    width: number
    height: number
    fileSize: number
    base64DataUrl: string      // base64图片数据（用于UI显示）
  }
  // ... 其他字段
}
```

### 2.4 存储操作

#### 保存消息历史

```typescript
// 在 aiTextbookChatStore 中
const saveChatHistory = async (): Promise<void> => {
  if (!resourceId.value) return
  
  const storageKey = `ai-textbook-${resourceId.value}`
  await asyncStorage.saveChatHistory(storageKey, {
    questionId: storageKey,
    messages: messages.value,
    lastUpdated: Date.now(),
    chatResponseTimes: chatResponseTimes.value
  })
}
```

#### 加载消息历史

```typescript
// 在 aiTextbookChatStore 中
const loadChatHistory = async (id?: string): Promise<void> => {
  const targetResourceId = id || resourceId.value
  if (!targetResourceId) return
  
  const storageKey = `ai-textbook-${targetResourceId}`
  const history = await asyncStorage.loadChatHistory(storageKey)
  
  if (history && history.messages) {
    messages.value = history.messages
    chatResponseTimes.value = history.chatResponseTimes || 0
    useScreenshotApi.value = messages.value.some(msg => 
      msg.messageType === 'image' || msg.imageData
    )
  }
}
```

### 2.5 存储示例

```javascript
// IndexedDB 中的实际存储
{
  "12345_chat_history_ai-textbook-resource_001": {
    "questionId": "ai-textbook-resource_001",
    "messages": [
      {
        "id": "msg_001",
        "content": "这个公式是什么意思？",
        "sender": "user",
        "type": "image",
        "messageType": "image",
        "timestamp": "2024-01-01T10:00:00.000Z",
        "imageData": {
          "filePath": "screenshot-1704067200000.jpg",
          "width": 800,
          "height": 600,
          "fileSize": 102400,
          "base64DataUrl": "data:image/jpeg;base64,/9j/4AAQ..."
        }
      },
      {
        "id": "msg_002",
        "content": "这是二次方程的求根公式...",
        "sender": "assistant",
        "type": "text",
        "timestamp": "2024-01-01T10:00:05.000Z"
      }
    ],
    "chatResponseTimes": 1,
    "lastUpdated": 1704067205000
  }
}
```

---

## 3. 会话切换流程

### 3.1 切换流程

当用户在 SessionList 中点击一个会话时，触发以下流程：

```typescript
// 1. 用户点击会话（PdfViewerView.vue）
const handleQuestionRecordClick = async (record: QuestionRecord) => {
  selectedRecordId.value = record.id
  await loadSessionDetail(record)
}

// 2. 加载会话详情（PdfViewerView.vue）
const loadSessionDetail = async (record: QuestionRecord) => {
  // 步骤1：设置 resourceId
  if (record.resourceId) {
    aiTextbookStore.setResourceId(record.resourceId)
  }
  
  // 步骤2：从存储中加载消息历史
  if (record.storageKey) {
    await aiTextbookStore.loadChatHistory(record.storageKey)
    // 如果会话包含图片消息，标记使用截图接口
    if (record.hasImage) {
      aiTextbookStore.useScreenshotApi = true
    }
  }
  
  // 步骤3：如果存储中没有消息，使用降级方案重建消息
  if (loadedMessages.length === 0) {
    // 根据 QuestionRecord 重建消息历史
    // ...
  }
}
```

### 3.2 关键步骤说明

1. **设置 resourceId**：将当前会话的 `resourceId` 设置到 `aiTextbookChatStore` 中
2. **加载消息历史**：使用 `storageKey`（格式：`ai-textbook-${resourceId}`）从 IndexedDB 加载完整的消息历史
3. **标记接口类型**：如果会话包含图片消息（`hasImage: true`），标记使用截图接口
4. **降级方案**：如果存储中没有消息，根据 `QuestionRecord` 中的 `question` 和 `answer` 重建消息历史

---

## 4. 存储关系图

```
┌─────────────────────────────────────────────────────────┐
│              PdfViewerView.vue                          │
│                                                          │
│  ┌──────────────────┐      ┌──────────────────┐         │
│  │   SessionList    │      │    ChatView      │         │
│  │                  │      │                  │         │
│  │  QuestionRecord  │      │  ChatBubble[]    │         │
│  │  (会话列表)      │      │  (消息列表)      │         │
│  └──────────────────┘      └──────────────────┘         │
│         │                           │                    │
│         │                           │                    │
│         ▼                           ▼                    │
│  ┌──────────────────┐      ┌──────────────────┐         │
│  │  localStorage    │      │   IndexedDB      │         │
│  │                  │      │                  │         │
│  │  Key:            │      │  DB:              │         │
│  │  {userId}_       │      │  ExerciseSolve   │         │
│  │  ai-textbook-    │      │  App_{userId}    │         │
│  │  sessions        │      │                  │         │
│  │                  │      │  Table:          │         │
│  │  Value:          │      │  chat_history    │         │
│  │  QuestionRecord[]│      │                  │         │
│  │                  │      │  Key:            │         │
│  │                  │      │  {userId}_       │         │
│  │                  │      │  chat_history_   │         │
│  │                  │      │  ai-textbook-    │         │
│  │                  │      │  {resourceId}    │         │
│  │                  │      │                  │         │
│  │                  │      │  Value:          │         │
│  │                  │      │  ChatHistoryData │         │
│  └──────────────────┘      └──────────────────┘         │
│         │                           │                    │
│         │                           │                    │
│         └───────────┬───────────────┘                    │
│                     │                                    │
│                     ▼                                    │
│            ┌──────────────────┐                          │
│            │  QuestionRecord  │                          │
│            │  .storageKey     │                          │
│            │  (关联键)        │                          │
│            └──────────────────┘                          │
└─────────────────────────────────────────────────────────┘
```

---

## 5. 关键代码位置

### 5.1 会话信息管理

- **存储工具**：`imates-web/src/utils/storage/screenshotSessions.ts`
- **类型定义**：`imates-web/src/types/chat.ts`（`QuestionRecord` 接口）
- **使用位置**：`imates-web/src/views/PdfViewerView.vue`（`loadSessions`、`handleQuestionRecordClick` 等）

### 5.2 消息历史管理

- **存储服务**：`imates-web/src/services/chat-storage.ts`（`AsyncStorageService`）
- **Store**：`imates-web/src/stores/aiTextbookChatStore.ts`（`saveChatHistory`、`loadChatHistory`）
- **使用位置**：`imates-web/src/views/PdfViewerView.vue`（`loadSessionDetail`）

### 5.3 组件

- **SessionList**：`imates-web/src/components/SessionList.vue`
- **ChatView**：`imates-web/src/components/ChatView.vue`

---

## 6. 注意事项

1. **存储键格式**：
   - 会话列表：`{userId}_ai-textbook-sessions`
   - 消息历史：`{userId}_chat_history_ai-textbook-${resourceId}`

2. **关联关系**：
   - `QuestionRecord.storageKey` 用于关联消息历史
   - 格式：`ai-textbook-${resourceId}`（不包含 `{userId}_chat_history_` 前缀）

3. **降级方案**：
   - IndexedDB 不可用时自动降级到 localStorage
   - 如果存储中没有消息历史，使用 `QuestionRecord` 中的 `question` 和 `answer` 重建消息

4. **图片消息**：
   - 图片的 `base64DataUrl` 会完整保存到 IndexedDB 中
   - 用于重新打开会话时显示图片

5. **账号隔离**：
   - 所有存储都使用 `userId` 作为前缀，实现多账号数据隔离

---

## 7. 调试方法

### 7.1 查看会话列表

```javascript
// 在浏览器控制台执行
const userId = localStorage.getItem('currentUserId') || 'default'
const key = `${userId}_ai-textbook-sessions`
const sessions = JSON.parse(localStorage.getItem(key) || '[]')
console.log('会话列表:', sessions)
```

### 7.2 查看消息历史

```javascript
// 在浏览器控制台执行
// 打开 IndexedDB
// 数据库名：ExerciseSolveApp_{userId}
// 表名：chat_history
// 查找键：{userId}_chat_history_ai-textbook-{resourceId}
```

### 7.3 使用调试面板

开发环境下可以使用 `PdfDebugPanel` 组件查看和调试存储数据。



