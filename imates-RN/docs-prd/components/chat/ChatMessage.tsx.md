# ChatMessage.tsx PRD 文档（React Native）

## 📋 概述

**文件路径**：`src/components/chat/ChatMessage.tsx`  
**文件类型**：`React Native Component`  
**主要职责**：聊天消息渲染组件，负责展示用户和 AI/老师发送的各种类型消息（文本、语音、图片），并支持消息交互操作（复制、转发、编辑、多选、重试等）

## 🎯 功能需求

### 1. 核心功能

#### 1.1 消息展示
- **消息类型支持**：
  - 文本消息（支持 Markdown 渲染）
  - 语音消息（使用 `VoiceMessage` 组件）
  - 图片消息（使用 `ImageMessage` 组件）
- **流式消息显示**：
  - 实时更新消息内容
  - 显示打字机效果
  - 支持流式渲染过程中的 Markdown 渲染
- **错误消息处理**：
  - 显示错误消息内容
  - 显示重试次数（最多 3 次）
  - 提供重试按钮（仅在 `canRetry` 为 true 时显示）

#### 1.2 消息交互
- **点击交互**：
  - 普通模式：点击消息触发 `onMessageClick` 回调
  - 选择模式：点击消息切换选中状态，触发 `onToggleSelection` 回调
- **长按交互**：
  - 长按显示操作菜单（复制、转发、编辑、多选）
  - 使用 `react-native-gesture-handler` 实现长按
  - 点击外部区域关闭菜单
- **消息操作**：
  - `复制`：复制消息内容到剪贴板
  - `转发`：转发消息到老师对话（仅 AI 消息可用）
  - `编辑`：编辑用户消息
  - `多选`：进入多选模式，支持批量选择消息
  - `重试`：重新发送失败的消息（仅错误消息可用）

#### 1.3 消息状态管理
- **选择状态**：
  - 支持多选模式（`isSelectionMode`）
  - 显示复选框（选择模式下）
  - 高亮显示已选消息
- **加载状态**：
  - 显示重试加载状态（旋转动画）
  - 显示流式消息生成状态

#### 1.4 消息样式
- **用户消息样式**：
  - 右侧对齐，蓝色渐变背景
  - 用户头像在右侧
  - 气泡样式带右侧小三角
- **AI/老师消息样式**：
  - 左侧对齐，浅灰色背景
  - AI 头像在左侧（根据类型显示不同图标）
  - 气泡样式带左侧小三角
- **响应式布局**：
  - 适配不同屏幕尺寸
  - 消息气泡最大宽度 80%

### 2. 功能边界

#### 2.1 负责的功能
- ✅ 消息内容的渲染和展示
- ✅ 消息交互操作（点击、长按、选择）
- ✅ 消息操作菜单的显示和交互
- ✅ 消息样式和布局
- ✅ Markdown 内容的渲染
- ✅ 消息状态的视觉反馈

#### 2.2 不负责的功能
- ❌ 消息数据的获取和存储（由 Store 负责）
- ❌ 消息发送逻辑（由父组件和 Store 负责）
- ❌ 聊天会话管理（由 ChatScreen 组件负责）
- ❌ 图片选择器（由原生模块负责）
- ❌ 语音录制（由原生模块负责）
- ❌ 流式消息数据的接收（由 Store 负责）

## 🔧 技术实现

### 1. 依赖关系

#### 1.1 导入依赖

```typescript
import React, { useMemo, useRef, useState, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native'
import { Avatar, Menu, Button } from 'react-native-paper'
import { LongPressGestureHandler, State } from 'react-native-gesture-handler'
import * as Clipboard from '@react-native-community/clipboard'
import Markdown from 'react-native-markdown-display'
import type { ChatBubble } from '../../types'
```

#### 1.2 被依赖
- `ChatScreen.tsx`：使用 `ChatMessage` 组件渲染消息列表

### 2. 关键代码逻辑

#### 2.1 Props 和回调

```typescript
interface ChatMessageProps {
  message: ChatBubble
  type: 'ai-general' | 'ai-exercise' | 'ai-textbook' | 'teacher'
  isSelected?: boolean
  isSelectionMode?: boolean
  messageIndex?: number
  onToggleSelection?: (messageId: string) => void
  onMessageClick?: (message: ChatBubble) => void
  onForwardMessage?: (message: ChatBubble) => void
  onEnterMultiSelect?: () => void
  onEditMessage?: (message: ChatBubble) => void
  onRetryMessage?: (messageId: string) => void
}

const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  type,
  isSelected = false,
  isSelectionMode = false,
  messageIndex = 0,
  onToggleSelection,
  onMessageClick,
  onForwardMessage,
  onEnterMultiSelect,
  onEditMessage,
  onRetryMessage,
}) => {
  // 组件实现
}
```

#### 2.2 消息渲染逻辑

```typescript
// 渲染消息内容
const renderMessageContent = useCallback(() => {
  if (message.messageType === 'image' && message.imageData) {
    return <ImageMessage imageData={message.imageData} />
  }
  
  if (message.messageType === 'voice' && message.voiceData) {
    return <VoiceMessage voiceData={message.voiceData} />
  }
  
  // 文本消息或 Markdown
  return (
    <Markdown style={markdownStyles}>
      {message.content}
    </Markdown>
  )
}, [message])
```

#### 2.3 长按交互逻辑

```typescript
const [showActionMenu, setShowActionMenu] = useState(false)
const [menuAnchor, setMenuAnchor] = useState({ x: 0, y: 0 })

const handleLongPressStateChange = useCallback(({ nativeEvent }) => {
  if (nativeEvent.state === State.ACTIVE && !isSelectionMode) {
    // 计算菜单位置
    const { pageX, pageY } = nativeEvent
    setMenuAnchor({ x: pageX, y: pageY })
    setShowActionMenu(true)
  }
}, [isSelectionMode])

return (
  <LongPressGestureHandler
    onHandlerStateChange={handleLongPressStateChange}
    minDurationMs={400}
  >
    <View>
      {/* 消息内容 */}
    </View>
  </LongPressGestureHandler>
)
```

#### 2.4 消息操作逻辑

```typescript
// 复制消息内容
const handleCopy = useCallback(async () => {
  try {
    const textContent = extractPlainText(message.content)
    await Clipboard.setString(textContent)
    Alert.alert('成功', '消息已复制到剪贴板')
    setShowActionMenu(false)
  } catch (error) {
    console.error('复制失败:', error)
    Alert.alert('错误', '复制失败')
  }
}, [message.content])

// 重试消息
const handleRetry = useCallback(async () => {
  if (!message.canRetry || !onRetryMessage) return
  
  try {
    await onRetryMessage(message.id)
    setShowActionMenu(false)
  } catch (error) {
    console.error('重试失败:', error)
    Alert.alert('错误', '重试失败')
  }
}, [message, onRetryMessage])
```

## 🔄 迁移到 React Native

### 1. 等价实现

#### 1.1 组件结构
- **当前实现**：Vue 3 Composition API + Quasar UI
- **React Native 实现**：React Native 组件 + React Native Paper

#### 1.2 核心差异

| Vue 功能 | React Native 实现 |
|---------|------------------|
| `<template>` | `<View>`, `<Text>`, `<TouchableOpacity>` |
| `v-if` | `{condition && <Component />}` |
| `@click` | `<TouchableOpacity onPress>` |
| `@touchstart` | `<LongPressGestureHandler>` |
| `computed` | `useMemo` |
| `ref` | `useRef`, `useState` |
| `watch` | `useEffect` |

### 2. 需要的第三方库

```json
{
  "react-native": "^0.72.0",
  "react-native-paper": "^5.0.0",
  "react-native-gesture-handler": "^2.0.0",
  "@react-native-community/clipboard": "^1.5.0",
  "react-native-markdown-display": "^7.0.0"
}
```

### 3. 迁移步骤

1. **创建基础组件结构**
   - 定义 Props 接口
   - 创建基础布局（用户消息/AI 消息）

2. **实现消息渲染**
   - 文本消息渲染（Markdown）
   - 图片消息渲染
   - 语音消息渲染

3. **实现长按手势**
   - 使用 `LongPressGestureHandler`
   - 实现操作菜单

4. **实现消息操作**
   - 复制功能
   - 转发功能
   - 编辑功能
   - 重试功能

5. **实现选择模式**
   - 显示复选框
   - 高亮选中状态

### 4. 注意事项

#### 4.1 样式迁移
- Vue 的 `scoped` 样式需要转换为 React Native 的 `StyleSheet`
- CSS 选择器需要改为样式对象
- 响应式布局使用 Flexbox

#### 4.2 事件处理差异
- React Native 使用 `onPress`、`onLongPress` 而不是 `@click`、`@touchstart`
- 触摸事件需要使用 `react-native-gesture-handler` 库

#### 4.3 Markdown 渲染
- 使用 `react-native-markdown-display` 库
- 注意样式自定义
- 考虑性能优化

#### 4.4 长按手势
- 使用 `react-native-gesture-handler` 库
- 注意手势冲突处理
- iOS 和 Android 行为可能不同

## 📝 迁移代码示例

### Vue 实现

```vue
<template>
  <div class="message-item" @click="handleClick">
    <div v-if="message.sender !== 'user'" class="ai-message">
      <div class="ai-avatar">
        <q-avatar :icon="avatarIcon" />
      </div>
      <div class="ai-content">
        <div class="ai-bubble">
          <div v-html="renderedContent"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const renderedContent = computed(() => {
  return renderMessageContent(props.message.content)
})

const handleClick = () => {
  emit('message-click', props.message)
}
</script>
```

### React Native 实现

```typescript
const ChatMessage: React.FC<ChatMessageProps> = ({ message, onMessageClick }) => {
  const renderedContent = useMemo(() => {
    return renderMessageContent(message.content)
  }, [message.content])
  
  const handlePress = useCallback(() => {
    onMessageClick?.(message)
  }, [message, onMessageClick])
  
  if (message.sender !== 'user') {
    return (
      <TouchableOpacity style={styles.messageItem} onPress={handlePress}>
        <View style={styles.aiMessage}>
          <Avatar.Icon icon={avatarIcon} size={36} />
          <View style={styles.aiContent}>
            <View style={styles.aiBubble}>
              <Markdown style={markdownStyles}>
                {renderedContent}
              </Markdown>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    )
  }
  
  // 用户消息布局...
}

const styles = StyleSheet.create({
  messageItem: {
    marginBottom: 20,
    width: '100%',
  },
  aiMessage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
  },
  aiContent: {
    flex: 1,
    maxWidth: '80%',
  },
  aiBubble: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 12,
  },
})
```

## ⚠️ 迁移风险

### 高风险项

1. **Markdown 渲染**：
   - **风险**：`react-native-markdown-display` 可能不支持所有 Markdown 特性
   - **解决方案**：使用 `react-native-webview` 渲染 HTML，或使用支持度更高的库
   - **影响**：部分 Markdown 语法可能无法正确渲染

2. **长按手势**：
   - **风险**：React Native 的长按手势与 Web 端行为不同
   - **解决方案**：使用 `react-native-gesture-handler` 库，调整 `minDurationMs` 参数
   - **影响**：用户体验可能略有差异

### 中风险项

1. **样式迁移**：
   - **风险**：CSS 样式需要完全重写为 StyleSheet
   - **解决方案**：逐步迁移样式，使用 React Native 支持的样式属性
   - **影响**：样式可能不完全一致

2. **剪贴板操作**：
   - 需要使用 `@react-native-community/clipboard` 库
   - 需要处理权限问题（Android）

## 🧪 测试要点

### 功能测试

1. **消息展示测试**：
   - ✅ 文本消息正确渲染 Markdown
   - ✅ 语音消息正确显示播放器
   - ✅ 图片消息正确显示图片
   - ✅ 流式消息正确更新内容
   - ✅ 错误消息正确显示错误信息和重试按钮

2. **交互测试**：
   - ✅ 点击消息触发正确事件
   - ✅ 长按消息显示操作菜单
   - ✅ 操作菜单项功能正常（复制、转发、编辑、多选）
   - ✅ 重试按钮功能正常

3. **选择模式测试**：
   - ✅ 选择模式下显示复选框
   - ✅ 点击消息切换选中状态
   - ✅ 已选消息高亮显示

4. **样式测试**：
   - ✅ 用户消息和 AI 消息样式正确
   - ✅ 响应式布局适配不同屏幕

## 📚 参考资源

### 相关文档
- [React Native Paper 文档](https://callstack.github.io/react-native-paper/)
- [React Native Gesture Handler 文档](https://docs.swmansion.com/react-native-gesture-handler/)
- [React Native Markdown Display 文档](https://github.com/iamacup/react-native-markdown-display)

### 相关文件
- `src/screens/ChatScreen.tsx` - 父组件，使用 ChatMessage
- `src/stores/aiGeneralChatStore.ts` - Store 实现
- `src/types/chat.ts` - 聊天相关类型定义

---

**文档版本**：v1.0  
**创建日期**：2025-01-03  
**维护者**：开发团队

## 📋 概述

**文件路径**：`src/components/chat/ChatMessage.tsx`  
**文件类型**：`React Native Component`  
**主要职责**：聊天消息渲染组件，负责展示用户和 AI/老师发送的各种类型消息（文本、语音、图片），并支持消息交互操作（复制、转发、编辑、多选、重试等）

## 🎯 功能需求

### 1. 核心功能

#### 1.1 消息展示
- **消息类型支持**：
  - 文本消息（支持 Markdown 渲染）
  - 语音消息（使用 `VoiceMessage` 组件）
  - 图片消息（使用 `ImageMessage` 组件）
- **流式消息显示**：
  - 实时更新消息内容
  - 显示打字机效果
  - 支持流式渲染过程中的 Markdown 渲染
- **错误消息处理**：
  - 显示错误消息内容
  - 显示重试次数（最多 3 次）
  - 提供重试按钮（仅在 `canRetry` 为 true 时显示）

#### 1.2 消息交互
- **点击交互**：
  - 普通模式：点击消息触发 `onMessageClick` 回调
  - 选择模式：点击消息切换选中状态，触发 `onToggleSelection` 回调
- **长按交互**：
  - 长按显示操作菜单（复制、转发、编辑、多选）
  - 使用 `react-native-gesture-handler` 实现长按
  - 点击外部区域关闭菜单
- **消息操作**：
  - `复制`：复制消息内容到剪贴板
  - `转发`：转发消息到老师对话（仅 AI 消息可用）
  - `编辑`：编辑用户消息
  - `多选`：进入多选模式，支持批量选择消息
  - `重试`：重新发送失败的消息（仅错误消息可用）

#### 1.3 消息状态管理
- **选择状态**：
  - 支持多选模式（`isSelectionMode`）
  - 显示复选框（选择模式下）
  - 高亮显示已选消息
- **加载状态**：
  - 显示重试加载状态（旋转动画）
  - 显示流式消息生成状态

#### 1.4 消息样式
- **用户消息样式**：
  - 右侧对齐，蓝色渐变背景
  - 用户头像在右侧
  - 气泡样式带右侧小三角
- **AI/老师消息样式**：
  - 左侧对齐，浅灰色背景
  - AI 头像在左侧（根据类型显示不同图标）
  - 气泡样式带左侧小三角
- **响应式布局**：
  - 适配不同屏幕尺寸
  - 消息气泡最大宽度 80%

### 2. 功能边界

#### 2.1 负责的功能
- ✅ 消息内容的渲染和展示
- ✅ 消息交互操作（点击、长按、选择）
- ✅ 消息操作菜单的显示和交互
- ✅ 消息样式和布局
- ✅ Markdown 内容的渲染
- ✅ 消息状态的视觉反馈

#### 2.2 不负责的功能
- ❌ 消息数据的获取和存储（由 Store 负责）
- ❌ 消息发送逻辑（由父组件和 Store 负责）
- ❌ 聊天会话管理（由 ChatScreen 组件负责）
- ❌ 图片选择器（由原生模块负责）
- ❌ 语音录制（由原生模块负责）
- ❌ 流式消息数据的接收（由 Store 负责）

## 🔧 技术实现

### 1. 依赖关系

#### 1.1 导入依赖

```typescript
import React, { useMemo, useRef, useState, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native'
import { Avatar, Menu, Button } from 'react-native-paper'
import { LongPressGestureHandler, State } from 'react-native-gesture-handler'
import * as Clipboard from '@react-native-community/clipboard'
import Markdown from 'react-native-markdown-display'
import type { ChatBubble } from '../../types'
```

#### 1.2 被依赖
- `ChatScreen.tsx`：使用 `ChatMessage` 组件渲染消息列表

### 2. 关键代码逻辑

#### 2.1 Props 和回调

```typescript
interface ChatMessageProps {
  message: ChatBubble
  type: 'ai-general' | 'ai-exercise' | 'ai-textbook' | 'teacher'
  isSelected?: boolean
  isSelectionMode?: boolean
  messageIndex?: number
  onToggleSelection?: (messageId: string) => void
  onMessageClick?: (message: ChatBubble) => void
  onForwardMessage?: (message: ChatBubble) => void
  onEnterMultiSelect?: () => void
  onEditMessage?: (message: ChatBubble) => void
  onRetryMessage?: (messageId: string) => void
}

const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  type,
  isSelected = false,
  isSelectionMode = false,
  messageIndex = 0,
  onToggleSelection,
  onMessageClick,
  onForwardMessage,
  onEnterMultiSelect,
  onEditMessage,
  onRetryMessage,
}) => {
  // 组件实现
}
```

#### 2.2 消息渲染逻辑

```typescript
// 渲染消息内容
const renderMessageContent = useCallback(() => {
  if (message.messageType === 'image' && message.imageData) {
    return <ImageMessage imageData={message.imageData} />
  }
  
  if (message.messageType === 'voice' && message.voiceData) {
    return <VoiceMessage voiceData={message.voiceData} />
  }
  
  // 文本消息或 Markdown
  return (
    <Markdown style={markdownStyles}>
      {message.content}
    </Markdown>
  )
}, [message])
```

#### 2.3 长按交互逻辑

```typescript
const [showActionMenu, setShowActionMenu] = useState(false)
const [menuAnchor, setMenuAnchor] = useState({ x: 0, y: 0 })

const handleLongPressStateChange = useCallback(({ nativeEvent }) => {
  if (nativeEvent.state === State.ACTIVE && !isSelectionMode) {
    // 计算菜单位置
    const { pageX, pageY } = nativeEvent
    setMenuAnchor({ x: pageX, y: pageY })
    setShowActionMenu(true)
  }
}, [isSelectionMode])

return (
  <LongPressGestureHandler
    onHandlerStateChange={handleLongPressStateChange}
    minDurationMs={400}
  >
    <View>
      {/* 消息内容 */}
    </View>
  </LongPressGestureHandler>
)
```

#### 2.4 消息操作逻辑

```typescript
// 复制消息内容
const handleCopy = useCallback(async () => {
  try {
    const textContent = extractPlainText(message.content)
    await Clipboard.setString(textContent)
    Alert.alert('成功', '消息已复制到剪贴板')
    setShowActionMenu(false)
  } catch (error) {
    console.error('复制失败:', error)
    Alert.alert('错误', '复制失败')
  }
}, [message.content])

// 重试消息
const handleRetry = useCallback(async () => {
  if (!message.canRetry || !onRetryMessage) return
  
  try {
    await onRetryMessage(message.id)
    setShowActionMenu(false)
  } catch (error) {
    console.error('重试失败:', error)
    Alert.alert('错误', '重试失败')
  }
}, [message, onRetryMessage])
```

## 🔄 迁移到 React Native

### 1. 等价实现

#### 1.1 组件结构
- **当前实现**：Vue 3 Composition API + Quasar UI
- **React Native 实现**：React Native 组件 + React Native Paper

#### 1.2 核心差异

| Vue 功能 | React Native 实现 |
|---------|------------------|
| `<template>` | `<View>`, `<Text>`, `<TouchableOpacity>` |
| `v-if` | `{condition && <Component />}` |
| `@click` | `<TouchableOpacity onPress>` |
| `@touchstart` | `<LongPressGestureHandler>` |
| `computed` | `useMemo` |
| `ref` | `useRef`, `useState` |
| `watch` | `useEffect` |

### 2. 需要的第三方库

```json
{
  "react-native": "^0.72.0",
  "react-native-paper": "^5.0.0",
  "react-native-gesture-handler": "^2.0.0",
  "@react-native-community/clipboard": "^1.5.0",
  "react-native-markdown-display": "^7.0.0"
}
```

### 3. 迁移步骤

1. **创建基础组件结构**
   - 定义 Props 接口
   - 创建基础布局（用户消息/AI 消息）

2. **实现消息渲染**
   - 文本消息渲染（Markdown）
   - 图片消息渲染
   - 语音消息渲染

3. **实现长按手势**
   - 使用 `LongPressGestureHandler`
   - 实现操作菜单

4. **实现消息操作**
   - 复制功能
   - 转发功能
   - 编辑功能
   - 重试功能

5. **实现选择模式**
   - 显示复选框
   - 高亮选中状态

### 4. 注意事项

#### 4.1 样式迁移
- Vue 的 `scoped` 样式需要转换为 React Native 的 `StyleSheet`
- CSS 选择器需要改为样式对象
- 响应式布局使用 Flexbox

#### 4.2 事件处理差异
- React Native 使用 `onPress`、`onLongPress` 而不是 `@click`、`@touchstart`
- 触摸事件需要使用 `react-native-gesture-handler` 库

#### 4.3 Markdown 渲染
- 使用 `react-native-markdown-display` 库
- 注意样式自定义
- 考虑性能优化

#### 4.4 长按手势
- 使用 `react-native-gesture-handler` 库
- 注意手势冲突处理
- iOS 和 Android 行为可能不同

## 📝 迁移代码示例

### Vue 实现

```vue
<template>
  <div class="message-item" @click="handleClick">
    <div v-if="message.sender !== 'user'" class="ai-message">
      <div class="ai-avatar">
        <q-avatar :icon="avatarIcon" />
      </div>
      <div class="ai-content">
        <div class="ai-bubble">
          <div v-html="renderedContent"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const renderedContent = computed(() => {
  return renderMessageContent(props.message.content)
})

const handleClick = () => {
  emit('message-click', props.message)
}
</script>
```

### React Native 实现

```typescript
const ChatMessage: React.FC<ChatMessageProps> = ({ message, onMessageClick }) => {
  const renderedContent = useMemo(() => {
    return renderMessageContent(message.content)
  }, [message.content])
  
  const handlePress = useCallback(() => {
    onMessageClick?.(message)
  }, [message, onMessageClick])
  
  if (message.sender !== 'user') {
    return (
      <TouchableOpacity style={styles.messageItem} onPress={handlePress}>
        <View style={styles.aiMessage}>
          <Avatar.Icon icon={avatarIcon} size={36} />
          <View style={styles.aiContent}>
            <View style={styles.aiBubble}>
              <Markdown style={markdownStyles}>
                {renderedContent}
              </Markdown>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    )
  }
  
  // 用户消息布局...
}

const styles = StyleSheet.create({
  messageItem: {
    marginBottom: 20,
    width: '100%',
  },
  aiMessage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
  },
  aiContent: {
    flex: 1,
    maxWidth: '80%',
  },
  aiBubble: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 12,
  },
})
```

## ⚠️ 迁移风险

### 高风险项

1. **Markdown 渲染**：
   - **风险**：`react-native-markdown-display` 可能不支持所有 Markdown 特性
   - **解决方案**：使用 `react-native-webview` 渲染 HTML，或使用支持度更高的库
   - **影响**：部分 Markdown 语法可能无法正确渲染

2. **长按手势**：
   - **风险**：React Native 的长按手势与 Web 端行为不同
   - **解决方案**：使用 `react-native-gesture-handler` 库，调整 `minDurationMs` 参数
   - **影响**：用户体验可能略有差异

### 中风险项

1. **样式迁移**：
   - **风险**：CSS 样式需要完全重写为 StyleSheet
   - **解决方案**：逐步迁移样式，使用 React Native 支持的样式属性
   - **影响**：样式可能不完全一致

2. **剪贴板操作**：
   - 需要使用 `@react-native-community/clipboard` 库
   - 需要处理权限问题（Android）

## 🧪 测试要点

### 功能测试

1. **消息展示测试**：
   - ✅ 文本消息正确渲染 Markdown
   - ✅ 语音消息正确显示播放器
   - ✅ 图片消息正确显示图片
   - ✅ 流式消息正确更新内容
   - ✅ 错误消息正确显示错误信息和重试按钮

2. **交互测试**：
   - ✅ 点击消息触发正确事件
   - ✅ 长按消息显示操作菜单
   - ✅ 操作菜单项功能正常（复制、转发、编辑、多选）
   - ✅ 重试按钮功能正常

3. **选择模式测试**：
   - ✅ 选择模式下显示复选框
   - ✅ 点击消息切换选中状态
   - ✅ 已选消息高亮显示

4. **样式测试**：
   - ✅ 用户消息和 AI 消息样式正确
   - ✅ 响应式布局适配不同屏幕

## 📚 参考资源

### 相关文档
- [React Native Paper 文档](https://callstack.github.io/react-native-paper/)
- [React Native Gesture Handler 文档](https://docs.swmansion.com/react-native-gesture-handler/)
- [React Native Markdown Display 文档](https://github.com/iamacup/react-native-markdown-display)

### 相关文件
- `src/screens/ChatScreen.tsx` - 父组件，使用 ChatMessage
- `src/stores/aiGeneralChatStore.ts` - Store 实现
- `src/types/chat.ts` - 聊天相关类型定义

---

**文档版本**：v1.0  
**创建日期**：2025-01-03  
**维护者**：开发团队
