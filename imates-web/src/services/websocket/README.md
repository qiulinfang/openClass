# 通用WebSocket服务使用指南

## 概述

通用WebSocket服务 (`webSocketService.ts`) 提供了统一的WebSocket连接管理，支持多种聊天类型的实时通信。

## 架构设计

```
WebSocket服务层
├── WebSocketService (核心类)
├── getWebSocketService() (实例管理)
├── destroyWebSocketService() (清理管理)
└── 支持的事件类型
```

## 支持的聊天类型

### 1. 教师聊天 (`teacher`)
- **用途**: 学生与教师的对话（适配研伴后端限制）
- **WebSocket URL**: `wss://[yanban-domain]/ws` (研伴后端实际路径)
- **支持的消息类型**:
  - ✅ `TYPE_NEW_QUESTION`: 新问题推送通知
  - ❌ `CHAT`: 发送消息（研伴后端不支持）
  - ❌ `TEACHER_RESPONSE`: 教师回复推送（研伴后端不支持）
  - ❌ `SESSION_UPDATE`: 会话更新（研伴后端不支持）

### 2. 客户端聊天 (`client`)
- **用途**: 用户与客服的实时对话
- **注意**: 由于认证复杂性，客户端聊天**不支持**通过通用服务访问
- **推荐**: 直接使用 `useUserClientStore()`

## 使用方法

### 教师聊天

```typescript
import { getWebSocketService } from '@/services/websocket/webSocketService'

// 获取教师WebSocket服务实例
const teacherWS = getWebSocketService('teacher')

// 连接WebSocket
await teacherWS.connect()

// 设置会话ID
teacherWS.setSessionId('session-123')

// 发送消息（研伴后端不支持WebSocket发送，使用HTTP API）
teacherWS.sendTeacherMessage('session-123', 'Hello teacher!', '0') // 实际无效

// 监听新问题通知（研伴后端支持）
teacherWS.on('new_question', (message) => {
  console.log('收到新问题通知:', message)
  // 可以触发刷新会话列表等操作
})

// 监听教师回复（研伴后端暂不支持）
teacherWS.on('teacher_response', (message) => {
  console.log('收到教师回复(预留功能):', message)
})

// 断开连接
teacherWS.disconnect()
```

### 客户端聊天

```typescript
// ❌ 不推荐：通过通用服务访问客户端WebSocket
// const clientWS = getWebSocketService('client') // 会抛出错误

// ✅ 推荐：直接使用userClientStore
import { useUserClientStore } from '@/stores/userClientStore'

const clientStore = useUserClientStore()
// 使用store的方法进行WebSocket操作
await clientStore.connect()
```

## API参考

### WebSocketService类

#### 构造函数
```typescript
constructor(config: WebSocketConfig)
```

#### 方法

##### 连接管理
- `connect(): Promise<boolean>` - 连接到WebSocket服务器
- `disconnect(): void` - 断开连接
- `isConnected(): boolean` - 获取连接状态
- `getConnectionStatus(): string` - 获取连接状态文本

##### 消息发送
- `sendMessage(message: WebSocketMessage): void` - 发送通用消息
- `sendTeacherMessage(sessionId: string, content: string, msgType?: string): void` - 发送教师消息
- `sendClientMessage(content: string, msgType?: string): void` - 发送客户端消息（不推荐）

##### 会话管理
- `setSessionId(sessionId: string): void` - 设置当前会话ID
- `getCurrentSessionId(): string | null` - 获取当前会话ID

##### 事件监听
- `on(event: WebSocketEventType, callback): void` - 添加事件监听器
- `off(event: WebSocketEventType, callback?): void` - 移除事件监听器

### 事件类型

```typescript
type WebSocketEventType =
  | 'connected'      // 连接成功
  | 'disconnected'   // 连接断开
  | 'error'          // 连接错误
  | 'message'        // 通用消息
  | 'new_question'   // ✅ 新问题通知（研伴后端支持）
  | 'teacher_response' // ❌ 教师回复（研伴后端不支持）
  | 'session_update'   // ❌ 会话更新（研伴后端不支持）
  | 'system'          // 系统消息
  | 'user_join'       // 用户加入
  | 'user_leave'      // 用户离开
  | 'agent_join'      // 客服加入
  | 'read_status'     // 已读状态
```

**✅ 支持**: `connected`, `disconnected`, `error`, `new_question`  
**❌ 预留**: `teacher_response`, `session_update` (研伴后端暂不支持)

## 🔧 研伴后端适配说明

### 功能适配状态

| 功能 | 支持情况 | 说明 |
|------|----------|------|
| **WebSocket连接** | ✅ | 连接到 `/ws` 端点 |
| **新问题推送** | ✅ | `TYPE_NEW_QUESTION` 消息 |
| **消息发送** | ❌ | 研伴后端不支持，使用HTTP API |
| **教师回复推送** | ❌ | 研伴后端不支持，使用HTTP轮询 |
| **会话更新推送** | ❌ | 研伴后端不支持 |

### 适配策略

1. **连接端点**: 使用 `/ws` 而不是 `/teacher/ws`
2. **消息发送**: 通过HTTP API (`/api/api/question/replyMessage`)
3. **消息接收**: WebSocket只接收推送通知，不接收聊天消息
4. **预留接口**: 为未来功能扩展预留事件监听器

## 当前使用情况

### ✅ 已集成
- **教师聊天**: `teacher-chat-api.ts` 和 `teacherChatStore.ts` (已适配研伴后端)

### ❌ 未集成（建议保持现状）
- **客户端聊天**: `FeedbackDialog.vue` 和 `userClientStore.ts`
  - 原因：客户端WebSocket包含复杂的IM认证逻辑，不适合通用化

## 最佳实践

### 1. 实例管理
```typescript
// 获取实例
const ws = getWebSocketService('teacher')

// 使用完毕后清理
destroyWebSocketService('teacher')
```

### 2. 错误处理
```typescript
try {
  const connected = await ws.connect()
  if (!connected) {
    console.error('WebSocket连接失败')
  }
} catch (error) {
  console.error('连接异常:', error)
}
```

### 3. 事件清理
```typescript
// 添加监听器
const handleMessage = (message) => { /* 处理消息 */ }
ws.on('message', handleMessage)

// 清理监听器
ws.off('message', handleMessage)
```

### 4. 连接状态检查
```typescript
if (ws.isConnected()) {
  ws.sendMessage({ type: 'CHAT', content: 'Hello' })
} else {
  console.warn('WebSocket未连接')
}
```

## 注意事项

1. **单例模式**: 相同类型的WebSocket服务是单例的
2. **自动重连**: 服务会自动处理断线重连
3. **心跳机制**: 默认30秒心跳保活连接
4. **类型安全**: 使用TypeScript类型定义确保消息格式正确
5. **资源清理**: 组件卸载时务必调用清理方法

## 扩展指南

如需添加新的聊天类型：

1. 在 `getWebSocketService()` 中添加新的type处理逻辑
2. 配置对应的WebSocket URL
3. 定义专用的消息发送方法（如 `sendTeacherMessage`）
4. 添加相应的事件类型支持
