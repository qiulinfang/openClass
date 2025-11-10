# UnifiedChatDialog 切换对话时 ChatView 加载机制分析

## 概述

本文档分析 `UnifiedChatDialog.vue` 中切换对话时，`ChatView` 组件如何加载不同对话的实现机制。

## 核心架构

### 1. 组件结构

```
UnifiedChatDialog
├── SessionTree (左侧会话树)
└── ChatView (右侧聊天界面)
    └── ChatStrategy (策略模式)
        ├── AiGeneralStrategy
        └── TeacherGeneralStrategy
```

### 2. 数据流

```
用户切换会话
  ↓
SessionTree 发出 session-switched 事件
  ↓
UnifiedChatDialog.handleSessionSwitched()
  ↓
更新 activeCategory (ai-general | teacher)
  ↓
ChatView 根据 activeCategory 渲染
  ↓
ChatView 根据 type prop 创建策略
  ↓
策略从对应的 Store 加载消息
```

## 详细实现

### 1. 对话切换触发

**代码位置：** `imates-web/src/components/UnifiedChatDialog.vue:209-213`

```typescript
const handleSessionSwitched = (type: 'ai' | 'teacher', sessionId: string) => {
  console.log('handleSessionSwitched', type, sessionId)
  // 只更新分类，所有切换逻辑已在 SessionTree 内部完成
  activeCategory.value = type === 'ai' ? 'ai-general' : 'teacher'
}
```

**关键点：**
- `SessionTree` 内部已经完成了会话切换的所有逻辑（包括设置 store 的 `currentSession`）
- `UnifiedChatDialog` 只需要更新 `activeCategory` 来控制显示哪个 `ChatView`

### 2. ChatView 条件渲染

**代码位置：** `imates-web/src/components/UnifiedChatDialog.vue:74-92`

```vue
<!-- AI聊天界面 -->
<ChatView 
  v-if="activeCategory === 'ai-general'"
  type="ai-general"
  @open-teacher-dialog="handleOpenTeacherDialog"
  @switch-to-teacher="handleSwitchToTeacher"
/>
<!-- 教师聊天界面 -->
<ChatView
  v-else-if="activeCategory === 'teacher' && teacherChatStore.currentSession?.sessionId"
  type="teacher-general"
  :session-id="teacherChatStore.currentSession.sessionId"
  :key="teacherChatStore.currentSession.sessionId"
/>
```

**关键点：**
- 使用 `v-if`/`v-else-if` 条件渲染，确保同一时间只渲染一个 `ChatView`
- 教师对话使用 `:key` 绑定 `sessionId`，确保切换会话时组件重新创建
- AI 对话不需要 `key`，因为只有一个 AI 对话实例

### 3. ChatView 策略创建

**代码位置：** `imates-web/src/components/ChatView.vue:235-249`

```typescript
const createStrategy = () => {
  if (props.type === 'ai-textbook') {
    aiTextbookStore.setResourceId(props.resourceId!)
  }

  // 创建策略实例
  // 如果是teacher-general类型但store中没有session，延迟创建策略（等待session初始化完成）
  if (props.type === 'teacher-general' && !teacherStore.currentSession) {
    // 延迟创建策略，等待session初始化完成
    // 策略将在store.currentSession的watch中创建
    return
  }

  chatStrategy.value = ChatStrategyFactory.create(props.type)
}
```

**关键点：**
- 根据 `props.type` 创建不同的策略实例
- 教师对话需要等待 `currentSession` 初始化完成
- 策略工厂模式统一管理策略创建

### 4. 策略工厂

**代码位置：** `imates-web/src/components/chat/strategies/ChatStrategyFactory.ts:26-36`

```typescript
static create(type: ChatType, options?: ChatStrategyFactoryOptions): ChatStrategy {
  switch (type) {
    case 'ai-general':
      return new AiGeneralStrategy()
    
    case 'ai-exercise':
      return new AiExerciseStrategy()
    
    case 'ai-textbook':
      return new AiTextbookStrategy()
    
    case 'teacher-general':
      return new TeacherGeneralStrategy()
    
    // ...
  }
}
```

**关键点：**
- 每个对话类型对应一个策略类
- 策略类内部会获取对应的 Store 实例

### 5. 策略获取消息

#### AiGeneralStrategy

**代码位置：** `imates-web/src/components/chat/strategies/AiGeneralStrategy.ts:22-24`

```typescript
getMessages(): ChatBubble[] {
  return this.aiGeneralStore.messages
}
```

**Store 加载逻辑：** `imates-web/src/stores/aiGeneralChatStore.ts:335-339`

```typescript
const setSession = async (session: AiGeneralSession): Promise<void> => {
  currentSession.value = session
  
  // 第3步：加载该会话的聊天记录
  await loadChatHistory(sessionId)
}
```

#### TeacherGeneralStrategy

**代码位置：** `imates-web/src/components/chat/strategies/TeacherGeneralStrategy.ts:40-42`

```typescript
getMessages(): ChatBubble[] {
  return this.teacherStore.messages
}
```

**Store 加载逻辑：** `imates-web/src/stores/teacherGeneralChatStore.ts:1257-1262`

```typescript
currentSession.value = newSession

// 第8步：加载聊天历史（如果存在）
try {
  await loadChatHistory(sessionId)
} catch (error) {
  console.warn('[TeacherStore] ⚠️ 加载聊天历史失败（可能是新会话）:', error)
}
```

### 6. ChatView 消息显示

**代码位置：** `imates-web/src/components/ChatView.vue:364-370`

```typescript
const displayedMessages = computed<ChatBubble[]>(() => {
  if (chatStrategy.value) {
    console.log('[ChatView] 🔍 [displayedMessages] 获取消息列表', chatStrategy.value.getMessages())
    return chatStrategy.value.getMessages()
  }
  return []
})
```

**关键点：**
- 使用 `computed` 自动响应策略变化
- 策略的 `getMessages()` 直接返回 Store 中的 `messages`
- 当 Store 的 `messages` 更新时，`displayedMessages` 会自动更新

### 7. 教师会话监听

**代码位置：** `imates-web/src/components/ChatView.vue:1737-1747`

```typescript
watch(
  () => teacherStore.currentSession,
  (session) => {
    // 只有在teacher-general类型且session存在时才创建或更新策略
    if (props.type === 'teacher-general' && session) {
      // 创建或更新策略
      // 策略会直接从 store 读取 session 信息，不需要传递参数
      chatStrategy.value = ChatStrategyFactory.create(props.type)
    }
  },
)
```

**关键点：**
- 监听 `teacherStore.currentSession` 变化
- 当会话切换时，重新创建策略
- 策略会从 Store 读取最新的会话信息

## 完整流程示例

### 场景：从 AI 对话切换到教师对话

```
1. 用户在 SessionTree 中点击教师会话
   ↓
2. SessionTree 调用 teacherChatStore.setSession(session)
   ↓
3. SessionTree 发出 session-switched('teacher', sessionId) 事件
   ↓
4. UnifiedChatDialog.handleSessionSwitched() 更新 activeCategory = 'teacher'
   ↓
5. ChatView 条件渲染：v-if="activeCategory === 'teacher'" 为 true
   ↓
6. ChatView 检测到 type="teacher-general"，调用 createStrategy()
   ↓
7. ChatStrategyFactory.create('teacher-general') 创建 TeacherGeneralStrategy
   ↓
8. TeacherGeneralStrategy 内部获取 teacherGeneralChatStore
   ↓
9. teacherGeneralChatStore.setSession() 时已调用 loadChatHistory(sessionId)
   ↓
10. loadChatHistory() 从 IndexedDB 加载消息到 store.messages
   ↓
11. ChatView 的 displayedMessages computed 自动获取策略的 getMessages()
   ↓
12. 界面显示加载的消息
```

### 场景：切换不同的教师会话

```
1. 用户在 SessionTree 中点击另一个教师会话
   ↓
2. SessionTree 调用 teacherChatStore.setSession(newSession)
   ↓
3. teacherChatStore.setSession() 调用 loadChatHistory(newSessionId)
   ↓
4. ChatView 的 watch(teacherStore.currentSession) 触发
   ↓
5. 重新创建 TeacherGeneralStrategy（策略会读取新的 currentSession）
   ↓
6. ChatView 的 :key="sessionId" 变化，组件重新创建
   ↓
7. 新组件初始化时，策略的 getMessages() 返回新会话的消息
   ↓
8. 界面显示新会话的消息
```

## 关键设计点

### 1. 策略模式

- **优势：** 不同对话类型使用不同的策略，逻辑清晰、易于扩展
- **实现：** 每个策略对应一个 Store，策略只负责业务逻辑，数据存储在 Store 中

### 2. Store 管理

- **AI 对话：** `aiGeneralChatStore` 管理所有 AI 会话和消息
- **教师对话：** `teacherGeneralChatStore` 管理所有教师会话和消息
- **数据隔离：** 不同场景的 Store 完全独立，互不干扰

### 3. 响应式更新

- **Computed 属性：** `displayedMessages` 自动响应策略和 Store 的变化
- **Watch 监听：** 监听 Store 的 `currentSession` 变化，自动更新策略

### 4. 组件生命周期

- **条件渲染：** 使用 `v-if` 确保同一时间只渲染一个 `ChatView`
- **Key 绑定：** 教师对话使用 `:key` 确保切换会话时组件重新创建
- **延迟初始化：** 教师对话策略等待 `currentSession` 初始化完成

## 存储机制

### AI 对话存储

**存储键格式：** `ai-general-${sessionId}`

**代码位置：** `imates-web/src/stores/aiGeneralChatStore.ts:360`

```typescript
await asyncStorage.saveChatHistory(`ai-general-${currentSession.value.sessionId}`, historyData)
```

### 教师对话存储

**存储键格式：** `teacher-general-${sessionId}`

**代码位置：** `imates-web/src/stores/teacherGeneralChatStore.ts:742`

```typescript
const storageKey = `teacher-general-${sessionId}`
const history = await asyncStorage.loadChatHistory(storageKey)
```

## 总结

`UnifiedChatDialog` 的切换对话机制基于以下核心设计：

1. **条件渲染：** 通过 `activeCategory` 控制显示哪个 `ChatView`
2. **策略模式：** 根据 `type` prop 创建不同的策略实例
3. **Store 管理：** 每个策略对应一个 Store，消息数据存储在 Store 中
4. **自动加载：** Store 的 `setSession()` 方法会自动加载对应会话的聊天记录
5. **响应式更新：** 使用 `computed` 和 `watch` 自动响应数据变化

这种设计确保了：
- ✅ 不同对话类型的数据完全隔离
- ✅ 切换对话时自动加载对应的聊天记录
- ✅ 代码结构清晰，易于维护和扩展
- ✅ 性能优化：条件渲染避免不必要的组件创建

