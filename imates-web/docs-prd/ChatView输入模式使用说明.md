# ChatView 输入模式使用说明

## 概述

`ChatView` 组件现在支持两种输入模式：

1. **完整输入模式 (full)** - 使用 `ChatInput` 组件，提供完整功能（语音、图片、公式等）
2. **简单输入模式 (simple)** - 使用 `SimpleChatInput` 组件，提供简洁的文本输入界面

## 使用方法

### 1. 完整输入模式（默认）

```vue
<template>
  <ChatView
    type="ai-general"
    input-mode="full"
  />
</template>
```

或者省略 `input-mode`（默认为 `full`）：

```vue
<template>
  <ChatView type="ai-general" />
</template>
```

### 2. 简单输入模式

```vue
<template>
  <ChatView
    type="ai-general"
    input-mode="simple"
  />
</template>
```

## 两种模式对比

| 特性 | 完整输入模式 (ChatInput) | 简单输入模式 (SimpleChatInput) |
|------|------------------------|-------------------------------|
| 文本输入 | ✅ | ✅ |
| 语音输入 | ✅ | ❌ |
| 图片上传 | ✅ | ❌ |
| 公式输入 | ✅ | ❌ |
| 模型选择 | ✅ | ❌ |
| 网络搜索 | ✅ | ❌ |
| 文件上传 | ✅ | ❌ |
| 消息编辑 | ✅ | ❌ |
| 键盘适配 | ✅ | ✅ |
| 适用场景 | 完整对话功能 | 快速问答、简单交互 |

## SimpleChatInput 特性

### 1. 键盘自适应

- **Web 环境**：通过 `focus`/`blur` 事件控制输入区域偏移
- **Android 环境**：监听原生键盘事件 (`keyboard-show`/`keyboard-hide`/`nativeKeyboardClose`)

### 2. 样式特点

- 固定在底部的输入区域
- 圆角输入框 + 圆形发送按钮
- 简洁的视觉设计
- 平滑的过渡动画

### 3. 交互行为

- 回车发送消息
- 发送后自动清空输入框
- 加载状态禁用发送按钮
- 空消息不可发送

## 完整示例

### 示例 1：AI 通用对话（完整模式）

```vue
<template>
  <div class="chat-container">
    <ChatView
      type="ai-general"
      input-mode="full"
      @response="handleResponse"
    />
  </div>
</template>

<script setup lang="ts">
import ChatView from '@/components/ChatView.vue'

const handleResponse = () => {
  console.log('消息发送完成')
}
</script>
```

### 示例 2：拍照搜题对话（简单模式）

```vue
<template>
  <div class="photo-search-container">
    <ChatView
      type="ai-exercise"
      input-mode="simple"
      :current-question-id="currentQuestionId"
      @response="handleResponse"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ChatView from '@/components/ChatView.vue'

const currentQuestionId = ref('12345')

const handleResponse = () => {
  console.log('问题已发送')
}
</script>
```

### 示例 3：动态切换输入模式

```vue
<template>
  <div class="dynamic-chat">
    <q-btn @click="toggleInputMode">
      切换到{{ inputMode === 'full' ? '简单' : '完整' }}模式
    </q-btn>
    
    <ChatView
      type="ai-general"
      :input-mode="inputMode"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ChatView from '@/components/ChatView.vue'

const inputMode = ref<'full' | 'simple'>('full')

const toggleInputMode = () => {
  inputMode.value = inputMode.value === 'full' ? 'simple' : 'full'
}
</script>
```

## Props 说明

### ChatView Props

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `type` | `'ai-general' \| 'ai-exercise' \| 'ai-textbook' \| 'teacher-general' \| 'teacher-exercise'` | 必填 | 对话类型 |
| `inputMode` | `'full' \| 'simple'` | `'full'` | 输入模式 |
| `currentQuestionId` | `string` | - | 当前题目 ID（可选） |
| `resourceId` | `string` | - | 资源 ID（可选） |
| `compressedHeight` | `number` | - | 键盘显示时的压缩高度（可选） |

### SimpleChatInput Props

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `modelValue` | `string` | `''` | 输入内容（v-model） |
| `placeholder` | `string` | `'输入你的问题'` | 占位符文本 |
| `isLoading` | `boolean` | `false` | 加载状态 |

### SimpleChatInput Events

| Event | 参数 | 说明 |
|-------|------|------|
| `update:modelValue` | `value: string` | 输入内容变化 |
| `send` | `message: string` | 发送消息 |
| `focus` | - | 输入框获得焦点 |
| `blur` | - | 输入框失去焦点 |

## 注意事项

1. **模式选择**：
   - 需要完整功能（语音、图片、公式）时使用 `full` 模式
   - 只需要简单文本输入时使用 `simple` 模式

2. **键盘适配**：
   - 两种模式都支持 Android 原生键盘事件
   - Web 环境下使用 focus/blur 控制偏移

3. **样式定制**：
   - `SimpleChatInput` 的样式可以通过修改 `SimpleChatInput.vue` 中的 SCSS 来定制
   - 输入区域高度、颜色、圆角等都可以调整

4. **性能考虑**：
   - `simple` 模式更轻量，适合性能敏感场景
   - `full` 模式功能完整，但组件更复杂

## 技术实现

### 组件结构

```
ChatView.vue
├── ChatInput.vue (完整输入模式)
└── SimpleChatInput.vue (简单输入模式)
```

### 条件渲染逻辑

```vue
<!-- ChatView.vue 中的实现 -->
<slot v-if="!isSelectionMode" name="input">
  <!-- 完整输入模式 -->
  <ChatInput
    v-if="inputMode === 'full'"
    ref="chatInputRef"
    v-model="inputMessage"
    ...
  />
  
  <!-- 简单输入模式 -->
  <SimpleChatInput
    v-else-if="inputMode === 'simple'"
    ref="simpleChatInputRef"
    v-model="inputMessage"
    :is-loading="isLoading"
    @send="sendSimpleMessage"
    ...
  />
</slot>
```

### 消息发送流程

```typescript
// 简单模式发送消息
const sendSimpleMessage = async (message: string) => {
  if (!message.trim() || isLoading.value) {
    return
  }
  
  // 设置 inputMessage 并调用标准发送流程
  inputMessage.value = message
  await sendMessage()
}
```

## 参考

- PhotoSearchView 中的输入区域实现：`src/views/PhotoSearchView.vue` (第 356-400 行)
- ChatInput 完整实现：`src/components/chat/ChatInput.vue`
- SimpleChatInput 实现：`src/components/chat/SimpleChatInput.vue`
