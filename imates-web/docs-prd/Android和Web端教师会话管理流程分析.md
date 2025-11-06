# Android和Web端教师会话管理流程分析

## 概述

本文档详细分析Android端和Web端在教师会话管理、消息发送和接收方面的完整流程，包括数据存储、消息传递和状态同步机制。

---

## 📌 教师消息监听器详解

### 什么是教师消息监听器？

**教师消息监听器（Teacher Message Listener）**是一个**双向通信机制**，用于在Android端和Web端之间传递教师发送的消息。

### 监听器的组成

教师消息监听器由**三层架构**组成：

#### 1. **RabbitMQ层**（最底层）
- **职责**：从RabbitMQ消息队列接收教师回复
- **位置**：`RabbitMQManager.startListeningForTeacherReplies()`
- **机制**：监听学生专属队列（`student_queue_{userId}`）

```java
// RabbitMQManager.java
channel.basicConsume(studentQueueName, false, deliverCallback, consumerTag -> {
    // 当有新消息时，deliverCallback会被调用
});
```

#### 2. **MessagingManager层**（中间层）
- **职责**：管理消息监听器列表，分发消息到所有监听器
- **位置**：`MessagingManager.java`
- **机制**：使用观察者模式，维护多个监听器

```java
// MessagingManager.java
private final List<MessageListener> messageListeners = new ArrayList<>();

// 收到消息时，分发给所有监听器
for (MessageListener listener : messageListeners) {
    listener.onTeacherMessageReceived(chatMsg);
}
```

#### 3. **WebAppInterface层**（接口层）
- **职责**：将Android端消息转换为JSON，通过JavaScript回调传递给Web端
- **位置**：`WebAppInterface.java`
- **机制**：调用JavaScript函数 `window.onTeacherMessageReceived()`

```java
// WebAppInterface.java
private void notifyTeacherMessageReceived(ChatMessage teacherMessage) {
    // 构建JSON
    JSONObject messageJson = new JSONObject();
    messageJson.put("messageId", teacherMessage.messageId);
    // ...
    
    // 调用JavaScript回调
    String script = "if (window.onTeacherMessageReceived) { " +
                   "window.onTeacherMessageReceived(" + messageJson.toString() + "); }";
    executeJavaScript(script);
}
```

### 监听器的工作流程

```
┌─────────────────────────────────────────────────────────────┐
│ 【第1层】RabbitMQ接收消息                                     │
│ └─> RabbitMQ队列收到教师消息                                 │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 【第2层】MessagingManager处理                                 │
│ ├─> 解析JSON → TeacherMessage                               │
│ ├─> 转换为ChatMessage                                       │
│ ├─> 保存文件（图片/语音）                                    │
│ └─> 分发给所有监听器                                        │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 【第3层】WebAppInterface通知Web端                            │
│ ├─> 构建消息JSON                                            │
│ └─> 调用 window.onTeacherMessageReceived(messageJson)       │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 【Web端】处理消息                                            │
│ ├─> 解析消息数据                                            │
│ ├─> 检查会话匹配                                            │
│ ├─> 添加到消息列表                                          │
│ └─> 保存到IndexedDB                                         │
└─────────────────────────────────────────────────────────────┘
```

### 初始化监听器

#### Android端初始化

```java
// WebAppInterface.java
@JavascriptInterface
public String initTeacherMessageListener() {
    // 1. 初始化MessagingManager（建立RabbitMQ连接）
    MessagingManager.getInstance().initialize(mContext, userId);
    
    // 2. 添加消息监听器（将WebAppInterface注册为监听器）
    MessagingManager.getInstance().addMessageListener(
        this::notifyTeacherMessageReceived
    );
    
    return createResponse(true, "老师消息监听器初始化成功", null);
}
```

#### Web端初始化

```typescript
// teacherChatStore.ts
const doInitMessageReceiver = async (): Promise<void> => {
  // 1. 设置全局回调函数（Android端会调用这个函数）
  window.onTeacherMessageReceived = async (messageData: unknown) => {
    // 处理消息...
  }
  
  // 2. 调用Android Bridge初始化监听器
  const result = window.AndroidBridge.initTeacherMessageListener()
  
  // 3. 等待初始化完成（最多10秒）
  // ...
}
```

### 监听器的特点

#### ✅ 支持多个监听器
- `MessagingManager` 维护一个监听器列表
- 可以同时注册多个监听器
- 消息会分发给所有监听器

#### ✅ 线程安全
- RabbitMQ消息接收在后台线程
- 通过 `mainHandler.post()` 切换到主线程
- 确保UI更新在主线程执行

#### ✅ 自动重连
- 连接断开时自动重连
- 监听器自动恢复

#### ✅ 异常隔离
- 单个监听器的异常不影响其他监听器
- 消息处理失败不会导致监听器崩溃

### 清理监听器

```java
// WebAppInterface.java
@JavascriptInterface
public String cleanupTeacherMessageListener() {
    // 移除当前监听器
    MessagingManager.getInstance().removeMessageListener(
        this::notifyTeacherMessageReceived
    );
    return createResponse(true, "老师消息监听器清理成功", null);
}
```

**注意**：清理监听器不会关闭RabbitMQ连接，只是移除当前监听器。如果还有其他监听器，消息仍然会被分发。

---

## 📌 Web端sessionId的作用详解

### sessionId的核心作用

**sessionId（会话ID）**是Web端教师会话管理的**核心标识符**，用于唯一标识一个教师对话会话。它在整个会话生命周期中起到关键作用。

### 1. **会话标识**（核心功能）

sessionId用于唯一标识一个教师对话会话：

```typescript
interface TeacherSession {
  sessionId: string      // 会话唯一标识
  sessionName: string    // 会话名称，如"数学答疑"、"生物答疑"
  subject: string       // 科目：'biology' | 'math'
  createTime: number     // 创建时间戳
}
```

**生成规则**：
- 格式：`teacher-{hash}-{timestamp}` 或 `teacher-{timestamp}`
- 示例：`teacher-abc123-1234567890` 或 `teacher-1234567890`

### 2. **消息关联**（关键功能）

sessionId用于将消息与特定会话关联：

#### 2.1 发送消息时携带sessionId

```typescript
// teacherChatStore.ts - sendMessageToTeacher()
const sessionId = currentSession.value.sessionId
const subject = currentSession.value.subject || 'math'

// 发送消息到Android端
await window.AndroidBridge.sendTextMessageToTeacher(
  content,
  sessionId,  // 携带sessionId
  subject
)
```

**作用**：确保消息发送到正确的会话，Android端会将该sessionId附加到RabbitMQ消息中。

#### 2.2 接收消息时匹配sessionId

```typescript
// teacherChatStore.ts - handleTeacherMessageReceived()
const isCurrentSession = currentSession.value?.sessionId === data.sessionId

if (!isCurrentSession) {
  // 消息不属于当前会话，尝试恢复或创建会话
  await createOrRestoreSessionForMessage(data.sessionId)
}
```

**作用**：
- 判断接收到的消息是否属于当前打开的会话
- 如果不属于，自动恢复或创建对应的会话
- 如果无法恢复，标记为未读消息

### 3. **数据存储**（持久化功能）

sessionId用作存储键的一部分，用于持久化会话信息和聊天历史：

#### 3.1 会话信息存储

```typescript
// 存储键格式
const storageKey = `${userId}_teacher_chat_${sessionId}_session`

// 存储会话信息到localStorage
localStorage.setItem(storageKey, JSON.stringify(session))
```

**存储位置**：`localStorage`  
**数据内容**：会话元数据（sessionId、sessionName、subject、createTime）

#### 3.2 聊天历史存储

```typescript
// 存储键格式
const storageKey = `teacher_chat_${sessionId}`

// 存储聊天历史到IndexedDB（降级到localStorage）
await asyncStorage.saveChatHistory(storageKey, {
  messages: messages.value,
  chatResponseTimes: chatResponseTimes.value
})
```

**存储位置**：`IndexedDB`（优先）或 `localStorage`（降级）  
**数据内容**：消息列表、聊天响应次数等

### 4. **会话切换和加载**（导航功能）

sessionId用于在不同会话之间切换和加载：

```typescript
// 加载指定会话的聊天历史
const loadChatHistory = async (sessionId: string): Promise<void> => {
  const storageKey = `teacher_chat_${sessionId}`
  const history = await asyncStorage.loadChatHistory(storageKey)
  
  if (history && history.messages) {
    messages.value = history.messages  // 加载消息列表
    currentSession.value = session     // 设置当前会话
  }
}
```

**作用**：
- 切换会话时，根据sessionId加载对应的聊天历史
- 保证用户看到的是正确的会话内容

### 5. **未读消息标记**（状态管理）

sessionId用于标记会话的未读状态：

```typescript
// 标记未读
const unreadKey = `teacher_${sessionId}`
unreadStore.markUnread(unreadKey)

// 清除未读
unreadStore.clearUnread(unreadKey)
```

**作用**：
- 当收到不属于当前会话的消息时，标记该会话为未读
- 当用户切换到该会话时，清除未读标记

### 6. **会话列表管理**（组织功能）

sessionId用于识别和管理会话列表：

```typescript
// 加载所有会话
const userId = getCurrentUserIdOrDefault()
const sessionPrefix = `${userId}_teacher_chat_`

// 遍历localStorage查找所有教师会话
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i)
  if (key?.startsWith(sessionPrefix) && key.endsWith('_session')) {
    // 提取sessionId
    const sessionId = key.replace(sessionPrefix, '').replace('_session', '')
    const session = JSON.parse(localStorage.getItem(key))
    // 添加到会话列表
  }
}
```

**作用**：
- 通过sessionId识别不同的会话
- 在会话列表中显示和管理多个会话

### 7. **消息过滤和路由**（分发功能）

sessionId用于将接收到的消息路由到正确的会话：

```typescript
// 接收消息时
const data = { sessionId: 'teacher-123', content: '...', ... }

// 检查消息是否属于当前会话
if (currentSession.value?.sessionId === data.sessionId) {
  // 属于当前会话，直接添加到消息列表
  addMessage(convertToChatBubble(data))
} else {
  // 不属于当前会话，尝试恢复会话或标记未读
  await createOrRestoreSessionForMessage(data.sessionId)
}
```

**作用**：
- 确保消息被正确分发到对应的会话
- 防止消息混乱或丢失

### sessionId的生命周期

```
┌─────────────────────────────────────────────────────────────┐
│ 1. 会话创建                                                  │
│    generateSessionId() → "teacher-abc123-1234567890"        │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. 会话保存                                                  │
│    localStorage.setItem(`${userId}_teacher_chat_${sessionId}_session`) │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. 消息发送                                                  │
│    sendTextMessageToTeacher(content, sessionId, subject)     │
│    → Android端将sessionId附加到RabbitMQ消息                  │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. 消息接收                                                  │
│    handleTeacherMessageReceived(data)                       │
│    → 通过data.sessionId匹配会话                             │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. 聊天历史存储                                              │
│    saveChatHistory(sessionId)                               │
│    → 以sessionId为键存储到IndexedDB                         │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. 会话切换                                                  │
│    loadChatHistory(sessionId)                               │
│    → 根据sessionId加载对应的聊天历史                         │
└─────────────────────────────────────────────────────────────┘
```

### 关键设计要点

1. **唯一性**：每个会话都有唯一的sessionId
2. **持久化**：sessionId作为存储键的一部分，确保数据持久化
3. **关联性**：所有消息都携带sessionId，确保消息与会话关联
4. **路由性**：通过sessionId将消息路由到正确的会话
5. **状态管理**：通过sessionId管理会话的未读状态

### 常见问题

#### Q1: 为什么需要sessionId？
**A**: sessionId用于唯一标识会话，确保消息、聊天历史、未读状态等都能正确关联到对应的会话。

#### Q2: sessionId如何生成？
**A**: 通常基于时间戳和哈希值生成，格式为 `teacher-{hash}-{timestamp}` 或 `teacher-{timestamp}`。

#### Q3: 如果sessionId丢失会怎样？
**A**: 如果sessionId丢失，将无法：
- 加载对应的聊天历史
- 正确关联接收到的消息
- 管理会话的未读状态

#### Q4: sessionId在Android端的作用？
**A**: Android端将sessionId附加到RabbitMQ消息中，用于：
- 标识消息属于哪个会话
- 服务器端可以根据sessionId进行消息路由和处理

---

## 📌 RabbitMQ连接配置详解

### 建立RabbitMQ连接需要的数据

建立RabbitMQ连接需要以下**两类数据**：

#### 1. **连接参数**（必需）

这些参数用于建立与RabbitMQ服务器的连接：

| 参数 | 来源 | 说明 | 示例值 |
|------|------|------|--------|
| **HOST** | `ApiUrl.MQ_HOST_BASE` | RabbitMQ服务器地址 | `www.imates.com.cn` |
| **PORT** | `ApiUrl.MQ_HOST_PORT` | RabbitMQ服务器端口 | `5673` |
| **USERNAME** | 硬编码 | 用户名 | `admin` |
| **PASSWORD** | 硬编码 | 密码 | `admin` |
| **VIRTUAL_HOST** | 硬编码 | 虚拟主机 | `/` |
| **userId** | `AppUtils.getUserId()` | 学生用户ID | 用于生成专属队列 |

**关键代码**：

```java
// RabbitMQManager.java
private static final String HOST = ApiUrl.MQ_HOST_BASE;  // 从ApiUrl获取
private static final int PORT = ApiUrl.MQ_HOST_PORT;     // 从ApiUrl获取
private static final String USERNAME = "admin";           // 硬编码
private static final String PASSWORD = "admin";           // 硬编码
private static final String VIRTUAL_HOST = "/";             // 硬编码

// 创建连接
ConnectionFactory factory = new ConnectionFactory();
factory.setHost(HOST);
factory.setPort(PORT);
factory.setUsername(USERNAME);
factory.setPassword(PASSWORD);
factory.setVirtualHost(VIRTUAL_HOST);
factory.setAutomaticRecoveryEnabled(true);  // 启用自动重连
factory.setNetworkRecoveryInterval(5000);    // 重连间隔5秒
```

#### 2. **Exchange和Queue配置**（必需）

这些参数用于声明和配置消息交换机和队列：

| 配置项 | 值 | 说明 |
|--------|-----|------|
| **EXCHANGE_NAME** | `student_teacher_exchange` | Direct类型的交换机 |
| **EXCHANGE_TYPE** | `direct` | 交换机类型 |
| **ROUTE_KEY_STUDENT_TO_TEACHER** | `student_route_teacher` | 学生→教师的路由键 |
| **ROUTE_KEY_TEACHER_TO_STUDENT** | `teacher_route_student_{userId}` | 教师→学生的路由键（动态） |
| **TEACHER_QUEUE_NAME** | `QUESTION_RECEIVE_QUEUE` | 教师的共享队列 |
| **STUDENT_QUEUE_NAME** | `{userId}_a` | 学生的私有队列（动态） |

**关键代码**：

```java
// 声明Exchange
channel.exchangeDeclare(EXCHANGE_NAME, EXCHANGE_TYPE, true);

// 声明教师队列（持久化）
channel.queueDeclare(TEACHER_QUEUE_NAME, true, false, false, null);

// 声明学生接收队列（持久化）
String studentQueueName = userId + "_a";
channel.queueDeclare(studentQueueName, true, false, false, null);

// 绑定教师队列到Exchange
channel.queueBind(TEACHER_QUEUE_NAME, EXCHANGE_NAME, ROUTE_KEY_STUDENT_TO_TEACHER);

// 绑定学生队列到Exchange
String routeKeyTeacherToStudent = "teacher_route_student_" + userId;
channel.queueBind(studentQueueName, EXCHANGE_NAME, routeKeyTeacherToStudent);
```

### 配置初始化流程

RabbitMQ连接配置的初始化流程：

```
┌─────────────────────────────────────────────────────────────┐
│ 1. 应用启动                                                  │
│    ApplicationModelShared.onCreate()                        │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. 检查环境配置                                              │
│    AppEnvConfig.checkAndUpdateVersion(context)               │
│    └─> 根据环境类型（RELEASE/INTERNAL_TEST）设置配置          │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. 设置RabbitMQ配置                                          │
│    ApiUrl.switchEnv(envType)                                │
│    ├─> MQ_HOST_BASE = "www.imates.com.cn"                   │
│    └─> MQ_HOST_PORT = 5673                                  │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. 初始化消息监听器                                          │
│    Web端调用 initTeacherMessageListener()                    │
│    └─> MessagingManager.initialize(context, userId)          │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. 建立RabbitMQ连接                                          │
│    RabbitMQManager.initialize()                             │
│    ├─> 使用ApiUrl中的HOST和PORT                             │
│    ├─> 创建ConnectionFactory                                │
│    ├─> 建立连接和通道                                        │
│    ├─> 声明Exchange和队列                                    │
│    └─> 绑定队列到Exchange                                    │
└─────────────────────────────────────────────────────────────┘
```

### 环境配置说明

根据环境类型，RabbitMQ配置会有所不同：

#### RELEASE（生产环境）
```java
MQ_HOST_BASE = "www.imates.com.cn"
MQ_HOST_PORT = 5673
```

#### INTERNAL_TEST（内部测试环境）
```java
MQ_HOST_BASE = "www.imates.com.cn"
MQ_HOST_PORT = 5673
```

**注意**：当前代码中，两个环境使用相同的RabbitMQ服务器地址和端口。

### 连接验证

在建立连接前，代码会验证配置的有效性：

```java
// 验证HOST配置
if (HOST == null || HOST.isEmpty()) {
    throw new IllegalStateException(
        "RabbitMQ HOST配置未初始化. 请确保ApiUrl.switchEnv()已被调用"
    );
}

// 验证PORT配置
if (PORT <= 0 || PORT > 65535) {
    throw new IllegalStateException(
        "RabbitMQ PORT配置无效. 请确保ApiUrl.switchEnv()已被调用"
    );
}
```

### 连接特性

- **自动重连**：`setAutomaticRecoveryEnabled(true)`
- **重连间隔**：5秒（`setNetworkRecoveryInterval(5000)`）
- **消息持久化**：队列和消息都设置为持久化（`durable=true`）
- **手动确认**：消息消费使用手动确认模式（`autoAck=false`）

### 常见问题

#### Q1: 连接失败，提示"HOST配置未初始化"
**原因**：`ApiUrl.switchEnv()` 未被调用  
**解决**：确保在应用启动时调用 `AppEnvConfig.checkAndUpdateVersion(context)`

#### Q2: 连接失败，提示"PORT配置无效"
**原因**：`ApiUrl.MQ_HOST_PORT` 为0或超出范围  
**解决**：检查 `ApiUrl.switchEnv()` 是否正确设置了PORT值

#### Q3: 连接建立成功，但无法接收消息
**原因**：可能是队列未正确绑定到Exchange  
**解决**：检查路由键是否正确，确保教师的回复使用正确的路由键格式：`teacher_route_student_{userId}`

---

## 一、Android端教师会话管理

### 1.1 会话存储机制

**重要**：Android端**不直接存储**教师会话信息，会话管理由Web端负责。

#### 会话管理职责分工

- **Web端**：负责会话的创建、存储、加载、删除
  - 会话信息存储在 `localStorage`
  - 聊天历史存储在 `IndexedDB` 或 `localStorage`
  
- **Android端**：负责消息的发送和接收
  - 通过RabbitMQ发送消息到服务器
  - 通过RabbitMQ监听教师回复
  - **不存储会话元数据**（会话ID、会话名称等由Web端管理）

### 1.2 Android端核心组件

#### MessagingManager（消息管理器）

**位置**：`app/src/main/java/com/cosinetech/imates/teachermessagemq/MessagingManager.java`

**职责**：
- 管理RabbitMQ连接
- 发送学生消息到RabbitMQ
- 监听教师回复消息
- 消息分发到监听器

**关键方法**：

```java
// 初始化RabbitMQ连接和监听
public void initialize(Context context, String userId)

// 发送消息到教师
public void sendMessageToTeacher(StudentMessage message, SendCallback callback)

// 添加消息监听器
public void addMessageListener(MessageListener listener)

// 移除消息监听器
public void removeMessageListener(MessageListener listener)
```

#### RabbitMQManager（RabbitMQ管理器）

**位置**：`app/src/main/java/com/cosinetech/imates/teachermessagemq/RabbitMQManager.java`

**职责**：
- 建立RabbitMQ连接
- 管理消息队列
- 发送消息到教师队列
- 监听学生队列接收教师回复

**关键方法**：

```java
// 发送消息到教师
public String sendMessageToTeacher(StudentMessage message)

// 开始监听教师回复
public void startListeningForTeacherReplies(MessageCallback callback)
```

#### WebAppInterface（Web桥接接口）

**位置**：`app/src/main/java/com/cosinetech/imates/ui/webview/common/WebAppInterface.java`

**职责**：
- 提供JavaScript接口供Web端调用
- 处理Web端发送消息的请求
- 将接收到的教师消息通知到Web端

**关键方法**：

```java
// 发送文本消息给教师
@JavascriptInterface
public String sendTextMessageToTeacher(String content, String sessionId, String subject)

// 发送图片消息给教师
@JavascriptInterface
public String sendPictureToTeacher(String imagePath, String sessionId, String subject)

// 发送语音消息给教师
@JavascriptInterface
public String sendVoiceMessageToTeacher(String voicePath, String duration, String sessionId, String subject)

// 初始化教师消息监听器
@JavascriptInterface
public String initTeacherMessageListener()

// 清理教师消息监听器
@JavascriptInterface
public String cleanupTeacherMessageListener()
```

---

## 二、Android端消息接收流程

### 2.1 初始化消息监听

**触发时机**：Web端调用 `initTeacherMessageListener()` 时

**流程**：

```
1. Web端调用 initTeacherMessageListener()
   └─> WebAppInterface.initTeacherMessageListener()

2. 初始化MessagingManager
   ├─> MessagingManager.getInstance().initialize(context, userId)
   └─> 在线程池中执行初始化

3. 创建RabbitMQManager
   ├─> 建立RabbitMQ连接
   ├─> 创建学生队列（student_queue_{userId}）
   └─> 绑定到教师回复交换机

4. 开始监听教师回复
   ├─> rabbitMQManager.startListeningForTeacherReplies(callback)
   └─> 设置消息消费回调

5. 添加消息监听器
   └─> MessagingManager.addMessageListener(WebAppInterface::notifyTeacherMessageReceived)
```

**关键代码**：

```java
// WebAppInterface.java
@JavascriptInterface
public String initTeacherMessageListener() {
    String userId = AppUtils.getUserId();
    
    // 初始化MessagingManager
    MessagingManager.getInstance().initialize(mContext, userId);
    
    // 添加消息监听器
    MessagingManager.getInstance().addMessageListener(this::notifyTeacherMessageReceived);
    
    return createResponse(true, "老师消息监听器初始化成功", null);
}
```

### 2.2 接收教师消息流程

**完整流程**：

```
┌─────────────────────────────────────────────────────────────┐
│ 1. RabbitMQ接收消息                                          │
│    └─> RabbitMQManager.startListeningForTeacherReplies()    │
│        └─> DeliverCallback.onReceive()                      │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. 解析消息JSON                                              │
│    └─> new TeacherMessage(jsonObject)                       │
│        └─> 解析messageId, sessionId, messageType, content等 │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. 转换为ChatMessage                                         │
│    └─> teacherMessage.toChatMessage()                       │
│        ├─> 文本消息：直接创建ChatMessage                    │
│        ├─> 图片消息：保存图片到本地，设置filePath             │
│        └─> 语音消息：保存语音到本地，获取时长，设置filePath  │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. 分发到主线程                                              │
│    └─> mainHandler.post(() -> {                             │
│            for (MessageListener listener : messageListeners) │
│                listener.onTeacherMessageReceived(chatMsg);   │
│        })                                                    │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. 通知Web端                                                 │
│    └─> WebAppInterface.notifyTeacherMessageReceived()        │
│        ├─> 构建消息JSON                                      │
│        ├─> 添加调试日志（如果有）                            │
│        └─> 调用JavaScript回调                               │
│            └─> window.onTeacherMessageReceived(messageJson)  │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 消息类型处理

#### 文本消息

```java
// TeacherMessage.java
case TeacherQaType.QA_MSG_TYPE_TEXT:
    chatMessage = new ChatMessage(
        this.getContent(),           // 文本内容
        false,                       // isSelf
        ChatMessage.MessageType.TEXT,
        this.getSessionId(),
        this.getTimestamp(),
        ChatAiView.ChatRole.CHAT_ROLE_TEACHER
    );
    break;
```

#### 图片消息

```java
// TeacherMessage.java
case TeacherQaType.QA_MSG_TYPE_PICTURE:
    chatMessage = new ChatMessage(
        "",                          // content为空（图片不显示文字）
        false,
        ChatMessage.MessageType.IMAGE,
        this.getSessionId(),
        this.getTimestamp(),
        ChatAiView.ChatRole.CHAT_ROLE_TEACHER
    );
    
    // 保存图片到本地
    String filePath = baseDir.getAbsolutePath() + "/" + chatMessage.messageId + ".png";
    ImageUtils.saveImageFile(this.getContent(), filePath);  // content是base64数据
    chatMessage.content = filePath;  // 设置文件路径
    break;
```

**处理逻辑**：
1. 从消息中获取base64图片数据（`content`字段）
2. 保存到本地文件系统（`{用户目录}/{messageId}.png`）
3. 将文件路径设置到`chatMessage.content`

#### 语音消息

```java
// TeacherMessage.java
case TeacherQaType.QA_MSG_TYPE_VOICE:
    chatMessage = new ChatMessage(
        "",
        false,
        ChatMessage.MessageType.VOICE,
        this.getSessionId(),
        this.getTimestamp(),
        ChatAiView.ChatRole.CHAT_ROLE_TEACHER
    );
    
    // 保存语音到本地
    String filePath = baseDir.getAbsolutePath() + "/" + chatMessage.messageId + ".voice";
    VoiceDbUtil.saveVoiceFile(this.getContent(), filePath, debugLogs);
    
    // 获取时长（秒）
    long duration = VoiceDbUtil.getDuration(filePath, debugLogs);
    
    // 设置content为 "duration,filePath" 格式
    chatMessage.content = duration + "," + filePath;
    break;
```

**处理逻辑**：
1. 从消息中获取base64语音数据（`content`字段，格式：`data:audio/aac;base64,{base64数据}`）
2. 保存到本地文件系统（`{用户目录}/{messageId}.voice`）
3. 获取音频时长（秒）
4. 将content设置为 `"duration,filePath"` 格式

**调试日志**：
- Android端会收集详细的调试日志（`VoiceDebugLogs`）
- 日志会传递到Web端，帮助排查问题
- 日志包含文件保存状态、时长获取结果等

### 2.4 消息ID处理

**重要**：Android端会对消息ID进行哈希处理：

```java
// TeacherMessage.java
if(chatMessage != null) {
    // 使用UUID.nameUUIDFromBytes对messageId进行哈希
    chatMessage.messageId = UUID.nameUUIDFromBytes(this.messageId.getBytes()).toString();
}
```

**原因**：
- 确保消息ID的唯一性和一致性
- 与Web端生成sessionId的逻辑保持一致

---

## 三、Web端消息接收流程

### 3.1 初始化消息接收器

**触发时机**：组件挂载或创建教师会话时

**位置**：`teacherChatStore.ts` - `initMessageReceiver()`

**流程**：

```
1. 设置全局回调函数
   └─> window.onTeacherMessageReceived = async (messageData) => { ... }

2. 调用Android Bridge初始化
   └─> window.AndroidBridge.initTeacherMessageListener()

3. 等待初始化完成（最多10秒）
   └─> 轮询检查 isMessagingManagerInitialized()

4. 确保监听器已添加
   └─> 如果已初始化，确保监听器已添加（避免重复）
```

**关键代码**：

```typescript
// teacherChatStore.ts
const doInitMessageReceiver = async (): Promise<void> => {
  // 第1步：设置全局回调
  window.onTeacherMessageReceived = async (messageData: unknown) => {
    // 处理消息...
  }
  
  // 第2步：初始化Android端监听器
  if (!window.AndroidBridge.isMessagingManagerInitialized?.()) {
    const result = window.AndroidBridge.initTeacherMessageListener()
    // 等待初始化完成...
  }
}
```

### 3.2 接收消息处理

**完整流程**：

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Android端调用JavaScript回调                              │
│    └─> window.onTeacherMessageReceived(messageJson)         │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Web端解析消息数据                                         │
│    └─> 解析messageId, sessionId, content, messageType等     │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. 检查会话是否匹配                                          │
│    ├─> 是：直接处理消息                                      │
│    └─> 否：尝试恢复或创建会话                                │
│        ├─> 从localStorage恢复会话                            │
│        └─> 如果不存在，创建新会话                            │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. 处理不同类型的消息                                        │
│    ├─> 文本消息：直接添加到消息列表                          │
│    ├─> 图片消息：处理文件路径或base64数据                    │
│    └─> 语音消息：解析duration和filePath                     │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. 保存聊天历史                                              │
│    └─> saveChatHistory(true)  // 立即保存                    │
└─────────────────────────────────────────────────────────────┘
```

**关键代码**：

```typescript
// teacherChatStore.ts
window.onTeacherMessageReceived = async (messageData: unknown) => {
  const data = messageData as {
    messageId: string
    sessionId: string
    content: string
    messageType: string
    timestamp: number
    debugLogs?: string[]
  }
  
  // 检查是否属于当前会话
  const isCurrentSession = currentSession.value?.sessionId === data.sessionId
  
  // 如果不在当前会话，尝试恢复或创建会话
  if (!isCurrentSession) {
    // 从localStorage恢复会话或创建新会话
    await createOrRestoreSessionForMessage(data.sessionId)
  }
  
  // 处理不同类型的消息
  if (data.messageType === 'IMAGE') {
    // 处理图片消息...
  } else if (data.messageType === 'VOICE') {
    // 处理语音消息...
  } else {
    // 处理文本消息
    const teacherMessage: ChatBubble = {
      id: data.messageId,
      content: data.content,
      type: 'ai',
      timestamp: new Date(data.timestamp).toISOString(),
      sender: 'teacher'
    }
    addMessage(teacherMessage)
    saveChatHistory(true)
  }
}
```

### 3.3 消息类型处理

#### 文本消息

```typescript
const teacherMessage: ChatBubble = {
  id: data.messageId,
  content: data.content,
  type: 'ai',
  timestamp: new Date(data.timestamp).toISOString(),
  sender: 'teacher'
}
addMessage(teacherMessage)
```

#### 图片消息

**情况1：content是文件路径**

```typescript
if (data.content?.startsWith('/storage/') || data.content?.startsWith('/data/')) {
  // 调用Android Bridge转换为base64
  const base64Result = window.AndroidBridge.loadImageFileToBase64(data.content)
  const base64Data = JSON.parse(base64Result)
  
  if (base64Data.success) {
    const imageMessage: ChatBubble = {
      id: data.messageId,
      content: '',
      type: 'ai',
      messageType: 'image',
      imageData: {
        filePath: data.content,
        base64DataUrl: base64Data.data,
        width: 0,
        height: 0,
        fileSize: 0
      }
    }
    addMessage(imageMessage)
  }
}
```

**情况2：content是base64数据**

```typescript
const imageMessage: ChatBubble = {
  id: data.messageId,
  content: '',
  type: 'ai',
  messageType: 'image',
  imageData: {
    filePath: '',
    base64DataUrl: data.content,  // 直接使用base64数据
    width: 0,
    height: 0,
    fileSize: 0
  }
}
addMessage(imageMessage)
```

#### 语音消息

```typescript
// content格式："{duration},{filePath}"
const parts = data.content.split(',')
const durationStr = parts[0].trim()
const filePath = parts.slice(1).join(',')
const duration = parseInt(durationStr, 10) || 0

const teacherMessage: ChatBubble = {
  id: data.messageId,
  content: data.content,
  type: 'ai',
  timestamp: new Date(data.timestamp).toISOString(),
  sender: 'teacher',
  messageType: 'voice',
  voiceData: {
    filePath: filePath,
    duration: duration * 1000,  // 转换为毫秒
    fileSize: 0
  }
}
addMessage(teacherMessage)
```

### 3.4 会话恢复机制

**场景**：学生删除了会话，但教师仍在回复消息

**流程**：

```typescript
// teacherChatStore.ts
const createOrRestoreSessionForMessage = async (sessionId: string): Promise<void> => {
  // 第1步：尝试从localStorage恢复会话
  const userId = getCurrentUserIdOrDefault()
  const sessionKey = `${userId}_teacher_chat_${sessionId}_session`
  const sessionData = localStorage.getItem(sessionKey)
  
  if (sessionData) {
    // 恢复会话
    const restoredSession = JSON.parse(sessionData) as TeacherSession
    currentSession.value = restoredSession
  } else {
    // 第2步：创建新会话（使用默认科目）
    const newSession: TeacherSession = {
      sessionId: sessionId,
      sessionName: '老师答疑',
      subject: 'math',  // 默认数学
      createTime: Date.now()
    }
    
    // 保存到localStorage
    localStorage.setItem(sessionKey, JSON.stringify(newSession))
    currentSession.value = newSession
  }
  
  // 第3步：加载聊天历史（如果存在）
  await loadChatHistory(sessionId)
  
  // 第4步：触发事件通知组件刷新会话列表
  window.dispatchEvent(new CustomEvent('teacher-session-restored', {
    detail: { sessionId, session: newSession }
  }))
}
```

---

## 四、消息发送流程（Web → Android → RabbitMQ）

### 4.1 文本消息发送

**完整流程**：

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Web端发送消息                                             │
│    └─> teacherChatStore.sendMessage()                       │
│        └─> window.AndroidBridge.sendTextMessageToTeacher()   │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Android Bridge接收                                        │
│    └─> WebAppInterface.sendTextMessageToTeacher()           │
│        ├─> 验证用户登录                                     │
│        ├─> 检查MessagingManager初始化状态                    │
│        └─> 如果未初始化，自动初始化（最多等待10秒）          │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. 创建StudentMessage                                        │
│    └─> new StudentMessage(userId, sessionId, subject, type, content) │
│        └─> 生成messageId（UUID）                             │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. 发送到RabbitMQ                                            │
│    └─> MessagingManager.sendMessageToTeacher()               │
│        └─> RabbitMQManager.sendMessageToTeacher()            │
│            └─> 发送到教师队列（teacher_queue_{subject}）      │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. 返回结果到Web端                                           │
│    └─> 通过回调返回JSON                                     │
│        └─> { success: true, data: { messageId, ... } }      │
└─────────────────────────────────────────────────────────────┘
```

**关键代码**：

```typescript
// teacherChatStore.ts
const sendMessage = async (content: string, imageData?: ChatImageData): Promise<void> => {
  // 调用Android Bridge
  const result = await window.AndroidBridge.sendTextMessageToTeacher(
    content,
    currentSession.value.sessionId,
    currentSession.value.subject
  )
  
  // 解析结果
  const data = JSON.parse(result)
  if (data.success) {
    // 增加响应次数
    chatResponseTimes.value++
    // 保存聊天历史
    await saveChatHistory()
  }
}
```

```java
// WebAppInterface.java
@JavascriptInterface
public String sendTextMessageToTeacher(String content, String sessionId, String subject) {
    // 验证用户登录
    String userId = AppUtils.getUserId();
    
    // 检查并初始化MessagingManager
    MessagingManager messagingManager = MessagingManager.getInstance();
    if (!messagingManager.isInitialized()) {
        // 自动初始化或等待初始化完成
    }
    
    // 创建StudentMessage
    StudentMessage studentMsg = new StudentMessage(
        userId, sessionId, teacherSubject, 0, content
    );
    
    // 发送到RabbitMQ（异步）
    messagingManager.sendMessageToTeacher(studentMsg, callback);
    
    // 等待回调（最多5秒）
    latch.await(5, TimeUnit.SECONDS);
    
    // 返回结果
    return createResponseWithJsonData(true, "消息发送成功", messageData);
}
```

### 4.2 图片消息发送

**流程**：

```
1. Web端选择图片
   └─> 转换为base64或获取filePath

2. 调用Android Bridge
   └─> window.AndroidBridge.sendPictureToTeacher()

3. Android端处理
   ├─> 如果传入filePath：读取文件并转换为base64
   ├─> 如果传入base64：直接使用
   └─> 创建StudentMessage（messageType = 1）

4. 发送到RabbitMQ
   └─> 发送到教师队列
```

### 4.3 语音消息发送

**流程**：

```
1. Web端录制语音
   └─> 保存到本地文件

2. 调用Android Bridge
   └─> window.AndroidBridge.sendVoiceMessageToTeacher()

3. Android端处理
   ├─> 读取语音文件
   ├─> 转换为base64（data:audio/aac;base64,{base64数据}）
   └─> 创建StudentMessage（messageType = 2）

4. 发送到RabbitMQ
   └─> 发送到教师队列
```

---

## 五、数据流转图

### 5.1 消息发送流程

```
┌──────────┐         ┌──────────────┐         ┌─────────────┐
│  Web端   │ ──────> │ Android Bridge│ ──────> │  RabbitMQ   │
│          │         │              │         │             │
│ Store    │         │ WebAppInterface│       │ 教师队列    │
└──────────┘         └──────────────┘         └─────────────┘
     │                       │
     │                       │
     │                       ▼
     │                ┌──────────────┐
     │                │MessagingManager│
     │                │              │
     │                │RabbitMQManager│
     │                └──────────────┘
     │
     ▼
┌──────────┐
│localStorage│ 保存会话信息
│IndexedDB  │ 保存聊天历史
└──────────┘
```

### 5.2 消息接收流程

```
┌─────────────┐         ┌──────────────┐         ┌──────────┐
│  RabbitMQ   │ ──────> │ Android端    │ ──────> │  Web端   │
│             │         │              │         │          │
│ 学生队列    │         │MessagingManager│       │ Store    │
└─────────────┘         └──────────────┘         └──────────┘
                              │                        │
                              │                        │
                              ▼                        ▼
                       ┌──────────────┐         ┌──────────┐
                       │TeacherMessage│         │localStorage│
                       │              │         │IndexedDB  │
                       │toChatMessage│         │           │
                       └──────────────┘         └──────────┘
```

---

## 六、关键代码位置

### 6.1 Android端

| 功能 | 文件 | 关键方法 |
|------|------|----------|
| 消息管理器 | `MessagingManager.java` | `initialize()`, `sendMessageToTeacher()`, `addMessageListener()` |
| RabbitMQ管理 | `RabbitMQManager.java` | `sendMessageToTeacher()`, `startListeningForTeacherReplies()` |
| Web桥接 | `WebAppInterface.java` | `sendTextMessageToTeacher()`, `sendPictureToTeacher()`, `initTeacherMessageListener()` |
| 消息转换 | `TeacherMessage.java` | `toChatMessage()` |

### 6.2 Web端

| 功能 | 文件 | 关键方法 |
|------|------|----------|
| 消息发送 | `teacherChatStore.ts` | `sendMessage()` |
| 消息接收 | `teacherChatStore.ts` | `initMessageReceiver()`, `window.onTeacherMessageReceived` |
| 会话管理 | `teacherChatStore.ts` | `createTeacherSession()`, `createOrRestoreSessionForMessage()` |
| 存储管理 | `chat-storage.ts` | `saveChatHistory()`, `loadChatHistory()` |

---

## 七、注意事项

### 7.1 会话管理

⚠️ **重要**：
- Android端**不存储**会话信息，仅负责消息传递
- 会话的创建、存储、删除都由Web端管理
- 会话ID由Web端生成和管理

### 7.2 消息ID处理

⚠️ **注意**：
- Android端会对消息ID进行哈希处理（`UUID.nameUUIDFromBytes`）
- Web端收到消息后，使用哈希后的messageId
- 确保消息ID的一致性

### 7.3 初始化时序

⚠️ **重要**：
- MessagingManager的初始化是异步的
- 发送消息前需要确保已初始化
- 如果未初始化，会自动初始化或等待初始化完成（最多等待10秒）

### 7.4 消息类型

⚠️ **注意**：
- 文本消息：直接传递内容
- 图片消息：Android端保存到本地，传递文件路径给Web端
- 语音消息：Android端保存到本地，传递`"duration,filePath"`格式给Web端

### 7.5 会话恢复

⚠️ **场景**：
- 学生删除了会话，但教师仍在回复
- Web端会自动恢复或创建会话来接收消息
- 恢复的会话会触发事件通知组件刷新

---

## 八、总结

### 8.1 职责分工

| 端 | 职责 |
|---|------|
| **Android端** | 消息发送和接收、RabbitMQ连接管理、文件处理（图片/语音） |
| **Web端** | 会话管理、消息存储、UI展示、用户交互 |

### 8.2 数据流

1. **发送消息**：Web端 → Android Bridge → RabbitMQ → 服务器
2. **接收消息**：服务器 → RabbitMQ → Android端 → Web端 → 存储

### 8.3 存储机制

- **Web端**：会话信息（localStorage）+ 聊天历史（IndexedDB）
- **Android端**：临时文件（图片/语音），不存储会话信息

### 8.4 关键特性

- ✅ 异步初始化：MessagingManager初始化不阻塞主线程
- ✅ 自动重连：连接断开时自动重连
- ✅ 会话恢复：自动恢复被删除的会话
- ✅ 调试日志：详细的日志帮助排查问题
- ✅ 消息确认：RabbitMQ消息确认机制确保消息不丢失

