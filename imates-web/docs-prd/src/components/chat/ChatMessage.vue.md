# ChatMessage.vue PRD 文档

## 📋 概述

**文件路径**：`src/components/chat/ChatMessage.vue`  
**文件类型**：`Vue 3 组件（Composition API）`  
**主要职责**：聊天消息渲染组件，负责展示用户和 AI/老师发送的各种类型消息（文本、语音、图片、聊天记录），并支持消息交互操作（复制、转发、编辑、多选、重试、点赞、点踩等）

## 🎯 功能需求

### 1. 核心功能

#### 1.1 消息展示
- **多类型消息支持**：
  - `文本消息`：支持 Markdown 渲染、LaTeX 数学公式渲染（MathJax）
  - `语音消息`：使用 `VoiceMessage` 组件展示语音播放器
  - `图片消息`：使用 `ImageMessage` 组件展示图片（支持 base64 显示）
  - `聊天记录`：使用 `ChatRecordCard` 组件展示转发的聊天记录卡片
- **流式消息显示**：
  - 使用 `StreamingMessage` 组件实现打字机效果
  - 支持实时更新消息内容
  - 支持流式渲染过程中的 MathJax 渲染
- **错误消息处理**：
  - 显示错误消息内容
  - 显示重试次数（最多 3 次）
  - 提供重试按钮（仅在 `canRetry` 为 true 时显示）

#### 1.2 消息交互
- **点击交互**：
  - 普通模式：点击消息触发 `message-click` 事件
  - 选择模式：点击消息切换选中状态，触发 `toggle-selection` 事件
- **长按交互**：
  - 支持触摸长按（400ms）和鼠标长按（500ms）
  - 长按显示操作菜单（复制、转发、编辑、多选）
  - 菜单位置根据气泡位置自动调整（上方/下方）
  - 点击外部区域或菜单项自动关闭菜单
- **消息操作**：
  - `复制`：复制消息内容到剪贴板（支持纯文本提取）
  - `转发`：转发消息到老师对话（仅 AI 消息可用）
  - `编辑`：编辑用户消息（首个消息不可编辑）
  - `多选`：进入多选模式，支持批量选择消息
  - `重试`：重新发送失败的消息（仅错误消息可用）
  - `刷新`：重新生成 AI 消息（基于前一条用户消息）
  - `点赞`：点赞 AI 消息（与点踩互斥）
  - `点踩`：点踩 AI 消息（与点赞互斥）

#### 1.3 消息状态管理
- **选择状态**：
  - 支持多选模式（`isSelectionMode`）
  - 显示复选框（选择模式下）
  - 高亮显示已选消息
- **加载状态**：
  - 显示重试加载状态（旋转动画）
  - 显示流式消息生成状态
- **交互状态**：
  - 点赞/点踩状态显示（高亮按钮）
  - 错误消息重试状态

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
  - 支持深色模式
  - 适配不同屏幕尺寸
  - 消息气泡最大宽度 80%

### 2. 功能边界

#### 2.1 负责的功能
- ✅ 消息内容的渲染和展示
- ✅ 消息交互操作（点击、长按、选择）
- ✅ 消息操作菜单的显示和交互
- ✅ 消息样式和布局
- ✅ MathJax 数学公式的渲染（通过工具函数）
- ✅ Markdown 内容的渲染（通过 composable）
- ✅ 懒加载渲染（Intersection Observer）
- ✅ 消息状态的视觉反馈

#### 2.2 不负责的功能
- ❌ 消息数据的获取和存储（由 Store 负责）
- ❌ 消息发送逻辑（由父组件和 Store 负责）
- ❌ 聊天会话管理（由 ChatView 组件负责）
- ❌ 图片选择器（由 ImagePicker 组件负责）
- ❌ 语音录制（由 VoiceRecorder 组件负责）
- ❌ 流式消息数据的接收（由 Store 负责）

## 🔧 技术实现

### 1. 依赖关系

#### 1.1 导入依赖

```typescript
// Vue 核心
import { computed, nextTick, ref, onUnmounted, type ComponentPublicInstance, type Ref } from 'vue'

// UI 框架
import { useQuasar } from 'quasar'

// 工具函数
import { MathJaxUtils } from '../../utils/math/mathjax'
import { useMessageRenderer } from '../../composables/useMessageRenderer'
import { useLazyMessageRender } from '../../utils/render/lazy-message-renderer'

// 状态管理
import { useAiExerciseChatStore } from '../../stores/aiExerciseChatStore'
import { useAiGeneralChatStore } from '../../stores/aiGeneralChatStore'
import { useAiTextbookChatStore } from '../../stores/aiTextbookChatStore'
import { useTeacherChatStore } from '../../stores/teacherChatStore'
import { useQuestionStore } from '../../stores/questionStore'
import { useUserStore } from '../../stores/userStore'

// 子组件
import VoiceMessage from './VoiceMessage.vue'
import ImageMessage from './ImageMessage.vue'
import StreamingMessage from './StreamingMessage.vue'
import ChatRecordCard from './ChatRecordCard.vue'

// 类型定义
import type { ChatBubble } from '../../types'
import type { ChatMessageProps } from '../../types'
```

#### 1.2 被依赖
- `ChatView.vue`：使用 `ChatMessage` 组件渲染消息列表
  - 传递 Props：`message`、`type`、`isSelected`、`isSelectionMode`、`messageIndex`
  - 监听事件：`toggle-selection`、`message-click`、`forward-message`、`enter-multi-select`、`edit-message`

### 2. 关键代码逻辑

#### 2.1 Props 和 Emits

```typescript
// Props 定义
const props = withDefaults(defineProps<ChatMessageProps>(), {
  isSelected: false,
  isSelectionMode: false,
  messageIndex: 0,
})

// Emits 定义
const emit = defineEmits<{
  'toggle-selection': [messageId: string]
  'message-click': [message: ChatBubble]
  'forward-message': [message: ChatBubble]
  'enter-multi-select': []
  'edit-message': [message: ChatBubble]
}>()
```

#### 2.2 消息渲染逻辑

```typescript
// 使用 composable 渲染消息内容（支持 Markdown 和 LaTeX）
const { renderMessageContent } = useMessageRenderer()

// 计算渲染后的消息内容
const renderedContent = computed(() => {
  const rendered = renderMessageContent(props.message.content)
  return rendered
})

// 懒加载渲染（Intersection Observer）
const { elementRef: messageElementRef } = useLazyMessageRender({
  rootMargin: '100px',
  threshold: 0.1
})

// MathJax 渲染（延迟渲染，使用懒加载模式）
const setMessageRef = (el: Element | ComponentPublicInstance | null, lazyRef?: Ref<HTMLElement | null>) => {
  if (el && el instanceof HTMLElement) {
    if (lazyRef) {
      lazyRef.value = el
    }
    nextTick(() => {
      MathJaxUtils.renderMath(el, true)
    })
  }
}
```

#### 2.3 长按交互逻辑

```typescript
// 触摸长按（400ms）
const handleTouchStart = (event: TouchEvent) => {
  if (props.isSelectionMode) return
  
  touchStartTime.value = Date.now()
  longPressTimer.value = window.setTimeout(() => {
    if (!props.isSelectionMode) {
      isLongPressing.value = true
      calculateBubblePosition()
      showActionMenu.value = true
    }
  }, 400)
}

// 鼠标长按（500ms）
const handleMouseDown = (event: MouseEvent) => {
  if (props.isSelectionMode) return
  
  mouseDownTime.value = Date.now()
  longPressTimer.value = window.setTimeout(() => {
    if (!props.isSelectionMode) {
      isLongPressing.value = true
      calculateBubblePosition()
      showActionMenu.value = true
    }
  }, 500)
}

// 动态计算菜单位置
const calculateBubblePosition = () => {
  if (!bubbleTarget.value) return
  
  const bubbleRect = bubbleTarget.value.getBoundingClientRect()
  const viewportHeight = window.innerHeight
  const spaceBelow = viewportHeight - bubbleRect.bottom
  const spaceAbove = bubbleRect.top
  
  if (spaceBelow >= estimatedMenuHeight || spaceBelow > spaceAbove) {
    // 在下方显示
    anchor.value = 'top middle'
    self.value = 'bottom middle'
  } else {
    // 在上方显示
    anchor.value = 'bottom middle'
    self.value = 'top middle'
  }
}
```

#### 2.4 消息操作逻辑

```typescript
// 重试消息（根据类型调用不同的 Store 方法）
const handleRetry = async () => {
  if (!props.message.canRetry || isRetrying.value) return
  
  try {
    isRetrying.value = true
    const subject = userStore.subject as 'MATH' | 'BIOLOGY'
    
    switch (props.type) {
      case 'ai-exercise':
        await aiExerciseStore.retryMessage(/* ... */)
        break
      case 'ai-general':
        await aiGeneralStore.retryMessage(/* ... */)
        break
      case 'ai-textbook':
        await aiTextbookStore.retryAiMessage(/* ... */)
        break
      case 'teacher':
        await teacherStore.retryTeacherMessage(/* ... */)
        break
    }
  } catch (error) {
    console.error('重发失败:', error)
  } finally {
    isRetrying.value = false
  }
}

// 刷新消息（重新生成）
const handleRefresh = async () => {
  // 找到前一条用户消息
  // 删除当前 AI 消息
  // 使用前一条用户消息重新发送
}

// 复制消息内容
const handleCopy = async () => {
  // 提取纯文本内容
  // 使用 navigator.clipboard API
  // 降级方案：使用 document.execCommand
}
```

#### 2.5 功能按钮配置

```typescript
// 根据消息类型和状态动态生成功能按钮
const actionButtons = computed(() => {
  const buttons: Array<{...}> = []
  
  // 欢迎消息不显示功能按钮
  if (props.message.id?.startsWith('welcome_')) {
    return buttons
  }
  
  const isUser = props.message.sender === 'user'
  const canShow = isUser || !props.message.isStreaming
  
  if (!canShow) {
    return buttons
  }
  
  // 复制按钮（所有消息）
  buttons.push({
    icon: 'content_copy',
    title: '复制',
    handler: handleCopy,
    show: true
  })
  
  // 编辑按钮（用户消息且可编辑）
  if (isUser && canEdit.value) {
    buttons.push({...})
  }
  
  // 转发按钮（AI 消息）
  if (canForward.value) {
    buttons.push({...})
  }
  
  // AI 消息专属按钮
  if (!isUser) {
    buttons.push({ icon: 'refresh', ... })  // 刷新
    buttons.push({ icon: 'thumb_up', ... })  // 点赞
    buttons.push({ icon: 'thumb_down', ... }) // 点踩
  }
  
  return buttons
})
```

### 3. 性能优化

#### 3.1 懒加载渲染
- 使用 `useLazyMessageRender` composable 实现 Intersection Observer
- 只在消息进入视口时渲染 MathJax
- `rootMargin: '100px'` 提前 100px 开始渲染

#### 3.2 消息渲染缓存
- `useMessageRenderer` composable 内部使用缓存（最多 100 条）
- 避免重复渲染相同内容

#### 3.3 事件处理优化
- 触摸/鼠标事件中检查公式元素，阻止事件传播
- 防止在滚动时误触发长按
- 移动距离超过 10px 时取消长按

## 🔄 迁移到 React Native

### 1. 等价实现

#### 1.1 组件结构
- **当前实现**：Vue 3 Composition API + Quasar UI
- **React Native 实现**：React Native 组件 + React Native Paper / NativeBase

#### 1.2 核心功能映射

| Vue 功能 | React Native 实现 |
|---------|------------------|
| `<template>` | `<View>`, `<Text>`, `<TouchableOpacity>` |
| `v-if` / `v-else` | 条件渲染 `{condition && <Component />}` |
| `v-for` | `{items.map(item => <Component key={item.id} />)}` |
| `@click` | `<TouchableOpacity onPress={handler}>` |
| `@touchstart` / `@touchmove` | `<View onTouchStart={handler}>` |
| `computed` | `useMemo` |
| `ref` | `useRef`, `useState` |
| `watch` | `useEffect` |
| Quasar 组件 | React Native Paper / NativeBase |

### 2. 需要的第三方库

```json
{
  "react-native": "^0.72.0",
  "react-native-paper": "^5.0.0",        // UI 组件库
  "react-native-gesture-handler": "^2.0.0",  // 手势处理
  "react-native-reanimated": "^3.0.0",      // 动画库
  "react-native-vector-icons": "^10.0.0",   // 图标库
  "@react-native-community/clipboard": "^1.5.0",  // 剪贴板
  "react-native-webview": "^13.0.0",        // WebView（用于 Markdown 渲染）
  "react-native-markdown-display": "^7.0.0", // Markdown 渲染
  "react-native-katex": "^0.1.0"            // LaTeX 渲染（或使用 WebView）
}
```

### 3. 迁移步骤

#### 步骤 1：创建基础组件结构

```typescript
// ChatMessage.tsx
import React, { useMemo, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Card, Avatar, Button, Menu } from 'react-native-paper'
import * as Clipboard from '@react-native-community/clipboard'

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
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
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
}) => {
  // 状态管理
  const [showActionMenu, setShowActionMenu] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [isLiked, setIsLiked] = useState(false)
  const [isDisliked, setIsDisliked] = useState(false)
  
  // 长按定时器
  const longPressTimer = useRef<NodeJS.Timeout | null>(null)
  
  // 渲染消息内容
  const renderedContent = useMemo(() => {
    // 使用 Markdown 渲染库
    return renderMessageContent(message.content)
  }, [message.content])
  
  // 处理点击
  const handlePress = () => {
    if (isSelectionMode) {
      onToggleSelection?.(message.id)
    } else {
      onMessageClick?.(message)
    }
  }
  
  // 处理长按
  const handleLongPress = () => {
    if (!isSelectionMode) {
      setShowActionMenu(true)
    }
  }
  
  // 处理复制
  const handleCopy = async () => {
    try {
      const textContent = extractPlainText(message.content)
      await Clipboard.setString(textContent)
      // 显示成功提示
    } catch (error) {
      console.error('复制失败:', error)
    }
  }
  
  return (
    <View style={styles.messageItem}>
      {message.sender === 'user' ? (
        // 用户消息布局
        <UserMessageLayout
          message={message}
          renderedContent={renderedContent}
          onPress={handlePress}
          onLongPress={handleLongPress}
        />
      ) : (
        // AI 消息布局
        <AIMessageLayout
          message={message}
          type={type}
          renderedContent={renderedContent}
          isRetrying={isRetrying}
          onPress={handlePress}
          onLongPress={handleLongPress}
          onRetry={handleRetry}
          onRefresh={handleRefresh}
        />
      )}
      
      {/* 操作菜单 */}
      <ActionMenu
        visible={showActionMenu}
        onDismiss={() => setShowActionMenu(false)}
        onCopy={handleCopy}
        onForward={canForward ? () => onForwardMessage?.(message) : undefined}
        onEdit={canEdit ? () => onEditMessage?.(message) : undefined}
        onMultiSelect={() => {
          setShowActionMenu(false)
          onEnterMultiSelect?.()
        }}
      />
    </View>
  )
}
```

#### 步骤 2：实现消息类型渲染

```typescript
// 文本消息渲染
const renderTextMessage = (content: string) => {
  return (
    <Markdown style={markdownStyles}>
      {content}
    </Markdown>
  )
}

// 语音消息渲染
const renderVoiceMessage = (voiceData: VoiceData) => {
  return (
    <VoiceMessage
      filePath={voiceData.filePath}
      duration={voiceData.duration / 1000}
      isUser={message.sender === 'user'}
    />
  )
}

// 图片消息渲染
const renderImageMessage = (imageData: ImageData) => {
  return (
    <ImageMessage
      base64DataUrl={imageData.base64DataUrl}
      width={imageData.width}
      height={imageData.height}
      fileSize={imageData.fileSize}
      isUser={message.sender === 'user'}
      showInfo={true}
    />
  )
}
```

#### 步骤 3：实现长按手势

```typescript
import { LongPressGestureHandler, State } from 'react-native-gesture-handler'

const handleLongPressStateChange = ({ nativeEvent }) => {
  if (nativeEvent.state === State.ACTIVE) {
    handleLongPress()
  }
}

<LongPressGestureHandler
  onHandlerStateChange={handleLongPressStateChange}
  minDurationMs={400}
>
  <View>
    {/* 消息内容 */}
  </View>
</LongPressGestureHandler>
```

#### 步骤 4：实现 MathJax 渲染

**方案 A：使用 WebView（推荐）**

```typescript
import { WebView } from 'react-native-webview'

const MathJaxRenderer = ({ content }) => {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <script src="https://polyfill.io/v3/polyfill.min.js?features=es6"></script>
        <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
      </head>
      <body>
        <div id="content">${content}</div>
        <script>
          window.MathJax = {
            tex: { inlineMath: [['$', '$']], displayMath: [['$$', '$$']] }
          };
          MathJax.typesetPromise([document.getElementById('content')]);
        </script>
      </body>
    </html>
  `
  
  return (
    <WebView
      source={{ html }}
      style={{ height: 200 }}
      scrollEnabled={false}
    />
  )
}
```

**方案 B：使用 react-native-katex（仅支持基本公式）**

```typescript
import Katex from 'react-native-katex'

const MathRenderer = ({ content }) => {
  return (
    <Katex expression={content} />
  )
}
```

### 4. 注意事项

#### 4.1 样式迁移
- Vue 的 `scoped` 样式需要转换为 React Native 的 `StyleSheet`
- CSS 选择器需要改为样式对象
- 响应式布局使用 Flexbox（React Native 默认支持）

#### 4.2 事件处理差异
- React Native 使用 `onPress`、`onLongPress` 而不是 `@click`、`@touchstart`
- 触摸事件需要使用 `react-native-gesture-handler` 库
- 鼠标事件在 React Native 中不存在（仅移动端）

#### 4.3 状态管理
- Vue 的 `ref`、`computed` 需要改为 React 的 `useState`、`useMemo`
- Store 可以使用 Zustand、Redux 或 MobX 替代 Pinia

#### 4.4 性能优化
- React Native 的懒加载使用 `FlatList` 的 `windowSize` 属性
- MathJax 渲染建议使用 WebView（性能较好）
- 长列表使用 `FlatList` 而不是 `ScrollView`

#### 4.5 平台差异
- iOS 和 Android 的触摸行为可能不同，需要测试
- 剪贴板 API 需要使用 `@react-native-community/clipboard`
- 深色模式支持需要使用 `useColorScheme` Hook

## 📝 迁移代码示例

### Vue 实现

```vue
<template>
  <div class="message-item" @click="handleClick" @touchstart="handleTouchStart">
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
import React, { useMemo } from 'react'
import { View, TouchableOpacity, StyleSheet } from 'react-native'
import { Avatar } from 'react-native-paper'
import { Markdown } from 'react-native-markdown-display'

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, onMessageClick }) => {
  const renderedContent = useMemo(() => {
    return renderMessageContent(message.content)
  }, [message.content])
  
  const handlePress = () => {
    onMessageClick?.(message)
  }
  
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
    gap: 12,
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

1. **MathJax 渲染**：
   - **风险**：React Native 不支持直接使用 MathJax，需要使用 WebView 或替代方案
   - **解决方案**：使用 WebView 加载 MathJax，或使用 `react-native-katex`（功能受限）
   - **影响**：可能影响数学公式的渲染效果和性能

2. **长按手势**：
   - **风险**：React Native 的长按手势与 Web 端行为不同，需要调整触发时间和距离判断
   - **解决方案**：使用 `react-native-gesture-handler` 库，调整 `minDurationMs` 参数
   - **影响**：用户体验可能略有差异

3. **Markdown 渲染**：
   - **风险**：`react-native-markdown-display` 可能不支持所有 Markdown 特性
   - **解决方案**：使用 `react-native-webview` 渲染 HTML，或使用支持度更高的库
   - **影响**：部分 Markdown 语法可能无法正确渲染

4. **消息懒加载**：
   - **风险**：React Native 的 Intersection Observer 需要使用第三方库或自定义实现
   - **解决方案**：使用 `FlatList` 的 `windowSize` 和 `removeClippedSubviews` 属性
   - **影响**：性能可能略有下降

5. **样式迁移**：
   - **风险**：CSS 样式需要完全重写为 StyleSheet，某些 CSS 特性不支持
   - **解决方案**：逐步迁移样式，使用 React Native 支持的样式属性
   - **影响**：样式可能不完全一致，需要调整

### 中风险项

1. **剪贴板操作**：
   - 需要使用 `@react-native-community/clipboard` 库
   - 需要处理权限问题（Android）

2. **消息操作菜单**：
   - Quasar 的 `q-popup-proxy` 需要使用 React Native Paper 的 `Menu` 组件
   - 菜单位置计算逻辑需要调整

3. **状态管理集成**：
   - Store 的调用方式需要改为 React Hook 形式
   - 需要处理 Store 的响应式更新

## 🧪 测试要点

### 功能测试

1. **消息展示测试**：
   - ✅ 文本消息正确渲染 Markdown 和 LaTeX
   - ✅ 语音消息正确显示播放器
   - ✅ 图片消息正确显示图片
   - ✅ 聊天记录卡片正确显示
   - ✅ 流式消息正确更新内容
   - ✅ 错误消息正确显示错误信息和重试按钮

2. **交互测试**：
   - ✅ 点击消息触发正确事件
   - ✅ 长按消息显示操作菜单
   - ✅ 操作菜单项功能正常（复制、转发、编辑、多选）
   - ✅ 重试按钮功能正常
   - ✅ 刷新按钮功能正常
   - ✅ 点赞/点踩按钮功能正常

3. **选择模式测试**：
   - ✅ 选择模式下显示复选框
   - ✅ 点击消息切换选中状态
   - ✅ 已选消息高亮显示

4. **样式测试**：
   - ✅ 用户消息和 AI 消息样式正确
   - ✅ 深色模式样式正确
   - ✅ 响应式布局适配不同屏幕

### 边界测试

1. **空内容测试**：
   - 消息内容为空时的处理
   - 消息内容为 null/undefined 时的处理

2. **长内容测试**：
   - 超长文本消息的正确显示和换行
   - 超长 LaTeX 公式的正确渲染

3. **异常情况测试**：
   - 消息数据格式错误时的容错处理
   - 网络错误导致重试失败时的处理
   - MathJax 渲染失败时的降级处理

4. **性能测试**：
   - 大量消息时的渲染性能
   - 流式消息更新时的性能
   - 懒加载是否正常工作

## 📚 参考资源

### 相关文档
- [Vue 3 官方文档](https://vuejs.org/)
- [React Native 官方文档](https://reactnative.dev/)
- [React Native Paper 文档](https://callstack.github.io/react-native-paper/)
- [React Native Gesture Handler 文档](https://docs.swmansion.com/react-native-gesture-handler/)
- [MathJax 官方文档](https://www.mathjax.org/)
- [Markdown It 文档](https://github.com/markdown-it/markdown-it)

### 相关文件
- `src/components/ChatView.vue` - 父组件，使用 ChatMessage
- `src/composables/useMessageRenderer.ts` - 消息渲染工具
- `src/utils/math/mathjax.ts` - MathJax 渲染工具
- `src/utils/render/lazy-message-renderer.ts` - 懒加载渲染工具
- `src/stores/aiExerciseChatStore.ts` - AI 练习对话 Store
- `src/stores/aiGeneralChatStore.ts` - AI 通用对话 Store
- `src/stores/aiTextbookChatStore.ts` - AI 教材对话 Store
- `src/stores/teacherChatStore.ts` - 老师对话 Store
- `src/types/chat.ts` - 聊天相关类型定义

### 相关组件
- `VoiceMessage.vue` - 语音消息组件
- `ImageMessage.vue` - 图片消息组件
- `StreamingMessage.vue` - 流式消息组件
- `ChatRecordCard.vue` - 聊天记录卡片组件

---

**文档版本**：v1.0  
**创建日期**：2025-01-XX  
**最后更新**：2025-01-XX  
**维护者**：开发团队
