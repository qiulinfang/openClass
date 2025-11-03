# ChatScreen.tsx PRD 文档（React Native）

## 📋 概述

**文件路径**：`src/screens/ChatScreen.tsx`  
**文件类型**：`React Native Screen Component`  
**主要职责**：聊天界面主屏幕，负责消息列表展示、消息输入、流式响应处理、会话管理等核心功能

## 🎯 功能需求

### 1. 核心功能

#### 1.1 消息列表展示
- **消息渲染**：
  - 使用 `FlatList` 渲染消息列表
  - 支持分页加载历史消息
  - 自动滚动到最新消息
- **消息类型支持**：
  - 用户消息（右侧显示）
  - AI 消息（左侧显示）
  - 教师消息（左侧显示）
  - 流式消息（实时更新）
  - 错误消息（带重试按钮）
- **消息交互**：
  - 点击消息触发操作
  - 长按消息显示操作菜单
  - 支持多选模式

#### 1.2 消息输入
- **文本输入**：
  - 多行文本输入框
  - 支持表情输入
  - 支持 Markdown 预览
- **多媒体输入**：
  - 图片选择（支持多选）
  - 语音录制（支持实时录制）
  - 文件上传（PDF、Word等）
- **输入控制**：
  - 发送按钮（支持禁用状态）
  - 清空按钮
  - 语音/文本切换

#### 1.3 流式响应处理
- **实时更新**：
  - 监听 Store 的消息更新
  - 实时渲染流式消息内容
  - 显示打字机效果
- **完成处理**：
  - 标记消息为完成状态
  - 自动滚动到底部
  - 保存聊天历史

#### 1.4 会话管理（侧边栏/抽屉）
- **会话列表显示**：
  - 使用 `Drawer` 或 `BottomSheet` 组件显示会话列表
  - 会话列表支持搜索功能（实时过滤）
  - 会话项显示：会话名称、最后消息预览、时间戳、置顶标识（🔝图标）
  - 支持置顶会话排序（置顶会话显示在最上方）
  - 当前激活会话高亮显示（背景色区分）
  - 空状态提示：无会话时显示"暂无会话"，搜索无结果时显示"未找到匹配的会话"
- **会话切换**：
  - 点击会话项切换当前会话
  - 切换前自动保存当前会话的聊天历史
  - 切换时自动加载该会话的聊天历史
  - 切换后自动滚动到最新消息
  - 切换后自动关闭抽屉/底部栏
- **创建新会话**：
  - 点击"新建会话"按钮（顶部工具栏）创建新会话
  - 新会话默认命名为第一条消息的截取（最多20个字符）
  - 创建后自动切换到新会话
  - 新会话显示在会话列表顶部（如果无置顶会话）
- **会话操作**（长按会话项或点击更多按钮）：
  - **重命名会话**：
    - 弹出输入对话框（Alert 或 Modal）
    - 预填充当前会话名称
    - 验证名称不为空且不超过50个字符
    - 保存到 Store 并更新会话列表
  - **置顶/取消置顶**：
    - 切换置顶状态（使用 push_pin 图标）
    - 自动更新会话列表排序（置顶在前）
    - 保存到 Store
  - **删除会话**：
    - 显示确认对话框（Alert.alert）
    - 删除会话及其聊天历史（调用 chatStorageService.removeChatHistory）
    - 如果删除的是当前会话，清空消息列表并重置 currentSession
    - 更新会话列表并保存
  - **批量管理**：
    - 进入批量选择模式（显示复选框）
    - 支持多选会话（全选/取消全选）
    - 批量删除选中会话（确认对话框）
- **会话搜索**：
  - 在会话列表顶部显示搜索框（TextInput）
  - 实时过滤会话列表（按会话名称 sessionName）
  - 搜索框右侧显示清除按钮（X图标）
  - 清空搜索框恢复完整列表
- **抽屉/底部栏控制**：
  - 通过导航栏按钮（菜单图标）打开/关闭会话列表
  - 支持手势滑动关闭（Drawer 或 BottomSheet）
  - 打开时显示遮罩层（半透明背景）

#### 1.5 选择模式
- **多选功能**：
  - 进入多选模式
  - 批量选择消息
  - 批量操作（复制、删除、转发）
- **选择工具栏**：
  - 显示选择数量
  - 全选/取消全选
  - 批量操作按钮

### 2. 功能边界

#### 2.1 负责的功能
- ✅ 消息列表渲染
- ✅ 消息输入交互
- ✅ 流式响应展示
- ✅ 会话管理 UI（侧边栏/抽屉）
- ✅ 选择模式 UI
- ✅ 键盘处理

#### 2.2 不负责的功能
- ❌ 消息数据管理（由 Store 负责）
- ❌ 消息内容渲染（由 ChatMessage 组件负责）
- ❌ API 请求（由 apiService 负责）
- ❌ 持久化存储（由 StorageService 负责）
- ❌ 会话数据管理（由 Store 负责）

## 🔧 技术实现

### 1. 依赖关系

#### 1.1 导入依赖
```typescript
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  View,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
  TouchableOpacity,
} from 'react-native'
import { useAiGeneralChatStore } from '../stores/aiGeneralChatStore'
import { useUserStore } from '../stores/userStore'
import ChatMessage from '../components/chat/ChatMessage'
import ChatInput from '../components/chat/ChatInput'
import SessionDrawer from '../components/chat/SessionDrawer'
import type { ChatBubble } from '../types/chat'
```

#### 1.2 被依赖
- `AppNavigator.tsx`：作为屏幕路由使用
- `MainScreen.tsx`：导航到聊天屏幕

#### 1.3 子组件依赖
- `SessionDrawer.tsx`：会话列表抽屉组件（待创建）
  - 负责会话列表的展示和管理
  - 处理会话搜索、选择、操作（重命名、置顶、删除）等
  - 使用 `@react-navigation/drawer` 或 `react-native-bottom-sheet` 实现
- `ChatMessage.tsx`：消息渲染组件（待创建）
- `ChatInput.tsx`：输入框组件（待创建）

### 2. 关键代码逻辑

#### 2.1 组件结构

```typescript
interface ChatScreenProps {
  route: {
    params: {
      type: 'ai-general' | 'ai-exercise' | 'ai-textbook' | 'teacher'
      sessionId?: string
      questionId?: string
    }
  }
  navigation: any
}

const ChatScreen: React.FC<ChatScreenProps> = ({ route, navigation }) => {
  // 状态管理
  const store = useAiGeneralChatStore()
  const userStore = useUserStore()
  const [inputMessage, setInputMessage] = useState('')
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set())
  const [isSessionDrawerOpen, setIsSessionDrawerOpen] = useState(false)
  
  // 引用
  const flatListRef = useRef<FlatList>(null)
  const inputRef = useRef<any>(null)
  
  // 初始化：加载会话列表和当前会话
  useEffect(() => {
    store.loadSessions()
    if (route.params.sessionId) {
      store.switchSession(route.params.sessionId)
    }
  }, [])
  
  // 监听消息更新
  useEffect(() => {
    // 自动滚动到底部
    scrollToBottom()
  }, [store.messages])
  
  // 发送消息
  const handleSendMessage = useCallback(async () => {
    if (!inputMessage.trim()) return
    
    try {
      await store.sendMessage(
        inputMessage,
        userStore.userInfo,
        userStore.subject,
        'mate' // selectedModel
      )
      setInputMessage('')
      scrollToBottom()
    } catch (error) {
      console.error('发送消息失败:', error)
      Alert.alert('发送失败', '请稍后重试')
    }
  }, [inputMessage, store, userStore])
  
  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    if (flatListRef.current && store.messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true })
    }
  }, [store.messages])
  
  // 渲染消息项
  const renderMessage = useCallback(({ item }: { item: ChatBubble }) => {
    return (
      <ChatMessage
        message={item}
        type={route.params.type}
        isSelected={selectedMessages.has(item.id)}
        isSelectionMode={isSelectionMode}
        onToggleSelection={handleToggleSelection}
        onMessageClick={handleMessageClick}
      />
    )
  }, [selectedMessages, isSelectionMode])
  
  // 会话切换
  const handleSessionSwitch = useCallback(async (sessionId: string) => {
    await store.switchSession(sessionId)
    setIsSessionDrawerOpen(false)
    scrollToBottom()
  }, [store])
  
  // 创建新会话
  const handleCreateSession = useCallback(async () => {
    // 创建新会话，第一条消息由用户发送时自动创建
    setIsSessionDrawerOpen(false)
  }, [])
  
  // 设置导航栏
  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity onPress={() => setIsSessionDrawerOpen(true)}>
          {/* 菜单图标 */}
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity onPress={handleCreateSession}>
          {/* 新建会话图标 */}
        </TouchableOpacity>
      ),
    })
  }, [navigation])
  
  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* 选择模式工具栏 */}
        {isSelectionMode && (
          <SelectionToolbar
            selectedCount={selectedMessages.size}
            onClose={() => setIsSelectionMode(false)}
            onSelectAll={handleSelectAll}
            onForward={handleForward}
          />
        )}
        
        {/* 消息列表 */}
        <FlatList
          ref={flatListRef}
          data={store.messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={scrollToBottom}
          inverted={false}
          removeClippedSubviews={true}
          windowSize={10}
        />
        
        {/* 输入框 */}
        <ChatInput
          ref={inputRef}
          value={inputMessage}
          onChangeText={setInputMessage}
          onSend={handleSendMessage}
          isLoading={store.isChatLoading}
          type={route.params.type}
        />
      </KeyboardAvoidingView>
      
      {/* 会话列表抽屉 */}
      <SessionDrawer
        visible={isSessionDrawerOpen}
        onClose={() => setIsSessionDrawerOpen(false)}
        sessions={store.sessions}
        currentSessionId={store.currentSession?.sessionId}
        onSessionSwitch={handleSessionSwitch}
        onSessionRename={store.renameSession}
        onSessionPin={store.togglePin}
        onSessionDelete={store.deleteSession}
      />
    </View>
  )
}
```

#### 2.2 流式响应处理

```typescript
// 监听 Store 的消息更新（Zustand 自动响应）
// 组件会自动重新渲染，因为使用了 useAiGeneralChatStore() Hook
useEffect(() => {
  // 检查是否有新的流式消息
  const streamingMessages = store.messages.filter(
    m => m.isStreaming && m.sender !== 'user'
  )
  
  if (streamingMessages.length > 0) {
    // 自动滚动到底部
    scrollToBottom()
  }
}, [store.messages])
```

### 3. 性能优化

#### 3.1 列表优化
- 使用 `FlatList` 的 `windowSize` 属性控制渲染窗口（默认10）
- 使用 `removeClippedSubviews` 提升性能（Android 上有效）
- 使用 `getItemLayout` 优化滚动性能（如果消息高度固定）
- 使用 `keyExtractor` 提供稳定的 key

#### 3.2 消息渲染优化
- 使用 `React.memo` 优化消息组件渲染
- 使用 `useCallback` 优化回调函数
- 避免在 `renderItem` 中创建新对象
- 使用 `useMemo` 缓存计算结果

### 4. 会话管理实现细节

#### 4.1 会话列表组件（SessionDrawer）
```typescript
interface SessionDrawerProps {
  visible: boolean
  onClose: () => void
  sessions: AiGeneralSession[]
  currentSessionId?: string
  onSessionSwitch: (sessionId: string) => void
  onSessionRename: (sessionId: string, newName: string) => Promise<void>
  onSessionPin: (sessionId: string) => Promise<void>
  onSessionDelete: (sessionId: string) => Promise<void>
}
```

#### 4.2 会话排序逻辑
```typescript
// 排序规则：置顶会话在前，然后按更新时间倒序
const sortedSessions = useMemo(() => {
  return [...sessions].sort((a, b) => {
    // 置顶会话优先
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    // 按更新时间倒序
    return b.updateTime - a.updateTime
  })
}, [sessions])
```

## 🔄 迁移到 React Native

### 1. 等价实现

#### 1.1 组件结构
- **当前实现**：Vue 3 Composition API + Quasar UI + Better Scroll
- **React Native 实现**：React Native 组件 + React Native Paper + FlatList

#### 1.2 核心差异

| Vue 功能 | React Native 实现 |
|---------|------------------|
| `<template>` | `<View>`, `<FlatList>` |
| `v-for` | `FlatList` 的 `data` 和 `renderItem` |
| `@click` | `<TouchableOpacity onPress>` |
| `computed` | `useMemo` |
| `ref` | `useRef` |
| `watch` | `useEffect` |
| `Better Scroll` | `FlatList` 内置滚动 |
| `q-drawer` | `@react-navigation/drawer` 或 `react-native-bottom-sheet` |
| `q-input` | `TextInput` |
| `q-btn` | `TouchableOpacity` + `Icon` |

### 2. 需要的第三方库

```json
{
  "react-native": "^0.72.0",
  "react-native-paper": "^5.0.0",
  "@react-navigation/native": "^6.0.0",
  "@react-navigation/native-stack": "^6.0.0",
  "@react-navigation/drawer": "^6.0.0",
  "react-native-gesture-handler": "^2.0.0",
  "react-native-keyboard-aware-scroll-view": "^0.9.0",
  "react-native-bottom-sheet": "^5.0.0",
  "react-native-vector-icons": "^10.0.0"
}
```

### 3. 迁移步骤

1. **创建基础组件结构**
   - 定义 Props 接口
   - 创建基础布局（KeyboardAvoidingView + FlatList + Input）
   - 设置导航栏（菜单按钮、新建会话按钮）

2. **集成 Store**
   - 使用 `useAiGeneralChatStore` Hook 获取状态
   - 监听消息更新
   - 实现消息发送逻辑
   - 实现会话管理逻辑

3. **实现消息列表**
   - 使用 `FlatList` 渲染消息
   - 实现滚动到底部功能
   - 优化列表性能

4. **实现会话管理**
   - 创建 `SessionDrawer` 组件
   - 实现会话列表展示
   - 实现会话搜索
   - 实现会话操作（重命名、置顶、删除）

5. **实现输入功能**
   - 创建 `ChatInput` 组件
   - 实现文本输入
   - 实现多媒体输入（图片、语音）

6. **实现流式响应**
   - 监听 Store 消息更新
   - 实时渲染流式消息
   - 显示打字机效果

7. **实现选择模式**
   - 创建选择工具栏
   - 实现多选逻辑
   - 实现批量操作

### 4. 注意事项

#### 4.1 键盘处理
- 使用 `KeyboardAvoidingView` 处理键盘遮挡
- iOS 和 Android 行为不同，需要分别处理
- 考虑使用 `react-native-keyboard-aware-scroll-view`

#### 4.2 滚动处理
- `FlatList` 的 `inverted` 属性可以反转列表方向
- 使用 `scrollToEnd` 滚动到底部
- 注意滚动动画的性能

#### 4.3 状态管理
- 使用 Zustand Store 管理消息状态
- 避免在组件中存储大量状态
- 使用 `useCallback` 优化回调

#### 4.4 性能优化
- 使用 `React.memo` 优化消息组件
- 使用 `getItemLayout` 优化列表滚动（如果消息高度固定）
- 避免在 `renderItem` 中创建新对象

#### 4.5 会话管理
- 会话列表使用 `FlatList` 渲染
- 支持搜索时使用 `useMemo` 缓存过滤结果
- 会话操作使用 Alert 或 Modal 显示对话框
- 删除操作需要确认对话框

## 📝 迁移代码示例

### Vue 实现

```vue
<template>
  <div class="chat-view">
    <q-drawer v-model="isDrawerOpen">
      <SessionList
        :sessions="sessions"
        :current-session-id="currentSession?.sessionId"
        @session-click="handleSessionSwitch"
      />
    </q-drawer>
    <div class="chat-messages">
      <ChatMessage
        v-for="message in messages"
        :key="message.id"
        :message="message"
      />
    </div>
    <ChatInput
      v-model="inputMessage"
      @send="sendMessage"
    />
  </div>
</template>

<script setup>
const store = useAiGeneralChatStore()
const messages = computed(() => store.messages)
const sessions = computed(() => store.sessions)

const sendMessage = async () => {
  await store.sendMessage(inputMessage.value)
  inputMessage.value = ''
}
</script>
```

### React Native 实现

```typescript
const ChatScreen: React.FC<ChatScreenProps> = ({ route, navigation }) => {
  const store = useAiGeneralChatStore()
  const [inputMessage, setInputMessage] = useState('')
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  
  const messages = useMemo(() => store.messages, [store.messages])
  const sessions = useMemo(() => store.sessions, [store.sessions])
  
  const handleSend = useCallback(async () => {
    await store.sendMessage(inputMessage)
    setInputMessage('')
  }, [inputMessage, store])
  
  return (
    <View style={styles.container}>
      <Drawer visible={isDrawerOpen} onClose={() => setIsDrawerOpen(false)}>
        <SessionList
          sessions={sessions}
          currentSessionId={store.currentSession?.sessionId}
          onSessionSwitch={store.switchSession}
        />
      </Drawer>
      <FlatList
        data={messages}
        renderItem={({ item }) => <ChatMessage message={item} />}
        keyExtractor={(item) => item.id}
      />
      <ChatInput
        value={inputMessage}
        onChangeText={setInputMessage}
        onSend={handleSend}
      />
    </View>
  )
}
```

## ⚠️ 迁移风险

### 高风险项

1. **键盘处理**：
   - **风险**：iOS 和 Android 的键盘行为不同，可能导致布局问题
   - **解决方案**：使用 `KeyboardAvoidingView` 和 `react-native-keyboard-aware-scroll-view`
   - **影响**：可能需要调整布局和样式

2. **流式响应**：
   - **风险**：频繁的消息更新可能影响性能
   - **解决方案**：使用 `React.memo` 和 `useMemo` 优化渲染
   - **影响**：可能需要调整更新频率

3. **会话抽屉/底部栏**：
   - **风险**：不同平台的抽屉组件实现方式不同
   - **解决方案**：使用 `@react-navigation/drawer`（侧边栏）或 `react-native-bottom-sheet`（底部栏）
   - **影响**：可能需要根据平台选择不同的实现方式

### 中风险项

1. **列表性能**：
   - **风险**：大量消息可能影响滚动性能
   - **解决方案**：使用 `FlatList` 的优化属性，实现分页加载
   - **影响**：可能需要限制消息数量

2. **状态同步**：
   - **风险**：Store 状态更新可能不及时同步到 UI
   - **解决方案**：正确使用 Zustand 的 Hook 机制
   - **影响**：可能需要调整状态更新策略

3. **会话管理**：
   - **风险**：会话切换时可能丢失未保存的消息
   - **解决方案**：切换前自动保存当前会话
   - **影响**：需要确保保存逻辑正确执行

## 🧪 测试要点

### 功能测试

1. **消息发送测试**：
   - ✅ 发送文本消息
   - ✅ 发送图片消息
   - ✅ 发送语音消息
   - ✅ 流式响应正确更新

2. **列表滚动测试**：
   - ✅ 自动滚动到底部
   - ✅ 滚动性能正常
   - ✅ 历史消息正确加载

3. **键盘处理测试**：
   - ✅ 键盘弹出时布局正常
   - ✅ 键盘收起时布局恢复
   - ✅ 输入框不被遮挡

4. **会话管理测试**：
   - ✅ 打开/关闭会话列表
   - ✅ 会话切换正常
   - ✅ 创建新会话
   - ✅ 重命名会话
   - ✅ 置顶/取消置顶
   - ✅ 删除会话
   - ✅ 会话搜索
   - ✅ 批量删除会话

5. **选择模式测试**：
   - ✅ 多选功能正常
   - ✅ 批量操作正常
   - ✅ 选择工具栏正常显示

### 边界测试

1. **空数据测试**：
   - 无消息时的处理
   - 无会话时的处理
   - 搜索无结果时的处理

2. **异常情况测试**：
   - 网络错误时的处理
   - 消息发送失败时的处理
   - 会话删除失败时的处理

3. **性能测试**：
   - 大量消息时的性能
   - 流式响应时的性能
   - 滚动性能测试
   - 大量会话时的性能

## 📚 参考资源

### 相关文档
- [React Native FlatList 文档](https://reactnative.dev/docs/flatlist)
- [React Native KeyboardAvoidingView 文档](https://reactnative.dev/docs/keyboardavoidingview)
- [React Navigation Drawer 文档](https://reactnavigation.org/docs/drawer-based-navigation)
- [Zustand 官方文档](https://zustand-demo.pmnd.rs/)

### 相关文件
- `src/stores/aiGeneralChatStore.ts` - Store 实现
- `src/components/chat/ChatMessage.tsx` - 消息组件（待创建）
- `src/components/chat/ChatInput.tsx` - 输入组件（待创建）
- `src/components/chat/SessionDrawer.tsx` - 会话列表组件（待创建）
- `src/types/chat.ts` - 类型定义

---

**文档版本**：v2.0  
**创建日期**：2025-01-27  
**最后更新**：2025-01-27  
**维护者**：开发团队
